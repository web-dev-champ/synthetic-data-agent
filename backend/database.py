import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

# SQLAlchemy requires 'postgresql+psycopg2://' instead of just 'postgresql://'
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# In database.py
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Crucial: Verifies the connection is alive before using it
    pool_recycle=300,    # Recycles connections every 5 minutes to prevent Neon timeouts
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()