# Offline Patch System Documentation

## Overview

This system allows you to create and distribute offline patches to clients without requiring internet connectivity. Clients can install patches by simply selecting a `.zip` file and clicking a button.

## Architecture

### Components

1. **Backend (Rust/Tauri)**
   - `src-tauri/src/patch.rs` - Patch installation logic
   - Handles file extraction, verification, and installation
   - Uses SHA256 checksums for integrity verification

2. **Frontend (React)**
   - `frontend/src/components/shared/PatchInstaller.tsx` - Patch installer UI
   - `frontend/src/components/shared/SettingsPage.tsx` - Settings page with tabs
   - Cinematic progress UI with status updates

3. **Build Tools**
   - `create-patch.sh` - Automated patch creation script
   - Generates `.zip` files with manifest and checksums

## Workflow

### For You (Developer)

#### Step 1: Make Code Changes
```bash
# Make your changes to frontend and backend
# Update version in:
# - frontend/package.json
# - src-tauri/tauri.conf.json
```

#### Step 2: Create Patch
```bash
cd /Users/mohamedcoulibaly/MVP/Pro/retail-manager
./create-patch.sh 1.0.1
```

This creates:
- `patch-v1.0.1.zip` - Ready to distribute
- Contains frontend build + backend binary + manifest with checksums

#### Step 3: Send to Client
- Email or USB drive the `.zip` file
- Include a note: "Open the app → Settings → Updates & Patches → Browse Files"

### For Your Client

#### Step 1: Receive Patch
- Get `patch-v1.0.1.zip` from you
- Save to their desktop or downloads

#### Step 2: Install Patch
1. Open Retail Manager app
2. Go to **Settings** tab (bottom menu or settings button)
3. Click **Updates & Patches**
4. Click **Browse Files...**
5. Select `patch-v1.0.1.zip`
6. Wait for installation (shows progress bar)
7. App automatically restarts

#### Step 3: Done!
- App restarts with new version
- All new features available

## Patch File Structure

```
patch-v1.0.1.zip
├── manifest.json         (metadata + checksums)
├── frontend/
│   ├── index.html
│   ├── assets/
│   │   ├── js/
│   │   ├── css/
│   │   └── ...
│   └── ...
└── backend/
    └── local-bridge      (new sidecar binary)
```

### manifest.json
```json
{
  "version": "1.0.1",
  "date": "2026-02-02T00:00:00Z",
  "checksums": {
    "manifest.json": "abc123...",
    "frontend": "def456...",
    "backend/local-bridge": "ghi789..."
  }
}
```

## How It Works (Technical)

### 1. User Selects Patch File
- File dialog opens
- User picks `patch-v1.0.1.zip`

### 2. App Verifies Integrity
- Extracts to temp directory
- Reads `manifest.json`
- Calculates checksums of all files
- Compares with manifest checksums
- **If mismatch → Installation fails with error**

### 3. Installation
- Extracts `frontend/` → `~/.app-data/frontend/`
- Extracts `backend/local-bridge` → `~/.app-data/backend/`

### 4. Auto-Restart
- App automatically restarts
- Loads new frontend/backend code
- Shows success screen

## API Reference

### Tauri Commands

#### `install_patch`
```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke('install_patch', {
  patchPath: '/Users/xyz/patch-v1.0.1.zip'
});
```

**Response:** `"Patch 1.0.1 installed successfully"`

**Errors:**
- "Patch file not found"
- "Invalid manifest"
- "Checksum mismatch for {file}"
- "Failed to get app data dir"

#### `get_app_version`
```typescript
const version = await invoke('get_app_version');
// Returns: "1.0.0"
```

## Security

### Checksums
- All files are hashed with SHA256
- Prevents corruption during transfer
- Prevents tampering with patch files
- Manifest itself is also checksummed

### Code Signing (Optional)
For production, you can sign patches:
```bash
# Sign the patch zip
codesign -s - patch-v1.0.1.zip

# Verify signature
codesign -v patch-v1.0.1.zip
```

## Troubleshooting

### "Checksum mismatch"
- **Cause:** File was corrupted during transfer
- **Solution:** Re-download the patch from a reliable source

### "Patch file not found"
- **Cause:** Wrong file path or file deleted
- **Solution:** Select the patch file again

### "Installation failed - invalid manifest"
- **Cause:** `.zip` file is corrupted or not a valid patch
- **Solution:** Recreate the patch using `./create-patch.sh`

### App doesn't restart after installation
- **Cause:** Rare error, app may have crashed
- **Solution:** Manually restart the app

## Examples

### Creating Your First Patch
```bash
cd /Users/mohamedcoulibaly/MVP/Pro/retail-manager

# Make changes, then create v1.0.1
./create-patch.sh 1.0.1

# Output:
# === Creating Patch v1.0.1 ===
# ✓ Patch File: patch-v1.0.1.zip
# ✓ Patch Size: 45.2MB
# ✓ Checksum: abc123def456...
```

### Distributing Multiple Patches
```bash
# Create several patches in sequence
./create-patch.sh 1.0.1
./create-patch.sh 1.0.2
./create-patch.sh 1.1.0

# Send clients the latest one:
# patch-v1.1.0.zip

# Or maintain a folder for downloads:
mkdir -p releases/
mv patch-v*.zip releases/
```

## Best Practices

1. **Always bump version** before creating a patch
2. **Test locally** with `npm run dev` first
3. **Build both** frontend and backend before patching
4. **Generate changelog** to include with patch
5. **Keep patch files** for auditing who has which version
6. **Document** what changed in each patch

## Version Numbers

Use semantic versioning:
- `1.0.0` - Major release
- `1.0.1` - Bug fix (patch)
- `1.1.0` - New feature (minor)
- `2.0.0` - Breaking changes (major)

## Future Enhancements

Planned features:
- [ ] Delta patches (only changed files)
- [ ] Automatic patch checks on startup
- [ ] Patch rollback capability
- [ ] Patch history and version list
- [ ] Compression (currently 1:1 copy)
- [ ] Parallel installation of multiple patches
