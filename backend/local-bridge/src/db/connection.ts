import fs from 'fs';
import path from 'path';
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

export const rawDb = new Database(dbPath, { ...options, timeout: 5000 });
rawDb.pragma('journal_mode = WAL');
rawDb.pragma('synchronous = NORMAL');
rawDb.pragma('temp_store = MEMORY');
rawDb.pragma('mmap_size = 3000000000');

export const dbFile = dbPath;




