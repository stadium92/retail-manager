use ed25519_dalek::{VerifyingKey, Signature, Verifier};

const PUBLIC_KEY_BYTES: [u8; 32] = [
    0x9C, 0xAB, 0x1B, 0x1C, 0x12, 0xBC, 0x66, 0x9F, 
    0x2D, 0xDE, 0x28, 0x7F, 0xD0, 0xD1, 0x12, 0x49, 
    0x56, 0xA3, 0xA5, 0xF5, 0x06, 0x93, 0xF6, 0xBF, 
    0x84, 0x19, 0x29, 0xD9, 0xBE, 0x28, 0x9C, 0x01, 
];

fn verify_signature(key: &str, device_id: &str) -> Result<bool, String> {
    let clean_device_id = device_id.replace("-", "").to_uppercase();
    
    let last_dash_idx = key.rfind('-').ok_or_else(|| "FORMAT_ERR: Missing signature separator".to_string())?;
    
    let (prefix_year_id, signature_encoded) = key.split_at(last_dash_idx);
    let signature_encoded = &signature_encoded[1..];

    let parts: Vec<&str> = prefix_year_id.splitn(3, '-').collect();
    if parts.len() < 3 {
        return Err("FORMAT_ERR: Invalid prefix/year format".to_string());
    }

    let prefix = parts[0];
    let year = parts[1];
    let key_device_id_raw = parts[2];
    
    let key_device_id = key_device_id_raw.replace("-", "").to_uppercase();

    if prefix != "RM" {
        return Err("PREFIX_ERR: Invalid prefix".to_string());
    }

    if key_device_id != clean_device_id {
        return Err(format!("DEVICE_MISMATCH: Key expects {}, got {}", key_device_id, clean_device_id));
    }

    let payload = format!("{}-{}-{}", prefix, year, key_device_id);
    let payload_bytes = payload.as_bytes();

    let signature_bytes = base32::decode(base32::Alphabet::Crockford, signature_encoded)
        .ok_or_else(|| "DECODE_ERR: Signature decoding failed".to_string())?;

    if signature_bytes.len() != 64 {
        return Err(format!("SIG_LEN_ERR: Got {} bytes, expected 64", signature_bytes.len()));
    }

    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|_| "SIG_FORMAT_ERR: Invalid signature format".to_string())?;
    
    let verifying_key = VerifyingKey::from_bytes(&PUBLIC_KEY_BYTES).unwrap();
    verifying_key.verify(payload_bytes, &signature).map_err(|_| "VERIFY_FAIL: Cryptographic mismatch.".to_string())?;

    Ok(true)
}

fn main() {
    // Note how this key has the dash inside the device ID portion
    let key = "RM-2026-0WAS-ETXT-EQRX9G1M3216QATCZFK9AFBJ0WVWBR3N5T7KTJHG0KT9QB2C6DMFKCPCC3BCMSXYHBJQ2V6HE601FFXFMSBDQAGZWNJCGGNE5WF9R2G";
    let device_id = "0WAS-ETXT";
    
    println!("Testing Key: {}", key);
    println!("Device ID: {}", device_id);
    
    match verify_signature(key, device_id) {
        Ok(_) => println!("✅ Key is mathematically VALID!"),
        Err(e) => println!("❌ Key is INVALID: {}", e),
    }
}
