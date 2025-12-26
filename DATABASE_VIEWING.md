# How to View Your SQLite Database

The database file is located at: `backend/practice_tracker.db`

## Option 1: Built-in Web Viewer (Easiest) 🌐

Once your backend is running, visit:
```
http://localhost:8000/admin/db-viewer
```

This shows all your data in a nice HTML table format - perfect for quick viewing!

## Option 2: DB Browser for SQLite (Recommended) 📊

**Best for: Non-technical users and visual browsing**

1. Download from: https://sqlitebrowser.org/
2. Install it (free and open-source)
3. Open DB Browser
4. Click "Open Database"
5. Navigate to: `backend/practice_tracker.db`
6. Browse tables, run queries, edit data visually

**Features:**
- Visual table browser
- Execute SQL queries
- Edit data in spreadsheet-like interface
- Export data to CSV/JSON
- View table structure

## Option 3: Command Line (sqlite3) 💻

**Best for: Quick checks and automation**

Open terminal/command prompt in the `backend` directory:

```bash
# Windows (if sqlite3 is installed)
sqlite3 practice_tracker.db

# Or use Python's built-in sqlite3
python -c "import sqlite3; conn = sqlite3.connect('practice_tracker.db'); cursor = conn.cursor(); cursor.execute('SELECT * FROM equipment'); print(cursor.fetchall()); conn.close()"
```

**Useful commands:**
```sql
.tables                    -- List all tables
.schema equipment          -- Show table structure
SELECT * FROM equipment;   -- View all equipment
SELECT * FROM task_occurrences WHERE completed = 0;
.quit                      -- Exit
```

## Option 4: VS Code Extension 📝

**Best for: Developers already using VS Code**

1. Install "SQLite Viewer" or "SQLite" extension in VS Code
2. Right-click on `backend/practice_tracker.db`
3. Select "Open Database"
4. Browse tables in sidebar

## Option 5: Python Script 🔧

Create a simple Python script to view data:

```python
from database import SessionLocal, Equipment, TaskOccurrence

db = SessionLocal()
try:
    # View equipment
    equipment = db.query(Equipment).all()
    for eq in equipment:
        print(f"{eq.id}: {eq.name} ({eq.category})")
    
    # View tasks
    tasks = db.query(TaskOccurrence).all()
    for task in tasks:
        print(f"Task {task.id}: {task.task_type} due {task.due_date}")
finally:
    db.close()
```

## Quick Reference

| Tool | Best For | Complexity |
|------|----------|-----------|
| Web Viewer (`/admin/db-viewer`) | Quick browser viewing | ⭐ Easy |
| DB Browser for SQLite | Full-featured GUI | ⭐⭐ Medium |
| Command Line (sqlite3) | Developers, automation | ⭐⭐⭐ Advanced |
| VS Code Extension | VS Code users | ⭐⭐ Medium |
| Python Script | Programmatic access | ⭐⭐⭐ Advanced |

## Database Tables

Your database contains these tables:
- `equipment` - Your instruments/equipment
- `task_definitions` - Recurring task templates
- `task_occurrences` - Individual task instances
- `task_completions` - Completion history
- `user_profile` - User settings

## Backup Your Database

Simply copy the file:
```bash
# Windows
copy backend\practice_tracker.db backend\hygiene_tracker_backup.db

# Mac/Linux
cp backend/practice_tracker.db backend/hygiene_tracker_backup.db
```

That's it! Your database is just a single file - easy to backup and restore.

