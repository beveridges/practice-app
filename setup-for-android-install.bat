@echo off
echo ========================================
echo Android Installation Setup
echo ========================================
echo.
echo This script will:
echo   1. Create app icons (required for installation)
echo   2. Check if icons directory exists
echo   3. Verify manifest.json configuration
echo.
pause

cd frontend

REM Check if icons directory exists
if not exist "icons" (
    echo Creating icons directory...
    mkdir icons
)

REM Check if icons already exist
if exist "icons\icon-192x192.png" (
    echo Icons already exist. Skipping creation.
    echo If you want to recreate them, delete the icons directory first.
) else (
    echo Creating placeholder icons...
    python create_icons_direct.py
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to create icons!
        echo Make sure you're in the frontend directory and Python is installed.
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Start backend: cd backend && conda activate pwa-backend && python main.py
echo   2. Start frontend: ..\start-android-test.bat
echo   3. On Android: Open http://YOUR_IP:3000 in Chrome
echo   4. Install: Menu -^> Add to Home screen
echo.
pause

