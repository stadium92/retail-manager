# Full Clean Build Script for Retail Manager
$ErrorActionPreference = "Continue"

Write-Host "--- STARTING FULL CLEAN BUILD ---" -ForegroundColor Cyan

# 1. Kill existing processes
Write-Host "Killing existing processes..."
taskkill /F /IM app.exe /T 2>$null
taskkill /F /IM local-bridge.exe /T 2>$null
taskkill /F /IM node.exe /T 2>$null

# 2. Wipe build artifacts and dependencies
Write-Host "Wiping artifacts and node_modules..."
$dirs = @(
    "frontend\dist",
    "frontend
ode_modules",
    "backend\local-bridge\dist",
    "backend\local-bridge
ode_modules",
    "src-tauri	arget",
    "src-tauri\binaries"
)

foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        Write-Host "Removing $dir..."
        Remove-Item -Path $dir -Recurse -Force
    }
}

# 3. Reinstall and Build Backend
Write-Host "`n--- Building Backend ---" -ForegroundColor Yellow
Push-Location backend\local-bridge
npm install --silent
npm run build
Pop-Location

# 4. Reinstall and Build Frontend
Write-Host "`n--- Building Frontend ---" -ForegroundColor Yellow
Push-Location frontend
npm install --silent
npm run build
Pop-Location

# 5. Prepare Sidecar Payload
Write-Host "`n--- Preparing Sidecar ---" -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File scripts\prepare-sidecar-payload.ps1

# 6. Final Tauri Build
Write-Host "`n--- Executing Tauri Build ---" -ForegroundColor Yellow
npx tauri build --target x86_64-pc-windows-msvc --bundles nsis

Write-Host "`n--- FULL CLEAN BUILD COMPLETE ---" -ForegroundColor Green
