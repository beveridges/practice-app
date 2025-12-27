"""
FastAPI Backend for Practice Tracker PWA
Handles instruments, tasks, scheduling, and analytics
"""

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response, HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
from enum import Enum
import os
from datetime import datetime, date, timedelta
import json
import csv
from io import StringIO
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, text, func
from database import (
    init_db, get_db, Base, engine, Instrument as DBInstrument, TaskDefinition as DBTaskDefinition,
    TaskOccurrence as DBTaskOccurrence, TaskCompletion as DBTaskCompletion, UserProfile as DBUserProfile,
    PracticeSessionDefinition as DBPracticeSessionDefinition, PracticeSession as DBPracticeSession
)
from instrument_list import get_instruments_list
from db_viewer import router as db_viewer_router
from uuid_utils import generate_uuid
from auth_utils import hash_password, verify_password

app = FastAPI(title="Practice Tracker API", version="1.0.0")

# Include database viewer router
app.include_router(db_viewer_router)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    # Create tables if they don't exist (preserves existing data)
    # This allows multiple users to be added to the database
    init_db()
    print("✓ Database initialized (tables created if needed)")
    
    # Ensure "Practice General" practice session definition exists
    db = next(get_db())
    try:
        practice_general = db.query(DBPracticeSessionDefinition).filter(
            DBPracticeSessionDefinition.name == "Practice General"
        ).first()
        
        if not practice_general:
            print("Creating 'Practice General' practice session definition...")
            practice_general = DBPracticeSessionDefinition(
                id=generate_uuid(),
                name="Practice General",
                description="General practice session"
            )
            db.add(practice_general)
            db.commit()
            print(f"✓ Created Practice General (ID: {practice_general.id})")
        else:
            print(f"✓ Practice General already exists (ID: {practice_general.id})")
    except Exception as e:
        print(f"⚠️ Error checking/creating Practice General: {e}")
        db.rollback()
    finally:
        db.close()
    
    # Note: For schema changes/migrations in the future, use proper migration tools like Alembic

# CORS middleware - allow frontend to access API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files in production
# Uncomment when deploying:
# app.mount("/static", StaticFiles(directory="../frontend"), name="static")

# Enums
class EquipmentCategory(str, Enum):
    WOODWIND = "Woodwind"
    BRASS = "Brass"
    PLUCKED_STRING = "Plucked string"
    BOWED_STRING = "Bowed string"
    PERCUSSION = "Percussion"
    STORAGE_CASE = "Storage/Case"
    OTHER = "Other"

class TaskType(str, Enum):
    PRACTICE = "Practice"

class FrequencyType(str, Enum):
    DAYS = "days"  # Every N days
    WEEKLY = "weekly"
    MONTHLY = "monthly"

class Gender(str, Enum):
    MALE = "Male"
    FEMALE = "Female"
    NON_BINARY = "Non-binary"
    PREFER_NOT_TO_SAY = "Prefer not to say"

# Instrument type enum
class InstrumentType(str, Enum):
    PRIMARY = "Primary"
    SECONDARY = "Secondary"

# Data models
class Instrument(BaseModel):
    id: Optional[str] = None  # UUID
    user_profile_id: Optional[str] = None  # UUID
    name: str
    category: EquipmentCategory
    instrument_type: InstrumentType = InstrumentType.PRIMARY  # Primary or Secondary
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class InstrumentCreate(BaseModel):
    user_profile_id: Optional[str] = None  # UUID - optional for private app
    name: str
    category: EquipmentCategory
    instrument_type: InstrumentType = InstrumentType.PRIMARY  # Primary or Secondary
    notes: Optional[str] = None

class TaskDefinition(BaseModel):
    id: Optional[str] = None  # UUID
    instrument_id: str  # UUID
    task_type: TaskType
    frequency_type: FrequencyType
    frequency_value: int  # N days, or 1 for weekly/monthly
    start_date: str  # ISO date
    created_at: Optional[str] = None

class TaskDefinitionCreate(BaseModel):
    instrument_id: str  # UUID
    task_type: TaskType
    frequency_type: FrequencyType
    frequency_value: int
    start_date: str

class TaskOccurrence(BaseModel):
    id: Optional[str] = None  # UUID
    task_definition_id: str  # UUID
    instrument_id: str  # UUID
    due_date: str  # ISO date
    task_type: TaskType
    completed: bool = False
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None

class TaskCompletion(BaseModel):
    task_occurrence_id: str  # UUID
    notes: Optional[str] = None
    photo_url: Optional[str] = None  # In production, handle file uploads

class PracticeSessionDefinition(BaseModel):
    id: Optional[str] = None  # UUID
    name: str
    description: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class PracticeSession(BaseModel):
    id: Optional[str] = None  # UUID
    instrument_id: str  # UUID
    practice_session_definition_id: str  # UUID
    start_time: Optional[str] = None  # ISO datetime
    end_time: Optional[str] = None  # ISO datetime
    duration: Optional[int] = None  # Duration in milliseconds
    completed: bool = False
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    updated_at: Optional[str] = None

class PracticeSessionCreate(BaseModel):
    instrument_id: str  # UUID
    practice_session_definition_id: str  # UUID
    start_time: Optional[str] = None  # ISO datetime
    end_time: Optional[str] = None  # ISO datetime
    duration: Optional[int] = None  # Duration in milliseconds
    notes: Optional[str] = None

class UserProfile(BaseModel):
    id: Optional[str] = None  # UUID
    username: Optional[str] = None
    email: Optional[str] = None
    name: str
    date_of_birth: Optional[str] = None  # ISO format date string
    gender: Optional[str] = None  # String value (e.g., "Male", "Female", "Non-binary", "Prefer not to say")
    primary_instrument: Optional[str] = None
    age_commenced_playing: Optional[int] = None
    secondary_instruments: Optional[str] = None  # Comma-separated list
    daily_practice_hours: Optional[float] = None
    days_per_week_practising: Optional[int] = None
    practice_routine_description: Optional[str] = None
    biography: Optional[str] = None
    reminder_hours: Optional[int] = 24  # Hours before due time
    notifications_enabled: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class UserProfileCreate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    name: str
    date_of_birth: Optional[str] = None  # ISO format date string
    gender: Optional[Gender] = None
    primary_instrument: Optional[str] = None
    age_commenced_playing: Optional[int] = None
    secondary_instruments: Optional[str] = None  # Comma-separated list
    daily_practice_hours: Optional[float] = None
    days_per_week_practising: Optional[int] = None
    practice_routine_description: Optional[str] = None
    biography: Optional[str] = None
    reminder_hours: Optional[int] = 24
    notifications_enabled: bool = True

class UserProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    date_of_birth: Optional[str] = None  # ISO format date string
    gender: Optional[str] = None  # Accept string, convert to enum in endpoint
    primary_instrument: Optional[str] = None
    age_commenced_playing: Optional[int] = None
    secondary_instruments: Optional[str] = None  # Comma-separated list
    daily_practice_hours: Optional[float] = None
    days_per_week_practising: Optional[int] = None
    practice_routine_description: Optional[str] = None
    biography: Optional[str] = None
    reminder_hours: Optional[int] = None
    notifications_enabled: Optional[bool] = None

# Authentication models
class SignUpRequest(BaseModel):
    name: str
    email: str
    password: str

class SignInRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    user_id: str
    name: str
    email: Optional[str] = None
    username: Optional[str] = None
    message: str = "Success"

# Helper functions
def db_instrument_to_pydantic(db_instrument: DBInstrument) -> Instrument:
    """Convert database Instrument model to Pydantic Instrument model"""
    return Instrument(
        id=db_instrument.id,
        user_profile_id=db_instrument.user_profile_id,
        name=db_instrument.name,
        category=db_instrument.category,
        instrument_type=InstrumentType(db_instrument.instrument_type) if db_instrument.instrument_type else InstrumentType.PRIMARY,
        notes=db_instrument.notes,
        created_at=db_instrument.created_at.isoformat() if db_instrument.created_at else None,
        updated_at=db_instrument.updated_at.isoformat() if db_instrument.updated_at else None
    )

def db_task_definition_to_pydantic(db_task_def: DBTaskDefinition) -> TaskDefinition:
    """Convert database TaskDefinition to Pydantic model"""
    return TaskDefinition(
        id=db_task_def.id,
        instrument_id=db_task_def.instrument_id,
        task_type=db_task_def.task_type,
        frequency_type=db_task_def.frequency_type,
        frequency_value=db_task_def.frequency_value,
        start_date=db_task_def.start_date.isoformat(),
        created_at=db_task_def.created_at.isoformat() if db_task_def.created_at else None
    )

def db_task_occurrence_to_pydantic(db_task_occ: DBTaskOccurrence) -> TaskOccurrence:
    """Convert database TaskOccurrence to Pydantic model"""
    return TaskOccurrence(
        id=db_task_occ.id,
        task_definition_id=db_task_occ.task_definition_id,
        instrument_id=db_task_occ.instrument_id,
        due_date=db_task_occ.due_date.isoformat(),
        task_type=db_task_occ.task_type,
        completed=db_task_occ.completed,
        completed_at=db_task_occ.completed_at.isoformat() if db_task_occ.completed_at else None,
        notes=db_task_occ.notes,
        photo_url=db_task_occ.photo_url
    )

def db_practice_session_definition_to_pydantic(db_def: DBPracticeSessionDefinition) -> PracticeSessionDefinition:
    """Convert database PracticeSessionDefinition to Pydantic model"""
    return PracticeSessionDefinition(
        id=db_def.id,
        name=db_def.name,
        description=db_def.description,
        created_at=db_def.created_at.isoformat() if db_def.created_at else None,
        updated_at=db_def.updated_at.isoformat() if db_def.updated_at else None
    )

def db_practice_session_to_pydantic(db_session: DBPracticeSession) -> PracticeSession:
    """Convert database PracticeSession to Pydantic model"""
    return PracticeSession(
        id=db_session.id,
        instrument_id=db_session.instrument_id,
        practice_session_definition_id=db_session.practice_session_definition_id,
        start_time=db_session.start_time.isoformat() if db_session.start_time else None,
        end_time=db_session.end_time.isoformat() if db_session.end_time else None,
        duration=db_session.duration,
        completed=db_session.completed,
        completed_at=db_session.completed_at.isoformat() if db_session.completed_at else None,
        notes=db_session.notes,
        photo_url=db_session.photo_url,
        updated_at=db_session.updated_at.isoformat() if hasattr(db_session, 'updated_at') and db_session.updated_at else None
    )

def db_user_profile_to_pydantic(db_profile: DBUserProfile) -> UserProfile:
    """Convert database UserProfile to Pydantic model"""
    # Convert gender: return string value directly (frontend expects string)
    gender_value = None
    if db_profile.gender:
        # Return as string, not enum
        gender_value = db_profile.gender
    
    return UserProfile(
        id=db_profile.id,
        username=db_profile.username,
        email=db_profile.email,
        name=db_profile.name,
        date_of_birth=db_profile.date_of_birth.isoformat() if db_profile.date_of_birth else None,
        gender=gender_value,
        primary_instrument=db_profile.primary_instrument,
        age_commenced_playing=db_profile.age_commenced_playing,
        secondary_instruments=db_profile.secondary_instruments,
        daily_practice_hours=db_profile.daily_practice_hours,
        days_per_week_practising=db_profile.days_per_week_practising,
        practice_routine_description=db_profile.practice_routine_description,
        biography=db_profile.biography,
        reminder_hours=db_profile.reminder_hours,
        notifications_enabled=db_profile.notifications_enabled,
        created_at=db_profile.created_at.isoformat() if db_profile.created_at else None,
        updated_at=db_profile.updated_at.isoformat() if db_profile.updated_at else None
    )

def generate_task_occurrences(task_def: DBTaskDefinition, db: Session, end_date: date = None):
    """Generate task occurrences from a task definition and save to database"""
    if end_date is None:
        end_date = date.today() + timedelta(days=90)  # Generate 90 days ahead
    
    start = task_def.start_date
    occurrences = []
    current_date = start
    
    while current_date <= end_date:
        occurrence = DBTaskOccurrence(
            id=generate_uuid(),
            task_definition_id=task_def.id,
            instrument_id=task_def.instrument_id,
            due_date=current_date,
            task_type=task_def.task_type,
            completed=False,
            completed_at=None,
            notes=None,
            photo_url=None
        )
        occurrences.append(occurrence)
        
        # Calculate next occurrence
        if task_def.frequency_type == "days":
            current_date += timedelta(days=task_def.frequency_value)
        elif task_def.frequency_type == "weekly":
            current_date += timedelta(weeks=task_def.frequency_value)
        elif task_def.frequency_type == "monthly":
            # Approximate: add 30 days per month
            current_date += timedelta(days=30 * task_def.frequency_value)
    
    # Add all occurrences to database
    db.add_all(occurrences)
    db.commit()
    
    return occurrences

def get_completion_streak(db: Session):
    """Calculate consecutive days with at least one completed task"""
    completions = db.query(DBTaskCompletion).all()
    
    if not completions:
        return 0
    
    # Get unique completion dates, sorted descending
    completion_dates = sorted(
        set([c.completed_at.date() for c in completions if c.completed_at]),
        reverse=True
    )
    
    if not completion_dates:
        return 0
    
    streak = 0
    expected_date = date.today()
    
    for comp_date in completion_dates:
        if comp_date == expected_date or comp_date == expected_date - timedelta(days=1):
            streak += 1
            expected_date = comp_date - timedelta(days=1)
        else:
            break
    
    return streak

# API Routes

@app.get("/", response_class=HTMLResponse)
async def root():
    """Root endpoint with navigation"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Practice Tracker API</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #2C5530; }
            .link-box { background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #2C5530; }
            .link-box a { color: #2C5530; text-decoration: none; font-weight: bold; font-size: 18px; }
            .link-box a:hover { text-decoration: underline; }
            .link-box p { color: #666; margin: 5px 0 0 0; }
            .status { color: #4CAF50; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎵 Practice Tracker API</h1>
            <p class="status">✓ Status: Running</p>
            
            <div class="link-box">
                <a href="/admin/db-viewer">📊 Database Viewer</a>
                <p>View all your data stored in the SQLite database</p>
            </div>
            
            <div class="link-box">
                <a href="/docs">📚 API Documentation</a>
                <p>Interactive API documentation with Swagger UI</p>
            </div>
            
            <div class="link-box">
                <a href="/api/health">💚 Health Check</a>
                <p>Check API status and version</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html

@app.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint - checks both API and database connectivity"""
    db_connected = False
    try:
        # Test database connection by executing a simple query
        result = db.execute(text("SELECT 1"))
        result.fetchone()  # Actually fetch the result
        db_connected = True
    except Exception as e:
        print(f"Database connection check failed: {e}")
        db_connected = False
    
    return {
        "status": "healthy" if db_connected else "degraded",
        "database": "connected" if db_connected else "disconnected",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

# Instrument endpoints
@app.get("/api/instruments", response_model=List[Instrument])
async def get_instruments(user_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Get instruments - optionally filtered by user_id"""
    query = db.query(DBInstrument)
    if user_id:
        query = query.filter(DBInstrument.user_profile_id == user_id)
    db_instruments = query.all()
    return [db_instrument_to_pydantic(instr) for instr in db_instruments]

@app.get("/api/instruments/{instrument_id}", response_model=Instrument)
async def get_instrument_item(instrument_id: str, db: Session = Depends(get_db)):
    """Get a specific instrument item"""
    item = db.query(DBInstrument).filter(DBInstrument.id == instrument_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return db_instrument_to_pydantic(item)

@app.post("/api/instruments", response_model=Instrument)
async def create_instrument(instrument: InstrumentCreate, db: Session = Depends(get_db)):
    """Create new instrument - user_profile_id is optional for private app"""
    new_instrument = DBInstrument(
        id=generate_uuid(),
        user_profile_id=instrument.user_profile_id,  # Can be None for private app
        name=instrument.name,
        category=instrument.category,
        instrument_type=instrument.instrument_type.value if isinstance(instrument.instrument_type, InstrumentType) else instrument.instrument_type,
        notes=instrument.notes
    )
    db.add(new_instrument)
    db.commit()
    db.refresh(new_instrument)
    return db_instrument_to_pydantic(new_instrument)

@app.put("/api/instruments/{instrument_id}", response_model=Instrument)
async def update_instrument(instrument_id: str, instrument: InstrumentCreate, db: Session = Depends(get_db)):
    """Update instrument"""
    existing = db.query(DBInstrument).filter(DBInstrument.id == instrument_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Instrument not found")
    
    existing.name = instrument.name
    existing.category = instrument.category
    existing.instrument_type = instrument.instrument_type.value if isinstance(instrument.instrument_type, InstrumentType) else instrument.instrument_type
    existing.notes = instrument.notes
    if instrument.user_profile_id:
        existing.user_profile_id = instrument.user_profile_id
    existing.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(existing)
    return db_instrument_to_pydantic(existing)

@app.delete("/api/instruments/{instrument_id}")
async def delete_instrument(instrument_id: str, db: Session = Depends(get_db)):
    """Delete instrument and all related tasks"""
    existing = db.query(DBInstrument).filter(DBInstrument.id == instrument_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Instrument not found")
    
    # Delete instrument (cascade will handle related tasks)
    db.delete(existing)
    db.commit()
    
    return {"message": "Instrument deleted", "id": instrument_id}

# Task definition endpoints
@app.get("/api/task-definitions")
async def get_task_definitions(db: Session = Depends(get_db)):
    """Get all task definitions"""
    db_task_defs = db.query(DBTaskDefinition).all()
    return [db_task_definition_to_pydantic(td) for td in db_task_defs]

@app.get("/api/task-definitions/instrument/{instrument_id}")
async def get_task_definitions_by_instrument(instrument_id: str, db: Session = Depends(get_db)):
    """Get task definitions for specific instrument"""
    db_task_defs = db.query(DBTaskDefinition).filter(DBTaskDefinition.instrument_id == instrument_id).all()
    return [db_task_definition_to_pydantic(td) for td in db_task_defs]

@app.post("/api/task-definitions")
async def create_task_definition(task_def: TaskDefinitionCreate, db: Session = Depends(get_db)):
    """Create a new task definition and generate occurrences"""
    # Verify instrument exists
    instrument = db.query(DBInstrument).filter(DBInstrument.id == task_def.instrument_id).first()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    
    new_def = DBTaskDefinition(
        id=generate_uuid(),
        instrument_id=task_def.instrument_id,
        task_type=task_def.task_type,
        frequency_type=task_def.frequency_type,
        frequency_value=task_def.frequency_value,
        start_date=date.fromisoformat(task_def.start_date)
    )
    db.add(new_def)
    db.commit()
    db.refresh(new_def)
    
    # Generate occurrences
    generate_task_occurrences(new_def, db)
    
    return db_task_definition_to_pydantic(new_def)

@app.delete("/api/task-definitions/{task_def_id}")
async def delete_task_definition(task_def_id: str, db: Session = Depends(get_db)):
    """Delete task definition and its occurrences"""
    existing = db.query(DBTaskDefinition).filter(DBTaskDefinition.id == task_def_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Task definition not found")
    
    # Cascade delete will handle task_occurrences
    db.delete(existing)
    db.commit()
    
    return {"message": "Task definition deleted", "id": task_def_id}

# Practice Session Definition endpoints
@app.get("/api/practice-session-definitions", response_model=List[PracticeSessionDefinition])
async def get_practice_session_definitions(db: Session = Depends(get_db)):
    """Get all practice session definitions"""
    db_defs = db.query(DBPracticeSessionDefinition).all()
    return [db_practice_session_definition_to_pydantic(d) for d in db_defs]

# Task occurrence endpoints
@app.get("/api/tasks")
async def get_tasks(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    instrument_id: Optional[str] = None,
    task_type: Optional[TaskType] = None,
    completed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get practice sessions (legacy endpoint - returns PracticeSession data in TaskOccurrence format for compatibility)"""
    # Query PracticeSession instead of TaskOccurrence
    query = db.query(DBPracticeSession)
    
    if start_date:
        # Filter by start_time date instead of due_date
        start_date_obj = date.fromisoformat(start_date)
        query = query.filter(
            func.date(DBPracticeSession.start_time) >= start_date_obj
        )
    if end_date:
        # Filter by start_time date instead of due_date
        end_date_obj = date.fromisoformat(end_date)
        query = query.filter(
            func.date(DBPracticeSession.start_time) <= end_date_obj
        )
    if instrument_id:
        query = query.filter(DBPracticeSession.instrument_id == instrument_id)
    if completed is not None:
        query = query.filter(DBPracticeSession.completed == completed)
    
    sessions = query.order_by(DBPracticeSession.start_time).all()
    
    # Convert PracticeSession to TaskOccurrence format for backward compatibility
    # Get "Practice General" definition ID for mapping
    practice_general = db.query(DBPracticeSessionDefinition).filter(
        DBPracticeSessionDefinition.name == "Practice General"
    ).first()
    
    result = []
    for session in sessions:
        # Extract date from start_time for due_date field (backward compatibility)
        due_date_value = None
        if session.start_time:
            due_date_value = session.start_time.date().isoformat()
        
        # Convert to TaskOccurrence-like format
        result.append({
            "id": session.id,
            "task_definition_id": "",  # Not applicable for PracticeSession
            "instrument_id": session.instrument_id,
            "due_date": due_date_value,
            "task_type": "Practice",  # Default to Practice
            "completed": session.completed,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "notes": session.notes,
            "photo_url": session.photo_url,
            # Add new fields for frontend
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "duration": session.duration,
            "practice_session_definition_id": session.practice_session_definition_id
        })
    
    return result

@app.get("/api/practice-sessions")
async def get_practice_sessions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    instrument_id: Optional[str] = None,
    practice_session_definition_id: Optional[str] = None,
    completed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get practice sessions with optional filters"""
    query = db.query(DBPracticeSession)
    
    if start_date:
        # Filter by start_time date instead of due_date
        start_date_obj = date.fromisoformat(start_date)
        query = query.filter(
            func.date(DBPracticeSession.start_time) >= start_date_obj
        )
    if end_date:
        # Filter by start_time date instead of due_date
        end_date_obj = date.fromisoformat(end_date)
        query = query.filter(
            func.date(DBPracticeSession.start_time) <= end_date_obj
        )
    if instrument_id:
        query = query.filter(DBPracticeSession.instrument_id == instrument_id)
    if practice_session_definition_id:
        query = query.filter(DBPracticeSession.practice_session_definition_id == practice_session_definition_id)
    if completed is not None:
        query = query.filter(DBPracticeSession.completed == completed)
    
    sessions = query.order_by(DBPracticeSession.start_time).all()
    return [db_practice_session_to_pydantic(s) for s in sessions]

@app.post("/api/practice-sessions", response_model=PracticeSession)
async def create_practice_session(session: PracticeSessionCreate, db: Session = Depends(get_db)):
    """Create a new practice session"""
    # Verify instrument exists
    instrument = db.query(DBInstrument).filter(DBInstrument.id == session.instrument_id).first()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    
    # Verify practice session definition exists
    practice_def = db.query(DBPracticeSessionDefinition).filter(
        DBPracticeSessionDefinition.id == session.practice_session_definition_id
    ).first()
    if not practice_def:
        raise HTTPException(status_code=404, detail="Practice session definition not found")
    
    # Parse start_time and end_time
    start_time = None
    if session.start_time:
        try:
            start_time = datetime.fromisoformat(session.start_time.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            start_time = None
    
    end_time = None
    if session.end_time:
        try:
            end_time = datetime.fromisoformat(session.end_time.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            end_time = None
    
    # Create new session (due_date removed - date extracted from start_time when needed)
    new_session = DBPracticeSession(
        id=generate_uuid(),
        instrument_id=session.instrument_id,
        practice_session_definition_id=session.practice_session_definition_id,
        start_time=start_time,
        end_time=end_time,
        duration=session.duration,
        completed=False,
        notes=session.notes
    )
    
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return db_practice_session_to_pydantic(new_session)

@app.put("/api/practice-sessions/{session_id}", response_model=PracticeSession)
async def update_practice_session(session_id: str, session: PracticeSessionCreate, db: Session = Depends(get_db)):
    """Update an existing practice session"""
    existing = db.query(DBPracticeSession).filter(DBPracticeSession.id == session_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Practice session not found")
    
    # Verify instrument exists
    instrument = db.query(DBInstrument).filter(DBInstrument.id == session.instrument_id).first()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")
    
    # Verify practice session definition exists
    practice_def = db.query(DBPracticeSessionDefinition).filter(
        DBPracticeSessionDefinition.id == session.practice_session_definition_id
    ).first()
    if not practice_def:
        raise HTTPException(status_code=404, detail="Practice session definition not found")
    
    # Parse start_time and end_time (due_date removed)
    start_time = None
    if session.start_time:
        try:
            start_time = datetime.fromisoformat(session.start_time.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            start_time = existing.start_time
    
    end_time = None
    if session.end_time:
        try:
            end_time = datetime.fromisoformat(session.end_time.replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            end_time = existing.end_time
    
    # Update session (due_date removed - date extracted from start_time when needed)
    existing.instrument_id = session.instrument_id
    existing.practice_session_definition_id = session.practice_session_definition_id
    existing.start_time = start_time
    existing.end_time = end_time
    existing.duration = session.duration
    existing.notes = session.notes
    existing.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(existing)
    
    return db_practice_session_to_pydantic(existing)

@app.delete("/api/practice-sessions/{session_id}")
async def delete_practice_session(session_id: str, db: Session = Depends(get_db)):
    """Delete a practice session"""
    session = db.query(DBPracticeSession).filter(DBPracticeSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")
    
    db.delete(session)
    db.commit()
    
    return {"message": "Practice session deleted", "id": session_id}

@app.get("/api/practice-sessions/total-time")
async def get_total_practice_time(db: Session = Depends(get_db)):
    """Calculate total practice time from all sessions in the database"""
    from sqlalchemy import func
    total = db.query(func.sum(DBPracticeSession.duration)).filter(
        DBPracticeSession.duration.isnot(None)
    ).scalar()
    return {"total_time": int(total) if total else 0}

@app.get("/api/tasks/date/{task_date}")
async def get_tasks_by_date(task_date: str, db: Session = Depends(get_db)):
    """Get all practice sessions for a specific date (legacy endpoint)"""
    # Filter by start_time date instead of due_date
    task_date_obj = date.fromisoformat(task_date)
    sessions = db.query(DBPracticeSession).filter(
        func.date(DBPracticeSession.start_time) == task_date_obj
    ).all()
    # Convert to TaskOccurrence format for backward compatibility
    result = []
    for session in sessions:
        # Extract date from start_time for due_date field (backward compatibility)
        due_date_value = None
        if session.start_time:
            due_date_value = session.start_time.date().isoformat()
        result.append({
            "id": session.id,
            "task_definition_id": "",
            "instrument_id": session.instrument_id,
            "due_date": due_date_value,
            "task_type": "Practice",
            "completed": session.completed,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "notes": session.notes,
            "photo_url": session.photo_url,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "duration": session.duration,
            "practice_session_definition_id": session.practice_session_definition_id
        })
    return result

@app.get("/api/tasks/today")
async def get_tasks_today(db: Session = Depends(get_db)):
    """Get practice sessions for today (legacy endpoint)"""
    today = date.today()
    # Filter by start_time date instead of due_date
    sessions = db.query(DBPracticeSession).filter(
        func.date(DBPracticeSession.start_time) == today,
        DBPracticeSession.completed == False
    ).all()
    # Convert to TaskOccurrence format
    result = []
    for session in sessions:
        # Extract date from start_time for due_date field (backward compatibility)
        due_date_value = None
        if session.start_time:
            due_date_value = session.start_time.date().isoformat()
        result.append({
            "id": session.id,
            "task_definition_id": "",
            "instrument_id": session.instrument_id,
            "due_date": due_date_value,
            "task_type": "Practice",
            "completed": session.completed,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "notes": session.notes,
            "photo_url": session.photo_url,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "duration": session.duration,
            "practice_session_definition_id": session.practice_session_definition_id
        })
    return result

@app.get("/api/tasks/tomorrow")
async def get_tasks_tomorrow(db: Session = Depends(get_db)):
    """Get practice sessions for tomorrow (legacy endpoint)"""
    tomorrow = date.today() + timedelta(days=1)
    # Filter by start_time date instead of due_date
    sessions = db.query(DBPracticeSession).filter(
        func.date(DBPracticeSession.start_time) == tomorrow,
        DBPracticeSession.completed == False
    ).all()
    # Convert to TaskOccurrence format
    result = []
    for session in sessions:
        # Extract date from start_time for due_date field (backward compatibility)
        due_date_value = None
        if session.start_time:
            due_date_value = session.start_time.date().isoformat()
        result.append({
            "id": session.id,
            "task_definition_id": "",
            "instrument_id": session.instrument_id,
            "due_date": due_date_value,
            "task_type": "Practice",
            "completed": session.completed,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "notes": session.notes,
            "photo_url": session.photo_url,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "duration": session.duration,
            "practice_session_definition_id": session.practice_session_definition_id
        })
    return result

@app.get("/api/tasks/overdue")
async def get_tasks_overdue(db: Session = Depends(get_db)):
    """Get overdue practice sessions (legacy endpoint)"""
    today = date.today()
    # Filter by start_time date instead of due_date
    sessions = db.query(DBPracticeSession).filter(
        func.date(DBPracticeSession.start_time) < today,
        DBPracticeSession.completed == False
    ).all()
    # Convert to TaskOccurrence format
    result = []
    for session in sessions:
        # Extract date from start_time for due_date field (backward compatibility)
        due_date_value = None
        if session.start_time:
            due_date_value = session.start_time.date().isoformat()
        result.append({
            "id": session.id,
            "task_definition_id": "",
            "instrument_id": session.instrument_id,
            "due_date": due_date_value,
            "task_type": "Practice",
            "completed": session.completed,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "notes": session.notes,
            "photo_url": session.photo_url,
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "duration": session.duration,
            "practice_session_definition_id": session.practice_session_definition_id
        })
    return result

@app.post("/api/tasks/{task_id}/complete")
async def complete_task(task_id: str, completion: TaskCompletion, db: Session = Depends(get_db)):
    """Mark a task as complete"""
    task = db.query(DBTaskOccurrence).filter(DBTaskOccurrence.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    now = datetime.utcnow()
    task.completed = True
    task.completed_at = now
    task.notes = completion.notes
    task.photo_url = completion.photo_url
    
    # Store in completion history
    task_completion = DBTaskCompletion(
        id=generate_uuid(),
        task_occurrence_id=task_id,
        instrument_id=task.instrument_id,
        task_type=task.task_type,
        completed_at=now,
        notes=completion.notes,
        photo_url=completion.photo_url
    )
    db.add(task_completion)
    db.commit()
    db.refresh(task)
    
    return db_task_occurrence_to_pydantic(task)

@app.put("/api/tasks/{task_id}/reschedule")
async def reschedule_task(task_id: str, new_date: dict, db: Session = Depends(get_db)):
    """Reschedule a practice session to a new due date (legacy endpoint)"""
    session = db.query(DBPracticeSession).filter(DBPracticeSession.id == task_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found")
    
    try:
        # Update start_time with new date, preserving the time component
        new_due_date = date.fromisoformat(new_date.get('due_date'))
        if session.start_time:
            # Preserve the time from existing start_time, only change the date
            old_start = session.start_time
            new_start_time = datetime.combine(new_due_date, old_start.time())
            session.start_time = new_start_time
            # Also update end_time if it exists to maintain duration
            if session.end_time and session.duration:
                new_end_time = datetime.combine(new_due_date, session.end_time.time())
                session.end_time = new_end_time
        else:
            # If no start_time, set it to the new date at midnight
            session.start_time = datetime.combine(new_due_date, datetime.min.time())
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(session)
        return db_practice_session_to_pydantic(session)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")

@app.delete("/api/tasks/{task_id}")
async def delete_task_occurrence(task_id: str, db: Session = Depends(get_db)):
    """Delete a single practice session (legacy endpoint - deletes from PracticeSession table)"""
    # Query PracticeSession instead of TaskOccurrence (matching GET /api/tasks behavior)
    session = db.query(DBPracticeSession).filter(DBPracticeSession.id == task_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(session)
    db.commit()
    
    return {"message": "Practice session deleted", "id": task_id}

@app.post("/api/tasks/instrument/{instrument_id}/complete-all")
async def complete_all_tasks_for_instrument(instrument_id: str, db: Session = Depends(get_db)):
    """Batch complete all due/overdue tasks for instrument"""
    today = date.today()
    tasks = db.query(DBTaskOccurrence).filter(
        DBTaskOccurrence.instrument_id == instrument_id,
        DBTaskOccurrence.due_date <= today,
        DBTaskOccurrence.completed == False
    ).all()
    
    now = datetime.utcnow()
    completed = []
    
    for task in tasks:
        task.completed = True
        task.completed_at = now
        
        # Create completion record
        task_completion = DBTaskCompletion(
            id=generate_uuid(),
            task_occurrence_id=task.id,
            instrument_id=instrument_id,
            task_type=task.task_type,
            completed_at=now,
            notes=None,
            photo_url=None
        )
        db.add(task_completion)
        completed.append(task)
        
    db.commit()
    for task in completed:
        db.refresh(task)
    
    return {
        "completed_count": len(completed),
        "tasks": [db_task_occurrence_to_pydantic(t) for t in completed]
    }

# Analytics endpoints
@app.get("/api/analytics/completion-rate")
async def get_completion_rate(period: str = "monthly", db: Session = Depends(get_db)):  # weekly or monthly
    """Get completion rate for period"""
    if period == "weekly":
        start_date = date.today() - timedelta(days=7)
    else:
        start_date = date.today() - timedelta(days=30)
    
    all_tasks = db.query(DBTaskOccurrence).filter(DBTaskOccurrence.due_date >= start_date).all()
    completed_tasks = [t for t in all_tasks if t.completed]
    
    rate = (len(completed_tasks) / len(all_tasks) * 100) if all_tasks else 0
    return {"period": period, "completion_rate": round(rate, 2), "total": len(all_tasks), "completed": len(completed_tasks)}

@app.get("/api/analytics/streak")
async def get_streak(db: Session = Depends(get_db)):
    """Get completion streak"""
    return {"streak_days": get_completion_streak(db)}

@app.get("/api/analytics/instrument-scores")
async def get_instrument_scores(db: Session = Depends(get_db)):
    """Get maintenance score per instrument (last 30 days)"""
    thirty_days_ago = date.today() - timedelta(days=30)
    all_instruments = db.query(DBInstrument).all()
    scores = []
    
    for instrument in all_instruments:
        instr_tasks = db.query(DBTaskOccurrence).filter(
            DBTaskOccurrence.instrument_id == instrument.id,
            DBTaskOccurrence.due_date >= thirty_days_ago
        ).all()
        completed = [t for t in instr_tasks if t.completed]
        score = (len(completed) / len(instr_tasks) * 100) if instr_tasks else 0
        
        scores.append({
            "instrument_id": instrument.id,
            "instrument_name": instrument.name,
            "score": round(score, 2),
            "total_tasks": len(instr_tasks),
            "completed_tasks": len(completed)
        })
    
    return scores

@app.get("/api/analytics/task-breakdown")
async def get_task_breakdown(db: Session = Depends(get_db)):
    """Get task breakdown by type and instrument"""
    breakdown = {
        "by_type": {},
        "by_instrument": {}
    }
    
    all_tasks = db.query(DBTaskOccurrence).all()
    all_instruments = {instr.id: instr.name for instr in db.query(DBInstrument).all()}
    
    for task in all_tasks:
        # By type
        task_type = task.task_type
        breakdown["by_type"][task_type] = breakdown["by_type"].get(task_type, 0) + 1
        
        # By instrument
        instr_name = all_instruments.get(task.instrument_id, "Unknown")
        breakdown["by_instrument"][instr_name] = breakdown["by_instrument"].get(instr_name, 0) + 1
    
    return breakdown

# Instruments endpoint
@app.get("/api/instruments")
async def get_instruments():
    """Get comprehensive list of musical instruments for dropdowns"""
    return {"instruments": get_instruments_list()}

# Authentication endpoints
@app.post("/api/auth/signup", response_model=AuthResponse)
async def signup(request: SignUpRequest, db: Session = Depends(get_db)):
    """Create a new user account"""
    # Check if email already exists
    existing = db.query(DBUserProfile).filter(DBUserProfile.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user profile with hashed password
    new_profile = DBUserProfile(
        id=generate_uuid(),
        email=request.email,
        name=request.name,
        password_hash=hash_password(request.password),
        reminder_hours=24,
        notifications_enabled=True
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    
    return AuthResponse(
        user_id=new_profile.id,
        name=new_profile.name,
        email=new_profile.email,
        message="Account created successfully"
    )

@app.post("/api/auth/signin", response_model=AuthResponse)
async def signin(request: SignInRequest, db: Session = Depends(get_db)):
    """Sign in with email and password"""
    # Find user by email
    user = db.query(DBUserProfile).filter(DBUserProfile.email == request.email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not user.password_hash or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return AuthResponse(
        user_id=user.id,
        name=user.name,
        email=user.email,
        username=user.username,
        message="Signed in successfully"
    )

@app.get("/api/auth/current-user")
async def get_current_user(user_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Get current user profile by user_id"""
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    user = db.query(DBUserProfile).filter(DBUserProfile.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "username": user.username
    }

# Profile endpoints
@app.post("/api/profile", response_model=UserProfile)
async def create_profile(profile: UserProfileCreate, db: Session = Depends(get_db)):
    """Create a new user profile"""
    # Parse date_of_birth if provided
    dob = None
    if profile.date_of_birth:
        try:
            # Handle both YYYY-MM-DD format and ISO format
            if len(profile.date_of_birth) == 10:  # YYYY-MM-DD format
                dob = date.fromisoformat(profile.date_of_birth)
            else:
                dob = datetime.fromisoformat(profile.date_of_birth.replace('Z', '+00:00')).date()
        except Exception as e:
            print(f"Error parsing date_of_birth: {e}")
            dob = None
    
    new_profile = DBUserProfile(
        id=generate_uuid(),
        username=profile.username,
        email=profile.email,
        name=profile.name,
        date_of_birth=dob,
        gender=profile.gender.value if profile.gender else None,
        primary_instrument=profile.primary_instrument,
        age_commenced_playing=profile.age_commenced_playing,
        secondary_instruments=profile.secondary_instruments,
        daily_practice_hours=profile.daily_practice_hours,
        days_per_week_practising=profile.days_per_week_practising,
        practice_routine_description=profile.practice_routine_description,
        biography=profile.biography,
        reminder_hours=profile.reminder_hours,
        notifications_enabled=profile.notifications_enabled
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return db_user_profile_to_pydantic(new_profile)

@app.get("/api/profile")
async def get_profile(user_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Get user profile - for private app, returns first profile or creates default"""
    if user_id:
        profile = db.query(DBUserProfile).filter(DBUserProfile.id == user_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        return db_user_profile_to_pydantic(profile)
    else:
        # Private app: get first profile or create default
        profile = db.query(DBUserProfile).first()
        if not profile:
            # Create default profile
            default_profile = DBUserProfile(
                id=generate_uuid(),
                name="User",
                reminder_hours=24,
                notifications_enabled=True
            )
            db.add(default_profile)
            db.commit()
            db.refresh(default_profile)
            return db_user_profile_to_pydantic(default_profile)
        return db_user_profile_to_pydantic(profile)

@app.put("/api/profile")
async def update_profile(profile: UserProfileUpdate, user_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Update profile - for private app, updates first profile if user_id not provided"""
    if user_id:
        existing = db.query(DBUserProfile).filter(DBUserProfile.id == user_id).first()
        if not existing:
            raise HTTPException(status_code=404, detail="Profile not found")
    else:
        # Private app: get first profile or create default
        existing = db.query(DBUserProfile).first()
        if not existing:
            # Create default profile
            existing = DBUserProfile(
                id=generate_uuid(),
                name=profile.name or "User",
                reminder_hours=24,
                notifications_enabled=True
            )
            db.add(existing)
            db.commit()
            db.refresh(existing)
    
    # Update all fields - frontend sends all fields, so update them all
    # Handle username (optional, not in profile form currently)
    if profile.username is not None:
        existing.username = profile.username.strip() if isinstance(profile.username, str) and profile.username.strip() else None
    
    # Update email
    if profile.email is not None:
        existing.email = profile.email.strip() if isinstance(profile.email, str) and profile.email.strip() else None
    
    # Update name (required field)
    if profile.name is not None:
        name_str = profile.name.strip() if isinstance(profile.name, str) else str(profile.name)
        if name_str:  # Only update if non-empty
            existing.name = name_str
    
    # Update date_of_birth (handle empty string or None)
    if profile.date_of_birth is not None:
        dob_str = profile.date_of_birth.strip() if isinstance(profile.date_of_birth, str) else str(profile.date_of_birth)
        if dob_str:
            try:
                # Handle both YYYY-MM-DD format and ISO format
                if len(dob_str) == 10:  # YYYY-MM-DD format
                    existing.date_of_birth = date.fromisoformat(dob_str)
                else:
                    existing.date_of_birth = datetime.fromisoformat(dob_str.replace('Z', '+00:00')).date()
            except Exception as e:
                print(f"Error parsing date_of_birth '{profile.date_of_birth}': {e}")
                # Keep existing date if parsing fails
        else:
            # Empty string - clear the date
            existing.date_of_birth = None
    
    # Update gender
    if profile.gender is not None:
        if isinstance(profile.gender, Gender):
            existing.gender = profile.gender.value
        elif isinstance(profile.gender, str):
            gender_str = profile.gender.strip()
            if gender_str and gender_str in [g.value for g in Gender]:
                existing.gender = gender_str
            else:
                existing.gender = None
        else:
            existing.gender = None
    else:
        existing.gender = None
    
    # Update primary_instrument
    if profile.primary_instrument is not None:
        existing.primary_instrument = profile.primary_instrument.strip() if isinstance(profile.primary_instrument, str) and profile.primary_instrument.strip() else None
    else:
        existing.primary_instrument = None
    
    # Update age_commenced_playing (integer, allow None or 0)
    existing.age_commenced_playing = profile.age_commenced_playing
    
    # Update secondary_instruments
    if profile.secondary_instruments is not None:
        existing.secondary_instruments = profile.secondary_instruments.strip() if isinstance(profile.secondary_instruments, str) and profile.secondary_instruments.strip() else None
    else:
        existing.secondary_instruments = None
    
    # Update daily_practice_hours (float, allow None or 0.0)
    existing.daily_practice_hours = profile.daily_practice_hours
    
    # Update days_per_week_practising (integer, allow None or 0)
    existing.days_per_week_practising = profile.days_per_week_practising
    
    # Update practice_routine_description
    if profile.practice_routine_description is not None:
        existing.practice_routine_description = profile.practice_routine_description.strip() if isinstance(profile.practice_routine_description, str) and profile.practice_routine_description.strip() else None
    else:
        existing.practice_routine_description = None
    
    # Update biography
    if profile.biography is not None:
        existing.biography = profile.biography.strip() if isinstance(profile.biography, str) and profile.biography.strip() else None
    else:
        existing.biography = None
    
    # Update reminder_hours (integer, default 24)
    if profile.reminder_hours is not None:
        existing.reminder_hours = profile.reminder_hours
    # If None, keep existing value (don't override with default)
    
    # Update notifications_enabled (boolean)
    if profile.notifications_enabled is not None:
        existing.notifications_enabled = profile.notifications_enabled
    
    existing.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(existing)
    return db_user_profile_to_pydantic(existing)

# Export endpoints
@app.get("/api/export/ics")
async def export_ics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    instrument_id: Optional[str] = None,
    task_type: Optional[TaskType] = None,
    db: Session = Depends(get_db)
):
    """Export tasks as ICS calendar file"""
    query = db.query(DBTaskOccurrence)
    
    if start_date:
        query = query.filter(DBTaskOccurrence.due_date >= date.fromisoformat(start_date))
    if end_date:
        query = query.filter(DBTaskOccurrence.due_date <= date.fromisoformat(end_date))
    if instrument_id:
        query = query.filter(DBTaskOccurrence.instrument_id == instrument_id)
    if task_type:
        query = query.filter(DBTaskOccurrence.task_type == task_type)
    
    tasks = query.all()
    all_instruments = {instr.id: instr.name for instr in db.query(DBInstrument).all()}
    
    ics_content = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Practice Tracker//EN\n"
    
    for task in tasks:
        instr_name = all_instruments.get(task.instrument_id, "Unknown")
        due_date_str = task.due_date.isoformat().replace("-", "")
        
        ics_content += f"""BEGIN:VEVENT
DTSTART;VALUE=DATE:{due_date_str}
SUMMARY:{task.task_type} - {instr_name}
DESCRIPTION:Practice session for {instr_name}
END:VEVENT
"""
    
    ics_content += "END:VCALENDAR\n"
    
    return Response(content=ics_content, media_type="text/calendar",
                   headers={"Content-Disposition": "attachment; filename=tasks.ics"})

@app.get("/api/export/csv")
async def export_csv(db: Session = Depends(get_db)):
    """Export task history as CSV"""
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["Date", "Instrument", "Task Type", "Completed", "Completed At", "Notes"])
    
    tasks = db.query(DBTaskOccurrence).order_by(DBTaskOccurrence.due_date).all()
    all_instruments = {instr.id: instr.name for instr in db.query(DBInstrument).all()}
    
    for task in tasks:
        instr_name = all_instruments.get(task.instrument_id, "Unknown")
        
        writer.writerow([
            task.due_date.isoformat(),
            instr_name,
            task.task_type,
            "Yes" if task.completed else "No",
            task.completed_at.isoformat() if task.completed_at else "",
            task.notes or ""
        ])
    
    return Response(content=output.getvalue(), media_type="text/csv",
                   headers={"Content-Disposition": "attachment; filename=tasks.csv"})

@app.get("/api/export/json")
async def export_json(db: Session = Depends(get_db)):
    """Export full backup as JSON"""
    instruments = db.query(DBInstrument).all()
    task_definitions = db.query(DBTaskDefinition).all()
    task_occurrences = db.query(DBTaskOccurrence).all()
    task_completions = db.query(DBTaskCompletion).all()
    user_profile = db.query(DBUserProfile).first()
    
    # Convert to dict format
    backup = {
        "export_date": datetime.utcnow().isoformat(),
        "instruments": [db_instrument_to_pydantic(instr).dict() for instr in instruments],
        "task_definitions": [db_task_definition_to_pydantic(td).dict() for td in task_definitions],
        "task_occurrences": [db_task_occurrence_to_pydantic(to).dict() for to in task_occurrences],
        "task_completions": [{
            "id": tc.id,
            "task_occurrence_id": tc.task_occurrence_id,
            "instrument_id": tc.instrument_id,
            "task_type": tc.task_type,
            "completed_at": tc.completed_at.isoformat() if tc.completed_at else None,
            "notes": tc.notes,
            "photo_url": tc.photo_url
        } for tc in task_completions],
        "user_profile": db_user_profile_to_pydantic(user_profile).dict() if user_profile else None
    }
    
    return Response(content=json.dumps(backup, indent=2, default=str), media_type="application/json",
                   headers={"Content-Disposition": "attachment; filename=backup.json"})

@app.post("/api/data/clear")
async def clear_all_data(confirm: bool = False, db: Session = Depends(get_db)):
    """Clear all data (requires confirmation)"""
    if not confirm:
        raise HTTPException(status_code=400, detail="Confirmation required")
    
    # Delete all records (cascade will handle relationships)
    db.query(DBTaskCompletion).delete()
    db.query(DBTaskOccurrence).delete()
    db.query(DBTaskDefinition).delete()
    db.query(DBInstrument).delete()
    # Keep user profile or delete it too? Let's keep it for now
    # db.query(DBUserProfile).delete()
    
    db.commit()
    
    return {"message": "All data cleared"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
