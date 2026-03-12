$path = "C:\Users\Mohamed\AppData\Local\retail-manager\local-bridge.exe"
if (Test-Path $path) {
    Write-Host "Found binary at: $path"
    Write-Host "Starting sidecar process..."
    $process = Start-Process -FilePath $path -PassThru -NoNewWindow
    
    if ($process.Id) {
        Write-Host "Sidecar started with PID: $($process.Id)"
        Write-Host "Waiting 60 seconds..."
        Start-Sleep -Seconds 60
        
        if (!$process.HasExited) {
            Write-Host "Sidecar is still running. Terminating..."
            Stop-Process -Id $process.Id -Force
            Write-Host "Sidecar terminated."
        } else {
            Write-Host "Sidecar exited prematurely. Exit Code: $($process.ExitCode)"
        }
    } else {
        Write-Error "Failed to start sidecar process."
    }
} else {
    Write-Error "Binary not found at: $path"
}