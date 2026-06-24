const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const paths = [
  path.join(__dirname, '..', '..', 'backend', 'local-bridge', 'localbridge.sqlite'),
  path.join(os.homedir(), 'Library', 'Application Support', 'Retail Manager', 'LocalBridge', 'database.sqlite')
];

for (const dbPath of paths) {
  console.log(`Checking DB at: ${dbPath}`);
  try {
    const db = new Database(dbPath, { fileMustExist: true });
    
    // Check if users table exists
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!tableCheck) {
      console.log('No "users" table found in this DB.');
      continue;
    }
    
    const users = db.prepare("SELECT id, email, full_name FROM users").all();
    console.log(`Found ${users.length} users:`);
    for (const u of users) {
      // Get roles
      const roles = db.prepare("SELECT role, store_id FROM user_roles WHERE user_id = ?").all(u.id);
      console.log(`- ${u.email} (Name: ${u.full_name}, ID: ${u.id})`);
      for (const r of roles) {
        console.log(`  * Role: ${r.role}, Store ID: ${r.store_id}`);
      }
    }
  } catch (e) {
    console.log(`Could not read DB: ${e.message}`);
  }
}
