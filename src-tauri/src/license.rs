use serde::{Serialize, Deserialize};
use machine_uid;
use sha2::{Sha256, Digest};
use hex;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseStore {
    pub store_id: String,
    pub store_name: String,
    pub activated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseData {
    pub activation_key: String,
    pub purchase_year: String,
    pub hardware_hash: String,
    pub stores: Vec<LicenseStore>,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseStatus {
    pub status: String, // "active", "trial", "expired"
    pub days_remaining: i32,
    pub stores: Vec<LicenseStore>,
    pub device_hash: String,
}

const TRIAL_DAYS: i32 = 30;

pub fn get_device_hash() -> String {
    let uid = machine_uid::get().unwrap_or_else(|_| "UNKNOWN_DEVICE".to_string());
    let mut hasher = Sha256::new();
    hasher.update(uid.as_bytes());
    let result = hasher.finalize();
    let hex_hash = hex::encode(result);
    // Take first 4 chars as per PRD
    hex_hash[..4].to_uppercase()
}

pub fn validate_checksum(data: &str, provided_checksum: &str) -> bool {
    let calculated = calculate_luhn_mod36(data);
    calculated == provided_checksum
}

fn calculate_luhn_mod36(data: &str) -> String {
    let chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let mut sum = 0;
    let n = chars.len() as u32;

    for (i, c) in data.chars().rev().enumerate() {
        let mut val = chars.find(c).unwrap_or(0) as u32;
        if i % 2 == 0 {
            val *= 2;
            val = (val / n) + (val % n);
        }
        sum += val;
    }

    let check_digit_index = (n - (sum % n)) % n;
    // Return a 4-char "hash" based on this sum for more robustness than a single digit
    // But PRD asks for 4-char VVVV. Let's make it a simple hash-based 4-char string.
    let mut hasher = Sha256::new();
    hasher.update(format!("{}{}", data, sum).as_bytes());
    let result = hasher.finalize();
    let hex_hash = hex::encode(result);
    hex_hash[..4].to_uppercase()
}

pub fn parse_key(key: &str) -> Result<(String, String, String, String), String> {
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() != 5 || parts[0] != "RM" {
        return Err("Invalid format. Use: RM-YYYY-SSSS-HHHH-VVVV".to_string());
    }
    Ok((
        parts[1].to_string(), // YYYY
        parts[2].to_string(), // SSSS
        parts[3].to_string(), // HHHH
        parts[4].to_string(), // VVVV
    ))
}

fn get_install_date_path(app_handle: &AppHandle) -> PathBuf {
    let mut path = app_handle.path().app_data_dir().unwrap_or_default();
    path.push("app_installed_date.json");
    path
}

fn get_license_path(app_handle: &AppHandle) -> PathBuf {
    let mut path = app_handle.path().app_data_dir().unwrap_or_default();
    path.push("license.enc");
    path
}

pub fn get_status(app_handle: &AppHandle) -> LicenseStatus {
    let device_hash = get_device_hash();
    let license_path = get_license_path(app_handle);
    
    // 1. Check if activated
    if license_path.exists() {
        if let Ok(content) = fs::read_to_string(&license_path) {
            if let Ok(data) = serde_json::from_str::<LicenseData>(&content) {
                if data.hardware_hash == device_hash {
                    return LicenseStatus {
                        status: "active".to_string(),
                        days_remaining: 9999,
                        stores: data.stores,
                        device_hash,
                    };
                }
            }
        }
    }

    // 2. Check trial
    let install_path = get_install_date_path(app_handle);
    if !install_path.exists() {
        let now = chrono::Utc::now().to_rfc3339();
        let _ = fs::create_dir_all(install_path.parent().unwrap());
        let _ = fs::write(&install_path, format!("{{\"date\": \"{}\"}}", now));
        return LicenseStatus {
            status: "trial".to_string(),
            days_remaining: TRIAL_DAYS,
            stores: vec![],
            device_hash,
        };
    }

    if let Ok(content) = fs::read_to_string(&install_path) {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(date_str) = val["date"].as_str() {
                if let Ok(install_date) = chrono::DateTime::parse_from_rfc3339(date_str) {
                    let now = chrono::Utc::now();
                    let elapsed = now.signed_duration_since(install_date).num_days() as i32;
                    let remaining = TRIAL_DAYS - elapsed;
                    
                    return LicenseStatus {
                        status: if remaining > 0 { "trial".to_string() } else { "expired".to_string() },
                        days_remaining: remaining.max(0),
                        stores: vec![],
                        device_hash,
                    };
                }
            }
        }
    }

    LicenseStatus {
        status: "expired".to_string(),
        days_remaining: 0,
        stores: vec![],
        device_hash,
    }
}

#[tauri::command]
pub fn validate_license_command(key: String) -> Result<bool, String> {
    let (year, ssss, hhhh, vvvv) = parse_key(&key)?;
    let device_hash = get_device_hash();
    
    if hhhh != device_hash {
        return Err("This key is for another device.".to_string());
    }

    let data_to_check = format!("RM-{}-{}-{}", year, ssss, hhhh);
    if !validate_checksum(&data_to_check, &vvvv) {
        return Err("Invalid checksum. Please check the key.".to_string());
    }

    Ok(true)
}

#[tauri::command]
pub fn activate_license_command(app_handle: AppHandle, key: String, store_name: String) -> Result<(), String> {
    validate_license_command(key.clone())?;
    
    let (year, _, hhhh, _) = parse_key(&key)?;
    let now = chrono::Utc::now().to_rfc3339();
    
    let data = LicenseData {
        activation_key: key,
        purchase_year: year,
        hardware_hash: hhhh,
        stores: vec![LicenseStore {
            store_id: "store-001".to_string(),
            store_name,
            activated_at: now,
        }],
        version: "1".to_string(),
    };

    let path = get_license_path(&app_handle);
    let content = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    
    // In production, encrypt 'content' here before writing
    fs::write(path, content).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn get_license_status_command(app_handle: AppHandle) -> Result<LicenseStatus, String> {
    Ok(get_status(&app_handle))
}

#[tauri::command]
pub fn get_device_hash_command() -> Result<String, String> {
    Ok(get_device_hash())
}
