# Backend Architecture

This document explains the structure of the Project Tracker Backend, which serves two dashboards: **GitHub** (project statistics) and **Whoop** (health/fitness data).

## Directory Structure

```
Project_Tracker_Backend/
├── app.py                      # Main Flask application
├── config.py                   # Configuration and environment variables
├── models.py                   # Database models (SQLAlchemy)
├── Procfile                    # Deployment configuration
├── requirements.txt            # Python dependencies
│
├── routes/                     # API endpoint definitions (Flask Blueprints)
│   ├── __init__.py
│   ├── github.py               # GitHub dashboard endpoints
│   └── whoop.py                # Whoop dashboard endpoints
│
├── services/                   # Business logic and external API integrations
│   ├── __init__.py
│   ├── github_service.py       # GitHub API integration
│   └── whoop_service.py        # Whoop API integration
│
└── instance/                   # Local database (SQLite, gitignored)
    └── db.sqlite
```

---

## Core Files

### `app.py` - Main Application

The entry point that:
- Initializes Flask and extensions (CORS, SQLAlchemy)
- Registers blueprints for each dashboard
- Sets up Redis for background jobs (optional)
- Provides legacy route redirects for backward compatibility
- Runs the background scheduler for periodic data updates

```python
# Blueprint registration
app.register_blueprint(github_bp, url_prefix='/api/github')
app.register_blueprint(whoop_bp, url_prefix='/api/whoop')
```

### `config.py` - Configuration

Centralizes all environment variables:
- `DATABASE_URL` - PostgreSQL (production) or SQLite (local)
- `REDIS_URL` - For background job queues
- `GITHUB_ACCESS_TOKEN` - GitHub API authentication
- `WHOOP_*` - Whoop API credentials
- `CORS_ORIGINS` - Allowed frontend domains

### `models.py` - Database Models

Defines SQLAlchemy models for both dashboards:

| Model | Dashboard | Purpose |
|-------|-----------|---------|
| `Project` | GitHub | Repository statistics |
| `RefreshJob` | GitHub | Background job tracking |
| `WhoopRecovery` | Whoop | Daily recovery scores |
| `WhoopSleep` | Whoop | Sleep data and stages |
| `WhoopWorkout` | Whoop | Individual workouts |
| `WhoopCycle` | Whoop | Daily strain cycles |

---

## Routes (API Endpoints)

### `routes/github.py` - GitHub Dashboard

**Prefix:** `/api/github`

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/projects` | `get_projects()` | List all GitHub projects with stats |
| GET | `/project/<name>` | `get_project(name)` | Get specific project details |
| GET | `/metrics` | `get_overall_metrics()` | Aggregated statistics across all projects |
| POST | `/refresh` | `refresh_stats()` | Trigger data refresh from GitHub API |
| GET | `/refresh/status/<job_id>` | `refresh_status(job_id)` | Check background job progress |
| GET | `/refresh/jobs` | `list_refresh_jobs()` | List recent refresh jobs |

**Data Flow:**
```
Client Request → routes/github.py → services/github_service.py → GitHub API
                                  ↓
                            models.py (Project, RefreshJob)
                                  ↓
                            Database (PostgreSQL/SQLite)
```

### `routes/whoop.py` - Whoop Dashboard

**Prefix:** `/api/whoop`

| Method | Endpoint | Function | Description |
|--------|----------|----------|-------------|
| GET | `/recovery` | `get_recovery()` | Recovery scores (supports `?days=N`) |
| GET | `/recovery/latest` | `get_latest_recovery()` | Most recent recovery score |
| GET | `/sleep` | `get_sleep()` | Sleep data (supports `?days=N`) |
| GET | `/sleep/latest` | `get_latest_sleep()` | Most recent sleep data |
| GET | `/workouts` | `get_workouts()` | Workout/activity data |
| GET | `/cycles` | `get_cycles()` | Daily strain cycles |
| GET | `/metrics` | `get_overall_metrics()` | Aggregated Whoop statistics |
| POST | `/refresh` | `refresh_data()` | Sync data from Whoop API |
| GET | `/status` | `get_status()` | Check API configuration |

**Query Parameters:**
- `days` - Number of days to fetch (default: 7)
- `start_date` - Start date (YYYY-MM-DD)
- `end_date` - End date (YYYY-MM-DD)

**Data Flow:**
```
Client Request → routes/whoop.py → services/whoop_service.py → Whoop API
                                 ↓
                           models.py (WhoopRecovery, WhoopSleep, etc.)
                                 ↓
                           Database (PostgreSQL/SQLite)
```

---

## Services (Business Logic)

### `services/github_service.py`

Handles GitHub API interactions:

| Function | Purpose |
|----------|---------|
| `update_project_stats()` | Synchronous refresh of all repositories |
| `update_project_stats_async(job_id)` | Background job version with progress tracking |
| `get_primary_language(repo)` | Extract primary language from repo |
| `get_repository_size_kb(repo)` | Get repo size in KB |

**GitHub API Data Collected:**
- Commit count and dates
- Repository size
- Primary programming language
- Active development days
- Lines of code (estimated from size)

### `services/whoop_service.py`

Handles Whoop API interactions via the `WhoopService` class:

| Method | Purpose |
|--------|---------|
| `is_configured()` | Check if API credentials are set |
| `sync_recovery(days)` | Fetch and store recovery data |
| `sync_sleep(days)` | Fetch and store sleep data |
| `sync_workouts(days)` | Fetch and store workout data |
| `sync_cycles(days)` | Fetch and store daily strain cycles |
| `_refresh_access_token()` | Refresh OAuth token if expired |

**Whoop API Data Collected:**
- Recovery scores (HRV, RHR, SpO2)
- Sleep stages (REM, deep, light, awake)
- Workout strain and heart rate
- Daily strain and calories

---

## Database Schema

### GitHub Tables

```sql
-- project
CREATE TABLE project (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    time_spent_min FLOAT,
    loc INTEGER,
    commit_count INTEGER,
    active_days INTEGER,
    last_commit_date DATETIME,
    code_churn INTEGER,
    primary_language VARCHAR(50),
    repository_size_kb FLOAT
);

-- refresh_job
CREATE TABLE refresh_job (
    id VARCHAR(36) PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'queued',
    started_at DATETIME,
    completed_at DATETIME,
    error_message TEXT,
    repositories_processed INTEGER DEFAULT 0,
    total_repositories INTEGER DEFAULT 0
);
```

### Whoop Tables

```sql
-- whoop_recovery
CREATE TABLE whoop_recovery (
    id INTEGER PRIMARY KEY,
    cycle_id VARCHAR(50) UNIQUE,
    date DATETIME NOT NULL,
    recovery_score FLOAT,
    resting_heart_rate FLOAT,
    hrv_rmssd FLOAT,
    spo2_percentage FLOAT,
    skin_temp_celsius FLOAT,
    created_at DATETIME
);

-- whoop_sleep
CREATE TABLE whoop_sleep (
    id INTEGER PRIMARY KEY,
    sleep_id VARCHAR(50) UNIQUE,
    date DATETIME NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    total_sleep_hours FLOAT,
    sleep_performance FLOAT,
    sleep_efficiency FLOAT,
    sleep_consistency FLOAT,
    rem_sleep_min FLOAT,
    deep_sleep_min FLOAT,
    light_sleep_min FLOAT,
    awake_min FLOAT,
    respiratory_rate FLOAT,
    created_at DATETIME
);

-- whoop_workout
CREATE TABLE whoop_workout (
    id INTEGER PRIMARY KEY,
    workout_id VARCHAR(50) UNIQUE,
    start_time DATETIME,
    end_time DATETIME,
    sport_id INTEGER,
    sport_name VARCHAR(100),
    strain FLOAT,
    average_heart_rate FLOAT,
    max_heart_rate FLOAT,
    calories FLOAT,
    distance_meters FLOAT,
    duration_min FLOAT,
    created_at DATETIME
);

-- whoop_cycle
CREATE TABLE whoop_cycle (
    id INTEGER PRIMARY KEY,
    cycle_id VARCHAR(50) UNIQUE,
    start_time DATETIME,
    end_time DATETIME,
    strain FLOAT,
    kilojoules FLOAT,
    average_heart_rate FLOAT,
    max_heart_rate FLOAT,
    created_at DATETIME
);
```

---

## Request/Response Flow

### Example: GET /api/github/metrics

```
1. Client sends GET request to /api/github/metrics

2. Flask routes to routes/github.py → get_overall_metrics()

3. Function queries database:
   projects = Project.query.all()

4. Calculates aggregated metrics:
   - Total projects, LOC, commits, hours
   - Top project by LOC, commits, time
   - Language breakdown

5. Returns JSON response:
   {
     "total_projects": 28,
     "total_loc": 15095774,
     "total_commits": 608,
     "most_common_language": {"language": "Python", "percentage": 60.7},
     ...
   }
```

### Example: POST /api/whoop/refresh

```
1. Client sends POST request to /api/whoop/refresh?days=7

2. Flask routes to routes/whoop.py → refresh_data()

3. Creates WhoopService instance and calls:
   - service.sync_recovery(days=7)
   - service.sync_sleep(days=7)
   - service.sync_workouts(days=7)
   - service.sync_cycles(days=7)

4. Each sync method:
   a. Calls Whoop API with date range
   b. Parses response data
   c. Upserts records to database

5. Returns JSON response:
   {
     "message": "Whoop data refreshed successfully",
     "synced": {
       "recovery": 7,
       "sleep": 7,
       "workouts": 3,
       "cycles": 7
     }
   }
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | PostgreSQL URL (defaults to SQLite) |
| `REDIS_URL` | No | Redis URL for background jobs |
| `GITHUB_ACCESS_TOKEN` | Yes | GitHub personal access token |
| `WHOOP_ACCESS_TOKEN` | For Whoop | Whoop OAuth access token |
| `WHOOP_REFRESH_TOKEN` | No | For automatic token refresh |
| `WHOOP_CLIENT_ID` | No | For automatic token refresh |
| `WHOOP_CLIENT_SECRET` | No | For automatic token refresh |

---

## Deployment

**Platform:** Railway

**Build:** Automatically detected as Python (uses `requirements.txt`)

**Start Command:** `gunicorn --timeout 300 app:app` (from Procfile)

**Database:** Railway PostgreSQL (set via `DATABASE_URL`)

---

## Legacy Endpoints

For backward compatibility, these routes redirect to the new structure:

| Old Endpoint | Redirects To |
|--------------|--------------|
| `GET /api/projects` | `GET /api/github/projects` |
| `GET /api/metrics` | `GET /api/github/metrics` |
| `POST /api/refresh` | `POST /api/github/refresh` |

