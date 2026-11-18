import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# Provide a fallback empty string to satisfy the type checker
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "")

if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")

connect_args = {}
# Supabase PgBouncer transaction pooler does not support prepared statements
if "postgresql" in SQLALCHEMY_DATABASE_URL:
    try:
        import psycopg  # noqa: F401
        connect_args["prepare_threshold"] = None
    except ImportError:
        pass

# pool_pre_ping tests connections for liveness before executing queries
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()