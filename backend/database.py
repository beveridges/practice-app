"""
Database models and setup using SQLAlchemy with SQLite
Uses UUID primary keys for offline-sync capability
"""

from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey, DateTime, Date, Float, Text, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from uuid_utils import generate_uuid

# Database file location
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./practice_tracker.db")

# Create engine with SQLite optimizations for better concurrency
if "sqlite" in DATABASE_URL:
    connect_args = {
        "check_same_thread": False,
        "timeout": 30.0  # Increase timeout to 30 seconds
    }
else:
    connect_args = {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Enable WAL mode for SQLite (allows concurrent reads/writes)
if "sqlite" in DATABASE_URL:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        """Enable WAL mode and optimize SQLite settings"""
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging for better concurrency
        cursor.execute("PRAGMA synchronous=NORMAL")  # Balanced performance/safety
        cursor.execute("PRAGMA foreign_keys=ON")  # Enable foreign key constraints
        cursor.close()

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# Database Models

class UserProfile(Base):
    """
    Main entry point - User profile containing personal information and settings.
    All instruments belong to a user profile.
    """
    __tablename__ = "UserProfile"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    username = Column(String, unique=True, nullable=True)
    email = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=True)  # Hashed password for authentication
    name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String, nullable=True)  # "Male", "Female", "Non-binary", "Prefer not to say"
    primary_instrument = Column(String, nullable=True)
    age_commenced_playing = Column(Integer, nullable=True)
    secondary_instruments = Column(Text, nullable=True)  # Comma-separated list
    daily_practice_hours = Column(Float, nullable=True)
    days_per_week_practising = Column(Integer, nullable=True)
    practice_routine_description = Column(Text, nullable=True)
    biography = Column(String, nullable=True)
    reminder_hours = Column(Integer, default=24)
    notifications_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    instruments = relationship("Instrument", back_populates="user_profile", cascade="all, delete-orphan")


class Instrument(Base):
    """
    Instruments owned by a user.
    Linked to UserProfile as the main entry point.
    """
    __tablename__ = "Instrument"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    user_profile_id = Column(String, ForeignKey("UserProfile.id"), nullable=True)  # UUID foreign key (optional for private app)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # EquipmentCategory enum as string
    instrument_type = Column(String, nullable=False, default="Primary")  # "Primary" or "Secondary"
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user_profile = relationship("UserProfile", back_populates="instruments")
    task_definitions = relationship("TaskDefinition", back_populates="instrument", cascade="all, delete-orphan")
    task_occurrences = relationship("TaskOccurrence", back_populates="instrument")
    practice_sessions = relationship("PracticeSession", back_populates="instrument")


class TaskDefinition(Base):
    """
    Practice session template - defines practice sessions for instruments (Trumpet only).
    """
    __tablename__ = "TaskDefinitions"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    instrument_id = Column(String, ForeignKey("Instrument.id"), nullable=False)  # UUID foreign key
    task_type = Column(String, nullable=False, default="Practice")  # TaskType enum: Practice only
    frequency_type = Column(String, nullable=False)  # FrequencyType enum: days, weekly, monthly
    frequency_value = Column(Integer, nullable=False)  # N days, or 1 for weekly/monthly
    start_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    instrument = relationship("Instrument", back_populates="task_definitions")
    task_occurrences = relationship("TaskOccurrence", back_populates="task_definition", cascade="all, delete-orphan")


class TaskOccurrence(Base):
    """
    Practice session instances - individual practice sessions created from task definitions.
    """
    __tablename__ = "TaskOccurrences"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    task_definition_id = Column(String, ForeignKey("TaskDefinitions.id"), nullable=False)  # UUID foreign key
    instrument_id = Column(String, ForeignKey("Instrument.id"), nullable=False)  # UUID foreign key (denormalized)
    due_date = Column(Date, nullable=False, index=True)
    task_type = Column(String, nullable=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    
    # Relationships
    task_definition = relationship("TaskDefinition", back_populates="task_occurrences")
    instrument = relationship("Instrument", back_populates="task_occurrences")


class TaskCompletion(Base):
    """
    Historical record of completed tasks - separate table for audit trail.
    """
    __tablename__ = "TaskCompletions"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    task_occurrence_id = Column(String, ForeignKey("TaskOccurrences.id"), nullable=False)  # UUID foreign key
    instrument_id = Column(String, nullable=False)  # UUID denormalized for easier queries
    task_type = Column(String, nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    notes = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)


class PracticeSessionDefinition(Base):
    """
    Practice session type definitions (e.g., "Practice General").
    """
    __tablename__ = "PracticeSessionDefinition"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    name = Column(String, nullable=False, unique=True)  # e.g., "Practice General"
    description = Column(Text, nullable=True)  # Optional description
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    practice_sessions = relationship("PracticeSession", back_populates="practice_session_definition", cascade="all, delete-orphan")


class PracticeSession(Base):
    """
    Individual practice sessions - tracks actual practice time with start/end times and duration.
    """
    __tablename__ = "PracticeSession"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    instrument_id = Column(String, ForeignKey("Instrument.id"), nullable=False)  # UUID foreign key
    practice_session_definition_id = Column(String, ForeignKey("PracticeSessionDefinition.id"), nullable=False)  # UUID foreign key
    start_time = Column(DateTime, nullable=True, index=True)  # When practice started (used for date filtering)
    end_time = Column(DateTime, nullable=True)  # When practice ended
    duration = Column(Integer, nullable=True)  # Duration in milliseconds
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    instrument = relationship("Instrument", back_populates="practice_sessions")
    practice_session_definition = relationship("PracticeSessionDefinition", back_populates="practice_sessions")


def init_db():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

