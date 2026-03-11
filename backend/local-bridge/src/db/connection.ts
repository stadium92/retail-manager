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
const adjacentPath = path.join(execDir, 'better_sqlite3.node');
const localModulePath = path.join(process.cwd(), 'node_modules/better-sqlite3/build/Release/better_sqlite3.node');

if (fs.existsSync(adjacentPath)) {
    console.log('[DB] Using native module from packaged path:', adjacentPath);
    options.nativeBinding = adjacentPath;
} else if (!fs.existsSync(localModulePath)) {
    // If we're not in dev and adjacent doesn't exist, we might be in a weird prod setup
    const nodeModulesPath = path.resolve(execDir, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node');
    if (fs.existsSync(nodeModulesPath)) {
        console.log('[DB] Using native module from Node path:', nodeModulesPath);
        options.nativeBinding = nodeModulesPath;
    }
}

export const rawDb = new Database(dbPath, { ...options, timeout: 5000 });
rawDb.pragma('journal_mode = DELETE');

export const dbFile = dbPath;




