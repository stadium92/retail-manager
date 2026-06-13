const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'Retail Manager Dubai', 'data', 'localbridge.sqlite');
const db = new Database(dbPath, { fileMustExist: true });

db.pragma('foreign_keys = ON');

const storeId = 'test-debug-store';
try {
  db.prepare(`INSERT OR IGNORE INTO stores (id, owner_id, name, created_at, updated_at) VALUES (?, 'a', 'b', 'c', 'd')`).run(storeId);
} catch(e) {}

const statements = [
  "DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE store_id = ?)",
  "DELETE FROM sales WHERE store_id = ?",
  "DELETE FROM inventory_movements WHERE store_id = ?",
  "DELETE FROM purchase_items WHERE order_id IN (SELECT id FROM purchase_orders WHERE store_id = ?)",
  "DELETE FROM purchase_orders WHERE store_id = ?",
  "DELETE FROM product_batches WHERE store_id = ?",
  "DELETE FROM products WHERE store_id = ?",
  "DELETE FROM product_families WHERE store_id = ?",
  "DELETE FROM clients WHERE store_id = ?",
  "DELETE FROM client_services WHERE store_id = ?",
  "DELETE FROM sync_outbox WHERE store_id = ?",
  "DELETE FROM sync_state WHERE store_id = ?",
  "DELETE FROM pending_mutations WHERE store_id = ?",
  "DELETE FROM deliveries WHERE store_id = ?",
  "DELETE FROM supplier_payments WHERE store_id = ?",
  "DELETE FROM suppliers WHERE store_id = ?",
  "DELETE FROM cash_transactions WHERE store_id = ?",
  "DELETE FROM cash_closings WHERE store_id = ?",
  "DELETE FROM audit_logs WHERE store_id = ?",
  "DELETE FROM replenishment_requests WHERE store_id = ?",
  "DELETE FROM worker_invitations WHERE store_id = ?",
  "DELETE FROM user_roles WHERE store_id = ?",
  "DELETE FROM scheduled_order_items WHERE scheduled_order_id IN (SELECT id FROM scheduled_orders WHERE store_id = ?)",
  "DELETE FROM scheduled_orders WHERE store_id = ?",
  "DELETE FROM tables_layout WHERE store_id = ?"
];

for (const stmt of statements) {
  try {
    db.prepare(stmt).run(storeId);
    console.log("SUCCESS:", stmt);
  } catch(e) {
    console.log("FAILED:", stmt, e.message);
  }
}

try {
  db.prepare("DELETE FROM stores WHERE id = ?").run(storeId);
  console.log("STORE DELETED SUCCESSFULLY!");
} catch(e) {
  console.log("STORE DELETE FAILED:", e.message);
  // Find which tables still have store_id
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  for (const t of tables) {
    try {
      const rows = db.prepare(`SELECT * FROM ${t.name} WHERE store_id = ? LIMIT 1`).all(storeId);
      if (rows.length > 0) {
        console.log(`Table ${t.name} STILL HAS ROWS!`);
      }
    } catch(err) {
      // Table might not have store_id column, ignore
    }
  }
}
