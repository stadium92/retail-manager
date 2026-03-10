import Database from 'better-sqlite3';

const DB_PATH = process.platform === 'darwin' 
    ? `/Users/${process.env.USER}/Library/Application Support/Retail Manager/data/localbridge.sqlite`
    : `${process.env.APPDATA}/Retail Manager/data/localbridge.sqlite`;

const db = new Database(DB_PATH);

console.log('--- STARTING AGGRESSIVE SYSTEM RESET ---');
db.exec('PRAGMA foreign_keys = OFF');

// Essential tables to PRESERVE
const PROTECTED_TABLES = ['users', 'user_roles', 'stores', 'sessions', 'sqlite_sequence'];

// Get all tables currently in the DB
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);

db.transaction(() => {
    for (const table of tables) {
        // Skip virtual tables (FTS5) and protected tables
        if (table.startsWith('products_fts') || PROTECTED_TABLES.includes(table)) {
            console.log(`- Preserved: ${table}`);
            continue;
        }

        try {
            db.prepare(`DELETE FROM ${table}`).run();
            console.log(`- Wiped: ${table}`);
        } catch (e) {
            console.log(`- Error wiping ${table}: ${e.message}`);
        }
    }

    // Force rebuild of search index to clear results
    try {
        db.prepare("INSERT INTO products_fts(products_fts) VALUES('rebuild')").run();
        console.log('- Rebuilt: products_fts index (Empty)');
    } catch (e) {}
})();

db.exec('PRAGMA foreign_keys = ON');
console.log('--- SYSTEM RESET COMPLETE ---');
console.log('Credential accounts are preserved. All business data is gone.');
db.close();
