const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'Retail Manager Dubai', 'data', 'localbridge.sqlite');
const db = new Database(dbPath, { fileMustExist: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
for (const table of tables) {
  const fks = db.pragma(`foreign_key_list(${table.name})`);
  for (const fk of fks) {
    if (fk.table === 'stores') {
      console.log(`${table.name} references stores on column ${fk.from}`);
    }
  }
}
