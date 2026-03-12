use ed25519_dalek::{Verifier, VerifyingKey, Signature};

fn main() {
    let public_key_bytes: [u8; 32] = [
        0x9C, 0xAB, 0x1B, 0x1C, 0x12, 0xBC, 0x66, 0x9F, 
        0x2D, 0xDE, 0x28, 0x7F, 0xD0, 0xD1, 0x12, 0x49, 
        0x56, 0xA3, 0xA5, 0xF5, 0x06, 0x93, 0xF6, 0xBF, 
        0x84, 0x19, 0x29, 0xD9, 0xBE, 0x28, 0x9C, 0x01, 
    ];

    let key = "RM-2026-IPB2RN63-58PRHP58TR9E32D7TBSAWVGH2FYT8BJ3EX7HBBACJ3VA8879Z914N4N3PH614SD50QHNQ1G7DEV1XFPQE2RRR7VQ8EJTGZPEM5CF410";
    let device_id = "IPB2RN63";

    let clean_device_id = device_id.replace("-", "").to_uppercase();
    
    let parts: Vec<&str> = key.splitn(4, '-').collect();
    if parts.len() < 4 {
        println!("Error: parts len < 4");
        return;
    }

    let prefix = parts[0];
    let year = parts[1];
    let key_device_id = parts[2].to_uppercase();
    let signature_encoded = parts[3].to_uppercase();

    println!("Payload construction: RM-{}-{}", year, key_device_id);
    let payload = format!("{}-{}-{}", prefix, year, key_device_id);
    let payload_bytes = payload.as_bytes();

    let signature_bytes = match base32::decode(base32::Alphabet::Crockford, &signature_encoded) {
        Some(b) => b,
        None => {
            println!("Error decoding base32");
            return;
        }
    };

    if signature_bytes.len() != 64 {
        println!("Error: sig len is {}", signature_bytes.len());
        return;
    }

    let signature = match Signature::from_slice(&signature_bytes) {
        Ok(s) => s,
        Err(_) => {
            println!("Error from_slice");
            return;
        }
    };

    let verifying_key = VerifyingKey::from_bytes(&public_key_bytes).unwrap();

    match verifying_key.verify(payload_bytes, &signature) {
        Ok(_) => println!("SUCCESS: Key is valid"),
        Err(e) => println!("FAIL: {}", e),
    }
}
