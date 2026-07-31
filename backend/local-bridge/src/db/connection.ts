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

// Snapshot the database BEFORE opening it. This app had no backup of any kind:
// the shop's entire trading history lived in exactly one file, with no second
// copy anywhere, so any corruption meant permanent loss and any attempt to fix
// a broken install risked destroying the only copy. Taken pre-open, while no
// connection is held, so the files are quiescent - and all three parts are
// copied together, because with WAL enabled recent transactions live in
// -wal and a lone .sqlite would silently miss them.
//
// This is deliberately a plain file copy rather than SQLite's online backup
// API: it must also work when the database is too damaged to open, which is
// precisely the case where the copy matters most.
const BACKUPS_TO_KEEP = 5;
const backupDir = path.join(env.dataDir, 'backups');

// Snapshot at most this often. The snapshot used to run on EVERY boot, which
// copies the full database + WAL synchronously before the server can start -
// on the cheap eMMC drives these POS terminals ship with, with Windows
// Defender scanning each new copy, that put multiple seconds of dead disk
// I/O in front of every single launch. Machines at a till get restarted many
// times a day; one snapshot per half-day still leaves BACKUPS_TO_KEEP=5 sets
// spanning ~2.5 days of history, which is what the backups exist for.
const SNAPSHOT_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;

const newestSnapshotAgeMs = (): number => {
  try {
    const times = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('localbridge-') && f.endsWith('.sqlite'))
      .map((f) => fs.statSync(path.join(backupDir, f)).mtimeMs);
    if (times.length === 0) return Infinity;
    return Date.now() - Math.max(...times);
  } catch {
    return Infinity; // no backup dir yet, or unreadable - snapshot to be safe
  }
};

const snapshotDatabase = () => {
  if (!fs.existsSync(dbPath)) return; // first ever run, nothing to protect yet
  try {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    if (newestSnapshotAgeMs() < SNAPSHOT_MIN_INTERVAL_MS) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    for (const suffix of ['', '-wal', '-shm']) {
      const src = `${dbPath}${suffix}`;
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backupDir, `localbridge-${stamp}.sqlite${suffix}`));
      }
    }

    // Keep only the newest few sets so this can't grow without bound on a
    // machine that gets restarted many times a day.
    const sets = Array.from(
      new Set(
        fs
          .readdirSync(backupDir)
          .filter((f) => f.startsWith('localbridge-'))
          .map((f) => f.replace(/\.sqlite(-wal|-shm)?$/, ''))
      )
    ).sort();

    for (const stale of sets.slice(0, Math.max(0, sets.length - BACKUPS_TO_KEEP))) {
      for (const suffix of ['', '-wal', '-shm']) {
        try {
          fs.unlinkSync(path.join(backupDir, `${stale}.sqlite${suffix}`));
        } catch {
          /* already gone */
        }
      }
    }
  } catch (err) {
    // A backup that fails must never stop the shop from trading.
    emergencyLog(`WARNING: could not snapshot the database before opening it: ${err}`);
  }
};

snapshotDatabase();

let db: Database.Database;
try {
  db = new Database(dbPath, options);
} catch (err) {
  emergencyLog(
    `CRITICAL: could not open the database at ${dbPath}: ${err}\n` +
      `  This happens before any error handling is installed, so the process ` +
      `will exit immediately. Usual causes: the file is corrupt, it is locked ` +
      `by another running copy of the backend, a stale -wal/-shm pair is next ` +
      `to it, or better_sqlite3.node was removed by antivirus.\n` +
      `  The database has NOT been modified or deleted. A copy taken just now ` +
      `is in ${backupDir} - preserve that folder before attempting any repair.`
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
