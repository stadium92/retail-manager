
# Windows Sidecar Build Script (ARM64 -> i686)
$ErrorActionPreference = "Stop"

$TAURI_BIN_DIR = "src-tauri/binaries"
if (!(Test-Path $TAURI_BIN_DIR)) { New-Item -ItemType Directory $TAURI_BIN_DIR }

Write-Host "🚀 Building Local Bridge (Node.js)..." -ForegroundColor Cyan
cd backend/local-bridge
npm run build

Write-Host "📦 Creating Payload Zip (Requires 32-bit Node.exe and modules)..." -ForegroundColor Cyan
# Ensure you have a 32-bit node.exe in the root of local-bridge
if (!(Test-Path "node.exe")) {
    Write-Host "⚠️ Please place a 32-bit node.exe in backend/local-bridge/" -ForegroundColor Yellow
}
Compress-Archive -Path dist, node_modules, node.exe -DestinationPath payload.zip -Force

Write-Host "🦀 Building Rust Wrapper (i686)..." -ForegroundColor Cyan
cd ../sidecar-wrapper
cargo build --release --target i686-pc-windows-msvc

Write-Host "🚚 Deploying Sidecar..." -ForegroundColor Cyan
Copy-Item "target/i686-pc-windows-msvc/release/sidecar-wrapper.exe" "../../$TAURI_BIN_DIR/local-bridge-i686-pc-windows-msvc.exe" -Force

Write-Host "✅ Sidecar Ready!" -ForegroundColor Green
