# 📜 PRD-011: Offline Activation Key System

## Objective
Implement a secure, offline-first licensing system for Retail Manager to enable a 30-day trial and manage purchases for small retail stores in Mali.

## 1. Key Format & Validation
- **Format:** `RM-YYYY-SSSS-HHHH-VVVV`
- **Validation:** 
  - `HHHH` must match the local device's primary hardware hash.
  - `VVVV` must satisfy the Luhn-mod-36 checksum of the preceding parts.
  - No internet connection required for validation.

## 2. User Lifecycle & "Nag" Logic
- **Trial (Day 1-30):** Full access, no prompts. Optional banner showing days remaining.
- **Expired (Day 31+):**
  - Show **Activation Required** dialog on every application launch.
  - Allow user to click "Continue Without Key" to load the app.
  - **App is NEVER blocked**, but the dialog repeats on every launch until activated.
- **Active:** Dialog never shows again. Store limit (max 2) enforced.

## 3. Security Requirements
- **Encryption:** License data must be stored in `license.enc` using AES-256 or similar.
- **Anti-Tamper:** Store `last_run_date`. If current system date is older than `last_run_date`, flag as potential trial tampering.
- **Hardware Binding:** Key is unique to the device MAC/CPU hash.

## 4. Technical Commands (Tauri/Rust)
- `validate_license(key)`
- `activate_license(key, store_name)`
- `get_license_status()` -> `{ status, daysRemaining, stores }`
- `get_device_hash()`

## 5. Acceptance Criteria
- [ ] 30-day trial works without internet.
- [ ] Activation dialog appears after Day 30 on every launch.
- [ ] Key is rejected if hardware hash doesn't match.
- [ ] Maximum 2 stores per activation key.
- [ ] License persists across app restarts and updates.
