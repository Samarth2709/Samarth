"""
Whoop Service
Handles fetching and processing Whoop health data

Whoop API Documentation: https://developer.whoop.com/api
"""
import os
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from models import db, WhoopRecovery, WhoopSleep, WhoopWorkout, WhoopCycle


class WhoopService:
    """Service for interacting with the Whoop API"""
    
    BASE_URL = "https://api.prod.whoop.com/developer/v1"
    
    def __init__(self):
        self.access_token = os.getenv('WHOOP_ACCESS_TOKEN')
        self.refresh_token = os.getenv('WHOOP_REFRESH_TOKEN')
        self.client_id = os.getenv('WHOOP_CLIENT_ID')
        self.client_secret = os.getenv('WHOOP_CLIENT_SECRET')
    
    def is_configured(self) -> bool:
        """Check if Whoop API is configured"""
        return bool(self.access_token)
    
    def _get_headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json'
        }
    
    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make authenticated request to Whoop API"""
        if not self.is_configured():
            print("Whoop API not configured")
            return None
        
        url = f"{self.BASE_URL}{endpoint}"
        
        try:
            response = requests.get(url, headers=self._get_headers(), params=params, timeout=30)
            
            if response.status_code == 401:
                # Token expired, try to refresh
                if self._refresh_access_token():
                    response = requests.get(url, headers=self._get_headers(), params=params, timeout=30)
                else:
                    print("Failed to refresh access token")
                    return None
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"Whoop API request failed: {e}")
            return None
    
    def _refresh_access_token(self) -> bool:
        """Refresh the access token using refresh token"""
        if not self.refresh_token or not self.client_id or not self.client_secret:
            return False
        
        try:
            response = requests.post(
                "https://api.prod.whoop.com/oauth/oauth2/token",
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': self.refresh_token,
                    'client_id': self.client_id,
                    'client_secret': self.client_secret
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get('access_token')
                self.refresh_token = data.get('refresh_token')
                # Note: In production, you'd want to save these new tokens
                print("Access token refreshed successfully")
                return True
            
            return False
            
        except Exception as e:
            print(f"Token refresh failed: {e}")
            return False
    
    # ==================== Recovery ====================
    
    def get_recovery(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict]:
        """Fetch recovery data from Whoop API"""
        params = {}
        if start_date:
            params['start'] = start_date
        if end_date:
            params['end'] = end_date
        
        data = self._make_request('/recovery', params)
        return data.get('records', []) if data else []
    
    def sync_recovery(self, days: int = 7) -> int:
        """Sync recovery data to database"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        records = self.get_recovery(
            start_date=start_date.strftime('%Y-%m-%dT00:00:00.000Z'),
            end_date=end_date.strftime('%Y-%m-%dT23:59:59.999Z')
        )
        
        synced_count = 0
        for record in records:
            try:
                cycle_id = record.get('cycle_id')
                
                # Check if already exists
                existing = WhoopRecovery.query.filter_by(cycle_id=cycle_id).first()
                if existing:
                    # Update existing
                    recovery = existing
                else:
                    recovery = WhoopRecovery(cycle_id=cycle_id)
                
                score = record.get('score', {})
                recovery.date = datetime.fromisoformat(record.get('created_at', '').replace('Z', '+00:00'))
                recovery.recovery_score = score.get('recovery_score')
                recovery.resting_heart_rate = score.get('resting_heart_rate')
                recovery.hrv_rmssd = score.get('hrv_rmssd_milli')
                recovery.spo2_percentage = score.get('spo2_percentage')
                recovery.skin_temp_celsius = score.get('skin_temp_celsius')
                
                db.session.add(recovery)
                synced_count += 1
                
            except Exception as e:
                print(f"Error syncing recovery record: {e}")
                continue
        
        db.session.commit()
        print(f"Synced {synced_count} recovery records")
        return synced_count
    
    # ==================== Sleep ====================
    
    def get_sleep(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict]:
        """Fetch sleep data from Whoop API"""
        params = {}
        if start_date:
            params['start'] = start_date
        if end_date:
            params['end'] = end_date
        
        data = self._make_request('/activity/sleep', params)
        return data.get('records', []) if data else []
    
    def sync_sleep(self, days: int = 7) -> int:
        """Sync sleep data to database"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        records = self.get_sleep(
            start_date=start_date.strftime('%Y-%m-%dT00:00:00.000Z'),
            end_date=end_date.strftime('%Y-%m-%dT23:59:59.999Z')
        )
        
        synced_count = 0
        for record in records:
            try:
                sleep_id = record.get('id')
                
                existing = WhoopSleep.query.filter_by(sleep_id=sleep_id).first()
                if existing:
                    sleep = existing
                else:
                    sleep = WhoopSleep(sleep_id=sleep_id)
                
                score = record.get('score', {})
                sleep.date = datetime.fromisoformat(record.get('start', '').replace('Z', '+00:00'))
                sleep.start_time = datetime.fromisoformat(record.get('start', '').replace('Z', '+00:00'))
                sleep.end_time = datetime.fromisoformat(record.get('end', '').replace('Z', '+00:00'))
                
                # Calculate total sleep in hours
                stage_summary = score.get('stage_summary', {})
                total_sleep_ms = stage_summary.get('total_in_bed_time_milli', 0)
                sleep.total_sleep_hours = total_sleep_ms / (1000 * 60 * 60)
                
                sleep.sleep_performance = score.get('sleep_performance_percentage')
                sleep.sleep_efficiency = score.get('sleep_efficiency_percentage')
                sleep.sleep_consistency = score.get('sleep_consistency_percentage')
                
                # Sleep stages in minutes
                sleep.rem_sleep_min = stage_summary.get('total_rem_sleep_time_milli', 0) / (1000 * 60)
                sleep.deep_sleep_min = stage_summary.get('total_slow_wave_sleep_time_milli', 0) / (1000 * 60)
                sleep.light_sleep_min = stage_summary.get('total_light_sleep_time_milli', 0) / (1000 * 60)
                sleep.awake_min = stage_summary.get('total_awake_time_milli', 0) / (1000 * 60)
                
                sleep.respiratory_rate = score.get('respiratory_rate')
                
                db.session.add(sleep)
                synced_count += 1
                
            except Exception as e:
                print(f"Error syncing sleep record: {e}")
                continue
        
        db.session.commit()
        print(f"Synced {synced_count} sleep records")
        return synced_count
    
    # ==================== Workouts ====================
    
    def get_workouts(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict]:
        """Fetch workout data from Whoop API"""
        params = {}
        if start_date:
            params['start'] = start_date
        if end_date:
            params['end'] = end_date
        
        data = self._make_request('/activity/workout', params)
        return data.get('records', []) if data else []
    
    def sync_workouts(self, days: int = 7) -> int:
        """Sync workout data to database"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        records = self.get_workouts(
            start_date=start_date.strftime('%Y-%m-%dT00:00:00.000Z'),
            end_date=end_date.strftime('%Y-%m-%dT23:59:59.999Z')
        )
        
        synced_count = 0
        for record in records:
            try:
                workout_id = record.get('id')
                
                existing = WhoopWorkout.query.filter_by(workout_id=workout_id).first()
                if existing:
                    workout = existing
                else:
                    workout = WhoopWorkout(workout_id=workout_id)
                
                score = record.get('score', {})
                workout.start_time = datetime.fromisoformat(record.get('start', '').replace('Z', '+00:00'))
                workout.end_time = datetime.fromisoformat(record.get('end', '').replace('Z', '+00:00'))
                workout.sport_id = record.get('sport_id')
                workout.sport_name = record.get('sport_name', 'Unknown')
                workout.strain = score.get('strain')
                workout.average_heart_rate = score.get('average_heart_rate')
                workout.max_heart_rate = score.get('max_heart_rate')
                workout.calories = score.get('kilojoule')  # Convert later if needed
                workout.distance_meters = score.get('distance_meter')
                
                # Calculate duration
                if workout.start_time and workout.end_time:
                    workout.duration_min = (workout.end_time - workout.start_time).total_seconds() / 60
                
                db.session.add(workout)
                synced_count += 1
                
            except Exception as e:
                print(f"Error syncing workout record: {e}")
                continue
        
        db.session.commit()
        print(f"Synced {synced_count} workout records")
        return synced_count
    
    # ==================== Cycles (Daily Strain) ====================
    
    def get_cycles(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict]:
        """Fetch cycle (daily strain) data from Whoop API"""
        params = {}
        if start_date:
            params['start'] = start_date
        if end_date:
            params['end'] = end_date
        
        data = self._make_request('/cycle', params)
        return data.get('records', []) if data else []
    
    def sync_cycles(self, days: int = 7) -> int:
        """Sync cycle data to database"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        records = self.get_cycles(
            start_date=start_date.strftime('%Y-%m-%dT00:00:00.000Z'),
            end_date=end_date.strftime('%Y-%m-%dT23:59:59.999Z')
        )
        
        synced_count = 0
        for record in records:
            try:
                cycle_id = record.get('id')
                
                existing = WhoopCycle.query.filter_by(cycle_id=cycle_id).first()
                if existing:
                    cycle = existing
                else:
                    cycle = WhoopCycle(cycle_id=cycle_id)
                
                score = record.get('score', {})
                cycle.start_time = datetime.fromisoformat(record.get('start', '').replace('Z', '+00:00'))
                cycle.end_time = datetime.fromisoformat(record.get('end', '').replace('Z', '+00:00')) if record.get('end') else None
                cycle.strain = score.get('strain')
                cycle.kilojoules = score.get('kilojoule')
                cycle.average_heart_rate = score.get('average_heart_rate')
                cycle.max_heart_rate = score.get('max_heart_rate')
                
                db.session.add(cycle)
                synced_count += 1
                
            except Exception as e:
                print(f"Error syncing cycle record: {e}")
                continue
        
        db.session.commit()
        print(f"Synced {synced_count} cycle records")
        return synced_count

