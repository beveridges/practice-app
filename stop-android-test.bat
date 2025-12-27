@echo off
echo Restoring original app.js...
if exist "frontend\app.js.backup" (
    copy /Y "frontend\app.js.backup" "frontend\app.js" >nul
    echo Original app.js restored.
) else (
    echo No backup found. app.js was not modified.
)
echo.
echo To restore localhost API URL manually, edit frontend\app.js:
echo   Change: const API_BASE_URL = 'http://YOUR_IP:8000/api';
echo   To:     const API_BASE_URL = 'http://localhost:8000/api';
echo.
pause

