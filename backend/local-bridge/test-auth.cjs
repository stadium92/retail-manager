const Database = require('./node_modules/better-sqlite3');
const path = require('path');
const bcrypt = require('./node_modules/bcryptjs');

const dbPath = path.resolve('./localbridge.sqlite');
console.log('Database path:', dbPath);
try {
  const db = new Database(dbPath);
  const users = db.prepare('SELECT id, email, password_hash, role FROM users').all();
  console.log('\n=== USERS IN DATABASE ===');
  users.forEach(u => {
    console.log(`  Email: ${u.email}`);
    console.log(`  Role: ${u.role}`);
    console.log(`  Hash prefix: ${u.password_hash ? u.password_hash.substring(0, 10) : 'NULL'}`);
    // Test password
    const testPass = '12345678@';
    const normalized = u.password_hash && u.password_hash.startsWith('$2b$') 
      ? u.password_hash.replace('$2b$', '$2a$') 
      : u.password_hash;
    const ok = normalized ? bcrypt.compareSync(testPass, normalized) : false;
    console.log(`  Password '12345678@' match: ${ok}`);
    console.log('---');
  });

  const roles = db.prepare('SELECT * FROM user_roles').all();
  console.log('\n=== USER ROLES ===');
  roles.forEach(r => console.log(r));

  const stores = db.prepare('SELECT id, name, owner_id FROM stores').all();
  console.log('\n=== STORES ===');
  stores.forEach(s => console.log(s));
  
} catch (e) {
  console.error('Error reading database:', e.message);
}
