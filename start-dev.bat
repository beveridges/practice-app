@echo off
REM Development startup script for Windows (Conda)

echo 🚀 Starting PWA Development Environment
echo.

REM Check if Conda environment exists
conda env list | findstr "pwa-backend" >nul
if errorlevel 1 (
    echo 📦 Creating Conda environment...
    cd backend
    conda env create -f environment.yml
    cd ..
)

REM Activate Conda environment
echo 🔧 Activating Conda environment...
call conda activate pwa-backend

REM Start backend
echo 🐍 Starting Python backend...
start "Backend Server" cmd /k "conda activate pwa-backend && cd backend && python main.py"

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start frontend
echo 🌐 Starting frontend server...
start "Frontend Server" cmd /k "cd frontend && python -m http.server 3000"

echo.
echo ✅ Development servers started!
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Close the command windows to stop the servers
echo.

pause

