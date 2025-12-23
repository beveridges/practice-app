@echo off
REM Simple batch file to create icon files
REM This will work if Python is available in your conda environment

echo.
echo Creating placeholder icon files...
echo.

cd /d %~dp0

REM Try multiple Python commands
python create_icons_direct.py 2>nul
if errorlevel 1 (
    python3 create_icons_direct.py 2>nul
    if errorlevel 1 (
        echo.
        echo ERROR: Python not found!
        echo.
        echo Please run this manually:
        echo   1. Activate your conda environment: conda activate pwa-backend
        echo   2. Navigate to frontend: cd frontend
        echo   3. Run: python create_icons_direct.py
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Done! Check the icons folder to verify.
pause

