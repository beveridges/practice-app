"""
Migration script to make user_profile_id nullable in Equipment table
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
    # Check if column is already nullable (SQLite doesn't support ALTER COLUMN directly)
    # We need to recreate the table
    
    # Step 1: Create new table with nullable user_profile_id
    cursor.execute("""
        CREATE TABLE Equipment_new (
            id TEXT PRIMARY KEY,
            user_profile_id TEXT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            instrument_type TEXT NOT NULL DEFAULT 'Primary',
            notes TEXT,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY (user_profile_id) REFERENCES UserProfile(id)
        )
    """)
    
    # Step 2: Copy data from old table
    cursor.execute("""
        INSERT INTO Equipment_new 
        SELECT id, user_profile_id, name, category, instrument_type, notes, created_at, updated_at
        FROM Equipment
    """)
    
    # Step 3: Drop old table
    cursor.execute("DROP TABLE Equipment")
    
    # Step 4: Rename new table
    cursor.execute("ALTER TABLE Equipment_new RENAME TO Equipment")
    
    # Step 5: Recreate indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_Equipment_id ON Equipment(id)")
    
    conn.commit()
    print("✓ Migration completed successfully")
    print("  Equipment.user_profile_id is now nullable")
    
except sqlite3.OperationalError as e:
    if "no such table" in str(e).lower():
        print("Equipment table doesn't exist yet - no migration needed")
        print("Database will be created with correct schema on next startup")
    else:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
finally:
    conn.close()

