"""
Script to create and inspect the SQLite database with UUID-based schema.
Run this to generate the database file for inspection.
"""

from database import init_db, engine, Base
from database import UserProfile, Instrument, TaskDefinition, TaskOccurrence, TaskCompletion
from sqlalchemy import inspect
from uuid_utils import generate_uuid
from datetime import date

def create_database():
    """Create the database schema"""
    print("Creating database schema...")
    init_db()
    print("✓ Database schema created successfully!")
    print(f"Database file: practice_tracker.db\n")

def inspect_database():
    """Inspect and display database structure"""
    inspector = inspect(engine)
    
    print("=" * 80)
    print("DATABASE STRUCTURE INSPECTION")
    print("=" * 80)
    print()
    
    # Get all table names
    tables = inspector.get_table_names()
    
    for table_name in tables:
        print(f"Table: {table_name}")
        print("-" * 80)
        
        # Get columns
        columns = inspector.get_columns(table_name)
        for col in columns:
            pk = " [PRIMARY KEY]" if col.get('primary_key') else ""
            nullable = " NULL" if col.get('nullable') else " NOT NULL"
            default = f" DEFAULT {col.get('default')}" if col.get('default') else ""
            print(f"  {col['name']:30} {str(col['type']):20}{pk}{nullable}{default}")
        
        # Get foreign keys
        fks = inspector.get_foreign_keys(table_name)
        if fks:
            print("\n  Foreign Keys:")
            for fk in fks:
                constrained_cols = ', '.join(fk['constrained_columns'])
                referred_cols = ', '.join(fk['referred_columns'])
                print(f"    {constrained_cols} -> {fk['referred_table']}.{referred_cols}")
        
        # Get indexes
        indexes = inspector.get_indexes(table_name)
        if indexes:
            print("\n  Indexes:")
            for idx in indexes:
                idx_cols = ', '.join(idx['column_names'])
                unique = " [UNIQUE]" if idx.get('unique') else ""
                print(f"    {idx['name']:30} on ({idx_cols}){unique}")
        
        print()
    
    print("=" * 80)
    print("RELATIONSHIP DIAGRAM")
    print("=" * 80)
    print("""
UserProfile (1) ──→ (many) Instrument
Instrument (1) ──→ (many) TaskDefinition
TaskDefinition (1) ──→ (many) TaskOccurrence
TaskOccurrence (1) ──→ (many) TaskCompletion
    """)

def create_sample_data():
    """Create sample data for inspection"""
    from database import SessionLocal
    
    db = SessionLocal()
    try:
        # Create sample user profile
        user = UserProfile(
            id=generate_uuid(),
            username="testuser",
            email="test@example.com",
            name="Test User",
            biography="Sample user for database inspection"
        )
        db.add(user)
        db.flush()  # Get the ID
        
        # Create sample instrument
        instrument = Instrument(
            id=generate_uuid(),
            user_profile_id=user.id,
            name="Trumpet",
            category="Brass",
            notes="My main instrument"
        )
        db.add(instrument)
        db.flush()
        
        # Create sample task definition
        task_def = TaskDefinition(
            id=generate_uuid(),
            instrument_id=instrument.id,
            task_type="Cleaning",
            frequency_type="days",
            frequency_value=7,
            start_date=date.today()
        )
        db.add(task_def)
        db.flush()
        
        # Create sample task occurrence
        task_occur = TaskOccurrence(
            id=generate_uuid(),
            task_definition_id=task_def.id,
            instrument_id=instrument.id,
            due_date=date.today(),
            task_type="Cleaning"
        )
        db.add(task_occur)
        db.flush()
        
        db.commit()
        print("✓ Sample data created!")
        print(f"  User Profile: {user.id}")
        print(f"  Instrument: {instrument.id}")
        print(f"  Task Definition: {task_def.id}")
        print(f"  Task Occurrence: {task_occur.id}")
    except Exception as e:
        db.rollback()
        print(f"Error creating sample data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    
    print("\n" + "=" * 80)
    print("HYGIENE TRACKER DATABASE CREATION")
    print("=" * 80 + "\n")
    
    # Create database
    create_database()
    
    # Inspect structure
    inspect_database()
    
    # Create sample data if requested
    if len(sys.argv) > 1 and sys.argv[1] == "--with-samples":
        print("\n" + "=" * 80)
        create_sample_data()
        print("\n✓ Database ready for inspection with sample data!")
    else:
        print("\n✓ Database schema created (empty database)")
        print("  Run with --with-samples flag to add sample data")
    
    print("  Open practice_tracker.db with DB Browser for SQLite or sqlite3")

