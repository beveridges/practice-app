@echo off
echo ========================================
echo Starting Frontend Server
echo ========================================
echo.

cd frontend

REM Try different Python commands
echo Looking for Python...

where python >nul 2>&1
if %errorlevel% equ 0 (
    echo Found: python
    echo.
    echo Starting server on http://0.0.0.0:3000
    echo Access from Android: http://192.168.78.129:3000
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    python -m http.server 3000 --bind 0.0.0.0
    goto :end
)

where py >nul 2>&1
if %errorlevel% equ 0 (
    echo Found: py
    echo.
    echo Starting server on http://0.0.0.0:3000
    echo Access from Android: http://192.168.78.129:3000
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    py -m http.server 3000 --bind 0.0.0.0
    goto :end
)

echo.
echo ERROR: Python not found!
echo.
echo Please try one of these:
echo.
echo Option 1: Activate Conda first
echo   conda activate pwa-backend
echo   cd frontend
echo   python -m http.server 3000 --bind 0.0.0.0
echo.
echo Option 2: Use Windows Python launcher
echo   cd frontend
echo   py -m http.server 3000 --bind 0.0.0.0
echo.
pause

:end

