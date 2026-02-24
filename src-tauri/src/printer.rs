use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use crate::license::check_license_gate;

#[derive(Serialize, Deserialize, Debug)]
pub struct Printer {
    id: String,
    name: String,
    is_default: bool,
    status: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ReceiptItem {
    name: String,
    qty: f64,
    price: f64,
    total: f64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ReceiptData {
    invoice: String,
    store_name: String,
    store_address: String,
    phone: String,
    items: Vec<ReceiptItem>,
    subtotal: f64,
    discount: f64,
    total: f64,
    date: String,
    cashier: String,
}

#[tauri::command]
pub async fn discover_printers(app_handle: AppHandle) -> Result<Vec<Printer>, String> {
    check_license_gate(&app_handle)?;
    // In a real implementation, this would use system APIs (winspool on Windows, CUPS on macOS/Linux)
    // For now, we return mock data or integrate with the local agent logic
    Ok(vec![
        Printer {
            id: "ptr_01".into(),
            name: "Thermal Receipt Printer".into(),
            is_default: true,
            status: "online".into(),
        }
    ])
}

#[tauri::command]
pub async fn set_default_printer(app_handle: AppHandle, id: String) -> Result<(), String> {
    check_license_gate(&app_handle)?;
    println!("Setting default printer to: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn print_receipt(app_handle: AppHandle, data: ReceiptData) -> Result<bool, String> {
    check_license_gate(&app_handle)?;
    println!("Printing receipt: {}", data.invoice);
    // Logic to send to system printer or proxy to LocalBridge
    Ok(true)
}

#[tauri::command]
pub async fn download_receipt(app_handle: AppHandle, data: ReceiptData) -> Result<(), String> {
    check_license_gate(&app_handle)?;
    println!("Generating PDF for download: {}", data.invoice);
    // Logic to trigger OS file save dialog
    Ok(())
}
