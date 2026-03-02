# Prepare Sidecar Payload and Wrapper Script (Architecture-Specific)
$ErrorActionPreference = "Stop"

$PROJECT_ROOT = Resolve-Path "$PSScriptRoot\.."
$BACKEND_DIR = "$PROJECT_ROOT\backend\local-bridge"
$WRAPPER_DIR = "$PROJECT_ROOT\backend\sidecar-wrapper"
$TAURI_BIN_DIR = "$PROJECT_ROOT\src-tauri\binaries"

# --- THE BIBLE CONFIGURATION (DO NOT CHANGE) ---
# Runtime: Node.js v18.20.8 (x64)
# Database: better-sqlite3 v9.4.3
# ABI: 108 (Node 18)
$NODE_VERSION = "v18.20.8"
$BS3_VERSION = "9.4.3"
$NODE_ABI = "108" # Node 18

Write-Host "--- Starting Architecture-Specific Sidecar Preparation (Bible Compliant) ---" -ForegroundColor Cyan
Write-Host "Target Node: $NODE_VERSION | Target BS3: $BS3_VERSION" -ForegroundColor Yellow

# 1. Build Backend TypeScript (Once)
Write-Host "Compiling Backend TypeScript..."
Push-Location $BACKEND_DIR
# Clean previous build
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
# Ensure dependencies match
npm install better-sqlite3@$BS3_VERSION --save-exact
npm run build 
Pop-Location

# 2. Architectures to process (Strictly x64 and ARM64)
$architectures = @(
    @{ arch = "x64";   triple = "x86_64-pc-windows-msvc"; node_arch = "x64";   bs3_arch = "x64" }
)

foreach ($item in $architectures) {
    $triple = $item.triple
    $node_arch = $item.node_arch
    $bs3_arch = $item.bs3_arch
    
    Write-Host "`n>>> Processing Architecture: $triple" -ForegroundColor Magenta
    
    # a. Download specific Node.exe
    $node_zip = "node-$NODE_VERSION-win-$node_arch.zip"
    $node_url = "https://nodejs.org/dist/$NODE_VERSION/$node_zip"
    $temp_zip = "$env:TEMP\node_$node_arch.zip"
    $extract_path = "$env:TEMP\node_extract_$node_arch"
    
    Write-Host "Downloading Node $node_arch ($NODE_VERSION)..."
    if (Test-Path $temp_zip) { Remove-Item $temp_zip -Force }
    Invoke-WebRequest -Uri $node_url -OutFile $temp_zip
    
    if (Test-Path $extract_path) { Remove-Item $extract_path -Recurse -Force }
    Expand-Archive -Path $temp_zip -DestinationPath $extract_path -Force
    
    # b. Setup Staging
    $staging = "$env:TEMP\sidecar_staging_$node_arch"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item -ItemType Directory -Path $staging
    
    # Correct path inside the extracted Node zip
    $node_exe_src = Get-ChildItem -Path "$extract_path\node-*" | Where-Object { $_.PSIsContainer } | Select-Object -First 1
    Copy-Item "$($node_exe_src.FullName)\node.exe" -Destination $staging
    
    # VERIFY Node Version right now
    Write-Host "Verifying downloaded Node version..."
    $v = & "$staging\node.exe" -v
    Write-Host "Actual Node version: $v"
    if ($v -notmatch $NODE_VERSION) {
        Write-Error "CRITICAL: Node version mismatch! Expected $NODE_VERSION, got $v"
        exit 1
    }
    
    Copy-Item "$BACKEND_DIR\dist" -Destination $staging -Recurse
    Copy-Item "$BACKEND_DIR\node_modules" -Destination $staging -Recurse
    
    # NEW: Add version file to payload
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $timestamp | Out-File -FilePath "$staging\version.txt" -Encoding utf8

    # c. Inject specific Better-SQLite3 binary
    $bs3_url = "https://github.com/WiseLibs/better-sqlite3/releases/download/v$BS3_VERSION/better-sqlite3-v$BS3_VERSION-node-v$NODE_ABI-win32-$bs3_arch.tar.gz"
    $bs3_tar = "$env:TEMP\bs3_$bs3_arch.tar.gz"
    $bs3_extract = "$env:TEMP\bs3_extract_$bs3_arch"
    
    Write-Host "Injecting Better-SQLite3 $bs3_arch (ABI $NODE_ABI)..."
    if (Test-Path $bs3_tar) { Remove-Item $bs3_tar -Force }
    curl.exe -L -o $bs3_tar $bs3_url
    if (Test-Path $bs3_extract) { Remove-Item $bs3_extract -Recurse -Force }
    New-Item -ItemType Directory -Path $bs3_extract
    tar -xzf $bs3_tar -C $bs3_extract
    
    $bs3_dest = "$staging\node_modules\better-sqlite3\build\Release"
    if (!(Test-Path $bs3_dest)) { New-Item -ItemType Directory -Path $bs3_dest -Force }
    Copy-Item "$bs3_extract\build\Release\better_sqlite3.node" -Destination "$bs3_dest\better_sqlite3.node" -Force
    
    # d. Create payload zip
    $payload_name = "payload-$triple.zip"
    $payload_path = "$WRAPPER_DIR\$payload_name"
    if (Test-Path $payload_path) { Remove-Item $payload_path -Force }
    
    Push-Location $staging
    Write-Host "Zipping payload (using tar for speed)..."
    tar.exe -a -cf $payload_path *
    Pop-Location
    
    # e. Compile Wrapper for this target
    Write-Host "Compiling Rust Wrapper for $triple..." -ForegroundColor Yellow
    Push-Location $WRAPPER_DIR
    $env:PAYLOAD_FILE = "../$payload_name"
    & cargo.exe build --release --target $triple
    Pop-Location
    
    # f. Move to Tauri Binaries
    if (!(Test-Path $TAURI_BIN_DIR)) { New-Item -ItemType Directory -Path $TAURI_BIN_DIR }
    $wrapperBinary = "$WRAPPER_DIR\target\$triple\release\local-bridge-wrapper.exe"
    $destBinary = "$TAURI_BIN_DIR\local-bridge-$triple.exe"
    Copy-Item $wrapperBinary -Destination $destBinary -Force
    
    Write-Host "Ready: $destBinary" -ForegroundColor Green
}

Write-Host "--- Sidecar Preparation Complete (Bible Compliant) ---" -ForegroundColor Cyan

