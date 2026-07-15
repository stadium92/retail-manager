import Database from 'better-sqlite3';
import { emitOutbox } from './sync_helpers.js';

/**
 * One-time (but safe to re-run) catch-up sweep for records that were
 * created in local SQLite *before* the corresponding repository started
 * calling emitOutbox() on write, and therefore have no sync_outbox entry at
 * all. Without this, that historical data would never reach Supabase - the
 * outbox only ever captures mutations made *after* it was wired up.
 *
 * Idempotency: for every row, we check whether ANY sync_outbox entry
 * already exists for (entity_type, entity_id) - regardless of status -
 * before inserting a 'create' entry via emitOutbox(). That covers rows
 * that are already pending, already sent/acked, or already failed (a
 * failed entry means a push was attempted and will keep being retried by
 * the normal drain loop; the backfill sweep must not re-queue a second
 * duplicate entry for the same record on top of it). Backed by
 * idx_sync_outbox_entity so this scan stays cheap on repeated runs.
 *
 * Scope: sales+sale_items, clients, deliveries, stores, cash_transactions,
 * products, suppliers, purchase_orders and purchase_items - i.e. every
 * entity type the (newly fixed) sync_outbox drain in /sync/push knows how
 * to push. Local-bridge "team"/worker accounts (users/user_roles) are
 * deliberately NOT included - see sync_payload_map.ts / the sync repair
 * report for why syncing those requires real Supabase Auth provisioning,
 * not a generic table push.
 */

export interface BackfillEntityResult {
  scanned: number;
  queued: number;
}

export interface BackfillResult {
  totalScanned: number;
  totalQueued: number;
  perEntity: Record<string, BackfillEntityResult>;
}

export const createOutboxBackfillRepo = (db: Database.Database) => ({
  runOutboxBackfill(): BackfillResult {
    const exists = db.prepare(
      'SELECT 1 FROM sync_outbox WHERE entity_type = ? AND entity_id = ? LIMIT 1'
    );

    const perEntity: Record<string, BackfillEntityResult> = {};

    const sweep = (
      entityType: string,
      sql: string,
      getStoreId: (row: any) => string | null | undefined
    ) => {
      const result: BackfillEntityResult = { scanned: 0, queued: 0 };
      const rows = db.prepare(sql).all() as any[];
      for (const row of rows) {
        result.scanned += 1;
        const storeId = getStoreId(row);
        if (!storeId) continue; // can't file an outbox entry without a store_id
        if (exists.get(entityType, row.id)) continue;
        emitOutbox(db, storeId, entityType, row.id, 'create', row as Record<string, unknown>);
        result.queued += 1;
      }
      perEntity[entityType] = result;
    };

    sweep('sale', 'SELECT * FROM sales', (row) => row.store_id);

    sweep(
      'sale_item',
      `SELECT si.*, s.store_id as store_id
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id`,
      (row) => row.store_id
    );

    sweep('client', 'SELECT * FROM clients', (row) => row.store_id);

    sweep('delivery', 'SELECT * FROM deliveries', (row) => row.store_id);

    // A store's own id is its natural store_id for outbox partitioning.
    sweep('store', 'SELECT * FROM stores', (row) => row.id);

    sweep('cash_transaction', 'SELECT * FROM cash_transactions', (row) => row.store_id);

    sweep('product', 'SELECT * FROM products', (row) => row.store_id);

    sweep('supplier', 'SELECT * FROM suppliers', (row) => row.store_id);

    sweep('purchase_order', 'SELECT * FROM purchase_orders', (row) => row.store_id);

    sweep(
      'purchase_item',
      `SELECT pi.*, po.store_id as store_id
       FROM purchase_items pi
       JOIN purchase_orders po ON po.id = pi.order_id`,
      (row) => row.store_id
    );

    let totalScanned = 0;
    let totalQueued = 0;
    for (const key of Object.keys(perEntity)) {
      totalScanned += perEntity[key].scanned;
      totalQueued += perEntity[key].queued;
    }

    return { totalScanned, totalQueued, perEntity };
  },
});
