use sha2::{Sha256, Digest};
fn main() {
    let uid = machine_uid::get().unwrap_or_else(|_| "UNKNOWN_DEVICE".to_string());
    println!("Raw UID: {}", uid);
    let mut hasher = Sha256::new();
    hasher.update(uid.as_bytes());
    let result = hasher.finalize();
    let first_5 = &result[..5];
    let b32_str = base32::encode(base32::Alphabet::Crockford, first_5);
    let b32_str: String = b32_str.chars().take(8).collect();
    let hash = if b32_str.len() == 8 { format!("{}-{}", &b32_str[..4], &b32_str[4..]) } else { b32_str };
    println!("Device Hash: {}", hash);
}
