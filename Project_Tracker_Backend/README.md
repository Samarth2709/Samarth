# Project Tracker Backend

Flask-based API serving two dashboards:
1. **GitHub Dashboard** - Project metrics from GitHub repositories
2. **WHOOP Dashboard** - Health and fitness data from WHOOP wearable

## Live Service

- **Local**: `http://localhost:5001`
- **Production**: `https://projecttracker-production.up.railway.app` (Railway)

---

## Quick Start (Local)

1. Create and activate a virtualenv:
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. Set required environment variables:
```bash
# GitHub (required for GitHub dashboard)
export GITHUB_ACCESS_TOKEN=your_pat_with_repo_scope

# WHOOP (required for WHOOP dashboard)
export WHOOP_CLIENT_ID=your_client_id
export WHOOP_CLIENT_SECRET=your_client_secret
export WHOOP_REFRESH_TOKEN=your_refresh_token

# Optional
# export DATABASE_URL=sqlite:///db.sqlite
# export REDIS_URL=redis://localhost:6379
```

3. Run the API:
```bash
python app.py
```

The API starts on `http://localhost:5001`.

---

## API Endpoints

### Health Check
```
GET /api/health
```

### Root (API Documentation)
```
GET /
```
Returns a complete list of all available endpoints.

---

## GitHub Dashboard

Analyzes your GitHub repositories and serves rich project metrics.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/github/projects` | List all projects and metrics |
| GET | `/api/github/project/<name>` | Get metrics for a single project |
| GET | `/api/github/metrics` | Overall rollup across all projects |
| POST | `/api/github/refresh` | Start metrics refresh |
| GET | `/api/github/refresh/status/<job_id>` | Check refresh job status |
| GET | `/api/github/refresh/jobs` | List recent refresh jobs |

### Metrics Collected
- **Lines of Code**: via `cloc` or fallback methods
- **Commits**: total commit count
- **Active Days**: days with at least one commit
- **Time Spent**: minutes between first and last commit
- **Code Churn**: lines added + deleted
- **Primary Language**: most used language by bytes
- **Repository Size**: in KB

---

## WHOOP Dashboard

Fetches and displays health data from WHOOP wearable devices.

### Architecture

The WHOOP dashboard uses a **local caching strategy**:

1. **On Startup**: Backend syncs data from WHOOP API to local SQLite/PostgreSQL database
2. **Periodically**: Scheduled sync every 24 hours keeps data fresh
3. **On Demand**: Manual sync endpoints for immediate updates
4. **Frontend Reads**: All dashboard queries read from local database (fast, reliable)

This means the frontend never directly calls the WHOOP API - it always reads from the local database, which is kept in sync automatically.

### Database Endpoints (Read from local DB)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/whoop/recovery` | Get recovery data |
| GET | `/api/whoop/recovery/latest` | Get latest recovery score |
| GET | `/api/whoop/sleep` | Get sleep data |
| GET | `/api/whoop/sleep/latest` | Get latest sleep record |
| GET | `/api/whoop/workouts` | Get workout/strain data |
| GET | `/api/whoop/cycles` | Get daily physiological cycles |
| GET | `/api/whoop/metrics` | Get aggregated metrics |
| GET | `/api/whoop/profile` | Get cached user profile |
| GET | `/api/whoop/sync/status` | Get last sync status |

**Query Parameters** (for data endpoints):
- `days` - Number of days to fetch (default: 7)
- `start_date` - Start date (YYYY-MM-DD)
- `end_date` - End date (YYYY-MM-DD)

### Sync Endpoints (Update local DB from WHOOP API)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/whoop/refresh/today` | Quick 2-day sync for page load |
| POST | `/api/whoop/refresh` | Manual sync (specify days) |
| POST | `/api/whoop/sync/incremental` | Sync new data since last sync |
| POST | `/api/whoop/sync/full` | Full historical sync (up to 365 days) |

### Status & Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/whoop/status` | Check API configuration |
| GET | `/api/whoop/auth/test` | Test authentication |
| GET | `/api/whoop/auth/authorize-url` | Get OAuth authorization URL |
| POST | `/api/whoop/auth/exchange-code` | Exchange auth code for tokens |

### Direct API Endpoints (For debugging)

These endpoints fetch directly from WHOOP API (not from local cache):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/whoop/api/profile` | Fetch profile from WHOOP API |
| GET | `/api/whoop/api/body` | Fetch body measurements |
| GET | `/api/whoop/api/recovery` | Fetch recovery from API |
| GET | `/api/whoop/api/sleep` | Fetch sleep from API |
| GET | `/api/whoop/api/workouts` | Fetch workouts from API |
| GET | `/api/whoop/api/cycles` | Fetch cycles from API |
| GET | `/api/whoop/api/dashboard` | Get combined dashboard data |

### Token Management

WHOOP uses **OAuth 2.0 with refresh token rotation**. Each time you use a refresh token, WHOOP issues a new one. The backend automatically:

1. Saves new refresh tokens to `.env` file
2. Updates environment variables in memory
3. Persists tokens between restarts

**Important**: Never use an old refresh token - it will be invalid.

To get initial tokens:
1. Visit `/api/whoop/auth/authorize-url` to get the OAuth URL
2. Authorize in browser
3. Copy the authorization code from redirect URL
4. POST to `/api/whoop/auth/exchange-code` with the code

---

## Data Models

### GitHub Models

**Project**
- `name`, `time_spent_min`, `loc`, `commit_count`, `active_days`
- `last_commit_date`, `code_churn`, `primary_language`, `repository_size_kb`

**RefreshJob**
- `id`, `status`, `started_at`, `completed_at`, `error_message`
- `repositories_processed`, `total_repositories`

### WHOOP Models

**WhoopRecovery**
- `cycle_id`, `date`, `recovery_score`, `resting_heart_rate`
- `hrv_rmssd`, `spo2_percentage`, `skin_temp_celsius`

**WhoopSleep**
- `sleep_id`, `date`, `start_time`, `end_time`, `total_sleep_hours`
- `sleep_performance`, `sleep_efficiency`, `sleep_consistency`
- `rem_sleep_min`, `deep_sleep_min`, `light_sleep_min`, `awake_min`
- `respiratory_rate`

**WhoopWorkout**
- `workout_id`, `start_time`, `end_time`, `sport_id`, `sport_name`
- `strain`, `average_heart_rate`, `max_heart_rate`, `calories`
- `distance_meters`, `duration_min`

**WhoopCycle**
- `cycle_id`, `start_time`, `end_time`, `strain`, `kilojoules`
- `average_heart_rate`, `max_heart_rate`

**WhoopProfile**
- `user_id`, `first_name`, `last_name`, `email`

**WhoopSyncStatus**
- `last_sync_at`, `last_sync_type`, `records_synced`, `status`, `error_message`

---

## Background Jobs & Scheduling

- **Redis/RQ**: If `REDIS_URL` is set, refresh jobs run asynchronously
- **APScheduler**: Runs scheduled tasks:
  - GitHub stats refresh: every 24 hours
  - WHOOP data sync: every 24 hours
- **Startup Sync**: WHOOP data is automatically synced on backend startup

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_ACCESS_TOKEN` | For GitHub | Personal access token with `repo` scope |
| `WHOOP_CLIENT_ID` | For WHOOP | OAuth client ID from WHOOP developer portal |
| `WHOOP_CLIENT_SECRET` | For WHOOP | OAuth client secret |
| `WHOOP_REFRESH_TOKEN` | For WHOOP | OAuth refresh token (auto-rotated) |
| `DATABASE_URL` | No | PostgreSQL URL (defaults to SQLite) |
| `REDIS_URL` | No | Redis URL for async jobs |
| `PORT` | No | Server port (default: 5001) |

---

## Deployment (Railway)

1. Connect GitHub repository to Railway
2. Add PostgreSQL and Redis services
3. Set environment variables in Railway dashboard
4. Railway auto-deploys on push

For WHOOP token setup in production:
1. Get tokens locally using the auth endpoints
2. Set `WHOOP_REFRESH_TOKEN` in Railway dashboard
3. Backend will auto-rotate and persist tokens

---

## Project Structure

```
├── app.py                 # Flask app, routes, scheduler
├── config.py              # Configuration from environment
├── models.py              # SQLAlchemy models
├── routes/
│   ├── github.py          # GitHub dashboard endpoints
│   └── whoop.py           # WHOOP dashboard endpoints
├── services/
│   ├── github_service.py  # GitHub API integration
│   └── whoop_service.py   # WHOOP API integration
├── worker.py              # RQ background worker
├── fetch_all_workouts.py  # Standalone WHOOP sync script
├── requirements.txt       # Python dependencies
├── Procfile               # Railway process definition
└── Aptfile                # System dependencies
```

---

## Troubleshooting

### CORS Errors
Ensure frontend origin is in `CORS_ORIGINS` in `config.py`.

### WHOOP Authentication Failed
- Check that `WHOOP_REFRESH_TOKEN` is current (not expired)
- Use `/api/whoop/auth/authorize-url` to get new tokens
- Tokens rotate on each use - never reuse old tokens

### Database Empty After Restart
- Check startup logs for sync errors
- Manually trigger sync with `POST /api/whoop/sync/full?days=90`

### Rate Limits
- GitHub: ~5000 requests/hour
- WHOOP: Check developer docs for current limits

---

## License

Proprietary. Contact for licensing information.
