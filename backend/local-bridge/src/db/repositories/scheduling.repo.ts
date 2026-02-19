import Database from 'better-sqlite3';
import { LocalScheduledOrder, LocalScheduledOrderItem } from '../types.js';

export const createSchedulingRepo = (db: Database.Database) => ({
  listScheduledOrders(storeId: string): LocalScheduledOrder[] {
    const rows = db
      .prepare('SELECT * FROM scheduled_orders WHERE store_id = ? ORDER BY next_run_date ASC')
      .all(storeId);
    return rows as LocalScheduledOrder[];
  },

  insertScheduledOrder(order: LocalScheduledOrder) {
    db.prepare(
      `
      INSERT INTO scheduled_orders (
        id, store_id, supplier_id, name, recurrence_type, recurrence_value, next_run_date, is_active, created_at, updated_at
      ) VALUES (
        @id, @store_id, @supplier_id, @name, @recurrence_type, @recurrence_value, @next_run_date, @is_active, @created_at, @updated_at
      )
    `
    ).run({
      ...order,
      supplier_id: order.supplier_id ?? null,
      is_active: order.is_active ? 1 : 0
    });
  },

  deleteScheduledOrder(id: string) {
    db.prepare('DELETE FROM scheduled_orders WHERE id = ?').run(id);
  },

  listScheduledOrderItems(scheduledOrderId: string): LocalScheduledOrderItem[] {
    const rows = db
      .prepare('SELECT * FROM scheduled_order_items WHERE scheduled_order_id = ?')
      .all(scheduledOrderId);
    return rows as LocalScheduledOrderItem[];
  },

  insertScheduledOrderItem(item: LocalScheduledOrderItem) {
    db.prepare(
      `
      INSERT INTO scheduled_order_items (
        id, scheduled_order_id, product_id, quantity
      ) VALUES (
        @id, @scheduled_order_id, @product_id, @quantity
      )
    `
    ).run(item);
  },
});
