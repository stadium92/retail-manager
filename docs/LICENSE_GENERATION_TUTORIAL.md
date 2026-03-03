# 🔑 Tutorial: Generating License Keys for Retail Manager

This guide explains how to generate secure, hardware-bound activation keys for your clients using the built-in `keygen` tool.

---

## 🛠 Prerequisites
You must run these commands from the project root on your development machine (Mac or VM).

## 🚀 Generation Commands

### 1. Generate a Standard Key (Default Year 2026)
When a client sends you their **Hardware ID** (e.g., `KV7M-9X2P`), run:
```bash
cd tools/keygen
cargo run -- --device-id KV7M-9X2P
```

### 2. Generate a Key for a Specific Year
If you want the license to be marked for a different year:
```bash
cd tools/keygen
cargo run -- --device-id KV7M-9X2P --year 2025
```

---

## 📖 Understanding the Output

When you run the command, you will see an output like this:

### **The License Key (Send this to the client)**
> `RM-2026-KV7M9X2P-4WS6T8...`
*   **RM**: Prefix for Retail Manager.
*   **2026**: The purchase/validity year.
*   **KV7M9X2P**: The Hardware ID (cleaned).
*   **Rest**: The cryptographic signature that proves YOU generated this key.

### **The Public Key (For your Codebase)**
The tool also outputs a `PUBLIC_KEY_BYTES` array.
*   **CRITICAL**: This array must match the one inside `src-tauri/src/license.rs`.
*   If you delete `private_key.pem` and generate a new one, you **must** update the code and rebuild the app, or all old keys will stop working.

---

## 🛡️ Security Best Practices

1.  **Protect `private_key.pem`**: This file is located in `tools/keygen/`. It is your "Master Key." If someone steals it, they can generate their own licenses. Never share it.
2.  **Hardware ID is Case-Insensitive**: The tool automatically converts IDs like `kv7m-9x2p` to `KV7M9X2P`.
3.  **One Key per Machine**: Because the signature includes the Device ID, a key generated for one computer will **never** work on another.

---

## 📁 File Locations
*   **Keygen Tool**: `tools/keygen/src/main.rs`
*   **Private Key**: `tools/keygen/private_key.pem` (Automatically created on first run)
*   **License Logic**: `src-tauri/src/license.rs` (Where the app validates the key)
