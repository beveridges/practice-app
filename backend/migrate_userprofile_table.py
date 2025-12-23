"""
Migration script to recreate UserProfile table using SQLAlchemy models.
This ensures the table structure exactly matches the model definition.

Usage:
    python migrate_userprofile_table.py
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from database import Base, UserProfile, engine, DATABASE_URL
from datetime import datetime
import sqlite3

def backup_user_data():
    """Backup existing user data to a list of dictionaries"""
    if "sqlite" in DATABASE_URL:
        db_file = DATABASE_URL.replace("sqlite:///", "")
        if not os.path.exists(db_file):
            return []
        
        conn = sqlite3.connect(db_file)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT * FROM UserProfile")
            rows = cursor.fetchall()
            data = [dict(row) for row in rows]
            conn.close()
            return data
        except sqlite3.OperationalError:
            # Table doesn't exist yet
            conn.close()
            return []
    return []

def restore_user_data(backup_data, engine):
    """Restore user data to the recreated table"""
    if not backup_data:
        return
    
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        restored_count = 0
        for user_data in backup_data:
            try:
                # Create a new UserProfile instance from backup data
                user = UserProfile()
                
                # Map old column names to new model attributes
                for key, value in user_data.items():
                    if hasattr(user, key):
                        # Handle date strings
                        if key == 'date_of_birth' and isinstance(value, str):
                            try:
                                from datetime import date
                                user.date_of_birth = date.fromisoformat(value)
                            except:
                                user.date_of_birth = None
                        # Handle datetime strings
                        elif key in ('created_at', 'updated_at') and isinstance(value, str):
                            try:
                                from datetime import datetime
                                user.__dict__[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                            except:
                                pass
                        # Handle boolean
                        elif key == 'notifications_enabled':
                            user.notifications_enabled = bool(value) if value is not None else True
                        # Handle other fields
                        else:
                            setattr(user, key, value)
                
                # Ensure required fields are present
                if not user.id:
                    from uuid_utils import generate_uuid
                    user.id = generate_uuid()
                if not user.name:
                    user.name = "Unknown"
                
                db.add(user)
                restored_count += 1
            except Exception as e:
                print(f"  Warning: Could not restore user {user_data.get('id', 'unknown')}: {e}")
                continue
        
        db.commit()
        print(f"  Restored {restored_count} of {len(backup_data)} user profile(s)")
    except Exception as e:
        db.rollback()
        print(f"  Error during restore: {e}")
        raise
    finally:
        db.close()

def migrate_userprofile_table():
    """Recreate UserProfile table to match the model definition"""
    print("Starting UserProfile table migration...")
    print("-" * 60)
    
    # Backup existing data
    print("1. Backing up existing data...")
    backup_data = backup_user_data()
    if backup_data:
        print(f"  Backed up {len(backup_data)} user profile(s)")
    else:
        print("  No existing data to backup")
    
    # Drop and recreate the table
    print("\n2. Dropping old UserProfile table...")
    with engine.connect() as conn:
        # Disable foreign keys temporarily
        if "sqlite" in DATABASE_URL:
            conn.execute(text("PRAGMA foreign_keys = OFF"))
        
        # Drop the table
        UserProfile.__table__.drop(engine, checkfirst=True)
        print("  Old table dropped")
        
        # Recreate the table
        print("\n3. Creating new UserProfile table...")
        Base.metadata.create_all(bind=engine, tables=[UserProfile.__table__])
        print("  New table created")
        
        # Re-enable foreign keys
        if "sqlite" in DATABASE_URL:
            conn.execute(text("PRAGMA foreign_keys = ON"))
        conn.commit()
    
    # Verify table structure
    print("\n4. Verifying table structure...")
    inspector = inspect(engine)
    columns = inspector.get_columns('UserProfile')
    print(f"  Table has {len(columns)} columns:")
    for col in columns:
        nullable = "NULL" if col['nullable'] else "NOT NULL"
        default = f" DEFAULT {col['default']}" if col['default'] is not None else ""
        print(f"    - {col['name']}: {col['type']} {nullable}{default}")
    
    # Restore data
    if backup_data:
        print("\n5. Restoring user data...")
        restore_user_data(backup_data, engine)
    
    print("\n" + "=" * 60)
    print("✓ Migration completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    try:
        migrate_userprofile_table()
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

