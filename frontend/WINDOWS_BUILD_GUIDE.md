# 🪟 Building Windows Executable - Quick Guide

## Option 1: Electron (Recommended - Easiest)

### Step 1: Install Dependencies

```bash
cd Pro/retail-manager/frontend
npm install --save-dev electron electron-builder concurrently wait-on
npm install electron-is-dev
```

### Step 2: Update Vite Config for Electron

Update `vite.config.ts` to set correct base path:

```typescript
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? './' : '/', // Important for Electron
  // ... rest of config
}));
```

### Step 3: Build Windows Executable

```bash
# Build for 64-bit Windows
npm run electron:build:win

# Build for 32-bit Windows (for older systems)
npm run electron:build:win32
```

**Output:** The `.exe` installer will be in `release/` folder.

---

## Option 2: Tauri (Lighter - Better for Low-End Hardware)

Tauri creates **much smaller** executables (10-20MB vs 100MB+ with Electron).

### Setup:

```bash
npm install --save-dev @tauri-apps/cli
npm install @tauri-apps/api
npx tauri init
```

Then build:
```bash
npm run tauri build
```

**Note:** Tauri requires Rust to be installed.

---

## Quick Commands Summary

```bash
# Install Electron dependencies
npm install --save-dev electron electron-builder concurrently wait-on electron-is-dev

# Build Windows executable
npm run electron:build:win

# Test Electron app locally (dev mode)
npm run electron:dev
```

---

## Output Location

After building, find your executable in:
- `release/Retail Manager Setup x.x.x.exe` (Installer)
- `release/win-unpacked/Retail Manager.exe` (Portable version)

---

## For Low-End Hardware (Intel Dual Core + 2.5GB RAM)

**Recommendation:** Use **Tauri** instead of Electron:
- Smaller file size (~15MB vs ~150MB)
- Lower memory usage
- Faster startup
- Better performance on old hardware

But Electron is easier to set up if you need it quickly.
