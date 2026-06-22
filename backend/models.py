from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from datetime import datetime
from database import Base
from datetime import datetime, timezone
import uuid

class ExecutionLog(Base):
    __tablename__ = "execution_log"
    __table_args__ = {'schema': 'synthetic_agent'}  # Forcing it into your isolated schema
    
    id = Column(Integer, primary_key=True, index=True)
    component = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False) # 'SUCCESS' or 'FAILED'
    execution_time_seconds = Column(Float)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ExceptionLog(Base):
    __tablename__ = "exception_log"
    __table_args__ = {'schema': 'synthetic_agent'}
    
    id = Column(Integer, primary_key=True, index=True)
    component = Column(String(50), nullable=False)
    error_message = Column(Text, nullable=False)
    stack_trace = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
from database import Base

# --- NEW TABLE FOR USER HISTORY ---
class GeneratedFile(Base):
    __tablename__ = "generated_files"
    __table_args__ = {'schema': 'synthetic_agent'}

    id = Column(String(36), primary_key=True, index=True) # The UUID
    user_id = Column(String(255), nullable=False, index=True) # From JWT Token
    filename = Column(String(255), nullable=False)
    num_rows = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class User(Base):
    __tablename__ = "users"
    __table_args__ = {'schema': 'synthetic_agent'}

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255))
    auth_provider = Column(String(50)) # e.g., 'google', 'github'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))