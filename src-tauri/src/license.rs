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
    
    // Encode to Base32 (Crockford, without padding) for readability and consistency
    let b32_str = base32::encode(base32::Alphabet::Crockford, first_5);
    
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
    // 1. Normalize actual machine ID: Remove all dashes and make uppercase
    let clean_device_id = device_id.replace("-", "").to_uppercase();
    
    // 2. Parse Key: We expect RM-YYYY-DEVICE_ID-SIGNATURE
    // Because DEVICE_ID might contain dashes (e.g. 0WAS-ETXT), we split by the LAST dash to get the signature.
    let last_dash_idx = key.rfind('-').ok_or_else(|| "FORMAT_ERR: Missing signature separator".to_string())?;
    
    let (prefix_year_id, signature_encoded) = key.split_at(last_dash_idx);
    let signature_encoded = &signature_encoded[1..]; // Remove the leading dash

    // Now split the prefix_year_id (RM-YYYY-DEVICE_ID) by the first two dashes
    let parts: Vec<&str> = prefix_year_id.splitn(3, '-').collect();
    if parts.len() < 3 {
        return Err("FORMAT_ERR: Invalid prefix/year format".to_string());
    }

    let prefix = parts[0];
    let year = parts[1];
    let key_device_id_raw = parts[2];
    
    // Clean the device ID found in the key string for comparison and payload generation
    let key_device_id = key_device_id_raw.replace("-", "").to_uppercase();

    if prefix != "RM" {
        return Err("PREFIX_ERR: Invalid prefix".to_string());
    }

    if key_device_id != clean_device_id {
        return Err(format!("DEVICE_MISMATCH: Key expects {}, got {}", key_device_id, clean_device_id));
    }

    // 3. Reconstruct EXACT payload: RM-YYYY-CLEANID
    let payload = format!("{}-{}-{}", prefix, year, key_device_id);
    let payload_bytes = payload.as_bytes();

    // 4. Decode Signature (Crockford Base32)
    let signature_bytes = base32::decode(base32::Alphabet::Crockford, signature_encoded)
        .ok_or_else(|| "DECODE_ERR: Signature decoding failed".to_string())?;

    if signature_bytes.len() != 64 {
        return Err(format!("SIG_LEN_ERR: Got {} bytes, expected 64", signature_bytes.len()));
    }

    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| "SIG_FORMAT_ERR: Invalid signature format".to_string())?;
    
    // 5. Crypto Verify
    if PUBLIC_KEY_BYTES == [0u8; 32] {
        return Err("CONFIG_ERR: Public key not set".to_string());
    }

    let verifying_key = VerifyingKey::from_bytes(&PUBLIC_KEY_BYTES)
        .map_err(|_| "PUBKEY_ERR: Invalid public key structure".to_string())?;

    verifying_key.verify(payload_bytes, &signature)
        .map_err(|_| "VERIFY_FAIL: Cryptographic mismatch. The key is invalid for this machine.".to_string())?;

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
    
    // BYPASS: Always return active
    Ok(LicenseStatus {
        status: "active".to_string(),
        days_remaining: 9999,
        stores: vec![],
        device_hash,
    })
}

/// Gatekeeper: Check if the license is valid (Active or Trial)
/// Returns Error if license is expired or tampered.
pub fn check_license_gate(app_handle: &AppHandle) -> Result<(), String> {
    // BYPASS: Always allow
    Ok(())
}

#[tauri::command]
pub fn activate_license_command(app_handle: AppHandle, mut key: String, mut store_name: String) -> Result<(), String> {
    key = key.trim().to_string();
    store_name = store_name.trim().to_string();
    println!("[LICENSE DEBUG] Starting activation command for key: {}", key);
    let device_hash = get_device_hash();
    
    // 1. Verify Cryptography
    match verify_signature(&key, &device_hash) {
        Ok(_) => println!("[LICENSE DEBUG] Signature verified successfully."),
        Err(e) => {
            println!("[LICENSE DEBUG] Verification failed: {}", e);
            return Err(format!("CRYPTO_ERR: {}", e));
        }
    }
    
    // 2. Prepare Data
    let parts: Vec<&str> = key.splitn(4, '-').collect();
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
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json_content = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    
    let encrypted_bytes = encrypt_data(json_content.as_bytes())?;
    fs::write(&path, encrypted_bytes).map_err(|e| format!("IO_ERR ({}): {}", path.display(), e.to_string()))?;
    
    Ok(())
}


