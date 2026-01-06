import os
import redis
from rq import Worker, Queue, Connection
from app import app

# Configure Redis connection with SSL settings for Railway
redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
if redis_url.startswith('rediss://'):
    conn = redis.from_url(redis_url, ssl_cert_reqs=None)
else:
    conn = redis.from_url(redis_url)

if __name__ == '__main__':
    with app.app_context():
        with Connection(conn):
            worker = Worker(['default'], connection=conn)
            worker.work()
