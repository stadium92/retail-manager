import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { env } from '../env.js';

if (!fs.existsSync(env.dataDir)) {
  fs.mkdirSync(env.dataDir, { recursive: true });
}

const dbPath = path.join(env.dataDir, 'localbridge.sqlite');

// Handle packaged environment: specify native module location
let options: Database.Options = {};
const execDir = path.dirname(process.execPath);

const possiblePaths = [
    path.join(execDir, 'better_sqlite3.node'), // Adjacent
    path.join(execDir, 'binaries', 'better_sqlite3.node'), // Windows/Linux Tauri subfolder
    path.resolve(execDir, '../Resources/binaries/better_sqlite3.node'), // macOS Tauri bundle
    path.resolve(execDir, '../Resources/better_sqlite3.node'), // macOS Tauri bundle alt
    path.join(process.cwd(), 'node_modules/better-sqlite3/build/Release/better_sqlite3.node'), // Dev
    path.resolve(execDir, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node') // Alt Dev
];

for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        console.log('[DB] Using native module from:', p);
        options.nativeBinding = p;
        break;
    }
}

// Automatically migrate legacy database if the new one doesn't exist
if (!fs.existsSync(dbPath)) {
  const osPlatform = process.platform;
  const legacyNames = osPlatform === 'darwin'
    ? ['Retail Manager', 'Retail Manager Dibidani']
    : ['retail-manager', 'retail-manager-dibidani'];

  let foundLegacyDb = '';

  for (const name of legacyNames) {
    let legacyDir = '';
    if (osPlatform === 'win32') {
      legacyDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), name, 'data');
    } else if (osPlatform === 'darwin') {
      legacyDir = path.join(os.homedir(), 'Library', 'Application Support', name, 'data');
    } else {
      legacyDir = path.join(os.homedir(), '.local', 'share', name, 'data');
    }

    const legacyPath = path.join(legacyDir, 'localbridge.sqlite');
    if (fs.existsSync(legacyPath)) {
      foundLegacyDb = legacyPath;
      break;
    }
  }

  if (foundLegacyDb) {
    try {
      console.log(`[DB Migration] Legacy database found at ${foundLegacyDb}. Copying to ${dbPath} to preserve old credentials/data...`);
      fs.copyFileSync(foundLegacyDb, dbPath);
      console.log('[DB Migration] Database successfully migrated.');
    } catch (err) {
      console.error('[DB Migration] Failed to copy legacy database:', err);
    }
  }
}

export const rawDb = new Database(dbPath, { ...options, timeout: 5000 });
rawDb.pragma('journal_mode = WAL');
rawDb.pragma('synchronous = NORMAL');
rawDb.pragma('temp_store = MEMORY');
rawDb.pragma('mmap_size = 3000000000');

export const dbFile = dbPath;





