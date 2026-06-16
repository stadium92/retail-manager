import Database from 'better-sqlite3';
import { LocalStockAdjustment } from '../types.js';
import { emitOutbox } from './sync_helpers.js';

export const createStockAdjustmentsRepo = (db: Database.Database) => {
  return {
    listStockAdjustments(storeId?: string): (LocalStockAdjustment & { product_name: string })[] {
      if (storeId) {
        const rows = db
          .prepare(
            `SELECT sa.*, p.name as product_name 
             FROM stock_adjustments sa
             LEFT JOIN products p ON sa.product_id = p.id
             WHERE sa.store_id = ?
             ORDER BY sa.created_at DESC`
          )
          .all(storeId);
        return rows as (LocalStockAdjustment & { product_name: string })[];
      }
      const rows = db
        .prepare(
          `SELECT sa.*, p.name as product_name 
           FROM stock_adjustments sa
           LEFT JOIN products p ON sa.product_id = p.id
           ORDER BY sa.created_at DESC`
        )
        .all();
      return rows as (LocalStockAdjustment & { product_name: string })[];
    },

    insertStockAdjustment(adjustment: LocalStockAdjustment) {
      db.prepare(
        `
        INSERT INTO stock_adjustments (
          id,
          store_id,
          worker_id,
          product_id,
          adjustment_type,
          quantity_adjusted,
          reason,
          created_at
        ) VALUES (
          @id,
          @store_id,
          @worker_id,
          @product_id,
          @adjustment_type,
          @quantity_adjusted,
          @reason,
          @created_at
        )
      `
      ).run({
        ...adjustment,
        reason: adjustment.reason ?? null,
      });
      emitOutbox(db, adjustment.store_id, 'stock_adjustment', adjustment.id, 'create', adjustment as unknown as Record<string, unknown>);
    },

    deleteStockAdjustment(id: string) {
      const existing = db
        .prepare('SELECT store_id FROM stock_adjustments WHERE id = ? LIMIT 1')
        .get(id) as { store_id: string } | undefined;
      db.prepare('DELETE FROM stock_adjustments WHERE id = ?').run(id);
      if (existing) {
        emitOutbox(db, existing.store_id, 'stock_adjustment', id, 'delete', { id });
      }
    },
  };
};
