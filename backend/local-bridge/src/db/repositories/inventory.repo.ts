import Database from 'better-sqlite3';
import { LocalInventoryMovement } from '../types.js';

export const createInventoryRepo = (db: Database.Database) => ({
  listInventoryMovements(storeId?: string, limit?: number): LocalInventoryMovement[] {
    if (storeId) {
      const rows = db
        .prepare(
          `SELECT * FROM inventory_movements WHERE store_id = ? ORDER BY created_at DESC${limit ? ' LIMIT ?' : ''}`
        )
        .all(limit ? [storeId, limit] : [storeId]);
      return rows as LocalInventoryMovement[];
    }
    const rows = db
      .prepare(`SELECT * FROM inventory_movements ORDER BY created_at DESC${limit ? ' LIMIT ?' : ''}`)
      .all(limit ? [limit] : []);
    return rows as LocalInventoryMovement[];
  },

  insertInventoryMovement(movement: LocalInventoryMovement) {
    db.prepare(
      `
      INSERT INTO inventory_movements (
        id,
        store_id,
        product_id,
        product_name,
        movement_type,
        quantity,
        reason,
        source,
        batch_id,
        created_at,
        created_by
      ) VALUES (
        @id,
        @store_id,
        @product_id,
        @product_name,
        @movement_type,
        @quantity,
        @reason,
        @source,
        @batch_id,
        @created_at,
        @created_by
      )
    `
    ).run({
      ...movement,
      product_name: movement.product_name ?? null,
      reason: movement.reason ?? null,
      source: movement.source ?? null,
      batch_id: movement.batch_id ?? null,
      created_by: movement.created_by ?? null,
    });
  },
});
