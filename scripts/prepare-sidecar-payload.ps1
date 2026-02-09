# Prepare Sidecar Payload and Wrapper Script (x64 Windows)
$ErrorActionPreference = "Stop"

$PROJECT_ROOT = "C:\Users\mohamedcoulibaly\MVP\Pro\retail-manager"
$BACKEND_DIR = "$PROJECT_ROOT\backend\local-bridge"
$WRAPPER_DIR = "$PROJECT_ROOT\backend\sidecar-wrapper"
$TAURI_BIN_DIR = "$PROJECT_ROOT\src-tauri\binaries"
$NODE_VERSION = "v18.20.8"
$NODE_ZIP = "node-$NODE_VERSION-win-x64.zip"
$NODE_URL = "https://nodejs.org/dist/$NODE_VERSION/$NODE_ZIP"

Write-Host "--- Starting Sidecar Preparation (x64) ---" -ForegroundColor Cyan

# 1. Setup MSVC Environment (Moved up for npm install)
$vcvars = "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"
if (Test-Path $vcvars) {
    Write-Host "Importing MSVC vcvarsall.bat x64 environment..."
    $env_vars = cmd /c "`"$vcvars`" x64 && set"
    foreach ($var in $env_vars) {
        if ($var -match '^(.*?)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2]
            if ($name -ieq 'PATH') {
                $env:PATH = $value
            } else {
                Set-Item -Path "Env:\$name" -Value $value
            }
        }
    }
}

# 2. Download x64 Node.js if not present
if (!(Test-Path "$BACKEND_DIR\node.exe")) {
    Write-Host "Downloading x64 Node.js $NODE_VERSION..." -ForegroundColor Yellow
    $tempZip = "$env:TEMP\$NODE_ZIP"
    Invoke-WebRequest -Uri $NODE_URL -OutFile $tempZip
    
    Write-Host "Extracting node.exe..."
    if (Test-Path "$env:TEMP\node_extract") { Remove-Item "$env:TEMP\node_extract" -Recurse -Force }
    Expand-Archive -Path $tempZip -DestinationPath "$env:TEMP\node_extract" -Force
    Copy-Item "$env:TEMP\node_extract\node-$NODE_VERSION-win-x64\node.exe" -Destination "$BACKEND_DIR\node.exe" -Force
    
    # Cleanup temp files
    Remove-Item $tempZip -Force
    Remove-Item "$env:TEMP\node_extract" -Recurse -Force
}

# 3. Build Backend TypeScript
Write-Host "Compiling Backend TypeScript..."
Push-Location $BACKEND_DIR
npm run build 
Pop-Location

# 4. Create payload.zip
Write-Host "Creating payload.zip (Optimized)..." -ForegroundColor Yellow
$payloadPath = "$BACKEND_DIR\payload.zip"
if (Test-Path $payloadPath) { Remove-Item $payloadPath -Force }

# Using a temporary staging area to ensure a clean zip structure
$staging = "$env:TEMP\sidecar_staging"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging

Write-Host "Copying files to staging..."
Copy-Item "$BACKEND_DIR\node.exe" -Destination $staging
Copy-Item "$BACKEND_DIR\dist" -Destination $staging -Recurse

Write-Host "Installing dependencies for x64..."
Copy-Item "$BACKEND_DIR\package.json" -Destination $staging
Copy-Item "$BACKEND_DIR\package-lock.json" -Destination $staging
Push-Location $staging

$npmCli = "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"
if (Test-Path $npmCli) {
    Write-Host "Using npm at: $npmCli"
    # Install dependencies EXCEPT better-sqlite3 first (to get fastify etc)
    & "$staging\node.exe" "$npmCli" install --omit=dev --ignore-scripts --no-bin-links
} else {
    Write-Error "Could not locate npm-cli.js."
}

# MANUAL INJECTION OF BETTER-SQLITE3 (x64)
# Because prebuild-install fails to find binaries automatically in this mixed env
$BS3_VERSION = "9.4.3"
$NODE_ABI = "108" # Node 18
$BS3_URL = "https://github.com/WiseLibs/better-sqlite3/releases/download/v$BS3_VERSION/better-sqlite3-v$BS3_VERSION-node-v$NODE_ABI-win32-x64.tar.gz"
$BS3_DEST = "$staging\node_modules\better-sqlite3"

Write-Host "Manually injecting better-sqlite3 binary from: $BS3_URL" -ForegroundColor Magenta

# Ensure directory exists
if (!(Test-Path $BS3_DEST)) {
    # If npm install didn't create it (should have), create it
    New-Item -ItemType Directory -Path $BS3_DEST -Force
}

# Download tarball
$bs3Tar = "$env:TEMP\bs3_x64.tar.gz"
# Use curl because Invoke-WebRequest might have TLS issues with GitHub sometimes
curl.exe -L -o $bs3Tar $BS3_URL

# Extract tarball
$bs3Extract = "$env:TEMP\bs3_extract"
if (Test-Path $bs3Extract) { Remove-Item $bs3Extract -Recurse -Force }
New-Item -ItemType Directory -Path $bs3Extract
tar -xzf $bs3Tar -C $bs3Extract

# Move binary to build/Release
$bs3BuildDir = "$BS3_DEST\build\Release"
if (!(Test-Path $bs3BuildDir)) { New-Item -ItemType Directory -Path $bs3BuildDir -Force }
Copy-Item "$bs3Extract\build\Release\better_sqlite3.node" -Destination "$bs3BuildDir\better_sqlite3.node" -Force

Write-Host "Verified better_sqlite3.node injection (x64)."
Pop-Location

Push-Location $staging
Write-Host "Zipping payload (this may take a minute)..."
Compress-Archive -Path * -DestinationPath $payloadPath
Pop-Location

Remove-Item $staging -Recurse -Force

# 5. Build Rust Wrapper
Write-Host "Compiling Rust Wrapper (32-bit wrapper, launching x64 node)..." -ForegroundColor Yellow
# We keep the wrapper 32-bit (i686) so it runs everywhere, but it will launch the x64 Node payload
# This is fine on x64 and ARM64 machines.

Push-Location $WRAPPER_DIR
$RUSTUP = "C:\Users\mohamedcoulibaly\.cargo\bin\rustup.exe"
$CARGO = "C:\Users\mohamedcoulibaly\.cargo\bin\cargo.exe"

& $RUSTUP target add i686-pc-windows-msvc
& $CARGO build --manifest-path "$WRAPPER_DIR\Cargo.toml" --release --target i686-pc-windows-msvc
Pop-Location

# 5. Move to Tauri Binaries with EXACT naming convention
Write-Host "Moving binary to Tauri folder..." -ForegroundColor Green
if (!(Test-Path $TAURI_BIN_DIR)) { New-Item -ItemType Directory -Path $TAURI_BIN_DIR }

$wrapperBinary = "$WRAPPER_DIR\target\i686-pc-windows-msvc\release\local-bridge-wrapper.exe"
$destBinary = "$TAURI_BIN_DIR\local-bridge-i686-pc-windows-msvc.exe"

if (Test-Path $wrapperBinary) {
    Copy-Item $wrapperBinary -Destination $destBinary -Force
    Write-Host "--- Sidecar Wrapper Ready! ---" -ForegroundColor Green
    Write-Host "Target: $destBinary"
} else {
    Write-Error "Wrapper binary not found at $wrapperBinary"
}