"""
Whoop Dashboard Routes
=======================

This module provides API endpoints for the WHOOP health and fitness dashboard.

Architecture:
- Data is synced from WHOOP API to local database on startup and periodically
- All frontend-facing endpoints read from local database (fast, offline-capable)
- Sync endpoints update local database from WHOOP API

Endpoint Categories:
1. Database endpoints (/recovery, /sleep, etc.) - Read from local database
2. Sync endpoints (/refresh, /sync/*) - Sync data from WHOOP API to database  
3. Admin endpoints (/api/*) - Direct WHOOP API access for debugging
4. Auth endpoints (/auth/*) - OAuth token management
"""
from flask import Blueprint, jsonify, request
from models import db, WhoopRecovery, WhoopSleep, WhoopWorkout, WhoopCycle, WhoopProfile, WhoopSyncStatus
from services.whoop_service import WhoopService
from datetime import datetime, timedelta
import traceback
import requests

whoop_bp = Blueprint('whoop', __name__)


# ==============================================================================
# Helper Functions
# ==============================================================================

def parse_date_params():
    """Parse common date query parameters"""
    days = request.args.get('days', type=int)
    start = request.args.get('start')
    end = request.args.get('end')
    limit = request.args.get('limit', type=int)
    
    return {
        'days': days,
        'start_date': start,
        'end_date': end,
        'limit': limit
    }


# ==============================================================================
# Database Endpoints (Synced Data)
# ==============================================================================

@whoop_bp.route('/recovery', methods=['GET'])
def get_recovery():
    """Get recovery data from local database
    
    Query params:
        - days: Number of days to fetch (default: 7)
        - start_date: Start date (YYYY-MM-DD)
        - end_date: End date (YYYY-MM-DD)
    """
    days = request.args.get('days', 7, type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = WhoopRecovery.query.order_by(WhoopRecovery.date.desc())
    
    if start_date and end_date:
        query = query.filter(
            WhoopRecovery.date >= datetime.strptime(start_date, '%Y-%m-%d'),
            WhoopRecovery.date <= datetime.strptime(end_date, '%Y-%m-%d')
        )
    else:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(WhoopRecovery.date >= cutoff)
    
    records = query.all()
    return jsonify([r.to_dict() for r in records])


@whoop_bp.route('/recovery/latest', methods=['GET'])
def get_latest_recovery():
    """Get the most recent recovery score from database"""
    record = WhoopRecovery.query.order_by(WhoopRecovery.date.desc()).first()
    if not record:
        return jsonify({'error': 'No recovery data found'}), 404
    return jsonify(record.to_dict())


@whoop_bp.route('/sleep', methods=['GET'])
def get_sleep():
    """Get sleep data from local database
    
    Query params:
        - days: Number of days to fetch (default: 7)
        - start_date: Start date (YYYY-MM-DD)
        - end_date: End date (YYYY-MM-DD)
    """
    days = request.args.get('days', 7, type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = WhoopSleep.query.order_by(WhoopSleep.date.desc())
    
    if start_date and end_date:
        query = query.filter(
            WhoopSleep.date >= datetime.strptime(start_date, '%Y-%m-%d'),
            WhoopSleep.date <= datetime.strptime(end_date, '%Y-%m-%d')
        )
    else:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(WhoopSleep.date >= cutoff)
    
    records = query.all()
    return jsonify([r.to_dict() for r in records])


@whoop_bp.route('/sleep/latest', methods=['GET'])
def get_latest_sleep():
    """Get the most recent sleep data from database"""
    record = WhoopSleep.query.order_by(WhoopSleep.date.desc()).first()
    if not record:
        return jsonify({'error': 'No sleep data found'}), 404
    return jsonify(record.to_dict())


@whoop_bp.route('/workouts', methods=['GET'])
def get_workouts():
    """Get workout/strain data from local database
    
    Query params:
        - days: Number of days to fetch (default: 7)
        - start_date: Start date (YYYY-MM-DD)
        - end_date: End date (YYYY-MM-DD)
    """
    days = request.args.get('days', 7, type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = WhoopWorkout.query.order_by(WhoopWorkout.start_time.desc())
    
    if start_date and end_date:
        query = query.filter(
            WhoopWorkout.start_time >= datetime.strptime(start_date, '%Y-%m-%d'),
            WhoopWorkout.start_time <= datetime.strptime(end_date, '%Y-%m-%d')
        )
    else:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(WhoopWorkout.start_time >= cutoff)
    
    records = query.all()
    return jsonify([r.to_dict() for r in records])


@whoop_bp.route('/cycles', methods=['GET'])
def get_cycles():
    """Get physiological cycle data from local database
    
    Query params:
        - days: Number of days to fetch (default: 7)
    """
    days = request.args.get('days', 7, type=int)
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    records = WhoopCycle.query.filter(
        WhoopCycle.start_time >= cutoff
    ).order_by(WhoopCycle.start_time.desc()).all()
    
    return jsonify([r.to_dict() for r in records])


@whoop_bp.route('/metrics', methods=['GET'])
def get_overall_metrics():
    """Get aggregated Whoop metrics from local database"""
    days = request.args.get('days', 30, type=int)
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Recovery stats
    recovery_records = WhoopRecovery.query.filter(WhoopRecovery.date >= cutoff).all()
    recovery_scores = [r.recovery_score for r in recovery_records if r.recovery_score]
    
    # Sleep stats
    sleep_records = WhoopSleep.query.filter(WhoopSleep.date >= cutoff).all()
    sleep_hours = [r.total_sleep_hours for r in sleep_records if r.total_sleep_hours]
    sleep_performances = [r.sleep_performance for r in sleep_records if r.sleep_performance]
    
    # Workout stats
    workouts = WhoopWorkout.query.filter(WhoopWorkout.start_time >= cutoff).all()
    workout_strains = [w.strain for w in workouts if w.strain]
    
    # Cycle stats
    cycles = WhoopCycle.query.filter(WhoopCycle.start_time >= cutoff).all()
    day_strains = [c.strain for c in cycles if c.strain]
    
    return jsonify({
        'period_days': days,
        'recovery': {
            'average_score': round(sum(recovery_scores) / len(recovery_scores), 1) if recovery_scores else 0,
            'max_score': max(recovery_scores) if recovery_scores else 0,
            'min_score': min(recovery_scores) if recovery_scores else 0,
            'total_records': len(recovery_records),
            'green_days': len([r for r in recovery_records if r.recovery_score and r.recovery_score >= 67]),
            'yellow_days': len([r for r in recovery_records if r.recovery_score and 34 <= r.recovery_score < 67]),
            'red_days': len([r for r in recovery_records if r.recovery_score and r.recovery_score < 34])
        },
        'sleep': {
            'average_hours': round(sum(sleep_hours) / len(sleep_hours), 1) if sleep_hours else 0,
            'average_performance': round(sum(sleep_performances) / len(sleep_performances), 1) if sleep_performances else 0,
            'total_records': len(sleep_records)
        },
        'strain': {
            'average_daily_strain': round(sum(day_strains) / len(day_strains), 1) if day_strains else 0,
            'max_daily_strain': round(max(day_strains), 1) if day_strains else 0,
            'total_workouts': len(workouts),
            'average_workout_strain': round(sum(workout_strains) / len(workout_strains), 1) if workout_strains else 0
        }
    })


@whoop_bp.route('/profile', methods=['GET'])
def get_profile():
    """Get cached user profile from local database
    
    If no cached profile exists, fetches from API and caches it.
    Use ?refresh=true to force refresh from API.
    """
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    # Try to get from cache first
    cached_profile = WhoopProfile.query.first()
    
    if cached_profile and not force_refresh:
        return jsonify({
            **cached_profile.to_dict(),
            'source': 'cache'
        })
    
    # Fetch from API and cache
    try:
        service = WhoopService()
        if not service.is_configured():
            if cached_profile:
                return jsonify({
                    **cached_profile.to_dict(),
                    'source': 'cache',
                    'note': 'API not configured, returning cached data'
                })
            return jsonify({'error': 'Whoop API not configured and no cached profile'}), 400
        
        profile_data = service.get_profile()
        if profile_data:
            # Cache the profile
            if cached_profile:
                cached_profile.user_id = str(profile_data.get('user_id', ''))
                cached_profile.first_name = profile_data.get('first_name')
                cached_profile.last_name = profile_data.get('last_name')
                cached_profile.email = profile_data.get('email')
            else:
                cached_profile = WhoopProfile(
                    user_id=str(profile_data.get('user_id', '')),
                    first_name=profile_data.get('first_name'),
                    last_name=profile_data.get('last_name'),
                    email=profile_data.get('email')
                )
                db.session.add(cached_profile)
            
            db.session.commit()
            
            return jsonify({
                **cached_profile.to_dict(),
                'source': 'api'
            })
        else:
            if cached_profile:
                return jsonify({
                    **cached_profile.to_dict(),
                    'source': 'cache',
                    'note': 'API fetch failed, returning cached data'
                })
            return jsonify({'error': 'Failed to fetch profile'}), 500
            
    except Exception as e:
        if cached_profile:
            return jsonify({
                **cached_profile.to_dict(),
                'source': 'cache',
                'note': f'API error, returning cached data: {str(e)}'
            })
        return jsonify({'error': str(e)}), 500


@whoop_bp.route('/sync/status', methods=['GET'])
def get_sync_status():
    """Get the last sync status for Whoop data
    
    Returns information about when the last sync occurred,
    how many records were synced, and the sync status.
    """
    sync_status = WhoopSyncStatus.query.first()
    
    # Get database record counts
    db_counts = {
        'recovery': WhoopRecovery.query.count(),
        'sleep': WhoopSleep.query.count(),
        'workouts': WhoopWorkout.query.count(),
        'cycles': WhoopCycle.query.count()
    }
    
    # Get latest record dates
    latest_recovery = WhoopRecovery.query.order_by(WhoopRecovery.date.desc()).first()
    latest_sleep = WhoopSleep.query.order_by(WhoopSleep.date.desc()).first()
    latest_cycle = WhoopCycle.query.order_by(WhoopCycle.start_time.desc()).first()
    
    latest_dates = {
        'recovery': latest_recovery.date.strftime('%Y-%m-%d') if latest_recovery and latest_recovery.date else None,
        'sleep': latest_sleep.date.strftime('%Y-%m-%d') if latest_sleep and latest_sleep.date else None,
        'cycle': latest_cycle.start_time.strftime('%Y-%m-%d') if latest_cycle and latest_cycle.start_time else None
    }
    
    return jsonify({
        'last_sync': sync_status.to_dict() if sync_status else None,
        'database_counts': db_counts,
        'latest_data_dates': latest_dates,
        'total_records': sum(db_counts.values())
    })


# ==============================================================================
# Direct API Endpoints (Real-time from Whoop)
# ==============================================================================

@whoop_bp.route('/api/profile', methods=['GET'])
def api_get_profile():
    """Get user profile directly from Whoop API
    
    Returns user information including name, email, and user ID.
    """
    try:
        service = WhoopService()
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'Please set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN in .env'
            }), 400
        
        profile = service.get_profile()
        if profile is None:
            return jsonify({'error': 'Failed to fetch profile from Whoop API'}), 500
        
        return jsonify(profile)
        
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@whoop_bp.route('/api/body', methods=['GET'])
def api_get_body():
    """Get body measurements directly from Whoop API
    
    Returns height, weight, and other body measurements.
    """
    try:
        service = WhoopService()
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'Please set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN in .env'
            }), 400
        
        body = service.get_body_measurement()
        if body is None:
            return jsonify({'error': 'Failed to fetch body measurements from Whoop API'}), 500
        
        return jsonify(body)
        
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@whoop_bp.route('/api/cycles', methods=['GET'])
def api_get_cycles():
    """Get cycle (daily strain) data directly from Whoop API (V1)
    
    Query params:
        - days: Number of days to look back (default: 7)
        - start: ISO-8601 start timestamp
        - end: ISO-8601 end timestamp
        - limit: Maximum records to return
    """
    try:
        service = WhoopService()
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'Please set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN in .env'
            }), 400
        
        params = parse_date_params()
        days = params['days'] or 7
        
        cycles = service.get_cycles(
            days=days,
            start_date=params['start_date'],
            end_date=params['end_date'],
            limit=params['limit']
        )
        
        return jsonify({
            'records': cycles,
            'count': len(cycles),
            'source': 'whoop_api_v1'
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@whoop_bp.route('/api/cycles/<cycle_id>', methods=['GET'])
def api_get_cycle_by_id(cycle_id):
    """Get a specific cycle by ID from Whoop API"""
    try:
        service = WhoopService()
        if not service.is_configured():
            return jsonify({'error': 'Whoop API not configured'}), 400
        
        cycle = service.get_cycle_by_id(cycle_id)
        if cycle is None:
            return jsonify({'error': f'Cycle {cycle_id} not found'}), 404
        
        return jsonify(cycle)
        
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@whoop_bp.route('/api/recovery', methods=['GET'])
def api_get_recovery():
    """Get recovery data directly from Whoop API (V2)
    
    Query params:
        - days: Number of days to look back (default: 7)
        - start: ISO-8601 start timestamp
        - end: ISO-8601 end timestamp
        - limit: Maximum records to return
    """
    try:
        service = WhoopService()
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'Please set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN in .env'
            }), 400
        
        params = parse_date_params()
        days = params['days'] or 7
        
        recoveries = service.get_recovery(
            days=days,
            start_date=params['start_date'],
            end_date=params['end_date'],
            limit=params['limit']
        )
        
        return jsonify({
            'records': recoveries,
            'count': len(recoveries),
            'source': 'whoop_api_v2'
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@whoop_bp.route('/api/sleep', methods=['GET'])
def api_get_sleep():
    """Get sleep data directly from Whoop API (V2)
    
    Query params:
        - days: Number of days to look back (default: 7)
        - start: ISO-8601 start timestamp
        - end: ISO-8601 end timestamp
        - limit: Maximum records to return
    """
    try:
        service = WhoopService()
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'Please set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN in .env'
            }), 400
        
        params = parse_date_params()
        days = params['days'] or 7
        
        sleeps = service.get_sleep(
            days=days,
            start_date=params['start_date'],
            end_date=params['end_date'],
            limit=params['limit']
        )
        
        return jsonify({
            'records': sleeps,
            'count': len(sleeps),
            'source': 'whoop_api_v2'
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@whoop_bp.route('/api/sleep/<sleep_id>', methods=['GET'])
def api_get_sleep_by_id(sleep_id):
    """Get a specific sleep record by ID from Whoop API"""
    try:
        service = WhoopService()
        if not service.is_configured():
            return jsonify({'error': 'Whoop API not configured'}), 400
        
        sleep = service.get_sleep_by_id(sleep_id)
        if sleep is None:
            return jsonify({'error': f'Sleep record {sleep_id} not found'}), 404
        
        return jsonify(sleep)
        
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@whoop_bp.route('/api/workouts', methods=['GET'])
def api_get_workouts():
    """Get workout data directly from Whoop API (V2)
    
    Query params:
        - days: Number of days to look back (default: 7)
        - start: ISO-8601 start timestamp
        - end: ISO-8601 end timestamp
        - limit: Maximum records to return
    """
    try:
        service = WhoopService()
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'Please set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN in .env'
            }), 400
        
        params = parse_date_params()
        days = params['days'] or 7
        
        workouts = service.get_workouts(
            days=days,
            start_date=params['start_date'],
            end_date=params['end_date'],
            limit=params['limit']
        )
        
        return jsonify({
            'records': workouts,
            'count': len(workouts),
            'source': 'whoop_api_v2'
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@whoop_bp.route('/api/workouts/<workout_id>', methods=['GET'])
def api_get_workout_by_id(workout_id):
    """Get a specific workout by ID from Whoop API"""
    try:
        service = WhoopService()
        if not service.is_configured():
            return jsonify({'error': 'Whoop API not configured'}), 400
        
        workout = service.get_workout_by_id(workout_id)
        if workout is None:
            return jsonify({'error': f'Workout {workout_id} not found'}), 404
        
        return jsonify(workout)
        
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


@whoop_bp.route('/api/dashboard', methods=['GET'])
def api_get_dashboard():
    """Get combined dashboard data with Cycles, Recovery, and Sleep joined
    
    This implements the "Three-Legged Fetch" pattern:
    1. Fetches Cycles (V1) - daily strain and container info
    2. Fetches Recoveries (V2) - recovery scores
    3. Fetches Sleep (V2) - sleep performance
    4. Joins by cycle_id for a complete daily view
    
    Query params:
        - days: Number of days to look back (default: 7)
    """
    try:
        service = WhoopService()
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'Please set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN in .env'
            }), 400
        
        days = request.args.get('days', 7, type=int)
        dashboard_data = service.get_dashboard_data(days=days)
        
        return jsonify(dashboard_data)
        
    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


# ==============================================================================
# Sync & Status Endpoints
# ==============================================================================

@whoop_bp.route('/refresh', methods=['POST'])
def refresh_data():
    """Manually trigger Whoop data refresh (sync to database)
    
    Query params:
        - days: Number of days to sync (default: 7)
    """
    try:
        service = WhoopService()
        
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'Please set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN in .env',
                'setup_url': 'https://developer.whoop.com'
            }), 400
        
        days = request.args.get('days', 7, type=int)
        
        results = {
            'recovery': service.sync_recovery(days=days),
            'sleep': service.sync_sleep(days=days),
            'workouts': service.sync_workouts(days=days),
            'cycles': service.sync_cycles(days=days)
        }
        
        return jsonify({
            'message': 'Whoop data refreshed successfully',
            'synced': results,
            'period_days': days
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'trace': traceback.format_exc()
        }), 500


@whoop_bp.route('/refresh/today', methods=['POST', 'GET'])
def refresh_today():
    """
    Lightweight refresh that syncs only today's and yesterday's data.
    
    This endpoint is designed to be called on page load to ensure
    the user sees the most current data without doing a full sync.
    
    - Syncs only 2 days of data (today and yesterday)
    - Fast response time for page load
    - Supports both GET and POST for flexibility
    
    Returns:
        JSON with sync results for each data type
    """
    try:
        service = WhoopService()
        
        if not service.is_configured():
            # Return cached data info if API not configured
            return jsonify({
                'status': 'skipped',
                'reason': 'Whoop API not configured',
                'message': 'Using cached data from database'
            }), 200  # Return 200 so frontend doesn't error
        
        if not service.ensure_authenticated():
            return jsonify({
                'status': 'skipped',
                'reason': 'Authentication failed',
                'message': 'Using cached data from database'
            }), 200  # Return 200 so frontend doesn't error
        
        # Sync only 2 days (today + yesterday)
        results = {
            'recovery': service.sync_recovery(days=2),
            'sleep': service.sync_sleep(days=2),
            'workouts': service.sync_workouts(days=2),
            'cycles': service.sync_cycles(days=2)
        }
        
        total_synced = sum(results.values())
        
        return jsonify({
            'status': 'success',
            'message': 'Today\'s data refreshed',
            'synced': results,
            'total_records': total_synced
        })
        
    except Exception as e:
        # Don't fail the page load - just return status
        return jsonify({
            'status': 'error',
            'reason': str(e),
            'message': 'Using cached data from database'
        }), 200  # Return 200 so frontend doesn't error


@whoop_bp.route('/sync/incremental', methods=['POST'])
def sync_incremental():
    """
    Incrementally sync all data from last recorded date to now.
    
    This is an efficient refresh that only fetches new data since the last sync.
    It automatically determines the last recorded date for each data type
    (workouts, sleep, recovery, cycles) and fetches all new data from that
    point to the current time.
    
    Features:
    - Fetches data in 7-day windows with pagination
    - Handles token refresh automatically
    - Updates existing records and adds new ones
    - Returns detailed sync statistics
    
    Returns:
        JSON with sync results for each data type including:
        - new: Number of new records added
        - updated: Number of existing records updated
        - start_date: Start of sync range
        - end_date: End of sync range (now)
    """
    try:
        service = WhoopService()
        
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'Please set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN in .env',
                'setup_url': 'https://developer.whoop.com'
            }), 400
        
        if not service.ensure_authenticated():
            return jsonify({
                'error': 'Authentication failed',
                'details': 'Could not obtain access token. Check your refresh token.'
            }), 401
        
        # Perform incremental sync
        results = service.sync_incremental()
        
        # Get current database counts
        db_counts = {
            'workouts': WhoopWorkout.query.count(),
            'sleep': WhoopSleep.query.count(),
            'recovery': WhoopRecovery.query.count(),
            'cycles': WhoopCycle.query.count()
        }
        
        return jsonify({
            'message': 'Incremental sync completed successfully',
            'sync_results': results,
            'database_totals': db_counts,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'trace': traceback.format_exc()
        }), 500


@whoop_bp.route('/status', methods=['GET'])
def get_status():
    """Check Whoop API configuration and connection status"""
    service = WhoopService()
    
    status = {
        'configured': service.is_configured(),
        'has_access_token': service.has_valid_token(),
        'has_refresh_token': bool(service.refresh_token),
        'has_client_credentials': bool(service.client_id and service.client_secret)
    }
    
    # Test authentication if configured
    if service.is_configured():
        try:
            if service.ensure_authenticated():
                status['authenticated'] = True
                status['message'] = 'Successfully authenticated with Whoop API'
            else:
                status['authenticated'] = False
                status['message'] = 'Failed to authenticate with Whoop API'
        except Exception as e:
            status['authenticated'] = False
            status['error'] = str(e)
    
    return jsonify(status)


@whoop_bp.route('/auth/test', methods=['GET'])
def test_auth():
    """Test authentication and return user profile if successful"""
    try:
        service = WhoopService()
        
        if not service.is_configured():
            return jsonify({
                'success': False,
                'error': 'Whoop API not configured',
                'details': 'Missing WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, or WHOOP_REFRESH_TOKEN'
            }), 400
        
        if not service.ensure_authenticated():
            return jsonify({
                'success': False,
                'error': 'Authentication failed',
                'details': 'Could not obtain access token. Check your credentials.'
            }), 401
        
        # Fetch profile to verify authentication
        profile = service.get_profile()
        
        if profile:
            return jsonify({
                'success': True,
                'message': 'Successfully authenticated with Whoop API',
                'profile': profile
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Could not fetch profile',
                'details': 'Authentication succeeded but profile fetch failed'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'trace': traceback.format_exc()
        }), 500


@whoop_bp.route('/auth/authorize-url', methods=['GET'])
def get_authorize_url():
    """Get the OAuth authorization URL for getting a new refresh token
    
    This endpoint returns the URL that users need to visit to authorize the app
    and get a new refresh token. Useful when the current refresh token has expired.
    
    Returns:
        JSON with authorization URL and instructions
    """
    from urllib.parse import urlencode
    
    service = WhoopService()
    
    if not service.client_id:
        return jsonify({
            'error': 'Whoop API not configured',
            'details': 'WHOOP_CLIENT_ID is not set'
        }), 400
    
    # Default redirect URI (should match your Whoop app settings)
    redirect_uri = request.args.get('redirect_uri', 'https://www.samarthkumbla.com')
    
    params = {
        'client_id': service.client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': 'offline',  # Required to get refresh token
        'state': 'whoop_auth'
    }
    
    auth_url = f"https://api.prod.whoop.com/oauth/oauth2/authorize?{urlencode(params)}"
    
    return jsonify({
        'authorization_url': auth_url,
        'redirect_uri': redirect_uri,
        'instructions': {
            'step1': f'Visit the authorization_url in your browser',
            'step2': f'Authorize the app',
            'step3': f'You will be redirected to {redirect_uri}?code=AUTHORIZATION_CODE',
            'step4': 'Copy the authorization code from the URL',
            'step5': 'Use POST /api/whoop/auth/exchange-code with the code to get refresh token'
        },
        'note': 'Authorization codes expire quickly, so exchange them immediately'
    })


@whoop_bp.route('/auth/exchange-code', methods=['POST'])
def exchange_authorization_code():
    """Exchange an OAuth authorization code for a refresh token
    
    This endpoint exchanges an authorization code (obtained from the OAuth flow)
    for a new refresh token and access token.
    
    Request body:
        {
            "code": "authorization_code_from_oauth_redirect",
            "redirect_uri": "https://www.samarthkumbla.com" (optional, defaults to configured)
        }
    
    Returns:
        JSON with new access_token and refresh_token
        NOTE: The refresh_token must be saved immediately - it replaces the old one
    """
    try:
        from urllib.parse import urlencode
        
        service = WhoopService()
        
        if not service.client_id or not service.client_secret:
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'WHOOP_CLIENT_ID or WHOOP_CLIENT_SECRET is not set'
            }), 400
        
        data = request.get_json() or {}
        auth_code = data.get('code')
        redirect_uri = data.get('redirect_uri', 'https://www.samarthkumbla.com')
        
        if not auth_code:
            return jsonify({
                'error': 'Missing authorization code',
                'details': 'Please provide "code" in the request body'
            }), 400
        
        # Exchange code for tokens
        payload = {
            'grant_type': 'authorization_code',
            'code': auth_code,
            'client_id': service.client_id,
            'client_secret': service.client_secret,
            'redirect_uri': redirect_uri
        }
        
        response = requests.post(
            'https://api.prod.whoop.com/oauth/oauth2/token',
            data=payload,
            timeout=30
        )
        
        if response.status_code != 200:
            return jsonify({
                'error': 'Failed to exchange authorization code',
                'details': response.text,
                'status_code': response.status_code
            }), response.status_code
        
        token_data = response.json()
        refresh_token = token_data.get('refresh_token')
        access_token = token_data.get('access_token')
        
        if not refresh_token:
            return jsonify({
                'error': 'No refresh token in response',
                'details': 'Make sure you included scope=offline in the authorization URL'
            }), 400
        
        # Try to save tokens (if .env file exists)
        try:
            service._save_tokens(access_token, refresh_token)
            saved = True
        except:
            saved = False
        
        return jsonify({
            'success': True,
            'message': 'Successfully obtained new tokens',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': token_data.get('token_type'),
            'expires_in': token_data.get('expires_in'),
            'tokens_saved': saved,
            'important': 'Save the refresh_token immediately - it replaces your old one!',
            'next_steps': {
                'local': 'If running locally, tokens are saved to .env file',
                'production': 'If in production (Railway), update WHOOP_REFRESH_TOKEN in Railway dashboard'
            }
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'trace': traceback.format_exc()
        }), 500


# ==============================================================================
# Extended Sync Endpoints
# ==============================================================================

@whoop_bp.route('/sync/full', methods=['POST'])
def sync_full():
    """Sync extended historical data (up to 90 days by default, max 365)
    
    Query params:
        - days: Number of days to sync (default: 90, max: 365)
    """
    try:
        service = WhoopService()
        
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured',
                'details': 'Please set WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and WHOOP_REFRESH_TOKEN in .env'
            }), 400
        
        days = min(request.args.get('days', 90, type=int), 365)
        
        results = service.sync_all(days=days)
        
        return jsonify({
            'message': f'Full sync complete for {days} days',
            'synced': results,
            'period_days': days
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'trace': traceback.format_exc()
        }), 500
