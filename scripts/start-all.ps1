param(
  [switch]$Detached
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$mlService = Join-Path $backend "python-ml-service"

function Start-DevServer {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Command
  )

  Write-Host "Starting $Name..." -ForegroundColor Cyan
  if ($Detached) {
    Start-Process -WindowStyle Hidden -WorkingDirectory $WorkingDirectory -FilePath powershell.exe -ArgumentList "-NoExit", "-Command", $Command
  } else {
    Start-Process -WorkingDirectory $WorkingDirectory -FilePath powershell.exe -ArgumentList "-NoExit", "-Command", $Command
  }
}

Write-Host ""
Write-Host "StockVerse AI local stack" -ForegroundColor Green
Write-Host "Frontend: prints its Vite URL, often http://localhost:8080 or similar"
Write-Host "Backend:  http://localhost:5000/health"
Write-Host "ML:       http://localhost:8000/health"
Write-Host ""

Start-DevServer -Name "frontend" -WorkingDirectory $root -Command "npm run dev"
Start-DevServer -Name "backend API" -WorkingDirectory $backend -Command "npm run dev"
Start-DevServer -Name "Python ML service" -WorkingDirectory $mlService -Command "py main.py"

Write-Host ""
Write-Host "All server windows have been opened. Keep those windows running while developing." -ForegroundColor Green
