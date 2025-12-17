import os
import subprocess
import tempfile
import uuid
import io
import zipfile
from datetime import datetime
from github import Github
from models import Project, RefreshJob, db
from typing import Optional
import requests

def resolve_cloc_executable() -> str:
    """Resolve the path to the cloc executable in Heroku or local environments.
    Returns the executable path or an empty string if not found.
    """
    candidate_paths = [
        os.environ.get('CLOC_PATH') or '',
        '/app/.apt/usr/bin/cloc',
        '/app/.apt/bin/cloc',
        '/usr/bin/cloc',
        '/usr/local/bin/cloc',
        'cloc',
    ]

    for candidate in candidate_paths:
        if not candidate:
            continue
        # If it's a bare command name, try to run `which` to see if it resolves
        if '/' not in candidate:
            try:
                which_result = subprocess.run(
                    ['which', candidate], capture_output=True, text=True
                )
                if which_result.returncode == 0 and which_result.stdout.strip():
                    return which_result.stdout.strip()
            except Exception:
                pass
        else:
            if os.path.exists(candidate):
                return candidate

    return ''

DEFAULT_EXCLUDE_DIRS = [
    'node_modules', 'dist', 'build', '.venv', '.env', '.github', '.idea', '.vscode',
    '__pycache__', '.mypy_cache', '.pytest_cache'
]

def run_cloc_csv(target_dir: str, exclude_dirs: Optional[list] = None) -> str:
    """Attempt to run cloc against target_dir and return CSV stdout on success.
    Tries direct execution and, if needed, invoking via perl with apt include paths.
    Supports excluding common vendor/build directories. Returns an empty string on failure.
    """
    env = os.environ.copy()
    env['PATH'] = f"{env.get('PATH','')}:/app/.apt/usr/bin:/app/.apt/bin"

    # 1) Try direct cloc executable
    cloc_exec = resolve_cloc_executable()
    if cloc_exec:
        try:
            args = [cloc_exec, target_dir, '--quiet', '--csv']
            dirs = exclude_dirs or DEFAULT_EXCLUDE_DIRS
            if dirs:
                args += [f"--exclude-dir={','.join(dirs)}"]
            result = subprocess.run(
                args,
                capture_output=True,
                text=True,
                env=env,
            )
            if result.returncode == 0 and result.stdout:
                return result.stdout
            else:
                print(
                    f"  Warning: direct cloc failed rc={result.returncode}. stderr: {result.stderr.strip()}"
                )
        except Exception as e:
            print(f"  Warning: direct cloc invocation raised: {e}")

    # 2) Try invoking cloc via perl with apt include paths (Heroku apt buildpack)
    possible_cloc_path = '/app/.apt/usr/bin/cloc'
    perl_includes = [
        '/app/.apt/usr/share/perl5',
        '/app/.apt/usr/share/perl/5.38.2',
        '/app/.apt/usr/lib/x86_64-linux-gnu/perl/5.38',
        '/app/.apt/usr/lib/x86_64-linux-gnu/perl5/5.38',
        '/app/.apt/usr/share/perl/5.38',
    ]
    dirs = exclude_dirs or DEFAULT_EXCLUDE_DIRS
    perl_cmd = ['perl'] + [f"-I{p}" for p in perl_includes] + [possible_cloc_path, target_dir, '--quiet', '--csv']
    if dirs:
        perl_cmd += [f"--exclude-dir={','.join(dirs)}"]
    try:
        result = subprocess.run(
            perl_cmd,
            capture_output=True,
            text=True,
            env=env,
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout
        else:
            print(
                f"  Warning: perl+cloc failed rc={result.returncode}. stderr: {result.stderr.strip()}"
            )
    except Exception as e:
        print(f"  Warning: perl+cloc invocation raised: {e}")

    return ''

def fallback_loc_with_pygount(target_dir: str) -> int:
    """Fallback LOC computation using pygount when cloc is not available.
    Counts only code lines across supported languages.
    Returns 0 on failure.
    """
    try:
        # Prefer library API to avoid parsing CLI output
        try:
            from pygount import ProjectSummary
            summary = ProjectSummary.from_paths([target_dir])
            # sum of code lines across files
            return int(summary.total_code_count)
        except Exception:
            pass

        # CLI fallback if needed
        result = subprocess.run(
            ['python', '-m', 'pygount', target_dir, '--format=summary'],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return 0
        # Parse summary: look for a line starting with 'sum'
        for line in result.stdout.splitlines():
            # common summary line: sum files code documentation empty
            parts = line.strip().split()
            if parts and parts[0].lower() == 'sum' and len(parts) >= 4:
                try:
                    return int(parts[2])  # code column
                except ValueError:
                    continue
        return 0
    except Exception as e:
        print(f"  Warning: pygount fallback failed: {e}")
        return 0

def download_repo_archive(repo, target_dir: str) -> bool:
    """Download repository archive (zipball) and extract to target_dir.
    Returns True on success, False otherwise.
    """
    try:
        archive_url = repo.get_archive_link(archive_format='zipball')
        headers = {}
        token = os.getenv('GITHUB_ACCESS_TOKEN')
        if token:
            headers['Authorization'] = f'token {token}'
        resp = requests.get(archive_url, headers=headers, timeout=120)
        if resp.status_code != 200:
            print(f"  Warning: failed to download archive: HTTP {resp.status_code}")
            return False
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            zf.extractall(target_dir)
        return True
    except Exception as e:
        print(f"  Error downloading/extracting repo archive: {e}")
        return False

def parse_loc(cloc_output):
    """Parse CLOC CSV output to get total lines of code
    
    CLOC CSV format: files,language,blank,comment,code
    We look for the SUM row which contains the total LOC count.
    """
    if not cloc_output or not cloc_output.strip():
        print("Warning: Empty CLOC output")
        return 0
        
    lines = cloc_output.strip().split('\n')
    
    # Must have at least a header and one data line
    if len(lines) < 2:
        print(f"Warning: Invalid CLOC output format - insufficient lines: {len(lines)}")
        return 0
    
    # First pass: look for the SUM row which contains the total LOC
    for line in lines[1:]:  # Skip header
        if line and ',' in line:
            parts = line.split(',')
            # Look for the SUM row which contains the total LOC
            if len(parts) >= 5 and parts[1] == 'SUM':
                try:
                    total_loc = int(parts[4])  # Code column (0-indexed: files,language,blank,comment,code)
                    print(f"Found SUM row with LOC: {total_loc}")
                    return total_loc
                except (ValueError, IndexError) as e:
                    print(f"Error parsing SUM row: {e}, line: {line}")
                    break  # Exit this approach and try fallback
    
    # Fallback: sum all individual language rows if no SUM row found
    print("No SUM row found, falling back to individual language summation")
    total_loc = 0
    languages_found = []
    
    for line in lines[1:]:  # Skip header
        if line and ',' in line:
            parts = line.split(',')
            # Skip SUM row and header, process individual language rows
            if (len(parts) >= 5 and 
                parts[1] != 'SUM' and 
                not parts[1].startswith('github.com') and
                parts[1] != 'language'):  # Exclude header row
                try:
                    loc = int(parts[4])  # Code column
                    total_loc += loc
                    languages_found.append(f"{parts[1]}:{loc}")
                except (ValueError, IndexError) as e:
                    print(f"Error parsing line: {e}, line: {line}")
                    continue
    
    if languages_found:
        print(f"Languages processed: {', '.join(languages_found)}")
    
    print(f"Total LOC calculated: {total_loc}")
    return total_loc

def calculate_code_churn(repo_path, exclude_dirs: Optional[list] = None):
    """Calculate total lines added and deleted across all commits.
    Excludes merge commits and common vendor/build directories to avoid inflation.
    """
    try:
        # Prepare git log command
        cmd = ['git', 'log', '--no-merges', '--numstat', '--pretty=format:']
        # Apply pathspec excludes for common vendor/build directories
        dirs = exclude_dirs or DEFAULT_EXCLUDE_DIRS
        if dirs:
            cmd += ['--', '.'] + [f":(exclude){d}" for d in dirs]
        # Get git log with numstat to show lines added/deleted per commit
        result = subprocess.run(cmd, cwd=repo_path, capture_output=True, text=True)
        
        if result.returncode != 0:
            return 0
            
        lines = result.stdout.strip().split('\n')
        total_additions = 0
        total_deletions = 0
        
        for line in lines:
            if line and '\t' in line:
                parts = line.split('\t')
                if len(parts) >= 2:
                    try:
                        additions = int(parts[0]) if parts[0] != '-' else 0
                        deletions = int(parts[1]) if parts[1] != '-' else 0
                        total_additions += additions
                        total_deletions += deletions
                    except ValueError:
                        continue
        
        return total_additions + total_deletions
    except Exception as e:
        print(f"  Error calculating code churn: {e}")
        return 0

def get_primary_language(repo):
    """Get the primary programming language of the repository"""
    try:
        languages = repo.get_languages()
        if not languages:
            return "Unknown"
        
        # Return the language with the most bytes
        primary_language = max(languages.items(), key=lambda x: x[1])[0]
        return primary_language
    except Exception as e:
        print(f"  Error getting primary language: {e}")
        return "Unknown"

def get_repository_size_kb(repo):
    """Get repository size in KB"""
    try:
        # repo.size returns size in KB
        return float(repo.size)
    except Exception as e:
        print(f"  Error getting repository size: {e}")
        return 0.0

def _build_authed_clone_url(repo) -> Optional[str]:
    token = os.getenv('GITHUB_ACCESS_TOKEN')
    if not token:
        return None
    url = repo.clone_url
    # Insert token into https URL: https://<token>@github.com/owner/repo.git
    if url.startswith('https://'):
        return 'https://' + token + '@' + url[len('https://'):]
    return url

def update_project_stats_async(job_id):
    """
    Background job to fetch and update project statistics from GitHub.
    This version includes progress tracking and can run asynchronously.
    """
    # Get the job record
    job = RefreshJob.query.get(job_id)
    if not job:
        return
    
    try:
        # Update job status to running
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
        
        # Update total repositories count
        job.total_repositories = len(repos)
        db.session.commit()
        
        print(f"Found {len(repos)} repositories to process")
        
        for i, repo in enumerate(repos):
            try:
                print(f"Processing repository {i+1}/{len(repos)}: {repo.name}")
                
                commits = repo.get_commits()
                if commits.totalCount == 0:
                    print(f"  Skipping {repo.name} - no commits")
                    continue

                # Get commit data (use committer date for stability)
                commits_list = list(commits)
                first_commit_date = commits_list[-1].commit.committer.date
                last_commit_date = commits_list[0].commit.committer.date
                time_spent_min = (last_commit_date - first_commit_date).total_seconds() / 60
                commit_count = commits.totalCount
                
                # Calculate active days
                unique_dates = set()
                for commit in commits_list:
                    unique_dates.add(commit.commit.committer.date.date())
                active_days = len(unique_dates)
                
                # Get repository size and primary language from GitHub API
                primary_language = get_primary_language(repo)
                repository_size_kb = get_repository_size_kb(repo)
                
                # Calculate lines of code using cloc and code churn
                loc = 0
                code_churn = 0
                try:
                    with tempfile.TemporaryDirectory() as temp_dir:
                        clone_dir = os.path.join(temp_dir, repo.name)
                        try:
                            print(f"  Cloning {repo.name}...")
                            authed_url = _build_authed_clone_url(repo) or repo.clone_url
                            subprocess.run(['git', 'clone', authed_url, clone_dir], 
                                         check=True, capture_output=True)
                            # Calculate code churn from git history
                            code_churn = calculate_code_churn(clone_dir)
                            print(f"  Code churn: {code_churn} lines")
                        except FileNotFoundError:
                            print("  Warning: git not found. Falling back to archive download for LOC only")
                            os.makedirs(clone_dir, exist_ok=True)
                            if not download_repo_archive(repo, clone_dir):
                                raise
                            code_churn = 0
                        except subprocess.CalledProcessError as e:
                            print(f"  Error cloning {repo.name}: {e}. Falling back to archive download for LOC only")
                            os.makedirs(clone_dir, exist_ok=True)
                            if not download_repo_archive(repo, clone_dir):
                                raise
                            code_churn = 0
                        
                        # Run cloc (robust invocation)
                        cloc_csv = run_cloc_csv(clone_dir)
                        if cloc_csv:
                            loc = parse_loc(cloc_csv)
                            print(f"  Lines of code: {loc}")
                        else:
                            # Robust Python fallback
                            loc = fallback_loc_with_pygount(clone_dir)
                            if loc > 0:
                                print(f"  Lines of code (pygount fallback): {loc}")
                            else:
                                print("  Warning: Could not compute LOC with cloc or pygount; will use rough estimation")
                
                except subprocess.CalledProcessError as e:
                    print(f"  Error processing {repo.name}: {e}")
                    continue
                except FileNotFoundError:
                    print(f"  Warning: required system tool not found. Using rough LOC estimation")
                    # Fallback: estimate LOC from file count (rough approximation)
                    try:
                        contents = repo.get_contents("")
                        loc = len([f for f in contents if f.type == "file"]) * 50  # rough estimate
                    except Exception:
                        loc = 0

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
                
                # Update job progress
                job.repositories_processed = i + 1
                db.session.commit()
                
                print(f"  Updated {repo.name}: {commit_count} commits, {active_days} active days, {loc} LOC, {code_churn} churn, {primary_language}, {repository_size_kb}KB")
                
            except Exception as e:
                print(f"  Error processing {repo.name}: {e}")
                continue
        
        # Mark job as completed
        job.status = 'completed'
        job.completed_at = datetime.utcnow()
        db.session.commit()
        print("Project stats update completed successfully")
        
    except Exception as e:
        # Mark job as failed
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
            
            # Get commit count without fetching all commits (faster)
            try:
                commits = repo.get_commits()
                commit_count = commits.totalCount
                
                if commit_count == 0:
                    print(f"  Skipping {repo.name} - no commits")
                    continue
                
                # Get first page of commits for date calculation (limit to avoid timeout)
                recent_commits = list(commits[:30])  # Only get recent 30 commits
                
                if recent_commits:
                    last_commit_date = recent_commits[0].commit.committer.date
                    # Estimate first commit date from repo creation if we can't get all commits
                    first_commit_date = repo.created_at
                    time_spent_min = (last_commit_date - first_commit_date).total_seconds() / 60
                    
                    # Calculate active days from recent commits
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
            
            # Get repository size and primary language from GitHub API (always available)
            primary_language = get_primary_language(repo)
            repository_size_kb = get_repository_size_kb(repo)
            
            # Estimate LOC from repo size (rough but fast)
            # Average ~50 bytes per line of code
            loc = int(repository_size_kb * 1024 / 50) if repository_size_kb > 0 else 0
            
            # Code churn not available without git clone
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
            db.session.commit()  # Commit after each repo to avoid losing progress
            print(f"  Updated {repo.name}: {commit_count} commits, {active_days} active days, ~{loc} LOC, {primary_language}, {repository_size_kb}KB")
            
        except Exception as e:
            print(f"  Error processing {repo.name}: {e}")
            continue
    
    print("Project stats update completed")
