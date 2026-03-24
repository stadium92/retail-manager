use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use crate::license::check_license_gate;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

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
    #[serde(rename = "storeName")]
    store_name: String,
    #[serde(rename = "storeAddress")]
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
    
    // 1. Format the receipt as an 80mm ESC/POS style plain text block
    let mut receipt_text = String::new();
    
    // Center aligned header roughly (approx 32-40 characters wide for 58mm-80mm)
    let width = 32;
    let store_name = if data.store_name.len() > width { &data.store_name[..width] } else { &data.store_name };
    let padding = (width - store_name.len()) / 2;
    receipt_text.push_str(&format!("{:width$}{}\n", "", store_name, width = padding));
    
    receipt_text.push_str(&format!("{}\n", data.store_address));
    receipt_text.push_str(&format!("Tel: {}\n", data.phone));
    receipt_text.push_str("--------------------------------\n");
    receipt_text.push_str(&format!("Facture: {}\n", data.invoice));
    receipt_text.push_str(&format!("Date: {}\n", data.date));
    receipt_text.push_str(&format!("Caissier: {}\n", data.cashier));
    receipt_text.push_str("--------------------------------\n");
    receipt_text.push_str("Article         Qte  Prix  Total\n");
    receipt_text.push_str("--------------------------------\n");
    
    for item in data.items {
        let name_short = if item.name.len() > 14 { format!("{}..", &item.name[..12]) } else { format!("{:<14}", item.name) };
        receipt_text.push_str(&format!("{} {:<4} {:<5} {}\n", name_short, item.qty, item.price, item.total));
    }
    
    receipt_text.push_str("--------------------------------\n");
    receipt_text.push_str(&format!("Sous-total:               {}\n", data.subtotal));
    if data.discount > 0.0 {
        receipt_text.push_str(&format!("Remise:                   -{}\n", data.discount));
    }
    receipt_text.push_str(&format!("TOTAL:                    {} FCFA\n", data.total));
    receipt_text.push_str("--------------------------------\n");
    receipt_text.push_str("        MERCI DE VOTRE VISITE!        \n");
    receipt_text.push_str("        Propulse par Jati Tech        \n");
    receipt_text.push_str("\n\n\n\n\n\n\n"); // Feed paper for cutting
    
    // 2. Write to a temporary file
    let temp_dir = std::env::temp_dir();
    let receipt_path = temp_dir.join(format!("receipt_{}.txt", data.invoice));
    fs::write(&receipt_path, &receipt_text).map_err(|e| e.to_string())?;
    
    // 3. Send to printer silently based on OS
    #[cfg(target_os = "windows")]
    {
        // Use PowerShell's Out-Printer which uses the default system printer silently
        let path_str = receipt_path.to_str().unwrap();
        let cmd = format!("Get-Content '{}' | Out-Printer", path_str);
        match Command::new("powershell")
            .args(&["-NoProfile", "-Command", &cmd])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output() 
        {
            Ok(_) => println!("Printed successfully via PowerShell"),
            Err(e) => return Err(format!("Print failed: {}", e)),
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // Use lpr on Mac
        match Command::new("lpr").arg(receipt_path.to_str().unwrap()).output() {
            Ok(_) => println!("Printed successfully via lpr"),
            Err(e) => return Err(format!("Print failed: {}", e)),
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // Use lpr on Linux
        match Command::new("lpr").arg(receipt_path.to_str().unwrap()).output() {
            Ok(_) => println!("Printed successfully via lpr"),
            Err(e) => return Err(format!("Print failed: {}", e)),
        }
    }

    Ok(true)
}

#[tauri::command]
pub async fn download_receipt(app_handle: AppHandle, data: ReceiptData) -> Result<(), String> {
    check_license_gate(&app_handle)?;
    println!("Generating PDF for download: {}", data.invoice);
    // Logic to trigger OS file save dialog
    Ok(())
}