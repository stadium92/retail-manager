import Database from 'better-sqlite3';
import { LocalStore } from '../types.js';

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
    return row as LocalStore | undefined;
  },

  deleteStore(storeId: string) {
    db.prepare('DELETE FROM stores WHERE id = ?').run(storeId);
  },
});
