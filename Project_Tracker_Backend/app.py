"""
Project Tracker Backend
Main Flask application with GitHub and Whoop dashboards
"""
import os
import redis
import threading
from datetime import datetime, timedelta, timezone
from flask import Flask, jsonify, request
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from rq import Queue

from config import Config
from models import db, WhoopRecovery, WhoopSleep, WhoopCycle, WhoopSyncStatus
from routes.github import github_bp, init_redis as init_github_redis
from routes.whoop import whoop_bp

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Load configuration
app.config.from_object(Config)

# Configure CORS
CORS(app, 
     origins=Config.CORS_ORIGINS,
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     supports_credentials=True
)

# Redis configuration for background jobs
redis_available = False
redis_conn = None
job_queue = None

if Config.REDIS_URL:
    try:
        if Config.REDIS_URL.startswith('rediss://'):
            redis_conn = redis.from_url(Config.REDIS_URL, ssl_cert_reqs=None)
        else:
            redis_conn = redis.from_url(Config.REDIS_URL)
        
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

# Initialize GitHub routes with Redis
init_github_redis(redis_available, job_queue)

# Initialize database
db.init_app(app)

# Create database tables on startup
with app.app_context():
    db.create_all()
    print("Database tables created/verified")


# ==================== Whoop Startup Sync ====================

def check_whoop_data_current():
    """
    Check if we have Whoop data for today (or yesterday, since WHOOP data
    is usually available for the previous day's sleep/recovery).
    
    Returns:
        tuple: (has_recent_data: bool, last_data_date: datetime or None)
    """
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    
    # Check for recent recovery data (most reliable indicator)
    latest_recovery = WhoopRecovery.query.order_by(WhoopRecovery.date.desc()).first()
    latest_cycle = WhoopCycle.query.order_by(WhoopCycle.start_time.desc()).first()
    
    last_data_date = None
    
    if latest_recovery and latest_recovery.date:
        recovery_date = latest_recovery.date.date() if hasattr(latest_recovery.date, 'date') else latest_recovery.date
        last_data_date = recovery_date
    
    if latest_cycle and latest_cycle.start_time:
        cycle_date = latest_cycle.start_time.date() if hasattr(latest_cycle.start_time, 'date') else latest_cycle.start_time
        if last_data_date is None or cycle_date > last_data_date:
            last_data_date = cycle_date
    
    # Consider data "current" if we have data from yesterday or today
    # (WHOOP typically provides yesterday's complete data)
    has_recent_data = last_data_date is not None and last_data_date >= yesterday
    
    return has_recent_data, last_data_date


def perform_startup_sync():
    """
    Perform Whoop data sync on startup if needed.
    
    This runs in a background thread to not block app startup.
    """
    from services.whoop_service import WhoopService
    
    try:
        print("\n" + "=" * 60)
        print("🔄 WHOOP STARTUP SYNC CHECK")
        print("=" * 60)
        
        service = WhoopService()
        
        if not service.is_configured():
            print("⚠️  Whoop API not configured - skipping startup sync")
            print("   Set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN")
            return
        
        # Check current data status
        has_recent_data, last_data_date = check_whoop_data_current()
        
        # Get total record counts
        recovery_count = WhoopRecovery.query.count()
        sleep_count = WhoopSleep.query.count()
        cycle_count = WhoopCycle.query.count()
        
        print(f"\n📊 Current database status:")
        print(f"   Recovery records: {recovery_count}")
        print(f"   Sleep records: {sleep_count}")
        print(f"   Cycle records: {cycle_count}")
        print(f"   Last data date: {last_data_date or 'No data'}")
        print(f"   Data is current: {has_recent_data}")
        
        # Determine sync strategy
        if recovery_count == 0 and sleep_count == 0 and cycle_count == 0:
            # Database is empty - do a full historical sync
            print("\n🚀 Database is empty - performing FULL historical sync...")
            sync_type = 'full_initial'
            
            # Use the fetch_all pattern from fetch_all_workouts.py
            if not service.ensure_authenticated():
                print("❌ Authentication failed - cannot sync")
                update_sync_status('failed', sync_type, 0, 'Authentication failed')
                return
            
            # Sync all data (90 days by default for initial sync)
            results = service.sync_all(days=90)
            total_synced = sum(results.values())
            
            print(f"\n✅ Full sync complete!")
            print(f"   Total records synced: {total_synced}")
            update_sync_status('completed', sync_type, total_synced)
            
        elif not has_recent_data:
            # Have some data but not current - do incremental sync
            print("\n🔄 Data is stale - performing incremental sync...")
            sync_type = 'incremental_startup'
            
            if not service.ensure_authenticated():
                print("❌ Authentication failed - cannot sync")
                update_sync_status('failed', sync_type, 0, 'Authentication failed')
                return
            
            # Incremental sync from last recorded date
            results = service.sync_incremental()
            total_synced = sum(r.get('new', 0) + r.get('updated', 0) for r in results.values())
            
            print(f"\n✅ Incremental sync complete!")
            print(f"   Total records synced: {total_synced}")
            update_sync_status('completed', sync_type, total_synced)
            
        else:
            # Data is current - just verify and maybe do a quick refresh
            print("\n✅ Data is current - no sync needed")
            print(f"   Last data from: {last_data_date}")
            
            # Optionally do a quick 2-day sync to catch any updates
            if service.ensure_authenticated():
                print("   Performing quick 2-day refresh to catch updates...")
                results = {
                    'recovery': service.sync_recovery(days=2),
                    'sleep': service.sync_sleep(days=2),
                    'cycles': service.sync_cycles(days=2)
                }
                total_synced = sum(results.values())
                print(f"   Quick refresh: {total_synced} records updated")
                update_sync_status('completed', 'quick_refresh', total_synced)
        
        print("\n" + "=" * 60)
        print("🎉 WHOOP STARTUP SYNC COMPLETE")
        print("=" * 60 + "\n")
        
    except Exception as e:
        print(f"\n❌ Startup sync failed: {e}")
        import traceback
        traceback.print_exc()
        update_sync_status('failed', 'startup', 0, str(e))


def update_sync_status(status: str, sync_type: str, records_synced: int, error_message: str = None):
    """Update or create sync status record"""
    try:
        sync_status = WhoopSyncStatus.query.first()
        if not sync_status:
            sync_status = WhoopSyncStatus()
            db.session.add(sync_status)
        
        sync_status.last_sync_at = datetime.utcnow()
        sync_status.last_sync_type = sync_type
        sync_status.records_synced = records_synced
        sync_status.status = status
        sync_status.error_message = error_message
        
        db.session.commit()
    except Exception as e:
        print(f"Failed to update sync status: {e}")


def run_startup_sync_in_background():
    """Run the startup sync in a background thread with app context"""
    with app.app_context():
        perform_startup_sync()


# ==================== CORS Handlers ====================
# Note: Flask-CORS handles most CORS headers automatically.
# We only need the after_request for credentials support on non-whitelisted origins.


# ==================== Register Blueprints ====================

# GitHub Dashboard: /api/github/*
app.register_blueprint(github_bp, url_prefix='/api/github')

# Whoop Dashboard: /api/whoop/*
app.register_blueprint(whoop_bp, url_prefix='/api/whoop')

# Legacy routes for backwards compatibility (can be removed later)
# These redirect old /api/projects to new /api/github/projects
@app.route('/api/projects', methods=['GET'])
def legacy_projects():
    """Legacy endpoint - redirects to /api/github/projects"""
    from routes.github import get_projects
    return get_projects()

@app.route('/api/metrics', methods=['GET'])
def legacy_metrics():
    """Legacy endpoint - redirects to /api/github/metrics"""
    from routes.github import get_overall_metrics
    return get_overall_metrics()

@app.route('/api/refresh', methods=['POST'])
def legacy_refresh():
    """Legacy endpoint - redirects to /api/github/refresh"""
    from routes.github import refresh_stats
    return refresh_stats()


# ==================== Root & Health Endpoints ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})


@app.route('/', methods=['GET'])
def index():
    """API documentation"""
    return jsonify({
        'message': 'Project Tracker Backend API',
        'version': '2.2',
        'redis_available': redis_available,
        'dashboards': {
            'github': {
                'description': 'GitHub project statistics',
                'endpoints': {
                    'GET /api/github/projects': 'List all projects',
                    'GET /api/github/project/<name>': 'Get specific project',
                    'GET /api/github/metrics': 'Get overall metrics',
                    'POST /api/github/refresh': 'Refresh data from GitHub',
                    'GET /api/github/refresh/status/<job_id>': 'Check refresh job status',
                    'GET /api/github/refresh/jobs': 'List recent refresh jobs'
                }
            },
            'whoop': {
                'description': 'Whoop health and fitness data (from local database)',
                'note': 'Data is synced from Whoop API on startup and periodically. All reads are from local DB.',
                'database_endpoints': {
                    'GET /api/whoop/recovery': 'Get recovery data from database',
                    'GET /api/whoop/recovery/latest': 'Get latest recovery from database',
                    'GET /api/whoop/sleep': 'Get sleep data from database',
                    'GET /api/whoop/sleep/latest': 'Get latest sleep from database',
                    'GET /api/whoop/workouts': 'Get workout data from database',
                    'GET /api/whoop/cycles': 'Get daily strain cycles from database',
                    'GET /api/whoop/metrics': 'Get aggregated Whoop metrics from database',
                    'GET /api/whoop/profile': 'Get cached user profile from database'
                },
                'sync_endpoints': {
                    'GET /api/whoop/refresh/today': 'Quick sync of today\'s data (called on page load)',
                    'POST /api/whoop/refresh': 'Manual sync from Whoop API (by days)',
                    'POST /api/whoop/sync/incremental': 'Sync new data since last sync',
                    'POST /api/whoop/sync/full': 'Full historical sync (up to 365 days)',
                    'GET /api/whoop/sync/status': 'Get last sync status'
                },
                'management_endpoints': {
                    'GET /api/whoop/status': 'Check API configuration status',
                    'GET /api/whoop/auth/test': 'Test authentication'
                },
                'query_params': {
                    'days': 'Number of days to look back (default: 7)',
                    'start_date': 'Start date filter (YYYY-MM-DD)',
                    'end_date': 'End date filter (YYYY-MM-DD)',
                    'limit': 'Maximum number of records to return'
                }
            }
        },
        'legacy_endpoints': {
            'GET /api/projects': 'Redirects to /api/github/projects',
            'GET /api/metrics': 'Redirects to /api/github/metrics',
            'POST /api/refresh': 'Redirects to /api/github/refresh'
        }
    })


# ==================== Scheduler ====================

def scheduled_whoop_sync():
    """Scheduled task to sync Whoop data periodically"""
    from services.whoop_service import WhoopService
    
    print("\n⏰ Running scheduled Whoop sync...")
    
    try:
        service = WhoopService()
        
        if not service.is_configured():
            print("   Whoop not configured - skipping")
            return
        
        if not service.ensure_authenticated():
            print("   Authentication failed - skipping")
            return
        
        # Do incremental sync
        results = service.sync_incremental()
        total_synced = sum(r.get('new', 0) + r.get('updated', 0) for r in results.values())
        
        print(f"   ✅ Scheduled sync complete: {total_synced} records")
        update_sync_status('completed', 'scheduled', total_synced)
        
    except Exception as e:
        print(f"   ❌ Scheduled sync failed: {e}")
        update_sync_status('failed', 'scheduled', 0, str(e))


def init_scheduler():
    """Initialize background scheduler for periodic updates"""
    from services.github_service import update_project_stats
    
    scheduler = BackgroundScheduler()
    
    # GitHub stats refresh - every 24 hours
    scheduler.add_job(
        func=update_project_stats,
        trigger="interval",
        hours=24,
        id='update_github_stats'
    )
    
    # Whoop data sync - every 24 hours
    # Wrap in app context for database access
    def whoop_sync_with_context():
        with app.app_context():
            scheduled_whoop_sync()
    
    scheduler.add_job(
        func=whoop_sync_with_context,
        trigger="interval",
        hours=24,
        id='sync_whoop_data'
    )
    
    scheduler.start()
    print("📅 Scheduler started:")
    print("   - GitHub stats: every 24 hours")
    print("   - Whoop sync: every 24 hours")
    
    return scheduler


# ==================== Startup ====================

# Run startup sync in background thread (non-blocking)
# This ensures the app starts quickly while sync happens in background
startup_sync_thread = threading.Thread(target=run_startup_sync_in_background, daemon=True)
startup_sync_thread.start()


if __name__ == '__main__':
    # Database already created above during module load
    scheduler = init_scheduler()
    
    try:
        app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
    except KeyboardInterrupt:
        scheduler.shutdown()
        print("Scheduler stopped")
