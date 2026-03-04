use serde::{Serialize, Deserialize};
use machine_uid;
use sha2::{Sha256, Digest};
use hex;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use ed25519_dalek::{Verifier, VerifyingKey, Signature};
use base32;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce // Or `Aes128Gcm`
};
use rand::{Rng, thread_rng};

#[cfg(windows)]
use winreg::enums::*;
#[cfg(windows)]
use winreg::RegKey;

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const REG_PATH: &str = "Software\\RetailManager\\License";

// TODO: REPLACE THIS WITH YOUR REAL PUBLIC KEY FROM tools/keygen/src/main.rs
// Run `cargo run --bin keygen -- --device-id TEST` to get this array.
const PUBLIC_KEY_BYTES: [u8; 32] = [
    0x9C, 0xAB, 0x1B, 0x1C, 0x12, 0xBC, 0x66, 0x9F, 
    0x2D, 0xDE, 0x28, 0x7F, 0xD0, 0xD1, 0x12, 0x49, 
    0x56, 0xA3, 0xA5, 0xF5, 0x06, 0x93, 0xF6, 0xBF, 
    0x84, 0x19, 0x29, 0xD9, 0xBE, 0x28, 0x9C, 0x01, 
];

// AES Key for local storage (Not for transmission). 
// Ideally derived from machine ID, but hardcoded is okay for local obfuscation against casual copying.
const LOCAL_STORAGE_KEY: &[u8; 32] = b"RETAIL-MANAGER-LOCAL-SECURE-KEY!"; // Must be 32 bytes

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

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
    pub status: String, // "active", "trial", "expired", "clock_error", "tamper_detected"
    pub days_remaining: i32,
    pub stores: Vec<LicenseStore>,
    pub device_hash: String,
}

const TRIAL_DAYS: i32 = 30;

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

fn set_reg_value(name: &str, value: &str) {
    #[cfg(windows)]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok((key, _)) = hkcu.create_subkey(REG_PATH) {
            let _ = key.set_value(name, &value);
        }
    }
}

fn get_reg_value(name: &str) -> Option<String> {
    #[cfg(windows)]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey(REG_PATH) {
            if let Ok(val) = key.get_value::<String, _>(name) {
                return Some(val);
            }
        }
    }
    None
}

pub fn get_device_hash() -> String {
    let uid = machine_uid::get().unwrap_or_else(|_| "UNKNOWN_DEVICE".to_string());
    let mut hasher = Sha256::new();
    hasher.update(uid.as_bytes());
    let result = hasher.finalize();
    
    // Take first 5 bytes
    let first_5 = &result[..5];
    
    // Encode to Base32 (RFC4648, without padding)
    let b32_str = base32::encode(base32::Alphabet::RFC4648 { padding: false }, first_5);
    
    // Truncate to 8 characters just in case
    let b32_str: String = b32_str.chars().take(8).collect();
    
    // Format as XXXX-XXXX
    if b32_str.len() == 8 {
        format!("{}-{}", &b32_str[..4], &b32_str[4..])
    } else {
        b32_str // Fallback if somehow shorter
    }
}

fn get_license_path(app_handle: &AppHandle) -> PathBuf {
    let mut path = app_handle.path().app_data_dir().unwrap_or_default();
    path.push("license.bin"); // Changed extension to .bin for binary
    path
}

fn get_install_date_path(app_handle: &AppHandle) -> PathBuf {
    let mut path = app_handle.path().app_data_dir().unwrap_or_default();
    path.push("app_installed_date.json");
    path
}

fn get_last_run_path(app_handle: &AppHandle) -> PathBuf {
    let mut path = app_handle.path().app_data_dir().unwrap_or_default();
    path.push("last_run.bin");
    path
}

// AES-GCM Encryption for local storage
fn encrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(LOCAL_STORAGE_KEY.into());
    let nonce_bytes: [u8; 12] = thread_rng().gen();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let ciphertext = cipher.encrypt(nonce, data)
        .map_err(|_| "Encryption failed".to_string())?;
        
    // Prepend nonce to ciphertext
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);
    Ok(result)
}

fn decrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < 12 {
        return Err("Invalid data length".to_string());
    }
    let nonce = Nonce::from_slice(&data[..12]);
    let ciphertext = &data[12..];
    
    let cipher = Aes256Gcm::new(LOCAL_STORAGE_KEY.into());
    cipher.decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed".to_string())
}

// -----------------------------------------------------------------------------
// CORE LOGIC
// -----------------------------------------------------------------------------

pub fn verify_signature(key: &str, device_id: &str) -> Result<bool, String> {
    // Expected Format: RM-YYYY-DEVICEID-<SIGNATURE_BASE32>
    // Example: RM-2026-KV7M9X2P-KB2...
    
    let clean_device_id = device_id.replace("-", "");
    
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() < 4 {
        return Err("Invalid key format.".to_string());
    }

    let prefix = parts[0];
    let year = parts[1];
    let key_device_id = parts[2];
    let signature_encoded = parts[3];

    if prefix != "RM" {
        return Err("Invalid license prefix.".to_string());
    }

    if key_device_id != clean_device_id {
        return Err(format!("Key is for device {}, but this is {}.", key_device_id, clean_device_id));
    }

    // Reconstruct Payload: RM-YYYY-DEVICEID
    let payload = format!("{}-{}-{}", prefix, year, key_device_id);
    let payload_bytes = payload.as_bytes();

    // Decode Signature
    let signature_bytes = base32::decode(base32::Alphabet::Crockford, signature_encoded)
        .ok_or("Invalid signature encoding (Base32).")?;

    if signature_bytes.len() != 64 {
        return Err("Invalid signature length.".to_string());
    }

    let signature = Signature::from_slice(&signature_bytes).map_err(|_| "Invalid signature bytes.".to_string())?;
    
    // Verify
    // Handle all-zero placeholder key
    if PUBLIC_KEY_BYTES == [0u8; 32] {
        return Err("Dev Error: PUBLIC_KEY_BYTES not set in license.rs".to_string());
    }

    let verifying_key = VerifyingKey::from_bytes(&PUBLIC_KEY_BYTES)
        .map_err(|_| "Invalid public key".to_string())?;

    verifying_key.verify(payload_bytes, &signature)
        .map_err(|_| "Invalid signature. Key has been tampered with.".to_string())?;

    Ok(true)
}

// -----------------------------------------------------------------------------
// TAURI COMMANDS
// -----------------------------------------------------------------------------

#[tauri::command]
pub fn validate_license_command(key: String) -> Result<bool, String> {
    let device_hash = get_device_hash();
    verify_signature(&key, &device_hash)
}

#[tauri::command]
pub fn get_device_hash_command() -> Result<String, String> {
    Ok(get_device_hash())
}

#[tauri::command]
pub fn get_license_status_command(app_handle: AppHandle) -> Result<LicenseStatus, String> {
    let device_hash = get_device_hash();
    let license_path = get_license_path(&app_handle);
    let last_run_path = get_last_run_path(&app_handle);
    
    // --- DeLorean (Clock Check) ---
    let now = chrono::Utc::now();
    let now_ts = now.timestamp();
    
    // 1. Get LKT from File
    let mut file_lkt: Option<i64> = None;
    if last_run_path.exists() {
        if let Ok(encrypted_last_run) = fs::read(&last_run_path) {
            if let Ok(decrypted_last_run) = decrypt_data(&encrypted_last_run) {
                if let Ok(last_run_str) = String::from_utf8(decrypted_last_run) {
                    if let Ok(last_run_ts) = last_run_str.parse::<i64>() {
                        file_lkt = Some(last_run_ts);
                    }
                }
            }
        }
    }

    // 2. Get LKT from Registry (Windows Only)
    let reg_lkt: Option<i64> = get_reg_value("LKT").and_then(|s| s.parse().ok());

    // 3. Reconcile LKT
    let last_known_ts = match (file_lkt, reg_lkt) {
        (Some(f), Some(r)) => std::cmp::max(f, r),
        (Some(f), None) => f,
        (None, Some(r)) => r,
        (None, None) => 0,
    };

    if last_known_ts > 0 && now_ts < last_known_ts {
        // User traveled back in time!
        return Ok(LicenseStatus {
            status: "clock_error".to_string(),
            days_remaining: 0,
            stores: vec![],
            device_hash,
        });
    }
    
    // Update last run (encrypted file + registry)
    if let Ok(encrypted_now) = encrypt_data(now_ts.to_string().as_bytes()) {
        let _ = fs::write(&last_run_path, encrypted_now);
    }
    set_reg_value("LKT", &now_ts.to_string());

    // 1. Check for Valid License File
    if license_path.exists() {
        if let Ok(encrypted_content) = fs::read(&license_path) {
            if let Ok(decrypted_bytes) = decrypt_data(&encrypted_content) {
                if let Ok(content) = String::from_utf8(decrypted_bytes) {
                    if let Ok(data) = serde_json::from_str::<LicenseData>(&content) {
                        // Double check device binding
                        if data.hardware_hash == device_hash {
                            // Triple check: Verify signature again (in case file was copied)
                            if verify_signature(&data.activation_key, &device_hash).is_ok() {
                                return Ok(LicenseStatus {
                                    status: "active".to_string(),
                                    days_remaining: 9999,
                                    stores: data.stores,
                                    device_hash,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Check Trial Status
    let install_path = get_install_date_path(&app_handle);
    let mut file_install_date: Option<String> = None;
    
    if install_path.exists() {
        if let Ok(content) = fs::read_to_string(&install_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(date_str) = val["date"].as_str() {
                    file_install_date = Some(date_str.to_string());
                }
            }
        }
    }

    let reg_install_date = get_reg_value("IDT");

    let final_install_date = match (file_install_date, reg_install_date) {
        (Some(f), Some(r)) => {
            // Reconcile: Pick the oldest date to prevent trial resets
            let f_date = chrono::DateTime::parse_from_rfc3339(&f).unwrap_or_default();
            let r_date = chrono::DateTime::parse_from_rfc3339(&r).unwrap_or_default();
            if f_date < r_date { f } else { r }
        },
        (Some(f), None) => {
            set_reg_value("IDT", &f);
            f
        },
        (None, Some(r)) => {
            // Registry has it but file doesn't? Possible tamper attempt.
            let now = chrono::Utc::now().to_rfc3339();
            let _ = fs::write(&install_path, format!("{{\"date\": \"{}\"}}", r));
            r
        },
        (None, None) => {
            // First run
            let now = chrono::Utc::now().to_rfc3339();
            if let Some(parent) = install_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(&install_path, format!("{{\"date\": \"{}\"}}", now));
            set_reg_value("IDT", &now);
            now
        }
    };

    if let Ok(install_date) = chrono::DateTime::parse_from_rfc3339(&final_install_date) {
        let now = chrono::Utc::now();
        let elapsed = now.signed_duration_since(install_date).num_days() as i32;
        let remaining = TRIAL_DAYS - elapsed;
        
        return Ok(LicenseStatus {
            status: if remaining > 0 { "trial".to_string() } else { "expired".to_string() },
            days_remaining: remaining.max(0),
            stores: vec![],
            device_hash,
        });
    }

    // Fallback: Expired
    Ok(LicenseStatus {
        status: "expired".to_string(),
        days_remaining: 0,
        stores: vec![],
        device_hash,
    })
}

/// Gatekeeper: Check if the license is valid (Active or Trial)
/// Returns Error if license is expired or tampered.
pub fn check_license_gate(app_handle: &AppHandle) -> Result<(), String> {
    let status = get_license_status_command(app_handle.clone())?;
    if status.status == "active" || status.status == "trial" {
        Ok(())
    } else if status.status == "clock_error" {
        Err("SECURITY ALERT: System clock tampered. Please restore correct date.".to_string())
    } else {
        Err("LICENSE REQUIRED: Trial expired or no active license found.".to_string())
    }
}

#[tauri::command]
pub fn activate_license_command(app_handle: AppHandle, key: String, store_name: String) -> Result<(), String> {
    let device_hash = get_device_hash();
    
    // 1. Verify Cryptography
    verify_signature(&key, &device_hash)?;
    
    // 2. Prepare Data
    let parts: Vec<&str> = key.split('-').collect();
    let year = parts[1].to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    let data = LicenseData {
        activation_key: key,
        purchase_year: year,
        hardware_hash: device_hash,
        stores: vec![LicenseStore {
            store_id: "store-001".to_string(), // In V1, we assume single main store
            store_name,
            activated_at: now,
        }],
        version: "2".to_string(), // Secure Schema V2
    };

    // 3. Encrypt & Save
    let path = get_license_path(&app_handle);
    let json_content = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    
    let encrypted_bytes = encrypt_data(json_content.as_bytes())?;
    fs::write(path, encrypted_bytes).map_err(|e| e.to_string())?;
    
    Ok(())
}


