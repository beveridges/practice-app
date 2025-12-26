"""
Migration script to rename Equipment table to Instrument and update all equipment_id columns to instrument_id
Run this once to update existing database
"""

import sqlite3
import os
from pathlib import Path

# Database file location
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./practice_tracker.db")
# Extract file path from SQLite URL
db_path = DATABASE_URL.replace("sqlite:///", "")

if not os.path.exists(db_path):
    print(f"Database file not found: {db_path}")
    print("No migration needed - database will be created with correct schema on next startup")
    exit(0)

print(f"Migrating database: {db_path}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check if Equipment table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Equipment'")
    equipment_exists = cursor.fetchone() is not None
    
    if not equipment_exists:
        print("Equipment table doesn't exist yet - no migration needed")
        print("Database will be created with correct schema on next startup")
        exit(0)
    
    # Step 1: Rename Equipment table to Instrument
    print("Step 1: Renaming Equipment table to Instrument...")
    cursor.execute("ALTER TABLE Equipment RENAME TO Instrument")
    
    # Step 2: Update foreign key columns in TaskDefinitions
    print("Step 2: Updating TaskDefinitions table...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='TaskDefinitions'")
    if cursor.fetchone():
        # Create new table with instrument_id
        cursor.execute("""
            CREATE TABLE TaskDefinitions_new (
                id TEXT PRIMARY KEY,
                instrument_id TEXT NOT NULL,
                task_type TEXT NOT NULL,
                frequency_type TEXT NOT NULL,
                frequency_value INTEGER NOT NULL,
                start_date DATE NOT NULL,
                created_at DATETIME,
                FOREIGN KEY (instrument_id) REFERENCES Instrument(id)
            )
        """)
        
        # Copy data, renaming equipment_id to instrument_id
        cursor.execute("""
            INSERT INTO TaskDefinitions_new 
            SELECT id, equipment_id, task_type, frequency_type, frequency_value, start_date, created_at
            FROM TaskDefinitions
        """)
        
        # Drop old table and rename new one
        cursor.execute("DROP TABLE TaskDefinitions")
        cursor.execute("ALTER TABLE TaskDefinitions_new RENAME TO TaskDefinitions")
        print("  ✓ TaskDefinitions.equipment_id → instrument_id")
    
    # Step 3: Update foreign key columns in TaskOccurrences
    print("Step 3: Updating TaskOccurrences table...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='TaskOccurrences'")
    if cursor.fetchone():
        # Create new table with instrument_id
        cursor.execute("""
            CREATE TABLE TaskOccurrences_new (
                id TEXT PRIMARY KEY,
                task_definition_id TEXT NOT NULL,
                instrument_id TEXT NOT NULL,
                due_date DATE NOT NULL,
                task_type TEXT NOT NULL,
                completed BOOLEAN DEFAULT 0,
                completed_at DATETIME,
                notes TEXT,
                photo_url TEXT,
                FOREIGN KEY (task_definition_id) REFERENCES TaskDefinitions(id),
                FOREIGN KEY (instrument_id) REFERENCES Instrument(id)
            )
        """)
        
        # Copy data, renaming equipment_id to instrument_id
        cursor.execute("""
            INSERT INTO TaskOccurrences_new 
            SELECT id, task_definition_id, equipment_id, due_date, task_type, completed, completed_at, notes, photo_url
            FROM TaskOccurrences
        """)
        
        # Drop old table and rename new one
        cursor.execute("DROP TABLE TaskOccurrences")
        cursor.execute("ALTER TABLE TaskOccurrences_new RENAME TO TaskOccurrences")
        
        # Recreate index
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_TaskOccurrences_due_date ON TaskOccurrences(due_date)")
        print("  ✓ TaskOccurrences.equipment_id → instrument_id")
    
    # Step 4: Update foreign key columns in TaskCompletions
    print("Step 4: Updating TaskCompletions table...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='TaskCompletions'")
    if cursor.fetchone():
        # Create new table with instrument_id
        cursor.execute("""
            CREATE TABLE TaskCompletions_new (
                id TEXT PRIMARY KEY,
                task_occurrence_id TEXT NOT NULL,
                instrument_id TEXT NOT NULL,
                task_type TEXT NOT NULL,
                completed_at DATETIME NOT NULL,
                notes TEXT,
                photo_url TEXT,
                FOREIGN KEY (task_occurrence_id) REFERENCES TaskOccurrences(id)
            )
        """)
        
        # Copy data, renaming equipment_id to instrument_id
        cursor.execute("""
            INSERT INTO TaskCompletions_new 
            SELECT id, task_occurrence_id, equipment_id, task_type, completed_at, notes, photo_url
            FROM TaskCompletions
        """)
        
        # Drop old table and rename new one
        cursor.execute("DROP TABLE TaskCompletions")
        cursor.execute("ALTER TABLE TaskCompletions_new RENAME TO TaskCompletions")
        print("  ✓ TaskCompletions.equipment_id → instrument_id")
    
    # Step 5: Recreate indexes for Instrument table
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_Instrument_id ON Instrument(id)")
    
    conn.commit()
    print("✓ Migration completed successfully")
    print("  Equipment table → Instrument table")
    print("  All equipment_id columns → instrument_id columns")
    
except sqlite3.OperationalError as e:
    print(f"Error during migration: {e}")
    conn.rollback()
    raise
finally:
    conn.close()

