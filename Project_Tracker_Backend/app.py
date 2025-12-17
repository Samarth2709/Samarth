"""
Project Tracker Backend
Main Flask application with GitHub and Whoop dashboards
"""
import os
import redis
from flask import Flask, jsonify, request
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
from rq import Queue

from config import Config
from models import db
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


# ==================== CORS Handlers ====================

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        from flask import make_response
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        return response


@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    
    if origin in Config.CORS_ORIGINS:
        response.headers.add('Access-Control-Allow-Origin', origin)
    
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    
    return response


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
        'version': '2.0',
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
                'description': 'Whoop health and fitness data',
                'endpoints': {
                    'GET /api/whoop/recovery': 'Get recovery data',
                    'GET /api/whoop/recovery/latest': 'Get latest recovery',
                    'GET /api/whoop/sleep': 'Get sleep data',
                    'GET /api/whoop/sleep/latest': 'Get latest sleep',
                    'GET /api/whoop/workouts': 'Get workout data',
                    'GET /api/whoop/cycles': 'Get daily strain cycles',
                    'GET /api/whoop/metrics': 'Get aggregated Whoop metrics',
                    'POST /api/whoop/refresh': 'Refresh data from Whoop',
                    'GET /api/whoop/status': 'Check Whoop API configuration'
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

def init_scheduler():
    """Initialize background scheduler for periodic updates"""
    from services.github_service import update_project_stats
    
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        func=update_project_stats,
        trigger="interval",
        hours=24,
        id='update_github_stats'
    )
    # Can add Whoop refresh here too if needed
    scheduler.start()
    return scheduler


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("Database tables created/updated")
    
    scheduler = init_scheduler()
    print("Scheduler started for periodic updates")
    
    try:
        app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
    except KeyboardInterrupt:
        scheduler.shutdown()
        print("Scheduler stopped")
