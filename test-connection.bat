@echo off
echo ========================================
echo Connection Test
echo ========================================
echo.

REM Test if frontend server is running
echo Testing if frontend server is accessible...
curl -s http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Frontend server is NOT running on localhost:3000
    echo.
    echo The frontend server needs to be started.
    echo.
) else (
    echo [OK] Frontend server is running on localhost:3000
    echo.
)

REM Test if backend server is running
echo Testing if backend server is accessible...
curl -s http://localhost:8000/api/profile >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Backend server is NOT running on localhost:8000
    echo.
) else (
    echo [OK] Backend server is running on localhost:8000
    echo.
)

REM Get IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set LOCAL_IP=%%a
    goto :ip_found
)

:ip_found
set LOCAL_IP=%LOCAL_IP:~1%
echo Your IP address: %LOCAL_IP%
echo.
echo Test URLs:
echo   Frontend: http://%LOCAL_IP%:3000
echo   Backend:  http://%LOCAL_IP%:8000/api/profile
echo.
echo Try accessing these from your Android device.
echo.
pause

