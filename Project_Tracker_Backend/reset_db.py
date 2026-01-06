#!/usr/bin/env python3
"""
Simple script to reset the local SQLite database.
For production PostgreSQL, use Railway CLI commands or database management tools.
"""

import os
from dotenv import load_dotenv

load_dotenv()

def reset_local_database():
    """Remove the local SQLite database file"""
    db_path = 'instance/db.sqlite'
    
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Removed local database: {db_path}")
    else:
        print("No local database found")
    
    print("Local database reset complete. Run the app to recreate tables.")

if __name__ == '__main__':
    reset_local_database()
