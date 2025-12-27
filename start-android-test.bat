@echo off
echo ========================================
echo Android Device Testing Setup
echo ========================================
echo.

REM Find local IP address
echo Finding your local IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set LOCAL_IP=%%a
    goto :ip_found
)

:ip_found
set LOCAL_IP=%LOCAL_IP:~1%
echo.
echo Detected IP: %LOCAL_IP%
echo.

REM Check if backend is running
echo Checking if backend is running...
curl -s http://localhost:8000/api/profile >nul 2>&1
if errorlevel 1 (
    echo.
    echo WARNING: Backend does not appear to be running!
    echo Please start the backend first:
    echo   cd backend
    echo   conda activate pwa-backend
    echo   python main.py
    echo.
    pause
    exit /b 1
)
echo Backend is running ✓
echo.

REM Backup app.js
if exist "frontend\app.js.backup" (
    echo Restoring original app.js from backup...
    copy /Y "frontend\app.js.backup" "frontend\app.js" >nul
) else (
    echo Creating backup of app.js...
    copy /Y "frontend\app.js" "frontend\app.js.backup" >nul
)

REM Update API_BASE_URL in app.js
echo Updating API URL in app.js to use %LOCAL_IP%...
powershell -Command "$content = Get-Content 'frontend\app.js' -Raw; $content = $content -replace 'http://localhost:8000/api', 'http://%LOCAL_IP%:8000/api'; Set-Content 'frontend\app.js' -Value $content -NoNewline"

echo.
echo ========================================
echo Configuration Complete!
echo ========================================
echo.
echo Frontend URL: http://%LOCAL_IP%:3000
echo Backend URL:  http://%LOCAL_IP%:8000
echo.
echo Open this URL on your Android device:
echo   http://%LOCAL_IP%:3000
echo.
echo Starting frontend server...
echo Press Ctrl+C to stop
echo.
echo ========================================
echo.

cd frontend

REM Try to find Python (try multiple methods)
where python >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=python
    goto :start_server
)

where py >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py
    goto :start_server
)

REM Try conda Python if conda is available
if exist "%USERPROFILE%\anaconda3\python.exe" (
    set PYTHON_CMD=%USERPROFILE%\anaconda3\python.exe
    goto :start_server
)

if exist "%USERPROFILE%\miniconda3\python.exe" (
    set PYTHON_CMD=%USERPROFILE%\miniconda3\python.exe
    goto :start_server
)

REM Try common conda installation paths
if exist "C:\ProgramData\anaconda3\python.exe" (
    set PYTHON_CMD=C:\ProgramData\anaconda3\python.exe
    goto :start_server
)

if exist "C:\ProgramData\miniconda3\python.exe" (
    set PYTHON_CMD=C:\ProgramData\miniconda3\python.exe
    goto :start_server
)

echo.
echo ========================================
echo ERROR: Python not found!
echo ========================================
echo.
echo The frontend server needs Python to run.
echo.
echo Solutions:
echo   1. Activate Conda first, then run this script:
echo      conda activate pwa-backend
echo      start-android-test.bat
echo.
echo   2. Or install Python from python.org
echo.
echo   3. Or run manually:
echo      cd frontend
echo      python -m http.server 3000 --bind 0.0.0.0
echo.
echo Note: The configuration is already done!
echo You can start the server manually using the command above.
echo.
pause
exit /b 1

:start_server
echo Using Python: %PYTHON_CMD%
echo.
%PYTHON_CMD% -m http.server 3000 --bind 0.0.0.0

