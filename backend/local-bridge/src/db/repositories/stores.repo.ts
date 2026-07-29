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
      INSERT INTO stores (
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
    // A store's own id is used as the outbox store_id - there's no other
    // store to attribute the mutation to.
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
    // Pre-change snapshot for the journal - see products.repo.updateProduct.
    const before = db.prepare('SELECT * FROM stores WHERE id = ? LIMIT 1').get(storeId) as
      | Record<string, unknown>
      | undefined;

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE stores SET ${assignments}, version = version + 1 WHERE id = @id`).run({
      id: storeId,
      ...Object.fromEntries(normalizedEntries),
    });

    const row = db.prepare('SELECT * FROM stores WHERE id = ? LIMIT 1').get(storeId);
    const updated = row as LocalStore | undefined;
    if (updated) {
      emitOutbox(db, storeId, 'store', storeId, 'update', updated as unknown as Record<string, unknown>, (updated as any).version - 1, { before: before ?? null });
    }
    return updated;
  },

  deleteStore(storeId: string) {
    const existing = db.prepare('SELECT * FROM stores WHERE id = ? LIMIT 1').get(storeId) as
      | (Record<string, unknown> & { version?: number })
      | undefined;
    db.prepare('DELETE FROM stores WHERE id = ?').run(storeId);
    emitOutbox(db, storeId, 'store', storeId, 'delete', { id: storeId }, existing?.version ?? null, { before: existing ?? null });
  },
});
