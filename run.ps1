Write-Host "Launching Mini ERP + CRM Portal..." -ForegroundColor Cyan

# Launch backend in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting Express Backend Server...' -ForegroundColor Green; cd backend; npm run dev"

# Launch frontend in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting Vite Frontend Dev Server...' -ForegroundColor Green; cd frontend; npm run dev"

Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "Backend dev console launched (Port 5000)" -ForegroundColor Green
Write-Host "Frontend dev console launched (Port 5173)" -ForegroundColor Green
Write-Host "Open http://localhost:5173 in your browser." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Yellow
