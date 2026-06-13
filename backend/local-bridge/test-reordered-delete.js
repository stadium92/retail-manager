const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const dbPath = path.join(os.homedir(), 'Library', 'Application Support', 'Retail Manager Dubai', 'data', 'localbridge.sqlite');
console.log('DB Path:', dbPath);
try {
  const db = new Database(dbPath, { fileMustExist: true });
  db.pragma('foreign_keys = ON');
  
  const storeId = 'test-store-reordered';
  db.prepare(`INSERT OR IGNORE INTO stores (id, owner_id, name, created_at, updated_at) VALUES (?, 'a', 'b', 'c', 'd')`).run(storeId);
  
  console.log('Testing reordered delete transaction...');
  db.transaction(() => {
      // 1. Children of sales & product_batches
      db.prepare(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE store_id = ?)`).run(storeId);
      db.prepare('DELETE FROM sales WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM inventory_movements WHERE store_id = ?').run(storeId);
      
      // 2. Children of purchase_orders & suppliers
      db.prepare(`DELETE FROM purchase_items WHERE order_id IN (SELECT id FROM purchase_orders WHERE store_id = ?)`).run(storeId);
      db.prepare('DELETE FROM purchase_orders WHERE store_id = ?').run(storeId);
      
      // 3. Batches (references products, suppliers, purchase_orders)
      db.prepare('DELETE FROM product_batches WHERE store_id = ?').run(storeId);
      
      // 4. Products & Families
      db.prepare('DELETE FROM products WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM product_families WHERE store_id = ?').run(storeId);
      
      // 5. Clients & Services
      db.prepare('DELETE FROM clients WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM client_services WHERE store_id = ?').run(storeId);
      
      // 6. Independent / loosely coupled
      db.prepare('DELETE FROM sync_outbox WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM sync_state WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM pending_mutations WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM deliveries WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM supplier_payments WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM suppliers WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM cash_transactions WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM cash_closings WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM audit_logs WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM replenishment_requests WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM worker_invitations WHERE store_id = ?').run(storeId);
      db.prepare('DELETE FROM user_roles WHERE store_id = ?').run(storeId);
      
      // Only for restaurant
      try {
        db.prepare(`DELETE FROM scheduled_order_items WHERE scheduled_order_id IN (SELECT id FROM scheduled_orders WHERE store_id = ?)`).run(storeId);
        db.prepare('DELETE FROM scheduled_orders WHERE store_id = ?').run(storeId);
        db.prepare('DELETE FROM tables_layout WHERE store_id = ?').run(storeId);
      } catch(e) {}
      
      // 7. Store itself
      db.prepare('DELETE FROM stores WHERE id = ?').run(storeId);
  })();
  console.log('Delete successful!');
} catch(e) {
  console.error('Delete failed:', e.message);
}
