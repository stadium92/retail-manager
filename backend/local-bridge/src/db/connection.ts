import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { env } from '../env.js';

if (!fs.existsSync(env.dataDir)) {
  fs.mkdirSync(env.dataDir, { recursive: true });
}

const dbPath = path.join(env.dataDir, 'localbridge.sqlite');

// Handle pkg-packaged environment: specify native module location
let options: Database.Options = {};
if ((process as any).pkg) {
    const execDir = path.dirname(process.execPath);
    const resourcePath = path.resolve(execDir, '../Resources/binaries/better_sqlite3.node');
    const adjacentPath = path.join(execDir, 'better_sqlite3.node');

    if (fs.existsSync(resourcePath)) {
        console.log('[DB] Using native module from:', resourcePath);
        options.nativeBinding = resourcePath;
    } else if (fs.existsSync(adjacentPath)) {
        console.log('[DB] Using native module from:', adjacentPath);
        options.nativeBinding = adjacentPath;
    } else {
        console.error('[DB] ERROR: Could not find better_sqlite3.node in:', resourcePath, 'or', adjacentPath);
        // List what's actually in the directories for debugging
        try {
          const macosDir = path.resolve(execDir);
          const resourcesDir = path.resolve(execDir, '../Resources/binaries');
          console.error('[DB] Contents of MacOS dir:', fs.existsSync(macosDir) ? fs.readdirSync(macosDir) : 'DOES NOT EXIST');
          console.error('[DB] Contents of Resources/binaries:', fs.existsSync(resourcesDir) ? fs.readdirSync(resourcesDir) : 'DOES NOT EXIST');
        } catch (e) {
          console.error('[DB] Error listing directories:', e);
        }
    }
}

// This runs at MODULE LOAD time, which in ES modules means it executes before
// any code in index.ts - including the uncaughtException handler and the EPIPE
// guards. So an exception thrown here escapes with no handler installed: node
// prints to stderr and exits 1, and backend-startup.log records nothing at
// all. From the outside that looks exactly like "the backend spawns and
// immediately dies for no reason", which is unfixable without this log line.
//
// Real causes seen in the wild: a corrupted SQLite file (power loss during a
// write), the file locked by an orphaned backend still holding it, a stale
// .sqlite-wal/.sqlite-shm pair from an unclean shutdown, or the native
// better_sqlite3 binding missing/quarantined. All of them fail identically on
// every relaunch, so the app never recovers on its own.
const emergencyLog = (msg: string) => {
  try {
    const dir = path.join(process.env.LOCALAPPDATA || '', 'retail-manager-logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'backend-startup.log'),
      `[${new Date().toISOString()}] ${msg}\n`
    );
  } catch {
    /* logging must never be the thing that takes the process down */
  }
};

let db: Database.Database;
try {
  db = new Database(dbPath, options);
} catch (err) {
  emergencyLog(
    `CRITICAL: could not open the database at ${dbPath}: ${err}\n` +
      `  This happens before any error handling is installed, so the process ` +
      `will exit immediately. Usual causes: the file is corrupt, it is locked ` +
      `by another running copy of the backend, a stale -wal/-shm pair is next ` +
      `to it, or better_sqlite3.node was removed by antivirus.`
  );
  throw err;
}

try {
  db.pragma('journal_mode = WAL');
} catch (err) {
  // WAL can fail where the plain open succeeded - notably on network/OneDrive
  // backed folders, which do not support the shared-memory file WAL needs.
  // Journal mode is a performance choice, not a correctness one, so fall back
  // to the default rather than refusing to start over it.
  emergencyLog(`WARNING: could not enable WAL mode (${err}). Continuing with the default journal mode.`);
}

export const rawDb = db;

export const dbFile = dbPath;
