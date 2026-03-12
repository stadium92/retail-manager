import { createHash } from 'crypto';

/**
 * License Key Generator for Retail Manager v1.0
 * Format: RM-YYYY-SSSS-HHHH-VVVV
 * 
 * YYYY: Purchase Year
 * SSSS: Random Serial/Salt
 * HHHH: Hardware Hash (provided by user)
 * VVVV: Checksum (Luhn Mod 36 based)
 */

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function calculateLuhnMod36(data: string): string {
    let sum = 0;
    const n = CHARS.length;

    const reversed = data.split('').reverse();
    for (let i = 0; i < reversed.length; i++) {
        let val = CHARS.indexOf(reversed[i]);
        if (val === -1) val = 0;

        if (i % 2 === 0) {
            val *= 2;
            val = Math.floor(val / n) + (val % n);
        }
        sum += val;
    }

    // Following logic in license.rs exactly:
    // let mut hasher = Sha256::new();
    // hasher.update(format!("{}{}", data, sum).as_bytes());
    const hash = createHash('sha256')
        .update(`${data}${sum}`)
        .digest('hex');
    
    return hash.substring(0, 4).toUpperCase();
}

function generateKey(hardwareHash: string, year: string = new Date().getFullYear().toString()) {
    if (hardwareHash.length !== 4) {
        throw new Error("Hardware hash must be exactly 4 characters.");
    }

    // Generate random 4-char SSSS
    const ssss = Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    
    const prefix = `RM-${year}-${ssss}-${hardwareHash.toUpperCase()}`;
    const vvvv = calculateLuhnMod36(prefix);
    
    return `${prefix}-${vvvv}`;
}

// CLI Usage
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log("Usage: npx tsx license-gen.ts <HARDWARE_HASH> [YEAR]");
    console.log("Example: npx tsx license-gen.ts A1B2 2026");
    process.exit(1);
}

const hwHash = args[0];
const year = args[1] || new Date().getFullYear().toString();

try {
    const key = generateKey(hwHash, year);
    console.log("\n========================================");
    console.log("   RETAIL MANAGER ACTIVATION KEY");
    console.log("========================================");
    console.log(`  Device ID:  ${hwHash.toUpperCase()}`);
    console.log(`  Year:       ${year}`);
    console.log(`  Key:        ${key}`);
    console.log("========================================\n");
} catch (error: any) {
    console.error("Error:", error.message);
}
