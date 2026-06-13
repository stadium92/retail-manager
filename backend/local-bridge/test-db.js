const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(process.env.HOME, 'Library', 'Application Support', 'Retail Manager', 'LocalBridge', 'database.sqlite');
console.log('DB Path:', dbPath);
try {
  const db = new Database(dbPath, { fileMustExist: true });
  console.log('Tables:');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(tables.map(t => t.name).join(', '));
} catch(e) {
  console.log(e);
}
