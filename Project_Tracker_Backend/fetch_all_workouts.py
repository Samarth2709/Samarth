"""
Fetch All Historical WHOOP Data Script
=======================================

NOTE: This standalone script is now largely superseded by the built-in sync
functionality in the backend. For most use cases, prefer:
  - Automatic startup sync: Runs when app.py starts
  - API endpoint: POST /api/whoop/sync/full?days=365
  - API endpoint: POST /api/whoop/sync/incremental

This script remains useful for:
  - Initial database population with complete history
  - Manual recovery if database is corrupted
  - Testing WHOOP API connectivity

This script fetches ALL historical data from the WHOOP API by iterating
backwards through time in 7-day windows until no more data is found.

Fetches:
- Workouts (activities)
- Sleep records
- Recovery scores
- Cycles (daily strain)

Usage:
    python fetch_all_workouts.py

The script will:
1. Start from today and work backwards in 7-day chunks
2. Handle pagination within each 7-day window using nextToken
3. Store all data in the existing SQLite database
4. Continue until the API returns no more data
5. Automatically save refresh tokens after each API call
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Tuple

# Add the parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from config import Config
from models import db, WhoopWorkout, WhoopSleep, WhoopRecovery, WhoopCycle
from services.whoop_service import WhoopService


def create_app():
    """Create Flask app for database context"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    return app


class WhoopDataFetcher:
    """
    Fetches all historical data from WHOOP API.
    
    Uses 7-day windows working backwards from current date until
    no more data is returned by the API.
    """
    
    WINDOW_DAYS = 7  # Fetch data in 7-day chunks
    MAX_ITERATIONS = 520  # ~10 years of history (safety limit)
    MAX_EMPTY_WINDOWS = 3  # Stop after 3 consecutive empty windows
    
    def __init__(self, whoop_service: WhoopService):
        self.whoop_service = whoop_service
        self.total_api_calls = 0
        
    @staticmethod
    def get_iso_timestamp(dt: datetime) -> str:
        """Convert datetime to ISO-8601 format required by WHOOP API"""
        return dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    
    # ==================== WORKOUT FETCHING ====================
    
    def fetch_workouts_for_window(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> Tuple[List[Dict], int]:
        """
        Fetch all workouts for a specific date window.
        Handles pagination using nextToken.
        """
        workouts = []
        next_token = None
        api_calls = 0
        
        while True:
            params = {
                'start': self.get_iso_timestamp(start_date),
                'end': self.get_iso_timestamp(end_date),
                'limit': 25
            }
            
            if next_token:
                params['nextToken'] = next_token
            
            data = self.whoop_service._make_request(
                '/activity/workout', 
                version=2, 
                params=params
            )
            api_calls += 1
            
            if not data:
                break
                
            records = data.get('records', [])
            workouts.extend(records)
            
            next_token = data.get('next_token')
            if not next_token:
                break
                
        return workouts, api_calls
    
    def fetch_all_workouts(self) -> List[Dict]:
        """Fetch ALL historical workouts"""
        print("\n" + "=" * 60)
        print("🏋️ FETCHING WORKOUTS")
        print("=" * 60)
        
        all_workouts = []
        end_date = datetime.now(timezone.utc)
        iterations = 0
        consecutive_empty = 0
        
        while iterations < self.MAX_ITERATIONS:
            iterations += 1
            start_date = end_date - timedelta(days=self.WINDOW_DAYS)
            
            workouts, api_calls = self.fetch_workouts_for_window(start_date, end_date)
            self.total_api_calls += api_calls
            
            if workouts:
                print(f"   {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}: {len(workouts)} workout(s)")
                all_workouts.extend(workouts)
                consecutive_empty = 0
            else:
                consecutive_empty += 1
                if consecutive_empty >= self.MAX_EMPTY_WINDOWS:
                    break
            
            end_date = start_date
        
        print(f"   ✓ Total: {len(all_workouts)} workouts")
        return all_workouts
    
    def save_workouts(self, workouts: List[Dict]) -> Tuple[int, int]:
        """Save workouts to database"""
        new_count = 0
        updated_count = 0
        
        for data in workouts:
            workout_id = str(data.get('id'))
            if not workout_id:
                continue
            
            existing = WhoopWorkout.query.filter_by(workout_id=workout_id).first()
            if existing:
                workout = existing
                updated_count += 1
            else:
                workout = WhoopWorkout(workout_id=workout_id)
                new_count += 1
            
            score = data.get('score') or {}
            start_time = data.get('start', '')
            end_time = data.get('end', '')
            
            if start_time:
                workout.start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            if end_time:
                workout.end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            
            workout.sport_id = data.get('sport_id')
            workout.sport_name = data.get('sport_name', 'Unknown')
            workout.strain = score.get('strain')
            workout.average_heart_rate = score.get('average_heart_rate')
            workout.max_heart_rate = score.get('max_heart_rate')
            workout.calories = score.get('kilojoule')
            workout.distance_meters = score.get('distance_meter')
            
            if workout.start_time and workout.end_time:
                workout.duration_min = (workout.end_time - workout.start_time).total_seconds() / 60
            
            db.session.add(workout)
        
        db.session.commit()
        return new_count, updated_count
    
    # ==================== SLEEP FETCHING ====================
    
    def fetch_sleep_for_window(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> Tuple[List[Dict], int]:
        """
        Fetch all sleep records for a specific date window.
        Handles pagination using nextToken.
        """
        sleep_records = []
        next_token = None
        api_calls = 0
        
        while True:
            params = {
                'start': self.get_iso_timestamp(start_date),
                'end': self.get_iso_timestamp(end_date),
                'limit': 25
            }
            
            if next_token:
                params['nextToken'] = next_token
            
            data = self.whoop_service._make_request(
                '/activity/sleep', 
                version=2, 
                params=params
            )
            api_calls += 1
            
            if not data:
                break
                
            records = data.get('records', [])
            sleep_records.extend(records)
            
            next_token = data.get('next_token')
            if not next_token:
                break
                
        return sleep_records, api_calls
    
    def fetch_all_sleep(self) -> List[Dict]:
        """Fetch ALL historical sleep records"""
        print("\n" + "=" * 60)
        print("😴 FETCHING SLEEP RECORDS")
        print("=" * 60)
        
        all_sleep = []
        end_date = datetime.now(timezone.utc)
        iterations = 0
        consecutive_empty = 0
        
        while iterations < self.MAX_ITERATIONS:
            iterations += 1
            start_date = end_date - timedelta(days=self.WINDOW_DAYS)
            
            sleep_records, api_calls = self.fetch_sleep_for_window(start_date, end_date)
            self.total_api_calls += api_calls
            
            if sleep_records:
                print(f"   {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}: {len(sleep_records)} sleep record(s)")
                all_sleep.extend(sleep_records)
                consecutive_empty = 0
            else:
                consecutive_empty += 1
                if consecutive_empty >= self.MAX_EMPTY_WINDOWS:
                    break
            
            end_date = start_date
        
        print(f"   ✓ Total: {len(all_sleep)} sleep records")
        return all_sleep
    
    def save_sleep(self, sleep_records: List[Dict]) -> Tuple[int, int]:
        """Save sleep records to database"""
        new_count = 0
        updated_count = 0
        
        for data in sleep_records:
            sleep_id = str(data.get('id'))
            if not sleep_id:
                continue
            
            existing = WhoopSleep.query.filter_by(sleep_id=sleep_id).first()
            if existing:
                sleep = existing
                updated_count += 1
            else:
                sleep = WhoopSleep(sleep_id=sleep_id)
                new_count += 1
            
            score = data.get('score') or {}
            start_time = data.get('start', '')
            end_time = data.get('end', '')
            
            if start_time:
                sleep.date = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                sleep.start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            if end_time:
                sleep.end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            
            # Calculate total sleep in hours
            stage_summary = score.get('stage_summary') or {}
            total_sleep_ms = stage_summary.get('total_in_bed_time_milli', 0)
            sleep.total_sleep_hours = total_sleep_ms / (1000 * 60 * 60) if total_sleep_ms else 0
            
            sleep.sleep_performance = score.get('sleep_performance_percentage')
            sleep.sleep_efficiency = score.get('sleep_efficiency_percentage')
            sleep.sleep_consistency = score.get('sleep_consistency_percentage')
            
            # Sleep stages in minutes
            sleep.rem_sleep_min = stage_summary.get('total_rem_sleep_time_milli', 0) / (1000 * 60) if stage_summary.get('total_rem_sleep_time_milli') else 0
            sleep.deep_sleep_min = stage_summary.get('total_slow_wave_sleep_time_milli', 0) / (1000 * 60) if stage_summary.get('total_slow_wave_sleep_time_milli') else 0
            sleep.light_sleep_min = stage_summary.get('total_light_sleep_time_milli', 0) / (1000 * 60) if stage_summary.get('total_light_sleep_time_milli') else 0
            sleep.awake_min = stage_summary.get('total_awake_time_milli', 0) / (1000 * 60) if stage_summary.get('total_awake_time_milli') else 0
            
            sleep.respiratory_rate = score.get('respiratory_rate')
            
            db.session.add(sleep)
        
        db.session.commit()
        return new_count, updated_count
    
    # ==================== RECOVERY FETCHING ====================
    
    def fetch_recovery_for_window(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> Tuple[List[Dict], int]:
        """
        Fetch all recovery records for a specific date window.
        Handles pagination using nextToken.
        """
        recovery_records = []
        next_token = None
        api_calls = 0
        
        while True:
            params = {
                'start': self.get_iso_timestamp(start_date),
                'end': self.get_iso_timestamp(end_date),
                'limit': 25
            }
            
            if next_token:
                params['nextToken'] = next_token
            
            data = self.whoop_service._make_request(
                '/recovery', 
                version=2, 
                params=params
            )
            api_calls += 1
            
            if not data:
                break
                
            records = data.get('records', [])
            recovery_records.extend(records)
            
            next_token = data.get('next_token')
            if not next_token:
                break
                
        return recovery_records, api_calls
    
    def fetch_all_recovery(self) -> List[Dict]:
        """Fetch ALL historical recovery records"""
        print("\n" + "=" * 60)
        print("💚 FETCHING RECOVERY RECORDS")
        print("=" * 60)
        
        all_recovery = []
        end_date = datetime.now(timezone.utc)
        iterations = 0
        consecutive_empty = 0
        
        while iterations < self.MAX_ITERATIONS:
            iterations += 1
            start_date = end_date - timedelta(days=self.WINDOW_DAYS)
            
            recovery_records, api_calls = self.fetch_recovery_for_window(start_date, end_date)
            self.total_api_calls += api_calls
            
            if recovery_records:
                print(f"   {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}: {len(recovery_records)} recovery record(s)")
                all_recovery.extend(recovery_records)
                consecutive_empty = 0
            else:
                consecutive_empty += 1
                if consecutive_empty >= self.MAX_EMPTY_WINDOWS:
                    break
            
            end_date = start_date
        
        print(f"   ✓ Total: {len(all_recovery)} recovery records")
        return all_recovery
    
    def save_recovery(self, recovery_records: List[Dict]) -> Tuple[int, int]:
        """Save recovery records to database"""
        new_count = 0
        updated_count = 0
        
        for data in recovery_records:
            cycle_id = str(data.get('cycle_id'))
            if not cycle_id:
                continue
            
            existing = WhoopRecovery.query.filter_by(cycle_id=cycle_id).first()
            if existing:
                recovery = existing
                updated_count += 1
            else:
                recovery = WhoopRecovery(cycle_id=cycle_id)
                new_count += 1
            
            score = data.get('score') or {}
            created_at = data.get('created_at', '')
            
            if created_at:
                recovery.date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            
            recovery.recovery_score = score.get('recovery_score')
            recovery.resting_heart_rate = score.get('resting_heart_rate')
            recovery.hrv_rmssd = score.get('hrv_rmssd_milli')
            recovery.spo2_percentage = score.get('spo2_percentage')
            recovery.skin_temp_celsius = score.get('skin_temp_celsius')
            
            db.session.add(recovery)
        
        db.session.commit()
        return new_count, updated_count
    
    # ==================== CYCLE FETCHING ====================
    
    def fetch_cycles_for_window(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> Tuple[List[Dict], int]:
        """
        Fetch all cycle records for a specific date window.
        Handles pagination using nextToken.
        Note: Cycles use API V1
        """
        cycle_records = []
        next_token = None
        api_calls = 0
        
        while True:
            params = {
                'start': self.get_iso_timestamp(start_date),
                'end': self.get_iso_timestamp(end_date),
                'limit': 25
            }
            
            if next_token:
                params['nextToken'] = next_token
            
            # Cycles use V1 API
            data = self.whoop_service._make_request(
                '/cycle', 
                version=1, 
                params=params
            )
            api_calls += 1
            
            if not data:
                break
                
            records = data.get('records', [])
            cycle_records.extend(records)
            
            next_token = data.get('next_token')
            if not next_token:
                break
                
        return cycle_records, api_calls
    
    def fetch_all_cycles(self) -> List[Dict]:
        """Fetch ALL historical cycle records"""
        print("\n" + "=" * 60)
        print("📊 FETCHING CYCLE (DAILY STRAIN) RECORDS")
        print("=" * 60)
        
        all_cycles = []
        end_date = datetime.now(timezone.utc)
        iterations = 0
        consecutive_empty = 0
        
        while iterations < self.MAX_ITERATIONS:
            iterations += 1
            start_date = end_date - timedelta(days=self.WINDOW_DAYS)
            
            cycle_records, api_calls = self.fetch_cycles_for_window(start_date, end_date)
            self.total_api_calls += api_calls
            
            if cycle_records:
                print(f"   {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}: {len(cycle_records)} cycle(s)")
                all_cycles.extend(cycle_records)
                consecutive_empty = 0
            else:
                consecutive_empty += 1
                if consecutive_empty >= self.MAX_EMPTY_WINDOWS:
                    break
            
            end_date = start_date
        
        print(f"   ✓ Total: {len(all_cycles)} cycles")
        return all_cycles
    
    def save_cycles(self, cycle_records: List[Dict]) -> Tuple[int, int]:
        """Save cycle records to database"""
        new_count = 0
        updated_count = 0
        
        for data in cycle_records:
            cycle_id = str(data.get('id'))
            if not cycle_id:
                continue
            
            existing = WhoopCycle.query.filter_by(cycle_id=cycle_id).first()
            if existing:
                cycle = existing
                updated_count += 1
            else:
                cycle = WhoopCycle(cycle_id=cycle_id)
                new_count += 1
            
            score = data.get('score') or {}
            start_time = data.get('start', '')
            end_time = data.get('end')
            
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
        return new_count, updated_count
    
    # ==================== MAIN FETCH ALL ====================
    
    def fetch_and_save_all(self) -> Dict[str, Dict[str, int]]:
        """
        Fetch and save all historical data from WHOOP.
        
        Returns:
            Dictionary with counts for each data type
        """
        results = {}
        
        # Ensure we have valid authentication
        if not self.whoop_service.ensure_authenticated():
            print("❌ Failed to authenticate with WHOOP API")
            print("   Please check your WHOOP_REFRESH_TOKEN in .env")
            return results
        
        print("✅ Authentication successful")
        
        # Fetch and save workouts
        workouts = self.fetch_all_workouts()
        if workouts:
            new, updated = self.save_workouts(workouts)
            results['workouts'] = {'new': new, 'updated': updated, 'total': len(workouts)}
        
        # Fetch and save sleep
        sleep_records = self.fetch_all_sleep()
        if sleep_records:
            new, updated = self.save_sleep(sleep_records)
            results['sleep'] = {'new': new, 'updated': updated, 'total': len(sleep_records)}
        
        # Fetch and save recovery
        recovery_records = self.fetch_all_recovery()
        if recovery_records:
            new, updated = self.save_recovery(recovery_records)
            results['recovery'] = {'new': new, 'updated': updated, 'total': len(recovery_records)}
        
        # Fetch and save cycles
        cycle_records = self.fetch_all_cycles()
        if cycle_records:
            new, updated = self.save_cycles(cycle_records)
            results['cycles'] = {'new': new, 'updated': updated, 'total': len(cycle_records)}
        
        return results


def main():
    """Main entry point for the script"""
    print("\n" + "🚀 " * 20)
    print("WHOOP Historical Data Sync")
    print("🚀 " * 20)
    
    # Create Flask app and database context
    app = create_app()
    
    with app.app_context():
        # Ensure database tables exist
        db.create_all()
        
        # Show current database state
        print("\n📊 Current database state:")
        print(f"   Workouts: {WhoopWorkout.query.count()}")
        print(f"   Sleep: {WhoopSleep.query.count()}")
        print(f"   Recovery: {WhoopRecovery.query.count()}")
        print(f"   Cycles: {WhoopCycle.query.count()}")
        
        # Create services
        whoop_service = WhoopService()
        
        if not whoop_service.is_configured():
            print("\n❌ WHOOP API not configured!")
            print("   Please set the following environment variables:")
            print("   - WHOOP_CLIENT_ID")
            print("   - WHOOP_CLIENT_SECRET")
            print("   - WHOOP_REFRESH_TOKEN")
            return
        
        # Create fetcher and run
        fetcher = WhoopDataFetcher(whoop_service)
        results = fetcher.fetch_and_save_all()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 SYNC SUMMARY")
        print("=" * 60)
        
        for data_type, counts in results.items():
            print(f"\n   {data_type.upper()}:")
            print(f"      New records: {counts['new']}")
            print(f"      Updated records: {counts['updated']}")
            print(f"      Total fetched: {counts['total']}")
        
        print(f"\n   Total API calls: {fetcher.total_api_calls}")
        
        # Show final database state
        print("\n📈 Final database state:")
        print(f"   Workouts: {WhoopWorkout.query.count()}")
        print(f"   Sleep: {WhoopSleep.query.count()}")
        print(f"   Recovery: {WhoopRecovery.query.count()}")
        print(f"   Cycles: {WhoopCycle.query.count()}")
        
        print("\n" + "✅ " * 20)
        print("SYNC COMPLETE!")
        print("✅ " * 20)


if __name__ == '__main__':
    main()
