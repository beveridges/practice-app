"""
Script to remove old snake_case tables from the database
"""

import sqlite3
import os

def remove_old_tables():
    """Remove old snake_case tables from the database"""
    db_path = 'practice_tracker.db'
    
    if not os.path.exists(db_path):
        print(f"Database file not found: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    print("Current tables in database:")
    for table in tables:
        print(f"  - {table}")
    
    # Old table names to remove (snake_case and old Equipment table)
    old_tables = [
        'user_profile',
        'task_definitions',
        'task_occurrences',
        'task_completions',
        'Equipment'  # Old Equipment table (replaced by Instrument)
    ]
    
    print("\nRemoving old snake_case tables...")
    for table_name in old_tables:
        if table_name in tables:
            try:
                cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
                print(f"  ✓ Dropped: {table_name}")
            except Exception as e:
                print(f"  ✗ Error dropping {table_name}: {e}")
        else:
            print(f"  - {table_name} not found (already removed or doesn't exist)")
    
    conn.commit()
    
    # Check remaining tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    remaining_tables = [row[0] for row in cursor.fetchall()]
    
    print("\nRemaining tables:")
    if remaining_tables:
        for table in remaining_tables:
            print(f"  - {table}")
    else:
        print("  (none)")
    
    conn.close()
    print("\n✅ Old tables removed!")

if __name__ == "__main__":
    remove_old_tables()

