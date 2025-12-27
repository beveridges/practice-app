@echo off
echo Finding your local IP address...
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    goto :found
)

:found
set IP=%IP:~1%
echo Your local IP address is: %IP%
echo.
echo Use this IP address to access the app from your Android device:
echo   Frontend: http://%IP%:3000
echo   Backend:  http://%IP%:8000
echo.
pause

