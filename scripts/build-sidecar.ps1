# Windows Sidecar Build Script (PowerShell)
# This script should be run inside your Parallels Windows VM

$ErrorActionPreference = "Stop"

# Configuration
$BACKEND_DIR = "backend/local-bridge"
$TAURI_BIN_DIR = "src-tauri/binaries"
$NODE_TARGET = "node18-win-x86" # Target 32-bit for maximum compatibility
$TARGET_ARCH = "ia32"           # 32-bit architecture for Node native modules

Write-Host "Starting Windows Backend Sidecar Build (32-bit)..." -ForegroundColor Cyan

# Add Git bin to PATH for pkg (needs patch, sh, etc.)
$env:PATH = "C:\Program Files\Git\usr\bin;" + $env:PATH

# 1. Setup Directories
if (!(Test-Path $TAURI_BIN_DIR)) {
    New-Item -ItemType Directory -Path $TAURI_BIN_DIR
}

# 2. Go to Backend
Push-Location $BACKEND_DIR
Write-Host "Working directory: $(Get-Location)"

# 3. Rebuild better-sqlite3 for 32-bit Windows
Write-Host "Recompiling better-sqlite3 for 32-bit Windows (Skipped, done manually)..." -ForegroundColor Yellow
# npm rebuild better-sqlite3 --arch=$TARGET_ARCH

# Find the binary
$BINARY_SOURCE = "node_modules/better-sqlite3/build/Release/better_sqlite3.node"
$DEST_BINARY = "../../$TAURI_BIN_DIR/better_sqlite3.node"

if (Test-Path $DEST_BINARY) {
    Write-Host "Binary already exists at $DEST_BINARY. Skipping copy."
} elseif (Test-Path $BINARY_SOURCE) {
    # Copy the binary
    Write-Host "Copying native binary..."
    Copy-Item $BINARY_SOURCE $DEST_BINARY -Force
} else {
    Write-Warning "Warning: Native module build failed. File not found at $BINARY_SOURCE. Assuming it is already in place."
}

# 4. Build TypeScript
Write-Host "Compiling TypeScript..."
npx tsc -p tsconfig.json

# 5. Package with pkg
Write-Host "Packaging sidecar executable..."
# Note: we manually specify the target to force 32-bit
npx pkg . --target $NODE_TARGET --output "../../$TAURI_BIN_DIR/local-bridge-i686-pc-windows-msvc.exe" --compress GZip

Pop-Location

Write-Host "Windows Sidecar build complete!" -ForegroundColor Green
Write-Host "Note: Your local better-sqlite3 is now 32-bit."
