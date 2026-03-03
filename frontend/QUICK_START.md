# 🚀 Quick Start - Build Windows Executable

## One-Command Setup & Build

```bash
# Install all dependencies
npm install --save-dev electron electron-builder concurrently wait-on electron-is-dev

# Build Windows executable
npm run electron:build:win
```

That's it! The `.exe` file will be in the `release/` folder.

---

## Step-by-Step

### 1. Install Dependencies
```bash
npm install --save-dev electron electron-builder concurrently wait-on electron-is-dev
```

### 2. Build React App + Create Executable
```bash
npm run electron:build:win
```

### 3. Find Your Executable
- **Installer:** `release/Retail Manager Setup 1.0.0.exe`
- **Portable:** `release/win-unpacked/Retail Manager.exe`

---

## Test Locally (Before Building)

```bash
# Start dev server + Electron
npm run electron:dev
```

---

## For 32-bit Windows (Older Computers)

```bash
npm run electron:build:win32
```

---

## Troubleshooting

**Issue:** "Cannot find module 'electron'"
- Run: `npm install --save-dev electron`

**Issue:** Build fails
- Make sure you've run `npm install` first
- Check that `dist/` folder exists after `npm run build`

**Issue:** App doesn't load
- Check `vite.config.ts` has `base: './'` for production
- Verify `electron/main.cjs` path is correct

---

## File Structure

```
frontend/
├── electron/
│   └── main.cjs          # Electron main process
├── dist/                 # Built React app (created by vite build)
├── release/              # Windows executable (created by electron-builder)
└── package.json          # Updated with Electron scripts
```
