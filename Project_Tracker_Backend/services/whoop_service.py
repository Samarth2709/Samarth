"""
Whoop Service
Handles fetching and processing Whoop health data

Whoop API Documentation: https://developer.whoop.com/api

API Versioning:
- V1: /developer/v1/cycle (Cycles/Strain)
- V2: /developer/v2/recovery, /developer/v2/activity/sleep, /developer/v2/activity/workout
"""
import os
import requests
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List, Any
from dotenv import set_key
from models import db, WhoopRecovery, WhoopSleep, WhoopWorkout, WhoopCycle


class WhoopService:
    """Service for interacting with the Whoop API"""
    
    BASE_URL_V1 = "https://api.prod.whoop.com/developer/v1"
    BASE_URL_V2 = "https://api.prod.whoop.com/developer/v2"
    TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
    
    # Path to .env file for token persistence
    ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '.env')
    
    def __init__(self):
        self.access_token = os.getenv('WHOOP_ACCESS_TOKEN')
        self.refresh_token = os.getenv('WHOOP_REFRESH_TOKEN')
        self.client_id = os.getenv('WHOOP_CLIENT_ID')
        self.client_secret = os.getenv('WHOOP_CLIENT_SECRET')
    
    def is_configured(self) -> bool:
        """Check if Whoop API is configured with refresh token for authentication"""
        return bool(self.refresh_token and self.client_id and self.client_secret)
    
    def has_valid_token(self) -> bool:
        """Check if we have an access token (may or may not be valid)"""
        return bool(self.access_token)
    
    def _get_headers(self) -> Dict[str, str]:
        """Get authorization headers"""
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json'
        }
    
    @staticmethod
    def get_iso_timestamp(days_ago: int = 0) -> str:
        """
        Generate ISO-8601 timestamp with milliseconds in UTC.
        Whoop API requires strict format: YYYY-MM-DDTHH:MM:SS.000Z
        """
        dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
        return dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    
    @staticmethod
    def get_iso_timestamp_from_date(date_str: str) -> str:
        """
        Convert a date string (YYYY-MM-DD) to ISO-8601 format with time set to midnight UTC.
        """
        return f"{date_str}T00:00:00.000Z"
    
    def _save_tokens(self, access_token: str, refresh_token: Optional[str] = None) -> None:
        """
        Save tokens to .env file for persistence.
        Critical for token rotation - Whoop issues new refresh tokens on each use.
        """
        try:
            # Update in-memory values
            self.access_token = access_token
            if refresh_token:
                self.refresh_token = refresh_token
            
            # Update environment variables
            os.environ['WHOOP_ACCESS_TOKEN'] = access_token
            if refresh_token:
                os.environ['WHOOP_REFRESH_TOKEN'] = refresh_token
            
            # Persist to .env file
            if os.path.exists(self.ENV_PATH):
                set_key(self.ENV_PATH, 'WHOOP_ACCESS_TOKEN', access_token)
                if refresh_token:
                    set_key(self.ENV_PATH, 'WHOOP_REFRESH_TOKEN', refresh_token)
                print("✅ Tokens saved to .env file")
            else:
                print("⚠️ .env file not found, tokens only saved in memory")
                
        except Exception as e:
            print(f"⚠️ Failed to save tokens to .env: {e}")
    
    def _make_request(self, endpoint: str, version: int = 1, params: Optional[Dict] = None) -> Optional[Dict]:
        """
        Make authenticated request to Whoop API.
        
        Args:
            endpoint: API endpoint path (e.g., '/cycle', '/recovery')
            version: API version (1 or 2)
            params: Query parameters
            
        Returns:
            JSON response data or None on failure
        """
        # Ensure we have a valid token first
        if not self.access_token:
            if not self._refresh_access_token():
                print("Failed to obtain access token")
                return None
        
        base_url = self.BASE_URL_V1 if version == 1 else self.BASE_URL_V2
        url = f"{base_url}{endpoint}"
        
        try:
            response = requests.get(url, headers=self._get_headers(), params=params, timeout=30)
            
            if response.status_code == 401:
                # Token expired, try to refresh
                print("Access token expired, refreshing...")
                if self._refresh_access_token():
                    response = requests.get(url, headers=self._get_headers(), params=params, timeout=30)
                else:
                    print("Failed to refresh access token")
                    return None
            
            if response.status_code == 404:
                print(f"Endpoint not found: {url}")
                return None
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"Whoop API request failed: {e}")
            return None
    
    def _refresh_access_token(self) -> bool:
        """
        Refresh the access token using refresh token.
        
        CRITICAL: Whoop uses refresh token rotation - each refresh returns a new
        refresh token that must be saved immediately. Using an old refresh token
        will result in invalid_grant error.
        """
        if not self.refresh_token or not self.client_id or not self.client_secret:
            print("Missing credentials for token refresh")
            return False
        
        try:
            response = requests.post(
                self.TOKEN_URL,
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': self.refresh_token,
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                    'scope': 'offline'  # Required to get new refresh token
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                new_access_token = data.get('access_token')
                new_refresh_token = data.get('refresh_token')
                
                # CRITICAL: Save new tokens immediately (token rotation)
                self._save_tokens(new_access_token, new_refresh_token)
                
                print("✅ Access token refreshed successfully")
                return True
            else:
                print(f"❌ Token refresh failed: {response.status_code} - {response.text}")
                return False
            
        except Exception as e:
            print(f"❌ Token refresh failed: {e}")
            return False
    
    def ensure_authenticated(self) -> bool:
        """
        Ensure we have a valid access token, refreshing if necessary.
        Call this before making API requests.
        """
        if not self.is_configured():
            return False
        
        if not self.access_token:
            return self._refresh_access_token()
        
        return True
    
    # ==================== User Profile ====================
    
    def get_profile(self) -> Optional[Dict]:
        """Fetch user profile from Whoop API (V1)"""
        return self._make_request('/user/profile/basic', version=1)
    
    def get_body_measurement(self) -> Optional[Dict]:
        """Fetch body measurements from Whoop API (V1)"""
        return self._make_request('/user/measurement/body', version=1)
    
    # ==================== Recovery (V2) ====================
    
    def get_recovery(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: Optional[int] = None,
        limit: Optional[int] = None
    ) -> List[Dict]:
        """
        Fetch recovery data from Whoop API (V2).
        
        Args:
            start_date: ISO-8601 formatted start date
            end_date: ISO-8601 formatted end date
            days: Number of days to look back (alternative to start_date)
            limit: Maximum number of records to return
        """
        params = {}
        
        if days and not start_date:
            params['start'] = self.get_iso_timestamp(days)
        elif start_date:
            params['start'] = start_date
            
        if end_date:
            params['end'] = end_date
            
        if limit:
            params['limit'] = limit
        
        # Use V2 for recovery
        data = self._make_request('/recovery', version=2, params=params)
        return data.get('records', []) if data else []
    
    def get_recovery_for_cycle(self, cycle_id: str) -> Optional[Dict]:
        """Fetch recovery data for a specific cycle"""
        data = self._make_request(f'/cycle/{cycle_id}/recovery', version=1)
        return data
    
    def sync_recovery(self, days: int = 7) -> int:
        """Sync recovery data to database"""
        records = self.get_recovery(days=days)
        
        synced_count = 0
        for record in records:
            try:
                cycle_id = str(record.get('cycle_id'))
                
                # Check if already exists
                existing = WhoopRecovery.query.filter_by(cycle_id=cycle_id).first()
                if existing:
                    recovery = existing
                else:
                    recovery = WhoopRecovery(cycle_id=cycle_id)
                
                score = record.get('score', {})
                created_at = record.get('created_at', '')
                if created_at:
                    recovery.date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                
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
    
    # ==================== Sleep (V2) ====================
    
    def get_sleep(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: Optional[int] = None,
        limit: Optional[int] = None
    ) -> List[Dict]:
        """
        Fetch sleep data from Whoop API (V2).
        
        Args:
            start_date: ISO-8601 formatted start date
            end_date: ISO-8601 formatted end date
            days: Number of days to look back (alternative to start_date)
            limit: Maximum number of records to return
        """
        params = {}
        
        if days and not start_date:
            params['start'] = self.get_iso_timestamp(days)
        elif start_date:
            params['start'] = start_date
            
        if end_date:
            params['end'] = end_date
            
        if limit:
            params['limit'] = limit
        
        # Use V2 for sleep
        data = self._make_request('/activity/sleep', version=2, params=params)
        return data.get('records', []) if data else []
    
    def get_sleep_by_id(self, sleep_id: str) -> Optional[Dict]:
        """Fetch a specific sleep record by ID"""
        return self._make_request(f'/activity/sleep/{sleep_id}', version=2)
    
    def sync_sleep(self, days: int = 7) -> int:
        """Sync sleep data to database"""
        records = self.get_sleep(days=days)
        
        synced_count = 0
        for record in records:
            try:
                sleep_id = str(record.get('id'))
                
                existing = WhoopSleep.query.filter_by(sleep_id=sleep_id).first()
                if existing:
                    sleep = existing
                else:
                    sleep = WhoopSleep(sleep_id=sleep_id)
                
                score = record.get('score', {})
                start_time = record.get('start', '')
                end_time = record.get('end', '')
                
                if start_time:
                    sleep.date = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                    sleep.start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                if end_time:
                    sleep.end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                
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
    
    # ==================== Workouts (V2) ====================
    
    def get_workouts(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: Optional[int] = None,
        limit: Optional[int] = None
    ) -> List[Dict]:
        """
        Fetch workout data from Whoop API (V2).
        
        Args:
            start_date: ISO-8601 formatted start date
            end_date: ISO-8601 formatted end date
            days: Number of days to look back (alternative to start_date)
            limit: Maximum number of records to return
        """
        params = {}
        
        if days and not start_date:
            params['start'] = self.get_iso_timestamp(days)
        elif start_date:
            params['start'] = start_date
            
        if end_date:
            params['end'] = end_date
            
        if limit:
            params['limit'] = limit
        
        # Use V2 for workouts
        data = self._make_request('/activity/workout', version=2, params=params)
        return data.get('records', []) if data else []
    
    def get_workout_by_id(self, workout_id: str) -> Optional[Dict]:
        """Fetch a specific workout by ID"""
        return self._make_request(f'/activity/workout/{workout_id}', version=2)
    
    def sync_workouts(self, days: int = 7) -> int:
        """Sync workout data to database"""
        records = self.get_workouts(days=days)
        
        synced_count = 0
        for record in records:
            try:
                workout_id = str(record.get('id'))
                
                existing = WhoopWorkout.query.filter_by(workout_id=workout_id).first()
                if existing:
                    workout = existing
                else:
                    workout = WhoopWorkout(workout_id=workout_id)
                
                score = record.get('score', {})
                start_time = record.get('start', '')
                end_time = record.get('end', '')
                
                if start_time:
                    workout.start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                if end_time:
                    workout.end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                    
                workout.sport_id = record.get('sport_id')
                workout.sport_name = record.get('sport_name', 'Unknown')
                workout.strain = score.get('strain')
                workout.average_heart_rate = score.get('average_heart_rate')
                workout.max_heart_rate = score.get('max_heart_rate')
                workout.calories = score.get('kilojoule')
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
    
    # ==================== Cycles (V1) ====================
    
    def get_cycles(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        days: Optional[int] = None,
        limit: Optional[int] = None
    ) -> List[Dict]:
        """
        Fetch cycle (daily strain) data from Whoop API (V1).
        
        Cycles are the "parent" container for each day, containing strain scores
        and IDs for associated recovery and sleep records.
        
        Args:
            start_date: ISO-8601 formatted start date
            end_date: ISO-8601 formatted end date
            days: Number of days to look back (alternative to start_date)
            limit: Maximum number of records to return
        """
        params = {}
        
        if days and not start_date:
            params['start'] = self.get_iso_timestamp(days)
        elif start_date:
            params['start'] = start_date
            
        if end_date:
            params['end'] = end_date
            
        if limit:
            params['limit'] = limit
        
        # Use V1 for cycles
        data = self._make_request('/cycle', version=1, params=params)
        return data.get('records', []) if data else []
    
    def get_cycle_by_id(self, cycle_id: str) -> Optional[Dict]:
        """Fetch a specific cycle by ID"""
        return self._make_request(f'/cycle/{cycle_id}', version=1)
    
    def sync_cycles(self, days: int = 7) -> int:
        """Sync cycle data to database"""
        records = self.get_cycles(days=days)
        
        synced_count = 0
        for record in records:
            try:
                cycle_id = str(record.get('id'))
                
                existing = WhoopCycle.query.filter_by(cycle_id=cycle_id).first()
                if existing:
                    cycle = existing
                else:
                    cycle = WhoopCycle(cycle_id=cycle_id)
                
                score = record.get('score', {})
                start_time = record.get('start', '')
                end_time = record.get('end')
                
                if start_time:
                    cycle.start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                if end_time:
                    cycle.end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                    
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
    
    # ==================== Extended Sync (More Historical Data) ====================
    
    def sync_all(self, days: int = 90) -> Dict[str, int]:
        """
        Sync all data types for a longer period.
        Default is 90 days, can be extended up to 365 days.
        
        Args:
            days: Number of days to sync (default 90, max 365)
        """
        days = min(days, 365)  # Cap at 1 year
        
        results = {
            'recovery': self.sync_recovery(days=days),
            'sleep': self.sync_sleep(days=days),
            'workouts': self.sync_workouts(days=days),
            'cycles': self.sync_cycles(days=days)
        }
        
        print(f"✅ Full sync complete for {days} days: {results}")
        return results
    
    # ==================== Incremental Sync (From Last Record to Now) ====================
    
    def get_last_recorded_dates(self) -> Dict[str, Optional[datetime]]:
        """
        Get the last recorded date for each data type from the database.
        
        Returns:
            Dictionary with last recorded datetime for each data type
        """
        last_dates = {}
        
        # Last workout
        last_workout = WhoopWorkout.query.order_by(WhoopWorkout.start_time.desc()).first()
        last_dates['workouts'] = last_workout.start_time if last_workout and last_workout.start_time else None
        
        # Last sleep
        last_sleep = WhoopSleep.query.order_by(WhoopSleep.date.desc()).first()
        last_dates['sleep'] = last_sleep.date if last_sleep and last_sleep.date else None
        
        # Last recovery
        last_recovery = WhoopRecovery.query.order_by(WhoopRecovery.date.desc()).first()
        last_dates['recovery'] = last_recovery.date if last_recovery and last_recovery.date else None
        
        # Last cycle
        last_cycle = WhoopCycle.query.order_by(WhoopCycle.start_time.desc()).first()
        last_dates['cycles'] = last_cycle.start_time if last_cycle and last_cycle.start_time else None
        
        return last_dates
    
    def sync_incremental(self) -> Dict[str, Any]:
        """
        Incrementally sync all data types from last recorded date to now.
        
        This is an efficient refresh that only fetches new data since the last sync.
        Fetches data in 7-day windows with pagination support.
        
        Returns:
            Dictionary with sync results for each data type
        """
        results = {
            'workouts': {'new': 0, 'updated': 0, 'start_date': None, 'end_date': None},
            'sleep': {'new': 0, 'updated': 0, 'start_date': None, 'end_date': None},
            'recovery': {'new': 0, 'updated': 0, 'start_date': None, 'end_date': None},
            'cycles': {'new': 0, 'updated': 0, 'start_date': None, 'end_date': None}
        }
        
        # Get last recorded dates
        last_dates = self.get_last_recorded_dates()
        now = datetime.now(timezone.utc)
        
        print("📅 Last recorded dates:")
        for data_type, last_date in last_dates.items():
            print(f"   {data_type}: {last_date.strftime('%Y-%m-%d %H:%M') if last_date else 'Never'}")
        
        # Sync workouts
        print("\n🏋️ Syncing workouts...")
        workout_results = self._sync_incremental_workouts(last_dates['workouts'], now)
        results['workouts'] = workout_results
        
        # Sync sleep
        print("\n😴 Syncing sleep...")
        sleep_results = self._sync_incremental_sleep(last_dates['sleep'], now)
        results['sleep'] = sleep_results
        
        # Sync recovery
        print("\n💚 Syncing recovery...")
        recovery_results = self._sync_incremental_recovery(last_dates['recovery'], now)
        results['recovery'] = recovery_results
        
        # Sync cycles
        print("\n📊 Syncing cycles...")
        cycle_results = self._sync_incremental_cycles(last_dates['cycles'], now)
        results['cycles'] = cycle_results
        
        print("\n✅ Incremental sync complete!")
        return results
    
    def _fetch_with_pagination(
        self, 
        endpoint: str, 
        version: int,
        start_date: datetime, 
        end_date: datetime
    ) -> List[Dict]:
        """
        Fetch all records from an endpoint with pagination support.
        Works in 7-day windows to avoid API limits.
        """
        all_records = []
        window_days = 7
        current_end = end_date
        
        # Ensure both dates are timezone-aware for comparison
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
        if current_end.tzinfo is None:
            current_end = current_end.replace(tzinfo=timezone.utc)
        
        while current_end > start_date:
            current_start = max(start_date, current_end - timedelta(days=window_days))
            
            next_token = None
            while True:
                params = {
                    'start': current_start.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
                    'end': current_end.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
                    'limit': 25
                }
                
                if next_token:
                    params['nextToken'] = next_token
                
                data = self._make_request(endpoint, version=version, params=params)
                
                if not data:
                    break
                
                records = data.get('records', [])
                all_records.extend(records)
                
                next_token = data.get('next_token')
                if not next_token:
                    break
            
            current_end = current_start
        
        return all_records
    
    def _sync_incremental_workouts(
        self, 
        last_date: Optional[datetime], 
        now: datetime
    ) -> Dict[str, Any]:
        """Sync workouts from last recorded date to now"""
        # Default to 30 days ago if no previous records
        start_date = last_date if last_date else (now - timedelta(days=30))
        
        # Fetch all workouts from start_date to now
        records = self._fetch_with_pagination('/activity/workout', 2, start_date, now)
        
        new_count = 0
        updated_count = 0
        
        for record in records:
            workout_id = str(record.get('id'))
            if not workout_id:
                continue
            
            existing = WhoopWorkout.query.filter_by(workout_id=workout_id).first()
            if existing:
                workout = existing
                updated_count += 1
            else:
                workout = WhoopWorkout(workout_id=workout_id)
                new_count += 1
            
            score = record.get('score') or {}
            start_time = record.get('start', '')
            end_time = record.get('end', '')
            
            if start_time:
                workout.start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            if end_time:
                workout.end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            
            workout.sport_id = record.get('sport_id')
            workout.sport_name = record.get('sport_name', 'Unknown')
            workout.strain = score.get('strain')
            workout.average_heart_rate = score.get('average_heart_rate')
            workout.max_heart_rate = score.get('max_heart_rate')
            workout.calories = score.get('kilojoule')
            workout.distance_meters = score.get('distance_meter')
            
            if workout.start_time and workout.end_time:
                workout.duration_min = (workout.end_time - workout.start_time).total_seconds() / 60
            
            db.session.add(workout)
        
        db.session.commit()
        print(f"   ✓ New: {new_count}, Updated: {updated_count}")
        
        return {
            'new': new_count,
            'updated': updated_count,
            'start_date': start_date.strftime('%Y-%m-%d') if start_date else None,
            'end_date': now.strftime('%Y-%m-%d')
        }
    
    def _sync_incremental_sleep(
        self, 
        last_date: Optional[datetime], 
        now: datetime
    ) -> Dict[str, Any]:
        """Sync sleep from last recorded date to now"""
        start_date = last_date if last_date else (now - timedelta(days=30))
        
        records = self._fetch_with_pagination('/activity/sleep', 2, start_date, now)
        
        new_count = 0
        updated_count = 0
        
        for record in records:
            sleep_id = str(record.get('id'))
            if not sleep_id:
                continue
            
            existing = WhoopSleep.query.filter_by(sleep_id=sleep_id).first()
            if existing:
                sleep = existing
                updated_count += 1
            else:
                sleep = WhoopSleep(sleep_id=sleep_id)
                new_count += 1
            
            score = record.get('score') or {}
            start_time = record.get('start', '')
            end_time = record.get('end', '')
            
            if start_time:
                sleep.date = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                sleep.start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            if end_time:
                sleep.end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            
            stage_summary = score.get('stage_summary') or {}
            total_sleep_ms = stage_summary.get('total_in_bed_time_milli', 0)
            sleep.total_sleep_hours = total_sleep_ms / (1000 * 60 * 60) if total_sleep_ms else 0
            
            sleep.sleep_performance = score.get('sleep_performance_percentage')
            sleep.sleep_efficiency = score.get('sleep_efficiency_percentage')
            sleep.sleep_consistency = score.get('sleep_consistency_percentage')
            
            sleep.rem_sleep_min = stage_summary.get('total_rem_sleep_time_milli', 0) / (1000 * 60) if stage_summary.get('total_rem_sleep_time_milli') else 0
            sleep.deep_sleep_min = stage_summary.get('total_slow_wave_sleep_time_milli', 0) / (1000 * 60) if stage_summary.get('total_slow_wave_sleep_time_milli') else 0
            sleep.light_sleep_min = stage_summary.get('total_light_sleep_time_milli', 0) / (1000 * 60) if stage_summary.get('total_light_sleep_time_milli') else 0
            sleep.awake_min = stage_summary.get('total_awake_time_milli', 0) / (1000 * 60) if stage_summary.get('total_awake_time_milli') else 0
            
            sleep.respiratory_rate = score.get('respiratory_rate')
            
            db.session.add(sleep)
        
        db.session.commit()
        print(f"   ✓ New: {new_count}, Updated: {updated_count}")
        
        return {
            'new': new_count,
            'updated': updated_count,
            'start_date': start_date.strftime('%Y-%m-%d') if start_date else None,
            'end_date': now.strftime('%Y-%m-%d')
        }
    
    def _sync_incremental_recovery(
        self, 
        last_date: Optional[datetime], 
        now: datetime
    ) -> Dict[str, Any]:
        """Sync recovery from last recorded date to now"""
        start_date = last_date if last_date else (now - timedelta(days=30))
        
        records = self._fetch_with_pagination('/recovery', 2, start_date, now)
        
        new_count = 0
        updated_count = 0
        
        for record in records:
            cycle_id = str(record.get('cycle_id'))
            if not cycle_id:
                continue
            
            existing = WhoopRecovery.query.filter_by(cycle_id=cycle_id).first()
            if existing:
                recovery = existing
                updated_count += 1
            else:
                recovery = WhoopRecovery(cycle_id=cycle_id)
                new_count += 1
            
            score = record.get('score') or {}
            created_at = record.get('created_at', '')
            
            if created_at:
                recovery.date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            
            recovery.recovery_score = score.get('recovery_score')
            recovery.resting_heart_rate = score.get('resting_heart_rate')
            recovery.hrv_rmssd = score.get('hrv_rmssd_milli')
            recovery.spo2_percentage = score.get('spo2_percentage')
            recovery.skin_temp_celsius = score.get('skin_temp_celsius')
            
            db.session.add(recovery)
        
        db.session.commit()
        print(f"   ✓ New: {new_count}, Updated: {updated_count}")
        
        return {
            'new': new_count,
            'updated': updated_count,
            'start_date': start_date.strftime('%Y-%m-%d') if start_date else None,
            'end_date': now.strftime('%Y-%m-%d')
        }
    
    def _sync_incremental_cycles(
        self, 
        last_date: Optional[datetime], 
        now: datetime
    ) -> Dict[str, Any]:
        """Sync cycles from last recorded date to now"""
        start_date = last_date if last_date else (now - timedelta(days=30))
        
        # Cycles use V1 API
        records = self._fetch_with_pagination('/cycle', 1, start_date, now)
        
        new_count = 0
        updated_count = 0
        
        for record in records:
            cycle_id = str(record.get('id'))
            if not cycle_id:
                continue
            
            existing = WhoopCycle.query.filter_by(cycle_id=cycle_id).first()
            if existing:
                cycle = existing
                updated_count += 1
            else:
                cycle = WhoopCycle(cycle_id=cycle_id)
                new_count += 1
            
            score = record.get('score') or {}
            start_time = record.get('start', '')
            end_time = record.get('end')
            
            if start_time:
                cycle.start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            if end_time:
                cycle.end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            
            cycle.strain = score.get('strain')
            cycle.kilojoules = score.get('kilojoule')
            cycle.average_heart_rate = score.get('average_heart_rate')
            cycle.max_heart_rate = score.get('max_heart_rate')
            
            db.session.add(cycle)
        
        db.session.commit()
        print(f"   ✓ New: {new_count}, Updated: {updated_count}")
        
        return {
            'new': new_count,
            'updated': updated_count,
            'start_date': start_date.strftime('%Y-%m-%d') if start_date else None,
            'end_date': now.strftime('%Y-%m-%d')
        }
    
    def get_recovery_for_date(self, date_str: str) -> List[Dict]:
        """
        Fetch recovery data for a specific date.
        
        Args:
            date_str: Date in YYYY-MM-DD format
        """
        start = self.get_iso_timestamp_from_date(date_str)
        # End is the next day at midnight
        end_date = datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=1)
        end = end_date.strftime('%Y-%m-%dT00:00:00.000Z')
        
        return self.get_recovery(start_date=start, end_date=end)
    
    def get_sleep_for_date(self, date_str: str) -> List[Dict]:
        """
        Fetch sleep data for a specific date.
        
        Args:
            date_str: Date in YYYY-MM-DD format
        """
        start = self.get_iso_timestamp_from_date(date_str)
        end_date = datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=1)
        end = end_date.strftime('%Y-%m-%dT00:00:00.000Z')
        
        return self.get_sleep(start_date=start, end_date=end)
    
    def get_cycles_for_date(self, date_str: str) -> List[Dict]:
        """
        Fetch cycle/strain data for a specific date.
        
        Args:
            date_str: Date in YYYY-MM-DD format
        """
        start = self.get_iso_timestamp_from_date(date_str)
        end_date = datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=1)
        end = end_date.strftime('%Y-%m-%dT00:00:00.000Z')
        
        return self.get_cycles(start_date=start, end_date=end)
    
    def get_workouts_for_date(self, date_str: str) -> List[Dict]:
        """
        Fetch workout data for a specific date.
        
        Args:
            date_str: Date in YYYY-MM-DD format
        """
        start = self.get_iso_timestamp_from_date(date_str)
        end_date = datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=1)
        end = end_date.strftime('%Y-%m-%dT00:00:00.000Z')
        
        return self.get_workouts(start_date=start, end_date=end)
    
    # ==================== Dashboard / Combined Data ====================
    
    def get_dashboard_data(self, days: int = 7) -> Dict[str, Any]:
        """
        Fetch and join data from Cycles, Recovery, and Sleep.
        
        This implements the "Three-Legged Fetch" pattern:
        1. Fetch Cycles (strain, day containers)
        2. Fetch Recoveries (recovery scores)
        3. Fetch Sleep (sleep performance)
        4. Join by cycle_id
        
        Returns:
            Combined data with cycles as the base, enriched with recovery and sleep data
        """
        # Fetch all data types
        cycles = self.get_cycles(days=days)
        recoveries = self.get_recovery(days=days)
        sleeps = self.get_sleep(days=days)
        
        # Create lookup maps by cycle_id
        recovery_by_cycle = {str(r.get('cycle_id')): r for r in recoveries}
        sleep_by_cycle = {str(s.get('cycle_id')): s for s in sleeps}
        
        # Join data
        dashboard_records = []
        for cycle in cycles:
            cycle_id = str(cycle.get('id'))
            cycle_score = cycle.get('score', {})
            
            # Get associated recovery
            recovery = recovery_by_cycle.get(cycle_id, {})
            recovery_score = recovery.get('score', {})
            
            # Get associated sleep
            sleep = sleep_by_cycle.get(cycle_id, {})
            sleep_score = sleep.get('score', {})
            stage_summary = sleep_score.get('stage_summary', {})
            
            combined = {
                'cycle_id': cycle_id,
                'date': cycle.get('start', '')[:10] if cycle.get('start') else None,
                'start': cycle.get('start'),
                'end': cycle.get('end'),
                'strain': {
                    'score': cycle_score.get('strain'),
                    'kilojoules': cycle_score.get('kilojoule'),
                    'average_hr': cycle_score.get('average_heart_rate'),
                    'max_hr': cycle_score.get('max_heart_rate')
                },
                'recovery': {
                    'score': recovery_score.get('recovery_score'),
                    'resting_hr': recovery_score.get('resting_heart_rate'),
                    'hrv': recovery_score.get('hrv_rmssd_milli'),
                    'spo2': recovery_score.get('spo2_percentage'),
                    'skin_temp': recovery_score.get('skin_temp_celsius'),
                    'score_state': recovery.get('score_state')
                },
                'sleep': {
                    'id': sleep.get('id'),
                    'performance': sleep_score.get('sleep_performance_percentage'),
                    'efficiency': sleep_score.get('sleep_efficiency_percentage'),
                    'consistency': sleep_score.get('sleep_consistency_percentage'),
                    'total_hours': round(stage_summary.get('total_in_bed_time_milli', 0) / (1000 * 60 * 60), 2),
                    'rem_min': round(stage_summary.get('total_rem_sleep_time_milli', 0) / (1000 * 60), 0),
                    'deep_min': round(stage_summary.get('total_slow_wave_sleep_time_milli', 0) / (1000 * 60), 0),
                    'light_min': round(stage_summary.get('total_light_sleep_time_milli', 0) / (1000 * 60), 0),
                    'awake_min': round(stage_summary.get('total_awake_time_milli', 0) / (1000 * 60), 0)
                }
            }
            dashboard_records.append(combined)
        
        return {
            'records': dashboard_records,
            'period_days': days,
            'total_cycles': len(cycles),
            'total_recoveries': len(recoveries),
            'total_sleeps': len(sleeps)
        }
