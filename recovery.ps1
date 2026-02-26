# Recovery Script for Retail Manager Migration
# Run this in the new Tiny11 environment

Write-Host "--- Starting Retail Manager Recovery ---" -ForegroundColor Cyan

# 1. Gemini CLI Reconfiguration
$oldGeminiPath = "Y:\.gemini" # Assuming you copied .gemini to Mac shared folder
$newGeminiPath = "$env:USERPROFILE\.gemini"

if (Test-Path $oldGeminiPath) {
    Write-Host "[+] Restoring Gemini CLI configuration..."
    Copy-Item -Path $oldGeminiPath -Destination $newGeminiPath -Recurse -Force
} else {
    Write-Warning "[!] Gemini backup not found at $oldGeminiPath. Please copy it manually."
}

# 2. Dependency Cache Linking
Write-Host "[+] Configuring NPM and Cargo to use Mac Shared Cache..."

# NPM Cache
$macNpmCache = "Y:\npm-cache"
if (Test-Path $macNpmCache) {
    npm config set cache $macNpmCache --global
    Write-Host "    NPM cache set to $macNpmCache"
}

# Cargo Home
$macCargoCache = "Y:\cargo-cache"
if (Test-Path $macCargoCache) {
    [Environment]::SetEnvironmentVariable("CARGO_HOME", $macCargoCache, "User")
    $env:CARGO_HOME = $macCargoCache
    Write-Host "    CARGO_HOME set to $macCargoCache"
}

# 3. Project Verification
$projectPath = "$env:USERPROFILE\MVP\Pro\retail-manager"
if (!(Test-Path $projectPath)) {
    Write-Host "[!] Project not found in $env:USERPROFILE. Attempting to copy from Mac..."
    $macProjectPath = "Y:\MVP\Pro\retail-manager"
    if (Test-Path $macProjectPath) {
        New-Item -ItemType Directory -Force -Path (Split-Path $projectPath)
        Copy-Item -Path $macProjectPath -Destination $projectPath -Recurse -Force
        Write-Host "    Project copied to $projectPath"
    }
}

if (Test-Path $projectPath) {
    Write-Host "[+] Verifying project structure..."
    $requiredFiles = @("package.json", "src-tauri\Cargo.toml", "src-tauri\tauri.conf.json")
    foreach ($file in $requiredFiles) {
        if (Test-Path "$projectPath\$file") {
            Write-Host "    Check: $file OK"
        } else {
            Write-Error "    Missing: $file"
        }
    }
}

# 4. Environment Readiness
Write-Host "[+] Finalizing environment setup..."
rustup target add i686-pc-windows-msvc
rustup target add aarch64-pc-windows-msvc

Write-Host "--- Recovery Complete! ---" -ForegroundColor Green
Write-Host "Next steps: cd frontend && npm install; cd ../src-tauri && cargo fetch"
