use ed25519_dalek::{Verifier, VerifyingKey, Signature};

fn main() {
    let public_key_bytes: [u8; 32] = [
        0x9C, 0xAB, 0x1B, 0x1C, 0x12, 0xBC, 0x66, 0x9F, 
        0x2D, 0xDE, 0x28, 0x7F, 0xD0, 0xD1, 0x12, 0x49, 
        0x56, 0xA3, 0xA5, 0xF5, 0x06, 0x93, 0xF6, 0xBF, 
        0x84, 0x19, 0x29, 0xD9, 0xBE, 0x28, 0x9C, 0x01, 
    ];

    let key = "RM-2026-0WASETXT-EQRX9G1M3216QATCZFK9AFBJ0WVWBR3N5T7KTJHG0KT9QB2C6DMFKCPCC3BCMSXYHBJQ2V6HE601FFXFMSBDQAGZWNJCGGNE5WF9R2G";
    let device_id = "0WAS-ETXT";

    let clean_device_id = device_id.replace("-", "").to_uppercase();
    let parts: Vec<&str> = key.splitn(4, '-').collect();
    
    let prefix = parts[0];
    let year = parts[1];
    let key_device_id = parts[2].to_uppercase();
    let signature_encoded = parts[3].to_uppercase();

    let payload = format!("{}-{}-{}", prefix, year, key_device_id);
    println!("Testing Payload: '{}'", payload);

    let signature_bytes = base32::decode(base32::Alphabet::Crockford, &signature_encoded).expect("Decode fail");
    let signature = Signature::from_slice(&signature_bytes).expect("Sig slice fail");
    let verifying_key = VerifyingKey::from_bytes(&public_key_bytes).expect("Key fail");

    match verifying_key.verify(payload.as_bytes(), &signature) {
        Ok(_) => println!("VERIFICATION SUCCESS"),
        Err(e) => println!("VERIFICATION FAILURE: {}", e),
    }
}
