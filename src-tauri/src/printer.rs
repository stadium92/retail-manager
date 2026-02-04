use serde::{Deserialize, Serialize};

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
pub async fn discover_printers() -> Result<Vec<Printer>, String> {
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
pub async fn set_default_printer(id: String) -> Result<(), String> {
    println!("Setting default printer to: {}", id);
    Ok(())
}

#[tauri::command]
pub async fn print_receipt(data: ReceiptData) -> Result<bool, String> {
    println!("Printing receipt: {}", data.invoice);
    // Logic to send to system printer or proxy to LocalBridge
    Ok(true)
}

#[tauri::command]
pub async fn download_receipt(data: ReceiptData) -> Result<(), String> {
    println!("Generating PDF for download: {}", data.invoice);
    // Logic to trigger OS file save dialog
    Ok(())
}
