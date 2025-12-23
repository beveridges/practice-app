@echo off
echo Creating placeholder icon files...
echo.

REM Try to find Python in common locations or use the one in PATH
python generate_icons.py 2>nul
if errorlevel 1 (
    echo Trying with python3...
    python3 generate_icons.py 2>nul
    if errorlevel 1 (
        echo.
        echo ERROR: Python not found in PATH.
        echo.
        echo Please run this manually:
        echo   1. Open a terminal where Python is available
        echo   2. cd to the frontend directory
        echo   3. Run: python generate_icons.py
        echo.
        echo OR activate your conda environment first:
        echo   conda activate pwa-backend
        echo   cd frontend
        echo   python generate_icons.py
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Done! Icon files created.
pause

