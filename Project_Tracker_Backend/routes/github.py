"""
GitHub Dashboard Routes
Endpoints for project tracking and GitHub statistics
"""
import uuid
from flask import Blueprint, jsonify
from models import db, Project, RefreshJob

github_bp = Blueprint('github', __name__)

# Redis and job queue will be set by app.py
redis_available = False
job_queue = None

def init_redis(available, queue):
    """Initialize Redis connection for this blueprint"""
    global redis_available, job_queue
    redis_available = available
    job_queue = queue


@github_bp.route('/projects', methods=['GET'])
def get_projects():
    """Get all projects with their metrics"""
    projects = Project.query.all()
    return jsonify([project.to_dict() for project in projects])


@github_bp.route('/project/<name>', methods=['GET'])
def get_project(name):
    """Get details for a specific project"""
    project = Project.query.filter_by(name=name).first()
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    return jsonify(project.to_dict())


@github_bp.route('/refresh', methods=['POST'])
def refresh_stats():
    """Manually trigger stats update using background job"""
    from services.github_service import update_project_stats, update_project_stats_async
    
    if not redis_available:
        # Fallback to synchronous update if Redis is not available
        try:
            update_project_stats()
            return jsonify({'message': 'Stats updated successfully (synchronous)'})
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Refresh error: {error_trace}")
            return jsonify({'error': str(e), 'trace': error_trace}), 500
    
    try:
        # Create a new refresh job record
        job_id = str(uuid.uuid4())
        refresh_job = RefreshJob(id=job_id)
        db.session.add(refresh_job)
        db.session.commit()
        
        # Queue the background job
        job = job_queue.enqueue(
            update_project_stats_async,
            job_id,
            job_timeout='30m'
        )
        
        return jsonify({
            'message': 'Refresh job started',
            'job_id': job_id,
            'status': 'queued',
            'check_status_url': f'/api/github/refresh/status/{job_id}'
        }), 202
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@github_bp.route('/refresh/status/<job_id>', methods=['GET'])
def refresh_status(job_id):
    """Check the status of a refresh job"""
    refresh_job = RefreshJob.query.get(job_id)
    if not refresh_job:
        return jsonify({'error': 'Job not found'}), 404
    
    return jsonify(refresh_job.to_dict())


@github_bp.route('/refresh/jobs', methods=['GET'])
def list_refresh_jobs():
    """List recent refresh jobs"""
    jobs = RefreshJob.query.order_by(RefreshJob.started_at.desc()).limit(10).all()
    return jsonify([job.to_dict() for job in jobs])


@github_bp.route('/metrics', methods=['GET'])
def get_overall_metrics():
    """Get overall metrics across all projects"""
    projects = Project.query.all()
    
    if not projects:
        return jsonify({
            'total_projects': 0,
            'total_time_spent_hours': 0,
            'total_loc': 0,
            'total_commits': 0,
            'project_with_most_loc': None,
            'project_with_most_time': None,
            'project_with_most_commits': None,
            'most_common_language': None,
            'average_project_size_kb': 0,
            'total_active_days': 0,
            'total_code_churn': 0,
            'languages_breakdown': {}
        })
    
    # Calculate metrics
    total_projects = len(projects)
    total_time_spent_min = sum(p.time_spent_min or 0 for p in projects)
    total_loc = sum(p.loc or 0 for p in projects)
    total_commits = sum(p.commit_count or 0 for p in projects)
    total_active_days = sum(p.active_days or 0 for p in projects)
    total_code_churn = sum(p.code_churn or 0 for p in projects)
    total_repo_size_kb = sum(p.repository_size_kb or 0 for p in projects)
    
    # Find project with most LOC
    project_with_most_loc = max(projects, key=lambda p: p.loc or 0)
    
    # Find project with most time spent
    project_with_most_time = max(projects, key=lambda p: p.time_spent_min or 0)
    
    # Find project with most commits
    project_with_most_commits = max(projects, key=lambda p: p.commit_count or 0)
    
    # Calculate language statistics
    language_counts = {}
    language_loc = {}
    for project in projects:
        lang = project.primary_language or "Unknown"
        language_counts[lang] = language_counts.get(lang, 0) + 1
        language_loc[lang] = language_loc.get(lang, 0) + (project.loc or 0)
    
    most_common_language = max(language_counts.items(), key=lambda x: x[1])[0] if language_counts else None
    
    # Create languages breakdown
    languages_breakdown = {}
    for lang, count in language_counts.items():
        languages_breakdown[lang] = {
            'project_count': count,
            'total_loc': language_loc[lang],
            'percentage_of_projects': round((count / total_projects) * 100, 1)
        }
    
    return jsonify({
        'total_projects': total_projects,
        'total_time_spent_hours': round(total_time_spent_min / 60, 1),
        'total_time_spent_minutes': round(total_time_spent_min, 1),
        'total_loc': total_loc,
        'total_commits': total_commits,
        'total_active_days': total_active_days,
        'total_code_churn': total_code_churn,
        'average_project_size_kb': round(total_repo_size_kb / total_projects, 1) if total_projects > 0 else 0,
        'project_with_most_loc': {
            'name': project_with_most_loc.name,
            'loc': project_with_most_loc.loc or 0
        },
        'project_with_most_time': {
            'name': project_with_most_time.name,
            'time_spent_minutes': project_with_most_time.time_spent_min or 0,
            'time_spent_hours': round((project_with_most_time.time_spent_min or 0) / 60, 1)
        },
        'project_with_most_commits': {
            'name': project_with_most_commits.name,
            'commits': project_with_most_commits.commit_count or 0
        },
        'most_common_language': {
            'language': most_common_language,
            'project_count': language_counts.get(most_common_language, 0),
            'percentage': round((language_counts.get(most_common_language, 0) / total_projects) * 100, 1)
        },
        'languages_breakdown': languages_breakdown,
        'averages': {
            'loc_per_project': round(total_loc / total_projects, 1) if total_projects > 0 else 0,
            'commits_per_project': round(total_commits / total_projects, 1) if total_projects > 0 else 0,
            'time_per_project_hours': round((total_time_spent_min / 60) / total_projects, 1) if total_projects > 0 else 0,
            'active_days_per_project': round(total_active_days / total_projects, 1) if total_projects > 0 else 0
        }
    })

