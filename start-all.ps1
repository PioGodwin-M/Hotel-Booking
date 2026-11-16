$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot

function Start-ServiceTerminal {
    param(
        [string]$Name,
        [string]$RelativePath
    )

    $Path = Join-Path $Root $RelativePath

    if (!(Test-Path "$Path\package.json")) {
        Write-Host "Missing package.json: $Path" -ForegroundColor Red
        return
    }

    Write-Host "Launching $Name..." -ForegroundColor Green

    Start-Process powershell.exe -WorkingDirectory $Path -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host 'Starting $Name' -ForegroundColor Cyan; npm run dev"
    )
}

Write-Host "Starting Hotel Booking Microservices..." -ForegroundColor Cyan

# Infrastructure
Write-Host "Starting RabbitMQ..." -ForegroundColor Yellow
docker compose -f "$Root\docker-compose.yml" up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Compose failed. Check Docker Desktop." -ForegroundColor Red
    exit 1
}

# Backend services
Start-ServiceTerminal "User Service" "services\user-service"
Start-ServiceTerminal "Catalog Service" "services\catalog-service"

Start-Sleep -Seconds 3

Start-ServiceTerminal "Booking Service" "services\booking-service"
Start-ServiceTerminal "Payment Service" "services\payment-service"
Start-ServiceTerminal "Notification Service" "services\notification-service"

Start-Sleep -Seconds 3

Start-ServiceTerminal "API Gateway" "services\api-gateway"

Start-Sleep -Seconds 2

# Frontend
Start-ServiceTerminal "React Frontend" "client"

Write-Host "`nStartup commands issued." -ForegroundColor Green
Write-Host "Frontend:    http://localhost:5173"
Write-Host "Gateway:     http://localhost:4000"
Write-Host "RabbitMQ UI: http://localhost:15672"
Write-Host "`nCheck each terminal for actual startup success."


