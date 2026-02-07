# Bypassing service manager to disable updates, bits, and delivery optimization
$services = @("wuauserv", "bits", "dosvc", "waasmedsvc")
foreach ($service in $services) {
    $path = "HKLM:\SYSTEM\CurrentControlSet\Services\$service"
    if (Test-Path $path) {
        Set-ItemProperty -Path $path -Name "Start" -Value 4
        Write-Host "Disabled $service via Registry" -ForegroundColor Green
    }
}