# Android Device Installation Guide (LAN Only)

This guide will help you install and use your PWA on an Android device over your local network (LAN).

## Prerequisites

- Your computer and Android device must be on the **same Wi-Fi network**
- Backend and frontend servers running on your computer
- Android device with Chrome browser
- App icons created (see Step 0 below)

## Step 0: Create App Icons (Required for Installation)

Before installing, you need to create the app icons. Run one of these:

**Option A: Quick placeholder icons**
```bash
cd frontend
python create_icons_direct.py
```

**Option B: Better icons with Pillow**
```bash
cd frontend
pip install Pillow
python create_icons.py
```

This creates icons in `frontend/icons/` directory. The app won't install without these icons.

## Method 1: Install on Android (LAN Setup)

### Step 1: Find Your Computer's Local IP Address

**Windows:**
```powershell
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x or 10.x.x.x)

**Alternative - Run the helper script:**
```powershell
.\get-ip-address.bat
```

### Step 2: Start Backend Server

The backend is already configured to accept connections from any network interface (host="0.0.0.0").

```bash
cd backend
conda activate pwa-backend
python main.py
```

Backend will be accessible at: `http://YOUR_IP:8000` (e.g., `http://192.168.1.100:8000`)

### Step 3: Start Frontend Server

**Option A: Use the Android testing script (Recommended)**
```powershell
.\start-android-test.bat
```

This script will:
- Detect your local IP address
- Start the frontend server
- Update `app.js` to use your IP address for API calls
- Display the URL to access from your Android device

**Option B: Manual setup**

1. Update `frontend/app.js` - Change line 6:
   ```javascript
   const API_BASE_URL = 'http://YOUR_IP:8000/api';
   ```
   Replace `YOUR_IP` with your computer's IP address (e.g., `http://192.168.1.100:8000/api`)

2. Start frontend server:
   ```bash
   cd frontend
   python -m http.server 3000 --bind 0.0.0.0
   ```

### Step 4: Access from Android Device

1. Open Chrome browser on your Android device
2. Navigate to: `http://YOUR_IP:3000`
   - Example: `http://192.168.1.100:3000`
3. The app should load and connect to your backend

### Step 5: Install as PWA on Android

**Important:** Android Chrome requires HTTPS for PWA installation by default. For LAN-only installation over HTTP, you have two options:

#### Option A: Enable "Add to Home screen" for HTTP (Easier)

1. Open Chrome on your Android device
2. Navigate to: `http://YOUR_IP:3000`
3. Tap the menu (three dots) → **Settings** → **Site settings**
4. Find your site in the list, or go back and:
   - Tap the lock icon in the address bar
   - Tap **Site settings**
5. Enable **"Add to Home screen"** permission
6. Go back to the app page
7. Tap menu (three dots) → **"Add to Home screen"** or **"Install app"**
8. Confirm installation
9. The app icon will appear on your home screen!

#### Option B: Enable Chrome Flags (For Full PWA Features)

If Option A doesn't work, enable Chrome flags:

1. Open Chrome on Android
2. Navigate to: `chrome://flags`
3. Search for: **"Insecure origins treated as secure"**
4. Add your computer's IP: `http://YOUR_IP:3000` (e.g., `http://192.168.1.100:3000`)
5. Search for: **"Desktop PWAs"** and enable it
6. Restart Chrome
7. Navigate to `http://YOUR_IP:3000`
8. Tap menu → **"Add to Home screen"** or **"Install app"**

**Note:** After installation, the app will work on your LAN. If you move to a different network, you'll need to update the IP address in `app.js` or use the app only when connected to your home network.

## After Installation

Once installed:
- The app icon appears on your Android home screen
- Tap it to launch the app (works like a native app)
- The app will only work when:
  - Your computer is running the backend and frontend servers
  - Your Android device is on the same Wi-Fi network
  - You're using the same IP address (if your computer's IP changes, update `app.js`)

## Keeping the Same IP Address

To avoid updating the IP address frequently:

1. **Set a static IP** for your computer on your router
2. **Or** use your computer's hostname if your router supports it (e.g., `http://YOUR-COMPUTER-NAME:3000`)

Check your router's admin panel for DHCP reservation/static IP settings.

## Troubleshooting

### "This site can't be reached" on Android

1. **Check firewall:** Windows Firewall may be blocking connections
   - Go to Windows Defender Firewall → Allow an app through firewall
   - Allow Python for both Private and Public networks

2. **Verify IP address:** Make sure you're using the correct IP address
   - Run `ipconfig` again to confirm
   - Try pinging your computer from Android (use a network tool app)

3. **Check network:** Ensure both devices are on the same Wi-Fi network
   - Some networks have "AP isolation" enabled - disable it if possible

### API calls failing (CORS errors)

The backend is already configured with CORS allowing all origins. If you see CORS errors:
- Check that the backend is running
- Verify the API_BASE_URL in `app.js` matches your backend URL
- Check browser console for specific error messages

### Service Worker not working

- Service Workers work over HTTP on local network (Chrome allows this)
- If service worker doesn't register:
  - Check browser console for errors
  - Ensure `service-worker.js` file exists and is accessible
  - Clear browser cache and reload

### Can't install as PWA

1. **Icons missing:** Make sure you created icons (Step 0)
   - Check that `frontend/icons/icon-192x192.png` and `icon-512x512.png` exist
   - Verify `manifest.json` points to correct icon paths

2. **Install option not showing:**
   - Try Option A in Step 5 (enable "Add to Home screen" in site settings)
   - Or try Option B (enable Chrome flags)
   - Make sure you're using Chrome browser (not other browsers)

3. **Installation fails:**
   - Check that manifest.json is accessible: `http://YOUR_IP:3000/manifest.json`
   - Verify all required icon sizes exist
   - Check browser console for errors (F12 or Chrome DevTools)

4. **App installed but won't connect:**
   - Verify backend is still running
   - Check that IP address hasn't changed
   - Ensure both devices are on same network

## Quick Installation Checklist

- [ ] Icons created in `frontend/icons/` directory (Step 0)
- [ ] Backend running on `0.0.0.0:8000`
- [ ] Frontend running on `0.0.0.0:3000` (use `start-android-test.bat`)
- [ ] `app.js` updated with correct IP address (done automatically by script)
- [ ] Both devices on same Wi-Fi network
- [ ] Windows Firewall allows Python connections (run `allow-firewall-ports.bat` if needed)
- [ ] Can access `http://YOUR_IP:3000` from Android Chrome
- [ ] Can access `http://YOUR_IP:8000/api` from Android Chrome (should see API response)
- [ ] Manifest accessible: `http://YOUR_IP:3000/manifest.json`
- [ ] App installed on Android home screen

## Troubleshooting Installation

**"Add to Home screen" option grayed out:**
- Enable it in Chrome site settings (Option A in Step 5)
- Or enable Chrome flags (Option B in Step 5)

**Icons not loading:**
- Run icon creation script (Step 0)
- Check that icons directory exists: `frontend/icons/`
- Verify icon files are actual PNG images (not empty)

**App installed but shows blank screen:**
- Check that backend is running
- Verify API_BASE_URL in app.js matches your IP
- Open Chrome DevTools on Android (chrome://inspect) to see errors

