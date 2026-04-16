use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use crate::license::check_license_gate;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use image::{DynamicImage, GenericImageView};

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
                    let mut name = String::new();
                    let mut len = 0;
                    while *name_raw.add(len) != 0 {
                        len += 1;
                    }
                    name = String::from_utf16_lossy(std::slice::from_raw_parts(name_raw, len));
                    
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

// ... (get_logo_bytes remains the same)

#[tauri::command]
pub async fn print_receipt(app_handle: AppHandle, data: ReceiptData) -> Result<bool, String> {
    check_license_gate(&app_handle)?;
    
    // ... (raw buffer construction remains the same)
    let mut raw = Vec::new();
    raw.extend_from_slice(&[ESC, 0x40]); 
    if let Some(logo_bytes) = get_logo_bytes(&app_handle) {
        raw.extend_from_slice(&[ESC, 0x61, 1]); // Center
        raw.extend(logo_bytes);
        raw.push(LF);
    }
    raw.extend_from_slice(&[ESC, 0x61, 1]);
    raw.extend_from_slice(&[GS, 0x21, 0x11]);
    raw.extend(data.store_name.as_bytes());
    raw.push(LF);
    raw.extend_from_slice(&[GS, 0x21, 0x00]);
    raw.extend(data.store_address.as_bytes());
    raw.push(LF);
    raw.extend(format!("Tel: {}", data.phone).as_bytes());
    raw.push(LF);
    raw.extend_from_slice(b"--------------------------------\n");
    raw.extend_from_slice(&[ESC, 0x61, 0]);
    raw.extend(format!("Facture: {}\n", data.invoice).as_bytes());
    raw.extend(format!("Date:    {}\n", data.date).as_bytes());
    raw.extend(format!("Vendeur: {}\n", data.cashier).as_bytes());
    raw.extend_from_slice(b"--------------------------------\n");
    raw.extend_from_slice(b"Article         Qte  Prix  Total\n");
    raw.extend_from_slice(b"--------------------------------\n");
    for item in data.items {
        let name = if item.name.len() > 14 { format!("{}..", &item.name[..12]) } else { format!("{:<14}", item.name) };
        raw.extend(format!("{} {:<4} {:<5} {:>7}\n", name, item.qty, item.price, item.total).as_bytes());
    }
    raw.extend_from_slice(b"--------------------------------\n");
    raw.extend_from_slice(&[ESC, 0x61, 2]);
    raw.extend(format!("Sous-total: {:>10}\n", data.subtotal).as_bytes());
    if data.discount > 0.0 {
        raw.extend(format!("Remise:     {:>10}\n", data.discount).as_bytes());
    }
    raw.extend_from_slice(&[GS, 0x21, 0x01]);
    raw.extend(format!("TOTAL: {:>10} FCFA\n", data.total).as_bytes());
    raw.extend_from_slice(&[GS, 0x21, 0x00]);
    raw.extend_from_slice(&[ESC, 0x61, 1]);
    raw.push(LF);
    raw.extend_from_slice(b"STIHL 100 YEARS: 1926-2026\n");
    raw.extend_from_slice(b"MERCI DE VOTRE VISITE!\n");
    raw.extend_from_slice(b"Propulse par Djati ERP\n");
    raw.extend_from_slice(&[GS, 0x56, 0x42, 0x00]);

    #[cfg(windows)]
    {
        use std::ffi::OsString;
        use winapi::um::winspool::{GetDefaultPrinterW};

        unsafe {
            let mut h_printer: winapi::shared::ntdef::HANDLE = ptr::null_mut();
            
            // LOGIC: First try to find a printer named "POS-80", 
            // if not found, use the SYSTEM DEFAULT PRINTER.
            let mut target_printer_name = OsString::from("POS-80");
            let mut name_u16: Vec<u16> = target_printer_name.encode_wide().chain(Some(0)).collect();
            
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
        let temp_path = std::env::temp_dir().join("receipt.bin");
        fs::write(&temp_path, &raw).map_err(|e| e.to_string())?;
        Command::new("lpr").arg(temp_path.to_str().unwrap()).output().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub async fn download_receipt(app_handle: AppHandle, data: ReceiptData) -> Result<(), String> {
    check_license_gate(&app_handle)?;
    println!("Generating PDF for download: {}", data.invoice);
    Ok(())
}
