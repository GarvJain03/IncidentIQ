import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("uvicorn")

# PostgreSQL (Supabase / Local) is the primary database.
# Supabase connection URI format:
# postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
# or pooler URI:
# postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require
DEFAULT_PG_URL = "postgresql://postgres:postgres@localhost:5432/incidentiq"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_PG_URL)

# Supabase / cloud hosts sometimes provide 'postgres://' which SQLAlchemy requires as 'postgresql://'
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

try:
    if DATABASE_URL.startswith("postgresql"):
        # PostgreSQL Engine configuration with connection pooling and health-checks (ideal for Supabase)
        engine = create_engine(
            DATABASE_URL,
            pool_size=5,
            max_overflow=10,
            pool_recycle=300,  # Recycle connections every 5 min to avoid cloud idle disconnects
            pool_pre_ping=True,  # Test connection liveliness before executing statements
        )
        # Attempt connectivity check
        with engine.connect() as conn:
            pass
        logger.info(f"Database: Connected to PostgreSQL (Supabase) successfully ({DATABASE_URL.split('@')[-1]})")
    else:
        engine = create_engine(
            DATABASE_URL,
            connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
        )
except Exception as e:
    # Graceful fallback to SQLite if local PostgreSQL daemon is offline or driver pending
    logger.warning(
        f"PostgreSQL connection to {DATABASE_URL} failed ({e}). "
        f"Falling back to local SQLite database (incidentiq.db) to keep server operational."
    )
    DATABASE_URL = "sqlite:///./incidentiq.db"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
