"""
Script to update database table names to PascalCase
This will drop all old tables and recreate with new names
"""

from database import Base, engine, init_db
from database import UserProfile, Instrument, TaskDefinition, TaskOccurrence, TaskCompletion
import sqlite3

def check_current_tables():
    """Check what tables currently exist"""
    conn = sqlite3.connect('practice_tracker.db')
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    return tables

def recreate_database():
    """Drop all tables and recreate with PascalCase names"""
    print("Current tables in database:")
    old_tables = check_current_tables()
    for table in old_tables:
        print(f"  - {table}")
    
    print("\nDropping all tables...")
    Base.metadata.drop_all(bind=engine)
    
    print("Creating new tables with PascalCase names...")
    init_db()
    
    print("\nNew tables in database:")
    new_tables = check_current_tables()
    for table in new_tables:
        print(f"  - {table}")
    
    print("\n✅ Database updated successfully!")
    print("Expected tables: UserProfile, Instrument, TaskDefinitions, TaskOccurrences, TaskCompletions")

if __name__ == "__main__":
    recreate_database()

