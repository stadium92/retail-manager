import Database from 'better-sqlite3';
import { LocalDelivery } from '../types.js';
import { emitOutbox } from './sync_helpers.js';

export const createDeliveriesRepo = (db: Database.Database) => ({
  listDeliveries(storeId?: string, delivererId?: string): LocalDelivery[] {
    if (delivererId) {
      return db
        .prepare('SELECT * FROM deliveries WHERE deliverer_id = ? ORDER BY created_at DESC')
        .all(delivererId) as LocalDelivery[];
    }
    if (storeId) {
      return db
        .prepare('SELECT * FROM deliveries WHERE store_id = ? ORDER BY created_at DESC')
        .all(storeId) as LocalDelivery[];
    }
    return db.prepare('SELECT * FROM deliveries ORDER BY created_at DESC').all() as LocalDelivery[];
  },

  getDeliveryById(deliveryId: string): LocalDelivery | undefined {
    const row = db.prepare('SELECT * FROM deliveries WHERE id = ? LIMIT 1').get(deliveryId);
    return row as LocalDelivery | undefined;
  },

  insertDelivery(delivery: LocalDelivery) {
    db.prepare(
      `
      INSERT INTO deliveries (
        id,
        sale_id,
        store_id,
        deliverer_id,
        customer_name,
        customer_phone,
        delivery_address,
        status,
        notes,
        scheduled_at,
        delivered_at,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @sale_id,
        @store_id,
        @deliverer_id,
        @customer_name,
        @customer_phone,
        @delivery_address,
        @status,
        @notes,
        @scheduled_at,
        @delivered_at,
        @created_at,
        @updated_at
      )
    `
    ).run({
      ...delivery,
      sale_id: delivery.sale_id ?? null,
      store_id: delivery.store_id ?? null,
      deliverer_id: delivery.deliverer_id ?? null,
      customer_name: delivery.customer_name ?? null,
      customer_phone: delivery.customer_phone ?? null,
      notes: delivery.notes ?? null,
      scheduled_at: delivery.scheduled_at ?? null,
      delivered_at: delivery.delivered_at ?? null,
    });
    if (delivery.store_id) {
      emitOutbox(db, delivery.store_id, 'delivery', delivery.id, 'create', delivery as unknown as Record<string, unknown>);
    }
  },

  updateDelivery(
    deliveryId: string,
    updates: Partial<Omit<LocalDelivery, 'id' | 'created_at'>>
  ): LocalDelivery | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      const row = db.prepare('SELECT * FROM deliveries WHERE id = ? LIMIT 1').get(deliveryId);
      return row as LocalDelivery | undefined;
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE deliveries SET ${assignments} WHERE id = @id`).run({
      id: deliveryId,
      ...Object.fromEntries(normalizedEntries),
    });

    const row = db.prepare('SELECT * FROM deliveries WHERE id = ? LIMIT 1').get(deliveryId);
    const updated = row as LocalDelivery | undefined;
    if (updated?.store_id) {
      emitOutbox(db, updated.store_id, 'delivery', deliveryId, 'update', updated as unknown as Record<string, unknown>);
    }
    return updated;
  },

  deleteDelivery(deliveryId: string) {
    const existing = db.prepare('SELECT * FROM deliveries WHERE id = ? LIMIT 1').get(deliveryId) as LocalDelivery | undefined;
    db.prepare('DELETE FROM deliveries WHERE id = ?').run(deliveryId);
    if (existing?.store_id) {
      emitOutbox(db, existing.store_id, 'delivery', deliveryId, 'delete', { id: deliveryId });
    }
  },
});
