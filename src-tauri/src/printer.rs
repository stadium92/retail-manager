use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use crate::license::check_license_gate;
use image::GenericImageView;

#[cfg(windows)]
use std::ptr;
#[cfg(windows)]
use winapi::um::winspool::{OpenPrinterW, ClosePrinter, StartDocPrinterW, EndDocPrinter, StartPagePrinter, EndPagePrinter, WritePrinter, DOC_INFO_1W};
#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;

#[derive(Serialize, Deserialize, Debug)]
pub struct Printer {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ReceiptItem {
    pub name: String,
    pub qty: f64,
    pub price: f64,
    pub total: f64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ReceiptData {
    pub invoice: String,
    #[serde(rename = "storeName")]
    pub store_name: String,
    #[serde(rename = "storeAddress")]
    pub store_address: String,
    pub phone: String,
    pub items: Vec<ReceiptItem>,
    pub subtotal: f64,
    pub discount: f64,
    pub total: f64,
    pub date: String,
    pub cashier: String,
}

// ESC/POS Commands
const ESC: u8 = 0x1B;
const GS: u8 = 0x1D;
const LF: u8 = 0x0A;

#[tauri::command]
pub async fn discover_printers(app_handle: AppHandle) -> Result<Vec<Printer>, String> {
    check_license_gate(&app_handle)?;
    
    #[cfg(windows)]
    {
        use std::ptr;
        use winapi::um::winspool::{EnumPrintersW, PRINTER_INFO_2W, PRINTER_ENUM_LOCAL, PRINTER_ENUM_CONNECTIONS};

        let mut bytes_needed: u32 = 0;
        let mut count: u32 = 0;

        unsafe {
            // First call to get the buffer size
            EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, ptr::null_mut(), 2, ptr::null_mut(), 0, &mut bytes_needed, &mut count);
            
            let mut buffer = vec![0u8; bytes_needed as usize];
            if EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, ptr::null_mut(), 2, buffer.as_mut_ptr(), bytes_needed, &mut bytes_needed, &mut count) != 0 {
                let prn_info = buffer.as_ptr() as *const PRINTER_INFO_2W;
                let mut printers = Vec::new();
                
                for i in 0..count {
                    let info = *prn_info.add(i as usize);
                    let name_raw = info.pPrinterName;
                    let mut len = 0;
                    while *name_raw.add(len) != 0 {
                        len += 1;
                    }
                    let name = String::from_utf16_lossy(std::slice::from_raw_parts(name_raw, len));
                    
                    printers.push(Printer {
                        id: name.clone(),
                        name: name,
                        is_default: (info.Attributes & 0x00000004) != 0, // PRINTER_ATTRIBUTE_DEFAULT
                        status: "online".into(),
                    });
                }
                return Ok(printers);
            }
        }
        
        // Fallback if enumeration fails
        Ok(vec![Printer { id: "default".into(), name: "System Default Printer".into(), is_default: true, status: "online".into() }])
    }

    #[cfg(not(windows))]
    {
        Ok(vec![
            Printer {
                id: "lpr".into(),
                name: "Generic Thermal (LPR)".into(),
                is_default: true,
                status: "online".into(),
            }
        ])
    }
}

#[tauri::command]
pub async fn set_default_printer(app_handle: AppHandle, id: String) -> Result<(), String> {
    check_license_gate(&app_handle)?;
    println!("Setting default printer to: {}", id);
    Ok(())
}

fn get_logo_bytes(app_handle: &AppHandle) -> Option<Vec<u8>> {
    // Try to find stihl-logo.jpg in the resources or public folder
    let resource_path = app_handle.path().resource_dir().ok()?.join("public/stihl-logo.jpg");
    let img = image::open(resource_path).ok()?;
    
    // Resize to fit thermal paper (usually 384 or 512 pixels wide)
    let resized = img.resize(384, 384, image::imageops::FilterType::Nearest);
    let (width, height) = resized.dimensions();
    let grayscale = resized.to_luma8();

    let mut esc_pos = Vec::new();
    
    // GS v 0 m xL xH yL yH d1...dk
    // xL xH is width in bytes (width / 8)
    let width_bytes = (width + 7) / 8;
    
    esc_pos.extend_from_slice(&[GS, 0x76, 0x30, 0]); // Command
    esc_pos.push((width_bytes % 256) as u8);
    esc_pos.push((width_bytes / 256) as u8);
    esc_pos.push((height % 256) as u8);
    esc_pos.push((height / 256) as u8);

    for y in 0..height {
        for x_byte in 0..width_bytes {
            let mut byte = 0u8;
            for bit in 0..8 {
                let x = x_byte * 8 + bit;
                if x < width {
                    let pixel = grayscale.get_pixel(x, y)[0];
                    if pixel < 128 { // Black pixel
                        byte |= 1 << (7 - bit);
                    }
                }
            }
            esc_pos.push(byte);
        }
    }
    
    Some(esc_pos)
}

#[tauri::command]
pub async fn print_receipt(app_handle: AppHandle, data: ReceiptData) -> Result<bool, String> {
    check_license_gate(&app_handle)?;
    
    let mut raw = Vec::new();

    // 1. Initialize Printer
    raw.extend_from_slice(&[ESC, 0x40]); 
    
    // 2. Print Logo (if exists)
    if let Some(logo_bytes) = get_logo_bytes(&app_handle) {
        raw.extend_from_slice(&[ESC, 0x61, 1]); // Center
        raw.extend(logo_bytes);
        raw.push(LF);
    }

    // 3. Store Name (Bold + Large)
    raw.extend_from_slice(&[ESC, 0x61, 1]); // Center
    raw.extend_from_slice(&[GS, 0x21, 0x11]); // Double height and width
    raw.extend(data.store_name.as_bytes());
    raw.push(LF);
    raw.extend_from_slice(&[GS, 0x21, 0x00]); // Reset size

    // 4. Address & Phone
    raw.extend("Niamana en face station Shell".as_bytes());
    raw.push(LF);
    raw.extend(format!("Tel: {}", data.phone).as_bytes());
    raw.push(LF);
    raw.extend_from_slice(b"--------------------------------\n");

    // 5. Header Info
    raw.extend_from_slice(&[ESC, 0x61, 0]); // Left align
    raw.extend(format!("Facture: {}\n", data.invoice).as_bytes());
    raw.extend(format!("Date:    {}\n", data.date).as_bytes());
    raw.extend(format!("Vendeur: {}\n", data.cashier).as_bytes());
    raw.extend_from_slice(b"--------------------------------\n");
    raw.extend_from_slice(b"Article         Qte  Prix  Total\n");
    raw.extend_from_slice(b"--------------------------------\n");

    // 6. Items
    for item in data.items {
        let name = if item.name.len() > 14 { format!("{}..", &item.name[..12]) } else { format!("{:<14}", item.name) };
        raw.extend(format!("{} {:<4} {:<5} {:>7}\n", name, item.qty, item.price, item.total).as_bytes());
    }

    // 7. Totals
    raw.extend_from_slice(b"--------------------------------\n");
    raw.extend_from_slice(&[ESC, 0x61, 2]); // Right align
    raw.extend(format!("Sous-total: {:>10}\n", data.subtotal).as_bytes());
    if data.discount > 0.0 {
        raw.extend(format!("Remise:     {:>10}\n", data.discount).as_bytes());
    }
    raw.extend_from_slice(&[GS, 0x21, 0x01]); // Double height for Total
    raw.extend(format!("TOTAL: {:>10} FCFA\n", data.total).as_bytes());
    raw.extend_from_slice(&[GS, 0x21, 0x00]); // Reset

    // 8. Footer & Slogan
    raw.extend_from_slice(&[ESC, 0x61, 1]); // Center
    raw.push(LF);
    raw.extend_from_slice(b"TOUJOURS CLIENTS SATISFAITS\n");
    raw.extend_from_slice(b"MERCI DE VOTRE VISITE!\n");
    raw.extend_from_slice(b"Propulse par Djati ERP\n");

    // 9. Cut Paper
    raw.extend_from_slice(&[GS, 0x56, 0x42, 0x00]); // Full Cut

    // --- SEND RAW TO HARDWARE ---
    
    #[cfg(windows)]
    {
        use std::ffi::OsString;
        use winapi::um::winspool::{GetDefaultPrinterW};

        unsafe {
            let mut h_printer: winapi::shared::ntdef::HANDLE = ptr::null_mut();
            
            // LOGIC: First try to find a printer named "POS-80", 
            // if not found, use the SYSTEM DEFAULT PRINTER.
            let target_printer_name = OsString::from("POS-80");
            let name_u16: Vec<u16> = target_printer_name.encode_wide().chain(Some(0)).collect();
            
            if OpenPrinterW(name_u16.as_ptr() as *mut _, &mut h_printer, ptr::null_mut()) == 0 {
                // POS-80 not found, let's get the default one
                let mut len: u32 = 0;
                GetDefaultPrinterW(ptr::null_mut(), &mut len);
                let mut buf = vec![0u16; len as usize];
                if GetDefaultPrinterW(buf.as_mut_ptr(), &mut len) != 0 {
                    let default_name = String::from_utf16_lossy(&buf[..len as usize - 1]);
                    println!("Using Default Printer: {}", default_name);
                    OpenPrinterW(buf.as_ptr() as *mut _, &mut h_printer, ptr::null_mut());
                }
            }

            if !h_printer.is_null() {
                let mut doc_info = DOC_INFO_1W {
                    pDocName: OsString::from("Djati Receipt").encode_wide().chain(Some(0)).collect::<Vec<u16>>().as_ptr() as *mut _,
                    pOutputFile: ptr::null_mut(),
                    pDatatype: OsString::from("RAW").encode_wide().chain(Some(0)).collect::<Vec<u16>>().as_ptr() as *mut _,
                };

                if StartDocPrinterW(h_printer, 1, &mut doc_info as *mut _ as *mut _) != 0 {
                    StartPagePrinter(h_printer);
                    let mut bytes_written: u32 = 0;
                    WritePrinter(h_printer, raw.as_ptr() as *mut _, raw.len() as u32, &mut bytes_written);
                    EndPagePrinter(h_printer);
                    EndDocPrinter(h_printer);
                }
                ClosePrinter(h_printer);
                return Ok(true);
            }
            
            Err("No suitable printer found. Please set a default printer in Windows.".into())
        }
    }

    #[cfg(not(windows))]
    {
        // Unix fallback (CUPS)
        let temp_path = std::env::temp_dir().join("receipt.bin");
        std::fs::write(&temp_path, &raw).map_err(|e| e.to_string())?;
        std::process::Command::new("lpr").arg(temp_path.to_str().unwrap()).output().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub async fn download_receipt(app_handle: AppHandle, data: ReceiptData) -> Result<(), String> {
    check_license_gate(&app_handle)?;
    println!("Generating PDF for download: {}", data.invoice);
    Ok(())
}
