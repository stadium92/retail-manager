# Electron build configs (macOS + Windows)

## macOS build config used

**Scripts (frontend/package.json):**
- `backend:build`: `cd ../backend/local-bridge && npm run build`
- `backend:rebuild`: `npx electron-rebuild -v 40.0.0 -m ../backend/local-bridge`
- `electron:build`: `npm run backend:build && npm run backend:rebuild && npm run build && electron-builder`

**Electron builder config (frontend/package.json):**
- `build.appId`: `com.retailmanager.app`
- `build.productName`: `Retail Manager`
- `build.directories.output`: `release`
- `build.files`: `dist/**/*`, `electron/**/*`, `node_modules/**/*`, `package.json`
- `build.extraResources`:
  - `../backend/local-bridge/dist` → `local-bridge/dist`
  - `../backend/local-bridge/node_modules` → `local-bridge/node_modules`
  - `../backend/local-bridge/package.json` → `local-bridge/package.json`

**Notes:**
- Electron version: `40.0.0`
- `better-sqlite3` updated to `^12.6.2` (LocalBridge) for Electron 40 compatibility.
- LocalBridge is auto-started by [frontend/electron/main.cjs](frontend/electron/main.cjs).

## Windows .exe build config (equivalent)

**Script (frontend/package.json):**
- `electron:build:win`: `npm run backend:build && npm run backend:rebuild && npm run build && electron-builder --win --x64`

**Electron builder config (frontend/package.json):**
- `build.win.target`: `nsis` (x64 + ia32 listed)
- `build.nsis`: `oneClick=false`, `allowToChangeInstallationDirectory=true`, `createDesktopShortcut=true`, `createStartMenuShortcut=true`, `shortcutName=Retail Manager`
- `build.extraResources`: same as macOS to bundle LocalBridge backend.

**Windows notes:**
- Build on Windows to generate .exe/installer reliably.
- `backend:rebuild` must run on the target OS/arch to rebuild `better-sqlite3`.

