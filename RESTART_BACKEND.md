# ⚠️ IMPORTANT: Restart Backend Server

The backend server **MUST be restarted** after changing the TaskType enum.

## The Problem

The error "Input should be 'Cleaning', 'Drying', 'Disinfecting' or 'Other'" means the backend is still running the OLD code with the old enum values.

## Solution: Restart the Backend

### Step 1: Stop the Current Backend
1. Find the terminal/command prompt where the backend is running
2. Press `Ctrl+C` to stop it
3. Wait until it's fully stopped

### Step 2: Restart the Backend
```bash
cd backend
python main.py
```

Or if using uvicorn directly:
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3: Verify It's Working
1. Check the terminal output - you should see "Uvicorn running on http://0.0.0.0:8000"
2. Try adding a session again - it should work now!

## Why This Happens

Python loads code into memory when the server starts. When you change the code:
- The file on disk is updated ✅
- But the running server still has the old code in memory ❌
- Restarting loads the new code into memory ✅

## Verification

After restarting, the TaskType enum should only have "Practice":
- ✅ TaskType.PRACTICE = "Practice"
- ❌ No more Cleaning, Drying, Disinfecting, Other

