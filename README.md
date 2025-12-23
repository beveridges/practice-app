# Practice Tracker Application 

A Progressive Web App (PWA) for musicians to track practice. Built with **FastAPI (Python)** backend and **vanilla JavaScript** frontend.

Ported from Instrument Hygiene Tracker.

## Features

### Core Functionality

1. **Equipment Management**
   - Add, edit, and delete equipment items (instruments, mouthpieces, cases, etc.)
   - Categorize by type: Woodwind, Brass, Plucked string, Bowed string, Percussion, Storage/Case, Other
   - Optional notes for each equipment item

2. **Hygiene Task Scheduling**
   - Define custom hygiene tasks per equipment item
   - Task types: Cleaning, Drying, Disinfecting, Other
   - Flexible frequency: Every N days, Weekly, or Monthly
   - Automatic generation of upcoming task occurrences

3. **Calendar & Task Views**
   - **Calendar View**: Visual calendar with tasks color-coded by type
   - **Today/Tomorrow/Overdue Lists**: Quick access to immediate tasks
   - Click any date to see tasks due that day

4. **Task Completion**
   - Mark tasks as complete with optional notes
   - Photo attachments (UI ready, backend supports)
   - Batch complete all tasks for a single equipment item
   - Tracks completion streak (consecutive days with ≥1 completed task)

5. **Analytics Dashboard**
   - Completion rate (weekly/monthly)
   - Completion streak tracking
   - Equipment maintenance scores (last 30 days)
   - Task breakdown by type and equipment

6. **Data Export**
   - ICS calendar export (filterable by date range, task type, equipment)
   - CSV export (task history)
   - JSON export (full backup)

7. **Offline Support**
   - Works without internet connection
   - Service Worker caches data
   - Syncs when connection restored

8. **PWA Features**
   - Installable on Android and iOS
   - App-like experience
   - Offline capable
   - Responsive design

## 🏗️ Architecture

```
Browser (HTML/CSS/JS)
   ↓
PWA Shell (Service Worker, Manifest)
   ↓
Python Backend (FastAPI)
```

### What Python Does
- ✅ RESTful APIs (JSON)
- ✅ Equipment CRUD operations
- ✅ Task definition and scheduling logic
- ✅ Automatic task occurrence generation
- ✅ Analytics calculations
- ✅ Data export (ICS, CSV, JSON)
- ✅ Business logic

### What Runs in the Browser
- ✅ HTML / CSS
- ✅ JavaScript (vanilla, no framework)
- ✅ Service Worker (offline + caching)
- ✅ Web App Manifest (installability)
- ✅ Calendar rendering
- ✅ Task management UI

## 🚀 Quick Start

### Prerequisites
- Conda (Anaconda or Miniconda)
- Python 3.8+ (installed via Conda)

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create Conda environment:**
   ```bash
   conda env create -f environment.yml
   ```

3. **Activate the environment:**
   ```bash
   conda activate pwa-backend
   ```

4. **Run the backend server:**
   ```bash
   python main.py
   ```
   
   Or with uvicorn directly:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`

### Frontend Setup

1. **Serve the frontend files:**
   
   **Option A: Python HTTP Server (Simple)**
   ```bash
   cd frontend
   python -m http.server 3000
   ```
   
   **Option B: Node.js http-server**
   ```bash
   npx http-server frontend -p 3000
   ```
   
   **Option C: Use FastAPI to serve static files (Production)**
   
   Uncomment the static file serving code in `backend/main.py`:
   ```python
   app.mount("/static", StaticFiles(directory="../frontend"), name="static")
   ```

2. **Update API URL (if needed):**
   
   Edit `frontend/app.js` and change `API_BASE_URL` if your backend runs on a different port:
   ```javascript
   const API_BASE_URL = 'http://localhost:8000/api';
   ```

3. **Open in browser:**
   ```
   http://localhost:3000
   ```

### Managing the Conda Environment

**Deactivate environment:**
```bash
conda deactivate
```

**Update environment (after changing environment.yml):**
```bash
conda env update -f environment.yml --prune
```

**Remove environment:**
```bash
conda env remove -n pwa-backend
```

## 📱 Using the App

### Adding Equipment

1. Navigate to the **Equipment** tab
2. Click **"+ Add Equipment"**
3. Enter name, select category, add optional notes
4. Click **Save**

### Creating Hygiene Tasks

1. Go to **Equipment** tab
2. Click **"Add Task"** on any equipment item
3. Select task type (Cleaning, Drying, Disinfecting, Other)
4. Set frequency (e.g., "Every 7 days" or "Weekly")
5. Set start date
6. Click **Create Task**

The app automatically generates upcoming task occurrences based on your schedule.

### Viewing Tasks

- **Calendar View**: See all tasks on a monthly calendar, color-coded by type
- **Tasks Tab**: Filter by Today, Tomorrow, or Overdue
- Click any date in the calendar to see tasks for that day

### Completing Tasks

1. Find the task in Calendar or Tasks view
2. Click **Complete**
3. Add optional notes or photo
4. Click **Mark Complete**

### Analytics

View your maintenance statistics in the **Analytics** tab:
- Completion streak
- Completion rate (weekly/monthly)
- Maintenance scores per equipment

## 🛠️ Development

### Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies (pip)
│   ├── environment.yml      # Conda environment file
│   └── .env.example         # Environment variables template
│
├── frontend/
│   ├── index.html           # Main HTML file
│   ├── styles.css           # App styles
│   ├── app.js               # Main JavaScript logic
│   ├── service-worker.js    # Service Worker for PWA
│   ├── manifest.json        # PWA manifest
│   └── icons/               # App icons (create these)
│
└── README.md
```

### API Endpoints

#### Equipment
- `GET /api/equipment` - Get all equipment
- `GET /api/equipment/{id}` - Get specific equipment
- `POST /api/equipment` - Create equipment
- `PUT /api/equipment/{id}` - Update equipment
- `DELETE /api/equipment/{id}` - Delete equipment

#### Task Definitions
- `GET /api/task-definitions` - Get all task definitions
- `GET /api/task-definitions/equipment/{id}` - Get definitions for equipment
- `POST /api/task-definitions` - Create task definition
- `DELETE /api/task-definitions/{id}` - Delete definition

#### Task Occurrences
- `GET /api/tasks` - Get tasks (with filters: start_date, end_date, equipment_id, task_type, completed)
- `GET /api/tasks/date/{date}` - Get tasks for specific date
- `GET /api/tasks/today` - Get today's tasks
- `GET /api/tasks/tomorrow` - Get tomorrow's tasks
- `GET /api/tasks/overdue` - Get overdue tasks
- `POST /api/tasks/{id}/complete` - Complete a task
- `POST /api/tasks/equipment/{id}/complete-all` - Batch complete for equipment

#### Analytics
- `GET /api/analytics/completion-rate?period=weekly|monthly` - Completion rate
- `GET /api/analytics/streak` - Completion streak
- `GET /api/analytics/equipment-scores` - Maintenance scores per equipment
- `GET /api/analytics/task-breakdown` - Task breakdown statistics

#### Export
- `GET /api/export/ics?start_date=&end_date=&equipment_id=&task_type=` - ICS calendar
- `GET /api/export/csv` - CSV export
- `GET /api/export/json` - JSON backup

#### Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update profile

#### Data Management
- `POST /api/data/clear?confirm=true` - Clear all data

## 🔧 Customization

### Adding Icons

Create app icons in `frontend/icons/` directory:
- `icon-72x72.png` through `icon-512x512.png`
- Required: `icon-192x192.png` and `icon-512x512.png`

Use tools like:
- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)

### Theme Colors

Edit CSS variables in `frontend/styles.css`:
```css
:root {
    --primary-color: #2C5530;
    --accent-color: #8B7355;
    /* ... */
}
```

### Adding Database

Currently uses in-memory storage. To add a database:

1. Install SQLAlchemy or your preferred ORM
2. Replace in-memory lists with database models
3. Update CRUD operations to use database queries

### Adding Authentication

1. Install `python-jose` for JWT
2. Add login/register endpoints
3. Protect routes with dependencies
4. Add authentication UI in frontend

## 📦 Deployment

### Backend Deployment

**Option 1: VPS/Cloud Server**
```bash
conda activate pwa-backend
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Option 2: Docker**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Option 3: Platform-as-a-Service**
- Heroku
- Railway
- Render
- Fly.io

### Frontend Deployment

**Option 1: Serve with FastAPI (Recommended)**
- Uncomment static file serving in `main.py`
- Deploy backend and frontend together

**Option 2: Static Hosting**
- Netlify
- Vercel
- GitHub Pages
- Cloudflare Pages

**Important:** Update `API_BASE_URL` in `app.js` to point to your production backend.

## 🔒 Security Notes

1. **CORS:** Update `allow_origins` in `main.py` to your production domain
2. **Environment Variables:** Never commit `.env` files
3. **HTTPS:** Required for PWA features (Service Worker, Install)
4. **API Keys:** Store securely, never in frontend code
5. **File Uploads:** Currently photo URLs are stored; implement proper file upload handling for production

## 🐛 Troubleshooting

**Service Worker not registering:**
- Ensure you're using HTTPS (or localhost)
- Check browser console for errors
- Clear cache and reload

**API calls failing:**
- Check CORS settings
- Verify backend is running
- Check API_BASE_URL in app.js

**App not installable:**
- Verify manifest.json is accessible
- Check icon sizes (192x192 and 512x512 required)
- Ensure HTTPS (or localhost for development)

**Tasks not appearing:**
- Check that task definitions have valid start dates
- Verify equipment exists before creating tasks
- Check browser console for API errors

## 📚 Next Steps

- [ ] Add database (SQLite/PostgreSQL)
- [ ] Implement authentication
- [ ] Add push notifications for reminders
- [ ] Implement proper file upload for photos
- [ ] Add data import functionality
- [ ] Add recurring task editing
- [ ] Add task templates
- [ ] Add equipment photos
- [ ] Add search functionality
- [ ] Add dark mode

## 📄 License

MIT License - feel free to use this for your projects!

## 🙏 Credits

Built following PWA best practices with:
- FastAPI (Python backend)
- Vanilla JavaScript (no framework required)
- Service Worker API
- Web App Manifest

---

**Happy tracking! 🎵**
