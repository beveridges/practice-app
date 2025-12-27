@echo off
echo ========================================
echo Windows Firewall Configuration
echo ========================================
echo.
echo This script will add firewall rules to allow:
echo   - Port 3000 (Frontend)
echo   - Port 8000 (Backend)
echo.
echo You may be prompted for administrator privileges.
echo.
pause

REM Add firewall rules for Python HTTP server (port 3000)
echo Adding firewall rule for port 3000 (Frontend)...
netsh advfirewall firewall add rule name="Practice App Frontend" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
if errorlevel 1 (
    echo Failed to add firewall rule for port 3000
    echo You may need to run this script as Administrator
) else (
    echo ✓ Port 3000 allowed
)

REM Add firewall rule for FastAPI backend (port 8000)
echo Adding firewall rule for port 8000 (Backend)...
netsh advfirewall firewall add rule name="Practice App Backend" dir=in action=allow protocol=TCP localport=8000 >nul 2>&1
if errorlevel 1 (
    echo Failed to add firewall rule for port 8000
    echo You may need to run this script as Administrator
) else (
    echo ✓ Port 8000 allowed
)

echo.
echo ========================================
echo Firewall configuration complete!
echo ========================================
echo.
echo If you still have connection issues:
echo   1. Check Windows Defender Firewall settings
echo   2. Ensure "Private network" is selected for these rules
echo   3. Try temporarily disabling firewall to test
echo.
pause

