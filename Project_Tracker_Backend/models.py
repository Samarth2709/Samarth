from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class RefreshJob(db.Model):
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
