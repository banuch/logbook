@echo off
REM Quick Fix: Add Sample Technicians to Database
REM Double-click this file to run

echo.
echo ========================================
echo Logbook - Add Sample Technicians
echo ========================================
echo.

REM Check if MySQL is accessible
where mysql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: MySQL not found in PATH
    echo.
    echo Please add MySQL to your system PATH or run manually:
    echo mysql -u root -p substation_logbook ^< add_sample_technicians.sql
    echo.
    pause
    exit /b 1
)

echo This will add 5 sample technicians to your database.
echo.

REM Prompt for credentials
set /p MYSQL_USER="Enter MySQL username (default: root): "
if "%MYSQL_USER%"=="" set MYSQL_USER=root

echo.
echo Running SQL script...
echo.

REM Run the SQL script
mysql -u %MYSQL_USER% -p substation_logbook < add_sample_technicians.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================
    echo SUCCESS! Sample technicians added!
    echo ======================================
    echo.
    echo Next steps:
    echo 1. Restart your Node.js server if running
    echo 2. Refresh your browser ^(Ctrl+Shift+R^)
    echo 3. Login and go to Post Logbook Entry
    echo 4. You should see technician checkboxes!
    echo.
) else (
    echo.
    echo ======================================
    echo ERROR: Failed to add technicians
    echo ======================================
    echo.
    echo Please check:
    echo - MySQL credentials are correct
    echo - Database 'substation_logbook' exists
    echo - You have permissions to insert data
    echo.
)

pause
