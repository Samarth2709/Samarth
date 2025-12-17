"""
GitHub Service
Handles fetching and processing GitHub repository data
"""
import os
from datetime import datetime
from github import Github
from models import Project, RefreshJob, db


def get_primary_language(repo):
    """Get the primary programming language of the repository"""
    try:
        languages = repo.get_languages()
        if not languages:
            return "Unknown"
        primary_language = max(languages.items(), key=lambda x: x[1])[0]
        return primary_language
    except Exception as e:
        print(f"  Error getting primary language: {e}")
        return "Unknown"


def get_repository_size_kb(repo):
    """Get repository size in KB"""
    try:
        return float(repo.size)
    except Exception as e:
        print(f"  Error getting repository size: {e}")
        return 0.0


def update_project_stats_async(job_id):
    """
    Background job to fetch and update project statistics from GitHub.
    This version includes progress tracking and can run asynchronously.
    """
    job = RefreshJob.query.get(job_id)
    if not job:
        return
    
    try:
        job.status = 'running'
        db.session.commit()
        
        github_token = os.getenv('GITHUB_ACCESS_TOKEN')
        if not github_token:
            job.status = 'failed'
            job.error_message = 'GITHUB_ACCESS_TOKEN not found in environment'
            job.completed_at = datetime.utcnow()
            db.session.commit()
            return

        g = Github(github_token)
        user = g.get_user()
        repos = [repo for repo in user.get_repos() if not repo.fork and repo.owner.login == user.login]
        
        job.total_repositories = len(repos)
        db.session.commit()
        
        print(f"Found {len(repos)} repositories to process")
        
        for i, repo in enumerate(repos):
            try:
                print(f"Processing repository {i+1}/{len(repos)}: {repo.name}")
                
                # Get commit count
                try:
                    commits = repo.get_commits()
                    commit_count = commits.totalCount
                    
                    if commit_count == 0:
                        print(f"  Skipping {repo.name} - no commits")
                        continue
                    
                    recent_commits = list(commits[:30])
                    
                    if recent_commits:
                        last_commit_date = recent_commits[0].commit.committer.date
                        first_commit_date = repo.created_at
                        time_spent_min = (last_commit_date - first_commit_date).total_seconds() / 60
                        
                        unique_dates = set()
                        for commit in recent_commits:
                            unique_dates.add(commit.commit.committer.date.date())
                        active_days = len(unique_dates)
                    else:
                        last_commit_date = repo.pushed_at or repo.updated_at
                        time_spent_min = 0
                        active_days = 1
                        
                except Exception as e:
                    print(f"  Warning: Could not get commits for {repo.name}: {e}")
                    commit_count = 0
                    last_commit_date = repo.pushed_at or repo.updated_at
                    time_spent_min = 0
                    active_days = 1
                
                primary_language = get_primary_language(repo)
                repository_size_kb = get_repository_size_kb(repo)
                
                # Estimate LOC from repo size
                loc = int(repository_size_kb * 1024 / 50) if repository_size_kb > 0 else 0
                code_churn = 0

                # Store/Update in database
                project = Project.query.filter_by(name=repo.name).first()
                if not project:
                    project = Project(name=repo.name)
                
                project.time_spent_min = time_spent_min
                project.loc = loc
                project.commit_count = commit_count
                project.active_days = active_days
                project.last_commit_date = last_commit_date
                project.code_churn = code_churn
                project.primary_language = primary_language
                project.repository_size_kb = repository_size_kb
                
                db.session.add(project)
                
                job.repositories_processed = i + 1
                db.session.commit()
                
                print(f"  Updated {repo.name}: {commit_count} commits, {active_days} active days, ~{loc} LOC")
                
            except Exception as e:
                print(f"  Error processing {repo.name}: {e}")
                continue
        
        job.status = 'completed'
        job.completed_at = datetime.utcnow()
        db.session.commit()
        print("Project stats update completed successfully")
        
    except Exception as e:
        job.status = 'failed'
        job.error_message = str(e)
        job.completed_at = datetime.utcnow()
        db.session.commit()
        print(f"Project stats update failed: {e}")


def update_project_stats():
    """
    Simplified synchronous function that uses only GitHub API data.
    No git clone or cloc required - faster and works on any hosting platform.
    """
    github_token = os.getenv('GITHUB_ACCESS_TOKEN')
    if not github_token:
        print("Error: GITHUB_ACCESS_TOKEN not found in environment")
        return
    
    g = Github(github_token)
    user = g.get_user()
    repos = [repo for repo in user.get_repos() if not repo.fork and repo.owner.login == user.login]
    
    print(f"Found {len(repos)} repositories to process")
    
    for repo in repos:
        try:
            print(f"Processing repository: {repo.name}")
            
            try:
                commits = repo.get_commits()
                commit_count = commits.totalCount
                
                if commit_count == 0:
                    print(f"  Skipping {repo.name} - no commits")
                    continue
                
                recent_commits = list(commits[:30])
                
                if recent_commits:
                    last_commit_date = recent_commits[0].commit.committer.date
                    first_commit_date = repo.created_at
                    time_spent_min = (last_commit_date - first_commit_date).total_seconds() / 60
                    
                    unique_dates = set()
                    for commit in recent_commits:
                        unique_dates.add(commit.commit.committer.date.date())
                    active_days = len(unique_dates)
                else:
                    last_commit_date = repo.pushed_at or repo.updated_at
                    time_spent_min = 0
                    active_days = 1
                    
            except Exception as e:
                print(f"  Warning: Could not get commits for {repo.name}: {e}")
                commit_count = 0
                last_commit_date = repo.pushed_at or repo.updated_at
                time_spent_min = 0
                active_days = 1
            
            primary_language = get_primary_language(repo)
            repository_size_kb = get_repository_size_kb(repo)
            
            loc = int(repository_size_kb * 1024 / 50) if repository_size_kb > 0 else 0
            code_churn = 0

            project = Project.query.filter_by(name=repo.name).first()
            if not project:
                project = Project(name=repo.name)
            
            project.time_spent_min = time_spent_min
            project.loc = loc
            project.commit_count = commit_count
            project.active_days = active_days
            project.last_commit_date = last_commit_date
            project.code_churn = code_churn
            project.primary_language = primary_language
            project.repository_size_kb = repository_size_kb
            
            db.session.add(project)
            db.session.commit()
            print(f"  Updated {repo.name}: {commit_count} commits, {active_days} active days, ~{loc} LOC")
            
        except Exception as e:
            print(f"  Error processing {repo.name}: {e}")
            continue
    
    print("Project stats update completed")

