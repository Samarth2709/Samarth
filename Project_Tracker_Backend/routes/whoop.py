"""
Whoop Dashboard Routes
Endpoints for health and fitness data from Whoop
"""
from flask import Blueprint, jsonify, request
from models import db, WhoopRecovery, WhoopSleep, WhoopWorkout, WhoopCycle
from services.whoop_service import WhoopService
from datetime import datetime, timedelta

whoop_bp = Blueprint('whoop', __name__)


@whoop_bp.route('/recovery', methods=['GET'])
def get_recovery():
    """Get recovery data
    
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
    """Get the most recent recovery score"""
    record = WhoopRecovery.query.order_by(WhoopRecovery.date.desc()).first()
    if not record:
        return jsonify({'error': 'No recovery data found'}), 404
    return jsonify(record.to_dict())


@whoop_bp.route('/sleep', methods=['GET'])
def get_sleep():
    """Get sleep data
    
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
    """Get the most recent sleep data"""
    record = WhoopSleep.query.order_by(WhoopSleep.date.desc()).first()
    if not record:
        return jsonify({'error': 'No sleep data found'}), 404
    return jsonify(record.to_dict())


@whoop_bp.route('/workouts', methods=['GET'])
def get_workouts():
    """Get workout/strain data
    
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
    """Get physiological cycle data (daily strain cycles)
    
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
    """Get aggregated Whoop metrics"""
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


@whoop_bp.route('/refresh', methods=['POST'])
def refresh_data():
    """Manually trigger Whoop data refresh"""
    try:
        service = WhoopService()
        
        if not service.is_configured():
            return jsonify({
                'error': 'Whoop API not configured. Please set WHOOP_ACCESS_TOKEN environment variable.',
                'setup_url': 'https://developer.whoop.com'
            }), 400
        
        # Refresh all data types
        days = request.args.get('days', 7, type=int)
        
        results = {
            'recovery': service.sync_recovery(days=days),
            'sleep': service.sync_sleep(days=days),
            'workouts': service.sync_workouts(days=days),
            'cycles': service.sync_cycles(days=days)
        }
        
        return jsonify({
            'message': 'Whoop data refreshed successfully',
            'synced': results
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'trace': traceback.format_exc()
        }), 500


@whoop_bp.route('/status', methods=['GET'])
def get_status():
    """Check Whoop API configuration status"""
    service = WhoopService()
    
    return jsonify({
        'configured': service.is_configured(),
        'has_access_token': bool(service.access_token),
        'has_refresh_token': bool(service.refresh_token)
    })

