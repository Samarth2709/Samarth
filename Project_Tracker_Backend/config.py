import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Database
    DATABASE_URL = os.getenv('DATABASE_URL')
    if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URI = DATABASE_URL or 'sqlite:///db.sqlite'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Redis
    REDIS_URL = os.getenv('REDIS_URL')
    
    # GitHub
    GITHUB_ACCESS_TOKEN = os.getenv('GITHUB_ACCESS_TOKEN')
    
    # Whoop
    WHOOP_CLIENT_ID = os.getenv('WHOOP_CLIENT_ID')
    WHOOP_CLIENT_SECRET = os.getenv('WHOOP_CLIENT_SECRET')
    WHOOP_ACCESS_TOKEN = os.getenv('WHOOP_ACCESS_TOKEN')
    WHOOP_REFRESH_TOKEN = os.getenv('WHOOP_REFRESH_TOKEN')
    
    # CORS
    CORS_ORIGINS = [
        'http://127.0.0.1:5500',
        'http://localhost:5500', 
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'https://samarthkumbla.com',
        'https://www.samarthkumbla.com',
        'https://nextjs-portfolio-psi-nine-50.vercel.app',
        'https://frontend-dun-three-35.vercel.app'
    ]

