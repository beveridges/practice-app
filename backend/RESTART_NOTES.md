# Restart the Backend After Code Changes

After adding new routes or making code changes, you need to restart the backend server.

## How to Restart

### If running with `python main.py`:
1. Press `Ctrl+C` in the terminal to stop
2. Run again: `python main.py`

### If running with `uvicorn` (with auto-reload):
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
The `--reload` flag automatically restarts on code changes.

### Check if server is running:
```bash
# Windows
netstat -ano | findstr :8000

# Mac/Linux  
lsof -i :8000
```

## New Routes Added:
- `/admin/db-viewer` - Database viewer (HTML)
- `/` - Home page with navigation links

