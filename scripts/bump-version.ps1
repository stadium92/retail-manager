param (
    [Parameter(Mandatory=$true)]
    [string]$NewVersion
)

Write-Host "Bumping version to $NewVersion..." -ForegroundColor Cyan

# 1. Update package.json
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    $pkg.version = $NewVersion
    $pkg | ConvertTo-Json -Depth 10 | Set-Content "package.json"
    Write-Host "Updated package.json" -ForegroundColor Green
}

# 2. Update src-tauri/tauri.conf.json
if (Test-Path "src-tauri/tauri.conf.json") {
    $tauri = Get-Content "src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json
    $tauri.version = $NewVersion
    $tauri | ConvertTo-Json -Depth 10 | Set-Content "src-tauri/tauri.conf.json"
    Write-Host "Updated tauri.conf.json" -ForegroundColor Green
}

# 3. Update src-tauri/Cargo.toml
if (Test-Path "src-tauri/Cargo.toml") {
    $content = Get-Content "src-tauri/Cargo.toml" -Raw
    $content = $content -replace '(?m)^version = ".*?"', "version = `"$NewVersion`""
    $content | Set-Content "src-tauri/Cargo.toml"
    Write-Host "Updated Cargo.toml" -ForegroundColor Green
}

Write-Host "Version bump complete!" -ForegroundColor Cyan
