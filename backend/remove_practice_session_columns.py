"""
Migration script to remove 'due_date' and 'created_at' columns from PracticeSession table
"""

import sqlite3
import os
from datetime import datetime

def migrate_practice_session_table():
    """Remove due_date and created_at columns from PracticeSession table"""
    db_path = 'practice_tracker.db'
    
    if not os.path.exists(db_path):
        print(f"Database file not found: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # SQLite doesn't support DROP COLUMN directly, so we need to:
        # 1. Create a new table without the columns
        # 2. Copy data (extracting date from start_time for any legacy due_date usage)
        # 3. Drop old table
        # 4. Rename new table
        
        print("Checking current PracticeSession table structure...")
        cursor.execute("PRAGMA table_info(PracticeSession)")
        columns = cursor.fetchall()
        print(f"Current columns: {[col[1] for col in columns]}")
        
        # Check if columns exist
        column_names = [col[1] for col in columns]
        has_due_date = 'due_date' in column_names
        has_created_at = 'created_at' in column_names
        
        if not has_due_date and not has_created_at:
            print("✅ Columns 'due_date' and 'created_at' already removed. No migration needed.")
            conn.close()
            return
        
        print("\nCreating new PracticeSession table without due_date and created_at...")
        
        # Create new table structure (without due_date and created_at)
        cursor.execute("""
            CREATE TABLE PracticeSession_new (
                id TEXT PRIMARY KEY,
                instrument_id TEXT NOT NULL,
                practice_session_definition_id TEXT NOT NULL,
                start_time DATETIME,
                end_time DATETIME,
                duration INTEGER,
                completed BOOLEAN DEFAULT 0,
                completed_at DATETIME,
                notes TEXT,
                photo_url TEXT,
                updated_at DATETIME,
                FOREIGN KEY (instrument_id) REFERENCES Instrument(id),
                FOREIGN KEY (practice_session_definition_id) REFERENCES PracticeSessionDefinition(id)
            )
        """)
        
        # Copy data from old table to new table
        print("Copying data to new table...")
        if has_due_date:
            # If due_date exists, we'll ignore it (date is in start_time)
            cursor.execute("""
                INSERT INTO PracticeSession_new 
                (id, instrument_id, practice_session_definition_id, start_time, end_time, 
                 duration, completed, completed_at, notes, photo_url, updated_at)
                SELECT 
                    id, instrument_id, practice_session_definition_id, start_time, end_time,
                    duration, completed, completed_at, notes, photo_url, updated_at
                FROM PracticeSession
            """)
        else:
            # If no due_date, just copy all columns except created_at
            cursor.execute("""
                INSERT INTO PracticeSession_new 
                (id, instrument_id, practice_session_definition_id, start_time, end_time, 
                 duration, completed, completed_at, notes, photo_url, updated_at)
                SELECT 
                    id, instrument_id, practice_session_definition_id, start_time, end_time,
                    duration, completed, completed_at, notes, photo_url, updated_at
                FROM PracticeSession
            """)
        
        # Drop old table
        print("Dropping old PracticeSession table...")
        cursor.execute("DROP TABLE PracticeSession")
        
        # Rename new table
        print("Renaming new table to PracticeSession...")
        cursor.execute("ALTER TABLE PracticeSession_new RENAME TO PracticeSession")
        
        # Recreate indexes
        print("Recreating indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_PracticeSession_start_time ON PracticeSession(start_time)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_PracticeSession_instrument_id ON PracticeSession(instrument_id)")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        print("   - Removed 'due_date' column")
        print("   - Removed 'created_at' column")
        print("   - Date information is now extracted from 'start_time' when needed")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error during migration: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("PracticeSession Table Migration")
    print("Removing: due_date, created_at columns")
    print("=" * 60)
    print()
    migrate_practice_session_table()

