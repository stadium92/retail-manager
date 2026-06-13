const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'Retail Manager Dubai', 'data', 'localbridge.sqlite');
console.log('DB Path:', dbPath);
try {
  const db = new Database(dbPath, { fileMustExist: true });
  db.pragma('foreign_keys = ON');
  
  // Create a dummy store
  const storeId = 'test-store-delete';
  db.prepare(`INSERT INTO stores (id, owner_id, name, created_at, updated_at) VALUES (?, 'a', 'b', 'c', 'd')`).run(storeId);
  
  console.log('Testing delete transaction...');
  db.transaction(() => {
      // 1. Delete items that belong to records in the store
      db.prepare('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE store_id = ?)').run(storeId);
      db.prepare('DELETE FROM purchase_items WHERE order_id IN (SELECT id FROM purchase_orders WHERE store_id = ?)').run(storeId);
      
      // 2. Delete all records with store_id
      db.prepare('DELETE FROM sync_outbox WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM sync_state WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM pending_mutations WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM sales WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM deliveries WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM supplier_payments WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM purchase_orders WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM inventory_movements WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM cash_transactions WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM cash_closings WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM audit_logs WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM clients WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM client_services WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM suppliers WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM product_batches WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM replenishment_requests WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM products WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM product_families WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM worker_invitations WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM user_roles WHERE store_id = ?').run(storeId);
      
      // 3. Finally, delete the store itself
      db.prepare('DELETE FROM stores WHERE id = ?').run(storeId);
  })();
  console.log('Delete successful!');
} catch(e) {
  console.error('Delete failed:', e.message);
}
