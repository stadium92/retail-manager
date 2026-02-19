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

export const rawDb = new Database(dbPath, options);
rawDb.pragma('journal_mode = WAL');

export const dbFile = dbPath;
