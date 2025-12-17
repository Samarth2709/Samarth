import os
import uuid
import redis
from flask import Flask, jsonify
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from rq import Queue
from models import db, Project, RefreshJob
from jobs import update_project_stats, update_project_stats_async

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure CORS with specific origins and comprehensive settings
CORS(app, 
     origins=[
         'http://127.0.0.1:5500',
         'http://localhost:5500', 
         'http://localhost:3000',
         'http://localhost:3001',
         'http://127.0.0.1:3001',
         'https://samarthkumbla.com',
         'https://www.samarthkumbla.com',
         'https://nextjs-portfolio-psi-nine-50.vercel.app'
     ],
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     supports_credentials=True
)

# Redis configuration for background jobs
redis_url = os.getenv('REDIS_URL')
redis_available = False
redis_conn = None
job_queue = None

if redis_url:
    try:
        # Configure Redis connection with SSL settings for Heroku
        if redis_url.startswith('rediss://'):
            redis_conn = redis.from_url(redis_url, ssl_cert_reqs=None)
        else:
            redis_conn = redis.from_url(redis_url)
        
        # Actually test the connection
        redis_conn.ping()
        job_queue = Queue('default', connection=redis_conn)
        redis_available = True
        print("Redis connected successfully")
    except Exception as e:
        print(f"Redis not available: {e}")
        redis_available = False
        redis_conn = None
        job_queue = None
else:
    print("No REDIS_URL configured, using synchronous mode")

# Database configuration
database_url = os.getenv('DATABASE_URL')
if database_url:
    # Heroku PostgreSQL
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    # Local SQLite
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///db.sqlite'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)

# Create database tables on startup (works with gunicorn too)
with app.app_context():
    db.create_all()
    print("Database tables created/verified")

# Handle preflight OPTIONS requests for all API routes
@app.before_request
def handle_preflight():
    from flask import request
    if request.method == "OPTIONS":
        from flask import make_response
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        return response

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    from flask import request
    
    # Get the origin from the request
    origin = request.headers.get('Origin')
    
    # List of allowed origins
    allowed_origins = [
        'http://127.0.0.1:5500',
        'http://localhost:5500', 
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'https://samarthkumbla.com',
        'https://www.samarthkumbla.com'
    ]
    
    # Set CORS headers if origin is allowed
    if origin in allowed_origins:
        response.headers.add('Access-Control-Allow-Origin', origin)
    
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    
    return response

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """Get all projects with their metrics"""
    projects = Project.query.all()
    return jsonify([project.to_dict() for project in projects])

@app.route('/api/project/<name>', methods=['GET'])
def get_project(name):
    """Get details for a specific project"""
    project = Project.query.filter_by(name=name).first()
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    return jsonify(project.to_dict())

@app.route('/api/refresh', methods=['POST'])
def refresh_stats():
    """Manually trigger stats update using background job"""
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
            job_timeout='30m'  # Allow up to 30 minutes for completion
        )
        
        return jsonify({
            'message': 'Refresh job started',
            'job_id': job_id,
            'status': 'queued',
            'check_status_url': f'/api/refresh/status/{job_id}'
        }), 202
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/refresh/status/<job_id>', methods=['GET'])
def refresh_status(job_id):
    """Check the status of a refresh job"""
    refresh_job = RefreshJob.query.get(job_id)
    if not refresh_job:
        return jsonify({'error': 'Job not found'}), 404
    
    return jsonify(refresh_job.to_dict())

@app.route('/api/refresh/jobs', methods=['GET'])
def list_refresh_jobs():
    """List recent refresh jobs"""
    jobs = RefreshJob.query.order_by(RefreshJob.started_at.desc()).limit(10).all()
    return jsonify([job.to_dict() for job in jobs])

@app.route('/api/metrics', methods=['GET'])
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

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

@app.route('/', methods=['GET'])
def index():
    """Basic info about the API"""
    return jsonify({
        'message': 'Project Tracker Backend API',
        'redis_available': redis_available,
        'endpoints': {
            'GET /api/projects': 'List all projects',
            'GET /api/project/<name>': 'Get specific project',
            'GET /api/metrics': 'Get overall metrics across all projects',
            'POST /api/refresh': 'Start refresh job (async if Redis available)',
            'GET /api/refresh/status/<job_id>': 'Check refresh job status',
            'GET /api/refresh/jobs': 'List recent refresh jobs',
            'GET /api/health': 'Health check'
        }
    })



# Initialize scheduler for periodic updates
def init_scheduler():
    scheduler = BackgroundScheduler()
    # Update stats every 24 hours
    scheduler.add_job(
        func=update_project_stats,
        trigger="interval",
        hours=24,
        id='update_stats'
    )
    scheduler.start()
    return scheduler

if __name__ == '__main__':
    with app.app_context():
        # Create database tables
        db.create_all()
        print("Database tables created/updated")
    
    # Start scheduler for periodic updates
    scheduler = init_scheduler()
    print("Scheduler started for periodic updates")
    
    try:
        # Run the Flask app
        app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
    except KeyboardInterrupt:
        scheduler.shutdown()
        print("Scheduler stopped")
