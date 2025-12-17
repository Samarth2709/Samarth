# Project Tracker Backend

Flask-based API that analyzes your GitHub repositories and serves rich project metrics: lines of code, commits, active days, code churn, primary language, repository size, plus overall rollups across all projects. Supports background refresh jobs, progress tracking, and CORS for frontend integrations.

## Live Service and Base URLs

- **Local**: `http://localhost:5001`
- **Production**: `https://young-garden-29023.herokuapp.com` (Heroku)

All examples below use the production base URL; swap for local when running on your machine.

## Quick Start (Local)

1) Create and activate a virtualenv, then install dependencies:
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2) Set required environment variables:
```bash
export GITHUB_ACCESS_TOKEN=your_pat_with_repo_scope
# Optional (defaults used if unset):
# export DATABASE_URL=sqlite:///db.sqlite
# export REDIS_URL=redis://localhost:6379
```

3) Run the API:
```bash
python app.py
```

The API starts on `http://localhost:5001`.

## What This Backend Does

- **Fetches your repos** via GitHub API (PyGithub) using `GITHUB_ACCESS_TOKEN`.
- **Computes per-repo metrics**: total LOC (CLOC, robust fallbacks), commits, active days, project lifespan in minutes, code churn (added+deleted lines), primary language, repository size.
- **Persists results** in SQL database (`Project` table). SQLite locally; PostgreSQL in production.
- **Supports manual and scheduled refresh** of metrics.
- **Provides overall metrics** aggregating across all projects.
- **Runs long tasks in background** via Redis + RQ with progress tracking (`RefreshJob`).

## API Overview

See full schemas and examples in `API_DOCUMENTATION.md`. Key endpoints:

- `GET /api/health`: Health check.
- `GET /api/projects`: List all projects and metrics.
- `GET /api/project/<name>`: Metrics for a single project.
- `GET /api/metrics`: Overall rollup across all projects.
- `POST /api/refresh`: Start metrics refresh (async if Redis available, else synchronous).
- `GET /api/refresh/status/<job_id>`: Check a refresh job’s status.
- `GET /api/refresh/jobs`: List the 10 most recent refresh jobs.
- `GET /`: API info + endpoint listing.

### Example Requests

Health:
```bash
curl https://young-garden-29023.herokuapp.com/api/health
```

Projects:
```bash
curl https://young-garden-29023.herokuapp.com/api/projects
```

Single project:
```bash
curl https://young-garden-29023.herokuapp.com/api/project/<name>
```

Overall metrics:
```bash
curl https://young-garden-29023.herokuapp.com/api/metrics
```

Start refresh (returns `job_id` when async):
```bash
curl -X POST https://young-garden-29023.herokuapp.com/api/refresh
```

Check refresh status:
```bash
curl https://young-garden-29023.herokuapp.com/api/refresh/status/<job_id>
```

List recent refresh jobs:
```bash
curl https://young-garden-29023.herokuapp.com/api/refresh/jobs
```

Authentication: No client-side auth for these endpoints. The GitHub token is configured server-side.

## Data Model

`models.py` defines two tables:

- `Project`:
  - `name` (str, unique)
  - `time_spent_min` (float) → returned as `time_spent` like "123m"
  - `loc` (int)
  - `commit_count` (int)
  - `active_days` (int)
  - `last_commit_date` (datetime) → returned as `last_finished`
  - `code_churn` (int)
  - `primary_language` (str)
  - `repository_size_kb` (float)

- `RefreshJob`:
  - `id` (UUID string)
  - `status` (queued | running | completed | failed)
  - `started_at`, `completed_at`
  - `error_message`
  - `repositories_processed`, `total_repositories` and computed `progress` (%)

## How Metrics Are Calculated

- **Time Spent**: minutes between first and last commit timestamps.
- **LOC**: via `cloc --csv` on a temporary clone, with robust resolution for the cloc binary (Heroku apt buildpack supported). If cloc is unavailable, falls back to `pygount`, and finally a rough heuristic.
- **Code Churn**: sum of additions + deletions from `git log --numstat`.
- **Primary Language**: most bytes reported by GitHub’s Languages API.
- **Repository Size**: GitHub repo size in KB.

Details and example payloads are in `API_DOCUMENTATION.md`.

## Background Jobs and Scheduling

- **Async refresh**: If `REDIS_URL` is set and reachable, the `POST /api/refresh` endpoint enqueues `update_project_stats_async` to an RQ queue and returns a `job_id`. Progress is tracked in `RefreshJob`.
- **Synchronous fallback**: If Redis is not available, refresh runs synchronously and returns `200` with a success message when complete.
- **Worker**: `worker.py` starts an RQ worker for the `default` queue. In Heroku, run it via the `worker` dyno.
- **Daily refresh**: The code includes an APScheduler job (24h interval) started when running `app.py` directly. In production on Heroku, prefer the Heroku Scheduler add-on or ensure APScheduler is started in your process model.

## CORS

CORS is enabled and restricted to specific origins. By default, development origins include `http://127.0.0.1:5500`, `http://localhost:5500`, and `http://localhost:3000`. Update production origin(s) in `app.py` (`CORS(...)` and `after_request(...)`) to match your frontend domain (e.g., `https://samarthkumbla.com`).

## Deployment (Heroku)

- Uses Python + Gunicorn; optional apt buildpack to install `cloc` via `Aptfile`.
- Add-ons: PostgreSQL and Redis are recommended. Configure `GITHUB_ACCESS_TOKEN`, `DATABASE_URL`, and `REDIS_URL`.
- Scale a `web` dyno for the API and a `worker` dyno for background jobs.

Example commands:
```bash
# Create app and add buildpacks
heroku create your-app-name
heroku buildpacks:add --index 1 heroku-community/apt
heroku buildpacks:add --index 2 heroku/python

# Add-ons
heroku addons:create heroku-postgresql:essential-0
heroku addons:create heroku-redis:mini

# Configure env
heroku config:set GITHUB_ACCESS_TOKEN=your_github_token_here

# Deploy and scale
git push heroku main
heroku ps:scale web=1 worker=1

# Initialize DB (first time)
heroku run python -c "from app import app, db; app.app_context().push(); db.create_all()"

# Test
heroku open
```

## Environment Variables

- `GITHUB_ACCESS_TOKEN` (required): Personal access token with `repo` scope.
- `DATABASE_URL` (optional): Defaults to SQLite locally; set by Heroku for Postgres. If it starts with `postgres://` it is normalized to `postgresql://` automatically.
- `REDIS_URL` (optional): Enables async refresh and job tracking when available.
- `PORT` (optional): Flask bind port; defaults to `5001` locally.
- `CLOC_PATH` (optional): Explicit path to `cloc` if auto-resolution fails.

## Project Structure

```
├── app.py               # Flask app, routes, CORS, scheduler, Redis/RQ integration
├── models.py            # SQLAlchemy models: Project, RefreshJob
├── jobs.py              # Metric collection (cloc, churn), async + sync job runners
├── worker.py            # RQ worker process
├── requirements.txt     # Python dependencies
├── Procfile             # Heroku processes (web, worker)
├── Aptfile              # System deps for Heroku apt buildpack (e.g., cloc)
└── API_DOCUMENTATION.md # Detailed endpoint schemas and examples
```

## Troubleshooting

- **CORS errors**: Ensure your frontend origin is listed in `allowed_origins` in `app.py`. See the CORS section above.
- **Refresh never returns `job_id`**: Redis not available; the API falls back to synchronous mode. Set `REDIS_URL` to enable async.
- **LOC stays 0**: Confirm `cloc` is installed (Heroku apt buildpack) or that `pygount` fallback works. You can set `CLOC_PATH`.
- **Rate limits**: GitHub API is rate-limited (~5000 req/hr for authenticated calls). Avoid frequent refreshes.

## License

Proprietary or TBD. Add a license if you plan to open-source.
