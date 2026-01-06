"""
Database Models
All SQLAlchemy models for GitHub and Whoop data
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


# ==================== GitHub Models ====================

class RefreshJob(db.Model):
    """Tracks background refresh jobs for GitHub data"""
    __tablename__ = 'refresh_job'
    
    id = db.Column(db.String(36), primary_key=True)
    status = db.Column(db.String(20), nullable=False, default='queued')  # queued, running, completed, failed
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    error_message = db.Column(db.Text)
    repositories_processed = db.Column(db.Integer, default=0)
    total_repositories = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'status': self.status,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'error_message': self.error_message,
            'repositories_processed': self.repositories_processed,
            'total_repositories': self.total_repositories,
            'progress': round((self.repositories_processed / self.total_repositories) * 100, 1) if self.total_repositories > 0 else 0
        }


class Project(db.Model):
    """GitHub project/repository data"""
    __tablename__ = 'project'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    time_spent_min = db.Column(db.Float)
    loc = db.Column(db.Integer)
    commit_count = db.Column(db.Integer)
    active_days = db.Column(db.Integer)
    last_commit_date = db.Column(db.DateTime)
    code_churn = db.Column(db.Integer)
    primary_language = db.Column(db.String(50))
    repository_size_kb = db.Column(db.Float)

    def to_dict(self):
        return {
            'name': self.name,
            'time_spent': f"{self.time_spent_min:.0f}m" if self.time_spent_min else "0m",
            'loc': self.loc or 0,
            'commits': self.commit_count or 0,
            'active_days': self.active_days or 0,
            'last_finished': self.last_commit_date.strftime('%m/%d/%Y, %I:%M:%S %p') if self.last_commit_date else "Never",
            'code_churn': self.code_churn or 0,
            'primary_language': self.primary_language or "Unknown",
            'repository_size_kb': f"{self.repository_size_kb:.1f}" if self.repository_size_kb else "0.0"
        }


# ==================== Whoop Models ====================

class WhoopRecovery(db.Model):
    """Daily recovery scores from Whoop"""
    __tablename__ = 'whoop_recovery'
    
    id = db.Column(db.Integer, primary_key=True)
    cycle_id = db.Column(db.String(50), unique=True)  # Whoop's cycle ID
    date = db.Column(db.DateTime, nullable=False)
    recovery_score = db.Column(db.Float)  # 0-100
    resting_heart_rate = db.Column(db.Float)  # bpm
    hrv_rmssd = db.Column(db.Float)  # HRV in milliseconds
    spo2_percentage = db.Column(db.Float)  # Blood oxygen %
    skin_temp_celsius = db.Column(db.Float)  # Skin temperature
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'cycle_id': self.cycle_id,
            'date': self.date.strftime('%Y-%m-%d') if self.date else None,
            'recovery_score': self.recovery_score,
            'resting_heart_rate': self.resting_heart_rate,
            'hrv_rmssd': self.hrv_rmssd,
            'spo2_percentage': self.spo2_percentage,
            'skin_temp_celsius': self.skin_temp_celsius,
            'recovery_status': self._get_recovery_status()
        }
    
    def _get_recovery_status(self):
        """Get recovery status based on score"""
        if not self.recovery_score:
            return 'unknown'
        if self.recovery_score >= 67:
            return 'green'
        elif self.recovery_score >= 34:
            return 'yellow'
        return 'red'


class WhoopSleep(db.Model):
    """Sleep data from Whoop"""
    __tablename__ = 'whoop_sleep'
    
    id = db.Column(db.Integer, primary_key=True)
    sleep_id = db.Column(db.String(50), unique=True)  # Whoop's sleep ID
    date = db.Column(db.DateTime, nullable=False)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    total_sleep_hours = db.Column(db.Float)
    sleep_performance = db.Column(db.Float)  # % of sleep need achieved
    sleep_efficiency = db.Column(db.Float)  # % of time in bed actually sleeping
    sleep_consistency = db.Column(db.Float)  # Consistency score
    rem_sleep_min = db.Column(db.Float)
    deep_sleep_min = db.Column(db.Float)  # Slow wave sleep
    light_sleep_min = db.Column(db.Float)
    awake_min = db.Column(db.Float)
    respiratory_rate = db.Column(db.Float)  # Breaths per minute
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'sleep_id': self.sleep_id,
            'date': self.date.strftime('%Y-%m-%d') if self.date else None,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'total_sleep_hours': round(self.total_sleep_hours, 1) if self.total_sleep_hours else 0,
            'sleep_performance': self.sleep_performance,
            'sleep_efficiency': self.sleep_efficiency,
            'sleep_consistency': self.sleep_consistency,
            'stages': {
                'rem_min': round(self.rem_sleep_min, 0) if self.rem_sleep_min else 0,
                'deep_min': round(self.deep_sleep_min, 0) if self.deep_sleep_min else 0,
                'light_min': round(self.light_sleep_min, 0) if self.light_sleep_min else 0,
                'awake_min': round(self.awake_min, 0) if self.awake_min else 0
            },
            'respiratory_rate': self.respiratory_rate
        }


class WhoopWorkout(db.Model):
    """Individual workout/activity data from Whoop"""
    __tablename__ = 'whoop_workout'
    
    id = db.Column(db.Integer, primary_key=True)
    workout_id = db.Column(db.String(50), unique=True)  # Whoop's workout ID
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    sport_id = db.Column(db.Integer)  # Whoop sport type ID
    sport_name = db.Column(db.String(100))
    strain = db.Column(db.Float)  # 0-21 scale
    average_heart_rate = db.Column(db.Float)
    max_heart_rate = db.Column(db.Float)
    calories = db.Column(db.Float)  # kilojoules from API
    distance_meters = db.Column(db.Float)
    duration_min = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'workout_id': self.workout_id,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'sport_id': self.sport_id,
            'sport_name': self.sport_name,
            'strain': round(self.strain, 1) if self.strain else 0,
            'average_heart_rate': self.average_heart_rate,
            'max_heart_rate': self.max_heart_rate,
            'calories': round(self.calories, 0) if self.calories else 0,
            'distance_meters': self.distance_meters,
            'duration_min': round(self.duration_min, 0) if self.duration_min else 0
        }


class WhoopCycle(db.Model):
    """Daily physiological cycle data (strain for the day)"""
    __tablename__ = 'whoop_cycle'
    
    id = db.Column(db.Integer, primary_key=True)
    cycle_id = db.Column(db.String(50), unique=True)  # Whoop's cycle ID
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    strain = db.Column(db.Float)  # Day strain 0-21 scale
    kilojoules = db.Column(db.Float)  # Calories burned
    average_heart_rate = db.Column(db.Float)
    max_heart_rate = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'cycle_id': self.cycle_id,
            'date': self.start_time.strftime('%Y-%m-%d') if self.start_time else None,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'strain': round(self.strain, 1) if self.strain else 0,
            'kilojoules': round(self.kilojoules, 0) if self.kilojoules else 0,
            'average_heart_rate': self.average_heart_rate,
            'max_heart_rate': self.max_heart_rate
        }


class WhoopProfile(db.Model):
    """Cached user profile from Whoop"""
    __tablename__ = 'whoop_profile'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), unique=True)  # Whoop's user ID
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    email = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'user_id': self.user_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'email': self.email,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class WhoopSyncStatus(db.Model):
    """Tracks the last sync status for Whoop data"""
    __tablename__ = 'whoop_sync_status'
    
    id = db.Column(db.Integer, primary_key=True)
    last_sync_at = db.Column(db.DateTime)
    last_sync_type = db.Column(db.String(50))  # 'startup', 'manual', 'scheduled', 'incremental'
    records_synced = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='pending')  # 'pending', 'running', 'completed', 'failed'
    error_message = db.Column(db.Text)
    
    def to_dict(self):
        return {
            'last_sync_at': self.last_sync_at.isoformat() if self.last_sync_at else None,
            'last_sync_type': self.last_sync_type,
            'records_synced': self.records_synced,
            'status': self.status,
            'error_message': self.error_message
        }
