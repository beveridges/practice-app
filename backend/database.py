"""
Database models and setup using SQLAlchemy with SQLite
Uses UUID primary keys for offline-sync capability
"""

from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey, DateTime, Date
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from uuid_utils import generate_uuid

# Database file location
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./hygiene_tracker.db")

# Create engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


# Database Models

class UserProfile(Base):
    """
    Main entry point - User profile containing personal information and settings.
    All equipment belongs to a user profile.
    """
    __tablename__ = "user_profile"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    username = Column(String, unique=True, nullable=True)
    email = Column(String, unique=True, nullable=True)
    name = Column(String, nullable=False)
    biography = Column(String, nullable=True)
    reminder_hours = Column(Integer, default=24)
    notifications_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    equipment = relationship("Equipment", back_populates="user_profile", cascade="all, delete-orphan")


class Equipment(Base):
    """
    Equipment/instruments owned by a user.
    Linked to UserProfile as the main entry point.
    """
    __tablename__ = "equipment"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    user_profile_id = Column(String, ForeignKey("user_profile.id"), nullable=True)  # UUID foreign key
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # EquipmentCategory enum as string
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user_profile = relationship("UserProfile", back_populates="equipment")
    task_definitions = relationship("TaskDefinition", back_populates="equipment", cascade="all, delete-orphan")
    task_occurrences = relationship("TaskOccurrence", back_populates="equipment")


class TaskDefinition(Base):
    """
    Cleaning schedule template - defines recurring tasks for equipment.
    """
    __tablename__ = "task_definitions"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    equipment_id = Column(String, ForeignKey("equipment.id"), nullable=False)  # UUID foreign key
    task_type = Column(String, nullable=False)  # TaskType enum: Cleaning, Drying, Disinfecting, Other
    frequency_type = Column(String, nullable=False)  # FrequencyType enum: days, weekly, monthly
    frequency_value = Column(Integer, nullable=False)  # N days, or 1 for weekly/monthly
    start_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    equipment = relationship("Equipment", back_populates="task_definitions")
    task_occurrences = relationship("TaskOccurrence", back_populates="task_definition", cascade="all, delete-orphan")


class TaskOccurrence(Base):
    """
    Generated task instances - individual occurrences created from task definitions.
    """
    __tablename__ = "task_occurrences"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    task_definition_id = Column(String, ForeignKey("task_definitions.id"), nullable=False)  # UUID foreign key
    equipment_id = Column(String, ForeignKey("equipment.id"), nullable=False)  # UUID foreign key (denormalized)
    due_date = Column(Date, nullable=False, index=True)
    task_type = Column(String, nullable=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    
    # Relationships
    task_definition = relationship("TaskDefinition", back_populates="task_occurrences")
    equipment = relationship("Equipment", back_populates="task_occurrences")


class TaskCompletion(Base):
    """
    Historical record of completed tasks - separate table for audit trail.
    """
    __tablename__ = "task_completions"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)  # UUID
    task_occurrence_id = Column(String, ForeignKey("task_occurrences.id"), nullable=False)  # UUID foreign key
    equipment_id = Column(String, nullable=False)  # UUID denormalized for easier queries
    task_type = Column(String, nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    notes = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)


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

