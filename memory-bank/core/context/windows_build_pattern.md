# Windows 32-bit Build Pattern (Tauri + Node.js Sidecar)

## Context
Building a Tauri v2 application with a Node.js backend sidecar for 32-bit Windows (`i686-pc-windows-msvc`) presents specific challenges, particularly with native modules (`better-sqlite3`) and the deprecated `pkg` tool which lacks upstream binaries for this target.

## Successful Workflow

### 1. Sidecar Packaging (Rust Wrapper)
Instead of relying on `pkg` to generate the executable directly (which fails for 32-bit Windows), we use a "Self-Extracting Launcher" pattern.

1.  **Bundle Node.js:** Zip the Node.js 18 32-bit binary (`node.exe`), the compiled backend code (`dist/`), and `node_modules`.
2.  **Embed in Rust:** Use a minimal Rust program (`backend/sidecar-wrapper`) to embed this zip file using `include_bytes!`.
3.  **Runtime Extraction:** On startup, the Rust wrapper extracts the payload to a temp directory and spawns `node.exe` with the entry point script.
4.  **Target:** Compile this wrapper for `i686-pc-windows-msvc`.

### 2. Native Module Compilation
`better-sqlite3` must be compiled for the **exact** Node.js version used in the sidecar (Node 18) and the **exact** architecture (32-bit/ia32).

*   **Command:** `npm rebuild better-sqlite3 --arch=ia32 --target=18.5.0`
*   **Location:** The `.node` file must be placed where the sidecar expects it (handled by the zip bundle) OR as a Tauri resource if loaded externally.

### 3. Tauri Configuration (`tauri.conf.json`)
*   **External Bin:** Point to the Rust wrapper executable.
    ```json
    "externalBin": ["binaries/local-bridge"]
    ```
*   **Resources:** Include the native module if necessary (though the zip method encapsulates it).
    ```json
    "resources": ["binaries/better_sqlite3.node"]
    ```
*   **Icons:** Ensure `icons/icon.ico` exists. Use `npx tauri icon` to generate from a PNG if missing.

### 4. Build Command
Use the specific target flag for 32-bit:
```bash
npx tauri build --target i686-pc-windows-msvc
```

### 5. Troubleshooting Common Errors

*   **`TargetKind::LogDir` Error:** In `src-tauri/src/lib.rs`, `tauri-plugin-log` v2 requires the `file_name` field.
    *   *Fix:* `Target::new(TargetKind::LogDir { file_name: None })`
*   **Missing Icons:** Build fails if `icon.ico` is missing.
    *   *Fix:* `npx tauri icon icons/icon_1024.png`
*   **Database Path:** Windows does not use `.local/share`.
    *   *Fix:* Update `env.ts` to use `APPDATA` or `LOCALAPPDATA` on Windows.

## Artifacts
The build produces:
-   `release/retail-manager_0.1.0_x86_en-US.msi`
-   `release/retail-manager_0.1.0_x86-setup.exe`
