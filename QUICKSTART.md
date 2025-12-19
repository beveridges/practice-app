# Quick Start Guide

Get your PWA up and running in 5 minutes!

## Step 1: Backend Setup

```bash
cd backend

# Create and activate Conda environment
conda env create -f environment.yml
conda activate pwa-backend

# Run the backend
python main.py
```

**Note:** If the environment already exists, just activate it:
```bash
conda activate pwa-backend
python main.py
```

Backend runs at: `http://localhost:8000`

## Step 2: Frontend Setup

Open a **new terminal** (keep backend running in first terminal):

```bash
cd frontend
python -m http.server 3000
```

Frontend runs at: `http://localhost:3000`

## Step 3: Test It!

1. Open `http://localhost:3000` in your browser
2. You should see the app interface
3. Try adding an item
4. Check the browser console (F12) to see API calls

## Step 4: Test PWA Features

1. **Install App:**
   - Chrome/Edge: Look for install icon in address bar
   - Mobile: Use "Add to Home Screen"

2. **Test Offline:**
   - Open DevTools → Network tab
   - Check "Offline"
   - App should still work with cached data

## Troubleshooting

**Backend won't start:**
- Make sure Conda is installed and in your PATH
- Verify the environment is activated: `conda activate pwa-backend`
- Check if port 8000 is already in use
- If environment creation fails, try: `conda env create -f environment.yml --force`

**Can't connect to backend (ERR_ADDRESS_INVALID):**
- **Important:** Always use `http://localhost:8000` or `http://127.0.0.1:8000` in your browser
- Never use `0.0.0.0:8000` - this is only for the server to bind to all interfaces, browsers can't connect to it
- If you see "This site can't be reached", make sure the backend is running and use `localhost` instead of `0.0.0.0`

**Frontend can't connect:**
- Verify backend is running
- Check `API_BASE_URL` in `frontend/app.js`

**Service Worker not working:**
- Must use `localhost` or HTTPS
- Clear browser cache and reload

## Next Steps

- Add app icons (see `frontend/icons/README.md`)
- Customize theme colors in `styles.css`
- Add your own API endpoints in `backend/main.py`
- Deploy to production (see main README.md)

Happy coding! 🚀

