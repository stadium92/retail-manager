import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { env } from '../env.js';

if (!fs.existsSync(env.dataDir)) {
  fs.mkdirSync(env.dataDir, { recursive: true });
}

const dbPath = path.join(env.dataDir, 'localbridge.sqlite');
console.log('[DB] Target database path:', dbPath);

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

// Automatically migrate legacy database if the new one doesn't exist or is empty
let isEmptyDb = false;
if (fs.existsSync(dbPath)) {
  try {
    const tempDb = new Database(dbPath, options);
    const tableExists = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!tableExists) {
      isEmptyDb = true;
      console.log('[DB] Existing DB has no users table - treating as empty');
    } else {
      const userCount = tempDb.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
      if (!userCount || userCount.count === 0) {
        isEmptyDb = true;
        console.log('[DB] Existing DB has 0 users - treating as empty for migration');
      } else {
        console.log(`[DB] Existing DB has ${userCount.count} users - no migration needed`);
      }
    }
    tempDb.close();
  } catch (e) {
    isEmptyDb = true;
    console.log('[DB] Could not open existing DB - treating as empty:', e);
  }
} else {
  console.log('[DB] No database found at target path - will search for legacy DB to migrate');
}

if (!fs.existsSync(dbPath) || isEmptyDb) {
  const osPlatform = process.platform;
  // Determine current app name from dataDir to prioritize its legacy path
  const appDirName = path.basename(path.dirname(env.dataDir));
  console.log('[DB Migration] App dir name (from DATA_DIR):', appDirName);
  
  // Format standard variations of the app name for search
  const nameVariants: string[] = [];
  if (appDirName) {
    nameVariants.push(appDirName);
    // If it has spaces/hyphens, handle clean capitalization: e.g. "retail-manager-dibidani" -> "Retail Manager Dibidani"
    const cleaned = appDirName
      .replace(/-/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    nameVariants.push(cleaned);
  }
  
  // On Windows: prioritize com.retailmanager.dibidani first (Tauri v2 standard location)
  const defaultLegacy = osPlatform === 'darwin'
    ? ['com.retailmanager.dibidani', 'com.retailmanager.app', 'Retail Manager Dibidani', 'Retail Manager', 'Retail Manager Stihl']
    : ['com.retailmanager.dibidani', 'com.retailmanager.app', 'retail-manager-dibidani', 'retail-manager', 'retail-manager-stihl'];

  // Prioritize active app name variants, then check defaults
  const legacyNames = Array.from(new Set([...nameVariants, ...defaultLegacy]));
  console.log('[DB Migration] Search order:', legacyNames);

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
    console.log('[DB Migration] Checking:', legacyPath);
    if (fs.existsSync(legacyPath) && legacyPath !== dbPath) {
      // Open legacy database to verify if it actually has users
      try {
        const tempDb = new Database(legacyPath, options);
        const tableExists = tempDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
        if (tableExists) {
          const userCount = tempDb.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
          if (userCount && userCount.count > 0) {
            console.log(`[DB Migration] Found valid legacy DB with ${userCount.count} users at: ${legacyPath}`);
            tempDb.close();
            foundLegacyDb = legacyPath;
            break;
          }
        }
        tempDb.close();
      } catch (e) {
        // Not a valid DB or no users table, continue
        console.log('[DB Migration] Could not read DB at:', legacyPath, e);
      }
    }
  }

  if (foundLegacyDb) {
    try {
      console.log(`[DB Migration] Copying legacy DB from ${foundLegacyDb} -> ${dbPath}`);
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
      }
      fs.copyFileSync(foundLegacyDb, dbPath);
      console.log('[DB Migration] Database successfully migrated.');
    } catch (err) {
      console.error('[DB Migration] Failed to copy legacy database:', err);
    }
  } else {
    console.log('[DB Migration] No legacy database with users found. Starting fresh.');
  }
}

export const rawDb = new Database(dbPath, { ...options, timeout: 5000 });
rawDb.pragma('journal_mode = WAL');
rawDb.pragma('synchronous = NORMAL');
rawDb.pragma('temp_store = MEMORY');
rawDb.pragma('mmap_size = 3000000000');

// ─── Startup: normalize any $2b$ bcrypt hashes to $2a$ ──────────────────────
// Some external tools (Python passlib, PHP, etc.) generate $2b$ prefix which
// bcryptjs may fail to compare. Normalizing to $2a$ is cryptographically identical.
try {
  const usersTable = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (usersTable) {
    const b2bUsers = rawDb.prepare("SELECT id, email FROM users WHERE password_hash LIKE '$2b$%'").all() as { id: string; email: string }[];
    if (b2bUsers.length > 0) {
      console.log(`[DB] Normalizing ${b2bUsers.length} $2b$ bcrypt hash(es) to $2a$:`, b2bUsers.map(u => u.email));
      const normalizeStmt = rawDb.prepare("UPDATE users SET password_hash = replace(password_hash, '$2b$', '$2a$') WHERE id = ?");
      const normalizeAll = rawDb.transaction((users: { id: string }[]) => {
        for (const user of users) normalizeStmt.run(user.id);
      });
      normalizeAll(b2bUsers);
      console.log('[DB] Hash normalization complete.');
    } else {
      console.log('[DB] No $2b$ hashes found - hash format is clean.');
    }
  }
} catch (e) {
  console.error('[DB] Failed to normalize hashes (non-fatal):', e);
}

export const dbFile = dbPath;
