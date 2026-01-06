"""
Configuration for Project Tracker Backend
==========================================

Environment variables:
- DATABASE_URL: PostgreSQL connection string (defaults to SQLite)
- REDIS_URL: Redis connection for background jobs (optional)
- GITHUB_ACCESS_TOKEN: GitHub personal access token with repo scope
- WHOOP_CLIENT_ID: OAuth client ID from WHOOP developer portal
- WHOOP_CLIENT_SECRET: OAuth client secret
- WHOOP_REFRESH_TOKEN: OAuth refresh token (auto-rotated on use)
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Application configuration loaded from environment variables."""
    
    # ==================== Database ====================
    DATABASE_URL = os.getenv('DATABASE_URL')
    # Railway uses postgres:// but SQLAlchemy requires postgresql://
    if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URI = DATABASE_URL or 'sqlite:///db.sqlite'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # ==================== Redis ====================
    REDIS_URL = os.getenv('REDIS_URL')  # Optional: enables async background jobs
    
    # ==================== GitHub Dashboard ====================
    GITHUB_ACCESS_TOKEN = os.getenv('GITHUB_ACCESS_TOKEN')
    
    # ==================== WHOOP Dashboard ====================
    # Note: WHOOP uses refresh token rotation - each use issues a new token
    # The backend automatically saves new tokens to .env file
    WHOOP_CLIENT_ID = os.getenv('WHOOP_CLIENT_ID')
    WHOOP_CLIENT_SECRET = os.getenv('WHOOP_CLIENT_SECRET')
    WHOOP_ACCESS_TOKEN = os.getenv('WHOOP_ACCESS_TOKEN')  # Auto-managed
    WHOOP_REFRESH_TOKEN = os.getenv('WHOOP_REFRESH_TOKEN')
    
    # ==================== CORS ====================
    # Allowed origins for cross-origin requests
    CORS_ORIGINS = [
        # Local development
        'http://127.0.0.1:5500',
        'http://localhost:5500', 
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        # Production
        'https://samarthkumbla.com',
        'https://www.samarthkumbla.com',
        # Vercel deployments
        'https://nextjs-portfolio-psi-nine-50.vercel.app',
        'https://frontend-dun-three-35.vercel.app'
    ]

