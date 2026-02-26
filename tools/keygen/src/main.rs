use clap::Parser;
use ed25519_dalek::{Signer, SigningKey, Signature};
use rand::rngs::OsRng;
use std::fs;
use std::path::Path;
use anyhow::Result;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Device ID (e.g. 4B2A)
    #[arg(short, long)]
    device_id: String,

    /// Year (default: 2026)
    #[arg(short, long, default_value = "2026")]
    year: String,
}

const PRIVATE_KEY_FILE: &str = "private_key.pem";
const PUBLIC_KEY_FILE: &str = "public_key.pem";

fn main() -> Result<()> {
    let args = Args::parse();

    // 1. Load or Generate Keypair
    let signing_key = get_or_create_keypair()?;
    let verifying_key = signing_key.verifying_key();

    // 2. Prepare Payload
    // Format: RM-YYYY-DEVICEID
    let payload_str = format!("RM-{}-{}", args.year, args.device_id.to_uppercase());
    let payload_bytes = payload_str.as_bytes();

    // 3. Sign
    let signature: Signature = signing_key.sign(payload_bytes);
    let signature_bytes = signature.to_bytes();

    // 4. Encode (Base32 for readability, no padding)
    // We append the signature to the payload
    let signature_encoded = base32::encode(base32::Alphabet::Crockford, &signature_bytes);
    
    // Final License Key
    let license_key = format!("{}-{}", payload_str, signature_encoded);

    println!("
✅ License Key Generated Successfully!");
    println!("---------------------------------------------------");
    println!("Device ID:  {}", args.device_id.to_uppercase());
    println!("Payload:    {}", payload_str);
    println!("License Key:
{}", license_key);
    println!("---------------------------------------------------");

    println!("
🔑 Public Key (Embed this in src-tauri/src/license.rs):");
    let pub_bytes = verifying_key.to_bytes();
    print!("const PUBLIC_KEY_BYTES: [u8; 32] = [");
    for (i, byte) in pub_bytes.iter().enumerate() {
        if i % 8 == 0 { print!("
    "); }
        print!("0x{:02X}, ", byte);
    }
    println!("
];");

    Ok(())
}

fn get_or_create_keypair() -> Result<SigningKey> {
    if Path::new(PRIVATE_KEY_FILE).exists() {
        println!("📂 Loading existing private key from {}...", PRIVATE_KEY_FILE);
        let pem_content = fs::read_to_string(PRIVATE_KEY_FILE)?;
        let pem = pem::parse(pem_content)?;
        let bytes: [u8; 32] = pem.contents().try_into().map_err(|_| anyhow::anyhow!("Invalid key length"))?;
        Ok(SigningKey::from_bytes(&bytes))
    } else {
        println!("✨ Generating new Ed25519 keypair...");
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        
        // Save Private Key
        let pem = pem::Pem::new("ED25519 PRIVATE KEY", signing_key.to_bytes().to_vec());
        fs::write(PRIVATE_KEY_FILE, pem::encode(&pem))?;
        println!("💾 Saved to {}", PRIVATE_KEY_FILE);

        // Save Public Key (for reference)
        let verifying_key = signing_key.verifying_key();
        let pem_pub = pem::Pem::new("ED25519 PUBLIC KEY", verifying_key.to_bytes().to_vec());
        fs::write(PUBLIC_KEY_FILE, pem::encode(&pem_pub))?;
        
        Ok(signing_key)
    }
}
