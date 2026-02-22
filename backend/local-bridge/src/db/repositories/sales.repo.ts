import Database from 'better-sqlite3';
import crypto from 'crypto';
import { LocalSale, LocalSaleItem } from '../types.js';

export const createSalesRepo = (db: Database.Database) => {
  const emitOutbox = (storeId: string, entityType: string, entityId: string, opType: 'create' | 'update' | 'delete', payload: Record<string, unknown>, baseVersion?: number | null) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const idempotencyKey = `${storeId}:${entityType}:${entityId}:${opType}:${now}`;
    try {
      db.prepare(
        `INSERT OR IGNORE INTO sync_outbox (id, store_id, entity_type, entity_id, op_type, payload_json, base_version, created_at, status, retry_count, last_error, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?)`
      ).run(id, storeId, entityType, entityId, opType, JSON.stringify(payload), baseVersion ?? null, now, idempotencyKey);
    } catch (_) { /* sync outbox write should never block main flow */ }
  };

  return {
  listSales(storeId?: string, limit?: number): LocalSale[] {
    if (storeId) {
      const rows = db
        .prepare(
          `SELECT * FROM sales WHERE store_id = ? ORDER BY created_at DESC${limit ? ' LIMIT ?' : ''}`
        )
        .all(limit ? [storeId, limit] : [storeId]);
      return rows as LocalSale[];
    }
    const rows = db
      .prepare(`SELECT * FROM sales ORDER BY created_at DESC${limit ? ' LIMIT ?' : ''}`)
      .all(limit ? [limit] : []);
    return rows as LocalSale[];
  },

  getSaleById(saleId: string): LocalSale | undefined {
    const row = db.prepare('SELECT * FROM sales WHERE id = ? LIMIT 1').get(saleId);
    return row as LocalSale | undefined;
  },

  insertSale(sale: LocalSale) {
    db.prepare(
      `
      INSERT INTO sales (
        id,
        store_id,
        worker_id,
        customer_name,
        customer_phone,
        sale_type,
        total_price,
        discount,
        tax,
        payment_method,
        payment_status,
        notes,
        invoice_number,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @store_id,
        @worker_id,
        @customer_name,
        @customer_phone,
        @sale_type,
        @total_price,
        @discount,
        @tax,
        @payment_method,
        @payment_status,
        @notes,
        @invoice_number,
        @created_at,
        @updated_at
      )
    `
    ).run({
      ...sale,
      worker_id: sale.worker_id ?? null,
      customer_name: sale.customer_name ?? null,
      customer_phone: sale.customer_phone ?? null,
      discount: sale.discount ?? 0,
      tax: sale.tax ?? 0,
      payment_method: sale.payment_method ?? 'cash',
      payment_status: sale.payment_status ?? 'paid',
      notes: sale.notes ?? null,
      invoice_number: sale.invoice_number ?? null,
    });
    emitOutbox(sale.store_id, 'sale', sale.id, 'create', sale as unknown as Record<string, unknown>);
  },

  updateSale(
    saleId: string,
    updates: Partial<Omit<LocalSale, 'id' | 'store_id' | 'created_at'>>
  ): LocalSale | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      // Re-implement getSaleById
      const row = db.prepare('SELECT * FROM sales WHERE id = ? LIMIT 1').get(saleId);
      return row as LocalSale | undefined;
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE sales SET ${assignments} WHERE id = @id`).run({
      id: saleId,
      ...Object.fromEntries(normalizedEntries),
    });
    
    const row = db.prepare('SELECT * FROM sales WHERE id = ? LIMIT 1').get(saleId);
    return row as LocalSale | undefined;
  },

  deleteSale(saleId: string) {
    db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId);
    db.prepare('DELETE FROM sales WHERE id = ?').run(saleId);
  },

  listSaleItems(saleId: string): LocalSaleItem[] {
    const rows = db
      .prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC')
      .all(saleId);
    return rows as LocalSaleItem[];
  },

  insertSaleItem(item: LocalSaleItem) {
    db.prepare(
      `
      INSERT INTO sale_items (
        id,
        sale_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        discount,
        total,
        batch_id,
        created_at
      ) VALUES (
        @id,
        @sale_id,
        @product_id,
        @product_name,
        @quantity,
        @unit_price,
        @discount,
        @total,
        @batch_id,
        @created_at
      )
    `
    ).run({
      ...item,
      product_id: item.product_id ?? null,
      discount: item.discount ?? 0,
      batch_id: item.batch_id ?? null,
    });
    // Retrieve store_id from the parent sale for the outbox event
    const sale = db.prepare('SELECT store_id FROM sales WHERE id = ? LIMIT 1').get(item.sale_id) as { store_id: string } | undefined;
    if (sale) {
      emitOutbox(sale.store_id, 'sale_item', item.id, 'create', item as unknown as Record<string, unknown>);
    }
  },
};
};
