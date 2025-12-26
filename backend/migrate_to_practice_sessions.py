"""
Migration script to create PracticeSessionDefinition and PracticeSession tables
and migrate existing TaskOccurrences data to PracticeSession.
"""

from database import (
    Base, engine, SessionLocal, DBPracticeSessionDefinition, DBPracticeSession,
    DBTaskOccurrence, DBPracticeSessionDefinition
)
from datetime import datetime
from uuid_utils import generate_uuid

def migrate_to_practice_sessions():
    """Create new tables and migrate data"""
    db = SessionLocal()
    
    try:
        print("Creating PracticeSessionDefinition and PracticeSession tables...")
        # Create new tables
        Base.metadata.create_all(bind=engine, tables=[
            DBPracticeSessionDefinition.__table__,
            DBPracticeSession.__table__
        ])
        print("✓ Tables created")
        
        # Check if "Practice General" already exists
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
            db.refresh(practice_general)
            print(f"✓ Created Practice General (ID: {practice_general.id})")
        else:
            print(f"✓ Practice General already exists (ID: {practice_general.id})")
        
        # Migrate existing TaskOccurrences to PracticeSession
        print("\nMigrating TaskOccurrences to PracticeSession...")
        task_occurrences = db.query(DBTaskOccurrence).all()
        
        migrated_count = 0
        for task_occ in task_occurrences:
            # Check if already migrated
            existing = db.query(DBPracticeSession).filter(
                DBPracticeSession.id == task_occ.id
            ).first()
            
            if existing:
                print(f"  - TaskOccurrence {task_occ.id} already migrated, skipping")
                continue
            
            # Create PracticeSession from TaskOccurrence
            practice_session = DBPracticeSession(
                id=task_occ.id,  # Keep same ID
                instrument_id=task_occ.instrument_id,
                practice_session_definition_id=practice_general.id,
                due_date=task_occ.due_date,
                start_time=None,  # Will be populated later
                end_time=None,  # Will be populated later
                duration=None,  # Will be populated later
                completed=task_occ.completed,
                completed_at=task_occ.completed_at,
                notes=task_occ.notes,
                photo_url=task_occ.photo_url,
                created_at=task_occ.due_date if task_occ.due_date else datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(practice_session)
            migrated_count += 1
        
        db.commit()
        print(f"✓ Migrated {migrated_count} TaskOccurrences to PracticeSession")
        
        print("\n✅ Migration completed successfully!")
        print(f"   - PracticeSessionDefinition table created")
        print(f"   - PracticeSession table created")
        print(f"   - 'Practice General' definition created")
        print(f"   - {migrated_count} sessions migrated")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_to_practice_sessions()

