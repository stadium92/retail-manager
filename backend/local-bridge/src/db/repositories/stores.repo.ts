import Database from 'better-sqlite3';
import { LocalStore } from '../types.js';
import { emitOutbox } from './sync_helpers.js';

export const createStoresRepo = (db: Database.Database) => ({
  getStoreById(storeId: string): LocalStore | undefined {
    const row = db.prepare('SELECT * FROM stores WHERE id = ? LIMIT 1').get(storeId);
    return row as LocalStore | undefined;
  },

  getStoreByName(name: string): LocalStore | undefined {
    const row = db.prepare('SELECT * FROM stores WHERE LOWER(name) = LOWER(?) LIMIT 1').get(name);
    return row as LocalStore | undefined;
  },

  listStores(ownerId?: string): LocalStore[] {
    if (ownerId) {
      // Since listStoresByOwner is inside the object returned, we can't call this.listStoresByOwner easily.
      // Just duplicate logic or use internal helper if needed. But logic is simple.
      const rows = db.prepare('SELECT * FROM stores WHERE owner_id = ? ORDER BY name ASC').all(ownerId);
      return rows as LocalStore[];
    }
    const rows = db.prepare('SELECT * FROM stores ORDER BY name ASC').all();
    return rows as LocalStore[];
  },

  listStoresByOwner(ownerId: string): LocalStore[] {
    const rows = db.prepare('SELECT * FROM stores WHERE owner_id = ? ORDER BY name ASC').all(ownerId);
    return rows as LocalStore[];
  },

  insertStore(store: LocalStore) {
    db.prepare(
      `
      INSERT OR REPLACE INTO stores (
        id,
        name,
        address,
        phone,
        owner_id,
        default_price_tier,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @name,
        @address,
        @phone,
        @owner_id,
        @default_price_tier,
        @created_at,
        @updated_at
      )
    `
    ).run({
      ...store,
      address: store.address ?? null,
      phone: store.phone ?? null,
      owner_id: store.owner_id ?? null,
      default_price_tier: store.default_price_tier ?? 1,
    });
    
    emitOutbox(db, store.id, 'store', store.id, 'create', store as unknown as Record<string, unknown>);
  },

  updateStore(
    storeId: string,
    updates: Partial<Omit<LocalStore, 'id' | 'created_at'>>
  ): LocalStore | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      // Need to re-implement getStoreById logic here or just call db
      const row = db.prepare('SELECT * FROM stores WHERE id = ? LIMIT 1').get(storeId);
      return row as LocalStore | undefined;
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE stores SET ${assignments} WHERE id = @id`).run({
      id: storeId,
      ...Object.fromEntries(normalizedEntries),
    });
    
    const row = db.prepare('SELECT * FROM stores WHERE id = ? LIMIT 1').get(storeId);
    if (row) {
      emitOutbox(db, storeId, 'store', storeId, 'update', row as unknown as Record<string, unknown>);
    }
    return row as LocalStore | undefined;
  },

  deleteStore(storeId: string) {
    const fs = require('fs');
    const path = require('path');
    const { env } = require('../../env.js');
    const errorLog = path.join(env.dataDir, 'delete-error.log');
    
    try {
      const deleteTx = db.transaction(() => {
        const step = (name: string, sql: string) => {
          try {
            db.prepare(sql).run(storeId);
          } catch (e: any) {
            throw new Error(`Failed at ${name}: ${e.message}`);
          }
        };

        step('sale_items', `DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE store_id = ?)`);
        step('sales', 'DELETE FROM sales WHERE store_id = ?');
        step('inventory_movements', 'DELETE FROM inventory_movements WHERE store_id = ?');
        
        step('purchase_items', `DELETE FROM purchase_items WHERE order_id IN (SELECT id FROM purchase_orders WHERE store_id = ?)`);
        step('purchase_orders', 'DELETE FROM purchase_orders WHERE store_id = ?');
        
        step('product_batches', 'DELETE FROM product_batches WHERE store_id = ?');
        
        step('products', 'DELETE FROM products WHERE store_id = ?');
        step('product_families', 'DELETE FROM product_families WHERE store_id = ?');
        
        step('clients', 'DELETE FROM clients WHERE store_id = ?');
        step('client_services', 'DELETE FROM client_services WHERE store_id = ?');
        
        step('sync_outbox', 'DELETE FROM sync_outbox WHERE store_id = ?');
        step('sync_state', 'DELETE FROM sync_state WHERE store_id = ?');
        step('pending_mutations', 'DELETE FROM pending_mutations WHERE store_id = ?');
        step('deliveries', 'DELETE FROM deliveries WHERE store_id = ?');
        step('supplier_payments', 'DELETE FROM supplier_payments WHERE store_id = ?');
        step('suppliers', 'DELETE FROM suppliers WHERE store_id = ?');
        step('cash_transactions', 'DELETE FROM cash_transactions WHERE store_id = ?');
        step('cash_closings', 'DELETE FROM cash_closings WHERE store_id = ?');
        step('audit_logs', 'DELETE FROM audit_logs WHERE store_id = ?');
        step('replenishment_requests', 'DELETE FROM replenishment_requests WHERE store_id = ?');
        step('worker_invitations', 'DELETE FROM worker_invitations WHERE store_id = ?');
        step('user_roles', 'DELETE FROM user_roles WHERE store_id = ?');
        
        try {
          step('scheduled_order_items', `DELETE FROM scheduled_order_items WHERE scheduled_order_id IN (SELECT id FROM scheduled_orders WHERE store_id = ?)`);
          step('scheduled_orders', 'DELETE FROM scheduled_orders WHERE store_id = ?');
          step('tables_layout', 'DELETE FROM tables_layout WHERE store_id = ?');
        } catch (e) {}
        
        emitOutbox(db, storeId, 'store', storeId, 'delete', { id: storeId });
        step('stores', 'DELETE FROM stores WHERE id = ?');
      });
      deleteTx();
      fs.writeFileSync(errorLog, `Success deleting store ${storeId} at ${new Date().toISOString()}\n`, { flag: 'a' });
    } catch (e: any) {
      fs.writeFileSync(errorLog, `Error deleting store ${storeId}: ${e.message}\n`, { flag: 'a' });
      throw e;
    }
  },

  healFragmentedStores() {
    const allStores = this.listStores();
    if (allStores.length <= 1) return;

    const primaryStore = allStores[0];
    const fragmentedStores = allStores.slice(1);

    for (const store of fragmentedStores) {
      console.log(`[Auto-Heal] Migrating fragmented store ${store.id} to primary store ${primaryStore.id}`);
      
      const healTx = db.transaction(() => {
        db.prepare('UPDATE user_roles SET store_id = ? WHERE store_id = ?').run(primaryStore.id, store.id);
        db.prepare('DELETE FROM sync_outbox WHERE store_id = ?').run(store.id);
        db.prepare('DELETE FROM sync_state WHERE store_id = ?').run(store.id);
        db.prepare('DELETE FROM pending_mutations WHERE store_id = ?').run(store.id);
        db.prepare('DELETE FROM stores WHERE id = ?').run(store.id);
      });
      
      healTx();
    }
    console.log(`[Auto-Heal] Completed. Unified ${fragmentedStores.length} fragmented store(s) into ${primaryStore.id}.`);
  },
});
