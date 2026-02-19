import Database from 'better-sqlite3';
import { LocalSupplier } from '../types.js';

export const createSuppliersRepo = (db: Database.Database) => ({
  listSuppliers(storeId: string): LocalSupplier[] {
    const rows = db
      .prepare('SELECT * FROM suppliers WHERE store_id = ? ORDER BY name ASC')
      .all(storeId);
    return rows as LocalSupplier[];
  },

  getSupplierById(supplierId: string): LocalSupplier | undefined {
    const row = db.prepare('SELECT * FROM suppliers WHERE id = ? LIMIT 1').get(supplierId);
    return row as LocalSupplier | undefined;
  },

  insertSupplier(supplier: LocalSupplier) {
    db.prepare(
      `
      INSERT INTO suppliers (
        id,
        store_id,
        name,
        phone,
        email,
        address,
        balance,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @store_id,
        @name,
        @phone,
        @email,
        @address,
        @balance,
        @created_at,
        @updated_at
      )
    `
    ).run({
      ...supplier,
      phone: supplier.phone ?? null,
      email: supplier.email ?? null,
      address: supplier.address ?? null,
    });
  },

  updateSupplier(
    supplierId: string,
    updates: Partial<Omit<LocalSupplier, 'id' | 'store_id' | 'created_at'>>
  ): LocalSupplier | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      const row = db.prepare('SELECT * FROM suppliers WHERE id = ? LIMIT 1').get(supplierId);
      return row as LocalSupplier | undefined;
    }

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE suppliers SET ${assignments} WHERE id = @id`).run({
      id: supplierId,
      ...Object.fromEntries(normalizedEntries),
    });
    
    const row = db.prepare('SELECT * FROM suppliers WHERE id = ? LIMIT 1').get(supplierId);
    return row as LocalSupplier | undefined;
  },

  deleteSupplier(supplierId: string) {
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplierId);
  },
});
