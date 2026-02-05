# PRD: Electron Removal & Codebase Cleanup

## 1. Overview
The **Retail Manager** project has successfully migrated to **Tauri v2** with a Node.js sidecar. The legacy **Electron** infrastructure is now obsolete technical debt. This PRD outlines the safe removal of Electron dependencies, configuration, and documentation to reduce repository size and complexity.

## 2. Scope of Cleanup

### A. Dependency Removal (`package.json`)
The following packages must be uninstalled:
- `electron`
- `electron-builder`
- `electron-is-dev`
- `@electron/rebuild`

### B. File & Directory Deletion
- **Directory**: `frontend/electron/` (Contains old main process logic).
- **Documentation**: 
    - `frontend/ELECTRON_SETUP.md`
    - `frontend/WINDOWS_BUILD_GUIDE.md` (If specifically for Electron NSIS).
- **Configuration**:
    - Remove the `build` section from `frontend/package.json` (Electron Builder config).
    - Remove `main: "electron/main.cjs"` from `frontend/package.json`.

### C. Source Code Sanitation
- Validated: `frontend/src` does **not** contain references to `ipcRenderer` or `window.require`.
- `dataClient.ts` uses HTTP/REST to talk to `LocalBridge`, so it is **framework agnostic** (Safe).

## 3. Risk Assessment
- **Risk**: Breaking the build scripts if they reference `electron-builder`.
- **Mitigation**: Update `frontend/package.json` scripts to remove `build:electron` or similar if they exist. (Checked: `backend:build` targets local-bridge, standard `build` targets Vite).
- **Conflict Check**: The user requested "if there is a conflict, leave it."
    - **Finding**: No conflict found. The `src` code is clean. The `LocalBridge` is a standalone Node app. The `Tauri` app is initialized. Electron is pure dead code.

## 4. Execution Plan
1.  **Uninstall** dependencies.
2.  **Delete** the `electron` directory.
3.  **Clean** `package.json` scripts and config.
4.  **Verify** the application still builds with `npm run build` (Vite) and `npm run tauri build`.
