# Quick Fix Script for Technicians Not Loading
# This script adds sample technicians to your database

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Logbook - Add Sample Technicians" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get MySQL credentials
$mysqlUser = Read-Host "Enter MySQL username (default: root)"
if ([string]::IsNullOrWhiteSpace($mysqlUser)) {
    $mysqlUser = "root"
}

$securePassword = Read-Host "Enter MySQL password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$mysqlPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host ""
Write-Host "Connecting to database..." -ForegroundColor Yellow

# Run the SQL script
$sqlFile = "add_sample_technicians.sql"
$cmd = "mysql -u $mysqlUser -p$mysqlPassword substation_logbook < $sqlFile"

try {
    Invoke-Expression $cmd
    Write-Host ""
    Write-Host "✅ Sample technicians added successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Restart your server (if running)" -ForegroundColor White
    Write-Host "2. Refresh your browser (Ctrl+Shift+R)" -ForegroundColor White
    Write-Host "3. Login and go to Post Logbook Entry page" -ForegroundColor White
    Write-Host "4. You should now see technician checkboxes!" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Host "❌ Error running SQL script" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Run this command manually:" -ForegroundColor Yellow
    Write-Host "mysql -u $mysqlUser -p substation_logbook < $sqlFile" -ForegroundColor White
    Write-Host ""
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
