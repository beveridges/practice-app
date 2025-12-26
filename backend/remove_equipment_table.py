"""
Script to remove the old Equipment table from the database
This should be run after migrating from Equipment to Instrument
"""

import sqlite3
import os

def remove_equipment_table():
    """Remove the old Equipment table from the database"""
    db_path = 'practice_tracker.db'
    
    if not os.path.exists(db_path):
        print(f"Database file not found: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if Equipment table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Equipment'")
        equipment_exists = cursor.fetchone() is not None
        
        if not equipment_exists:
            print("Equipment table not found - it may have already been removed or migrated to Instrument")
            conn.close()
            return
        
        # Check if there are any foreign key constraints referencing Equipment
        print("Checking for foreign key constraints...")
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND sql LIKE '%Equipment%'
        """)
        referencing_tables = cursor.fetchall()
        
        if referencing_tables:
            print("Warning: The following tables may reference Equipment:")
            for table in referencing_tables:
                print(f"  - {table[0]}")
            print("\nNote: If you've already migrated to Instrument, these references should be updated.")
        
        # Drop the Equipment table
        print("\nDropping Equipment table...")
        cursor.execute("DROP TABLE IF EXISTS Equipment")
        conn.commit()
        print("✓ Equipment table removed successfully")
        
        # Verify removal
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        remaining_tables = [row[0] for row in cursor.fetchall()]
        
        print("\nRemaining tables in database:")
        for table in remaining_tables:
            print(f"  - {table}")
        
        # Check if Instrument table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Instrument'")
        instrument_exists = cursor.fetchone() is not None
        
        if instrument_exists:
            print("\n✓ Instrument table found - migration appears successful")
        else:
            print("\n⚠ Warning: Instrument table not found. You may need to run the migration script.")
        
    except sqlite3.Error as e:
        print(f"Error removing Equipment table: {e}")
        conn.rollback()
    finally:
        conn.close()
    
    print("\n✅ Script completed!")

if __name__ == "__main__":
    remove_equipment_table()

