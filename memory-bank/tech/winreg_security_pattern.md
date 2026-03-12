# 🛡️ Windows Registry Security Pattern (Anti-Tamper)

## Objective
To prevent users from bypassing the 30-day trial or license expiration by deleting local files (AppData) or clearing browser storage (IndexedDB).

## 1. Mechanism: Registry Mirroring
The application uses the `winreg` Rust crate to mirror critical security timestamps in the Windows Registry.

### Key Data Points:
-   **IDT (Install Date Time):** The timestamp when the application was first launched.
-   **LKT (Last Known Time):** The absolute latest timestamp (system time or backend bridge time) the application has ever seen.

### Location:
`HKEY_CURRENT_USER\Software\RetailManager\License`

## 2. Protection Logic (DeLorean Check)
During the license status check (`get_license_status_command`), the application performs a dual-source verification:

1.  **Reconciliation:** It reads the LKT/IDT from both the local binary file (`last_run.bin`, `app_installed_date.json`) and the Windows Registry.
2.  **Oldest wins for IDT:** If the Registry shows an older install date than the file, the Registry date is used. This prevents users from deleting the install date file to "restart" their 30-day trial.
3.  **Newest wins for LKT:** The application tracks the "future-most" time it has ever seen. If the system clock is set to a time *before* this LKT, a `clock_error` is triggered, blocking access.
4.  **Automatic Restoration:** If one source is missing (e.g., file deleted but Registry exists), the application automatically restores the missing data from the surviving source.

## 3. Implementation Details
-   **Crate:** `winreg` (v0.52)
-   **Scope:** `HKEY_CURRENT_USER` (Requires no Admin privileges, but is persistent across app uninstalls).
-   **Conditional Compilation:** The logic is wrapped in `#[cfg(windows)]` to ensure the app remains cross-platform (Mac build will ignore Registry logic).

## 4. Security Posture
By combining **Hardware Binding**, **Encrypted Local Storage**, and **Registry Mirroring**, the application effectively blocks:
-   USB Copying (Piracy)
-   AppData deletion (Trial Reset)
-   Clock Rollback (Expiration Bypass)
