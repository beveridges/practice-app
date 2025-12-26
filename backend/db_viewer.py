"""
Simple web-based SQLite database viewer
Access at: http://localhost:8000/admin/db-viewer
"""

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from database import get_db
from database import Instrument, TaskDefinition, TaskOccurrence, TaskCompletion, UserProfile

router = APIRouter()


@router.get("/admin/db-viewer", response_class=HTMLResponse)
async def db_viewer(db: Session = Depends(get_db)):
    """Simple HTML viewer for the database"""
    
    # Get all data
    instruments = db.query(Instrument).all()
    task_defs = db.query(TaskDefinition).all()
    task_occurrences = db.query(TaskOccurrence).all()
    task_completions = db.query(TaskCompletion).all()
    profile = db.query(UserProfile).first()
    
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Database Viewer - Practice Tracker</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            h1 { color: #2C5530; }
            h2 { color: #8B7355; margin-top: 30px; }
            table { border-collapse: collapse; width: 100%; background: white; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #2C5530; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            .count { background: #4CAF50; color: white; padding: 2px 8px; border-radius: 3px; }
            .section { background: white; padding: 20px; margin: 10px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        </style>
    </head>
    <body>
        <h1>🔍 Database Viewer</h1>
        <p>View all data stored in the SQLite database</p>
    """
    
    # User Profile
    html += f"""
    <div class="section">
        <h2>User Profile</h2>
        <table>
            <tr>
                <th>ID (UUID)</th>
                <th>Username</th>
                <th>Email</th>
                <th>Name</th>
                <th>Biography</th>
                <th>Reminder Hours</th>
                <th>Notifications</th>
            </tr>
    """
    if profile:
        html += f"""
            <tr>
                <td>{profile.id[:8]}...</td>
                <td>{profile.username or ''}</td>
                <td>{profile.email or ''}</td>
                <td>{profile.name}</td>
                <td>{profile.biography or ''}</td>
                <td>{profile.reminder_hours}</td>
                <td>{'Yes' if profile.notifications_enabled else 'No'}</td>
            </tr>
        """
    else:
        html += "<tr><td colspan='7'>No profile found</td></tr>"
    html += "</table></div>"
    
    # Instruments
    html += f"""
    <div class="section">
        <h2>Instruments <span class="count">{len(instruments)}</span></h2>
        <table>
            <tr>
                <th>ID (UUID)</th>
                <th>User Profile ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Notes</th>
                <th>Created</th>
            </tr>
    """
    for instr in instruments:
        html += f"""
            <tr>
                <td>{instr.id[:8]}...</td>
                <td>{instr.user_profile_id[:8] + '...' if instr.user_profile_id else 'None'}</td>
                <td>{instr.name}</td>
                <td>{instr.category}</td>
                <td>{instr.notes or ''}</td>
                <td>{instr.created_at.strftime('%Y-%m-%d %H:%M') if instr.created_at else ''}</td>
            </tr>
        """
    html += "</table></div>"
    
    # Task Definitions
    html += f"""
    <div class="section">
        <h2>Task Definitions <span class="count">{len(task_defs)}</span></h2>
        <table>
            <tr>
                <th>ID (UUID)</th>
                <th>Instrument ID</th>
                <th>Task Type</th>
                <th>Frequency</th>
                <th>Start Date</th>
            </tr>
    """
    for td in task_defs:
        html += f"""
            <tr>
                <td>{td.id[:8]}...</td>
                <td>{td.instrument_id[:8]}...</td>
                <td>{td.task_type}</td>
                <td>{td.frequency_type} ({td.frequency_value})</td>
                <td>{td.start_date}</td>
            </tr>
        """
    html += "</table></div>"
    
    # Task Occurrences
    html += f"""
    <div class="section">
        <h2>Task Occurrences <span class="count">{len(task_occurrences)}</span></h2>
        <table>
            <tr>
                <th>ID (UUID)</th>
                <th>Instrument ID</th>
                <th>Due Date</th>
                <th>Task Type</th>
                <th>Completed</th>
                <th>Notes</th>
            </tr>
    """
    for to in task_occurrences:
        html += f"""
            <tr>
                <td>{to.id[:8]}...</td>
                <td>{to.instrument_id[:8]}...</td>
                <td>{to.due_date}</td>
                <td>{to.task_type}</td>
                <td>{'✅' if to.completed else '❌'}</td>
                <td>{to.notes or ''}</td>
            </tr>
        """
    html += "</table></div>"
    
    # Task Completions
    html += f"""
    <div class="section">
        <h2>Task Completions <span class="count">{len(task_completions)}</span></h2>
        <table>
            <tr>
                <th>ID (UUID)</th>
                <th>Task Occurrence ID</th>
                <th>Instrument ID</th>
                <th>Completed At</th>
                <th>Notes</th>
            </tr>
    """
    for tc in task_completions:
        html += f"""
            <tr>
                <td>{tc.id[:8]}...</td>
                <td>{tc.task_occurrence_id[:8]}...</td>
                <td>{tc.instrument_id[:8]}...</td>
                <td>{tc.completed_at.strftime('%Y-%m-%d %H:%M') if tc.completed_at else ''}</td>
                <td>{tc.notes or ''}</td>
            </tr>
        """
    html += "</table></div>"
    
    html += """
        <div class="section">
            <p><strong>Tip:</strong> For more advanced database management, use <a href="https://sqlitebrowser.org/">DB Browser for SQLite</a></p>
        </div>
    </body>
    </html>
    """
    
    return html

