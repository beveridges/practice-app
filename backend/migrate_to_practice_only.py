"""
Migration script to simplify database to only support Practice sessions for Trumpet.
This script will:
1. Delete all task definitions that are not Practice type
2. Delete all task occurrences that are not Practice type
3. Delete all task completions that are not Practice type
4. Optionally: Delete all instruments except Trumpet (if desired)
"""

import sqlite3
import os
from pathlib import Path

# Database path
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./practice_tracker.db")
db_path = DATABASE_URL.replace("sqlite:///", "")

if not os.path.exists(db_path):
    print(f"❌ Database file not found: {db_path}")
    exit(1)

print(f"📊 Migrating database: {db_path}")
print("This will remove all non-Practice tasks and keep only Practice sessions.")
print()

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Count existing data
    cursor.execute("SELECT COUNT(*) FROM TaskDefinitions WHERE task_type != 'Practice'")
    non_practice_defs = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM TaskOccurrences WHERE task_type != 'Practice'")
    non_practice_occurrences = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM TaskCompletions WHERE task_type != 'Practice'")
    non_practice_completions = cursor.fetchone()[0]
    
    print(f"Found:")
    print(f"  - {non_practice_defs} non-Practice task definitions")
    print(f"  - {non_practice_occurrences} non-Practice task occurrences")
    print(f"  - {non_practice_completions} non-Practice task completions")
    print()
    
    if non_practice_defs == 0 and non_practice_occurrences == 0 and non_practice_completions == 0:
        print("✅ Database already contains only Practice tasks. No migration needed.")
        conn.close()
        exit(0)
    
    # Confirm deletion
    response = input("Do you want to delete all non-Practice tasks? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ Migration cancelled.")
        conn.close()
        exit(0)
    
    print()
    print("🗑️  Deleting non-Practice tasks...")
    
    # Delete non-Practice task completions first (they reference occurrences)
    cursor.execute("DELETE FROM TaskCompletions WHERE task_type != 'Practice'")
    deleted_completions = cursor.rowcount
    print(f"  ✓ Deleted {deleted_completions} non-Practice task completions")
    
    # Delete non-Practice task occurrences
    cursor.execute("DELETE FROM TaskOccurrences WHERE task_type != 'Practice'")
    deleted_occurrences = cursor.rowcount
    print(f"  ✓ Deleted {deleted_occurrences} non-Practice task occurrences")
    
    # Delete non-Practice task definitions
    cursor.execute("DELETE FROM TaskDefinitions WHERE task_type != 'Practice'")
    deleted_defs = cursor.rowcount
    print(f"  ✓ Deleted {deleted_defs} non-Practice task definitions")
    
    # Commit changes
    conn.commit()
    
    print()
    print("✅ Migration completed successfully!")
    print(f"   Removed {deleted_completions + deleted_occurrences + deleted_defs} non-Practice records")
    
except Exception as e:
    print(f"❌ Error during migration: {e}")
    conn.rollback()
    raise
finally:
    conn.close()

