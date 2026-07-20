use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use std::time::Duration;
use tokio::time::sleep;
use crate::license::check_license_gate;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScanEvent {
    pub code: String,
    pub source: String,
}

#[tauri::command]
pub async fn start_hardware_scan_listener(app: AppHandle) -> Result<(), String> {
    check_license_gate(&app)?;
    println!("Initializing hardware serial scanner listener...");
    
    // In a real production environment, we would use the `serialport` crate here:
    // let port = serialport::new("/dev/ttyUSB0", 9600).open().expect("Failed to open port");
    
    // For now, we simulate a background listener that "detects" a scanner
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        // Simulate waiting for a hardware scan event
        loop {
            sleep(Duration::from_secs(60)).await; // Just keep the task alive
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn list_connected_scanners(app: AppHandle) -> Result<Vec<String>, String> {
    check_license_gate(&app)?;
    // This would use system APIs to list USB/Serial devices
    Ok(vec![
        "Internal HID Scanner".into(),
        "OBF Professional Scanner (USB-Serial)".into()
    ])
}

// Helper command to simulate a scan for testing purposes
#[tauri::command]
pub async fn simulate_hardware_scan(app: AppHandle, code: String) -> Result<(), String> {
    check_license_gate(&app)?;
    app.emit("hardware-scan", ScanEvent { 
        code, 
        source: "Simulated-Serial".into() 
    }).map_err(|e| e.to_string())
}
