import Database from 'better-sqlite3';
import { LocalSale, LocalSaleItem } from '../types.js';
import { emitOutbox } from './sync_helpers.js';

export const createSalesRepo = (db: Database.Database) => {
  // Pre-prepare common statements for performance
  const stmts = {
    insertSale: db.prepare(`
      INSERT INTO sales (
        id, store_id, worker_id, client_id, customer_name, customer_phone,
        sale_type, total_price, discount, tax, payment_method,
        payment_status, notes, invoice_number, created_at, updated_at
      ) VALUES (
        @id, @store_id, @worker_id, @client_id, @customer_name, @customer_phone,
        @sale_type, @total_price, @discount, @tax, @payment_method,
        @payment_status, @notes, @invoice_number, @created_at, @updated_at
      )
    `),
    insertItem: db.prepare(`
      INSERT INTO sale_items (
        id, sale_id, product_id, product_name, quantity, unit_price,
        discount, total, batch_id, created_at
      ) VALUES (
        @id, @sale_id, @product_id, @product_name, @quantity, @unit_price,
        @discount, @total, @batch_id, @created_at
      )
    `),
    getSale: db.prepare('SELECT * FROM sales WHERE id = ? LIMIT 1'),
    listItems: db.prepare(`
      SELECT si.*, pf.name as category_name
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN product_families pf ON p.category = pf.id
      WHERE si.sale_id = ?
      ORDER BY si.created_at ASC
    `),
    updateClientBalance: db.prepare('UPDATE clients SET current_balance = current_balance + ? WHERE id = ?'),
  };

  return {
  listSales(storeId?: string, limit?: number, dateFrom?: string, dateTo?: string): LocalSale[] {
    let sql = 'SELECT * FROM sales WHERE 1=1';
    const params: any[] = [];

    if (storeId) {
      sql += ' AND store_id = ?';
      params.push(storeId);
    }

    if (dateFrom) {
      sql += ' AND created_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ' AND created_at <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY created_at DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = db.prepare(sql).all(...params);
    return rows as LocalSale[];
  },

  getSaleById(saleId: string): LocalSale | undefined {
    return stmts.getSale.get(saleId) as LocalSale | undefined;
  },

  insertSale(sale: LocalSale) {
    stmts.insertSale.run({
      ...sale,
      worker_id: sale.worker_id ?? null,
      client_id: (sale as any).client_id ?? null,
      customer_name: sale.customer_name ?? null,
      customer_phone: sale.customer_phone ?? null,
      discount: sale.discount ?? 0,
      tax: sale.tax ?? 0,
      payment_method: sale.payment_method ?? 'cash',
      payment_status: sale.payment_status ?? 'paid',
      notes: sale.notes ?? null,
      invoice_number: sale.invoice_number ?? null,
    });
    emitOutbox(db, sale.store_id, 'sale', sale.id, 'create', sale as unknown as Record<string, unknown>);
  },

  /**
   * Atomic transaction to create a sale and its items
   */
  createSaleWithItems(sale: LocalSale, items: LocalSaleItem[]) {
    const transaction = db.transaction((saleData: LocalSale, itemsData: LocalSaleItem[]) => {
      // 1. Insert Sale
      stmts.insertSale.run({
        ...saleData,
        worker_id: saleData.worker_id ?? null,
        client_id: (saleData as any).client_id ?? null,
        customer_name: saleData.customer_name ?? null,
        customer_phone: saleData.customer_phone ?? null,
        discount: saleData.discount ?? 0,
        tax: saleData.tax ?? 0,
        payment_method: saleData.payment_method ?? 'cash',
        payment_status: saleData.payment_status ?? 'paid',
        notes: saleData.notes ?? null,
        invoice_number: saleData.invoice_number ?? null,
      });

      // 2. Insert Items
      for (const item of itemsData) {
        stmts.insertItem.run({
          ...item,
          product_id: item.product_id ?? null,
          discount: item.discount ?? 0,
          batch_id: item.batch_id ?? null,
        });
      }

      // 3. Update Client Balance if credit
      if (saleData.payment_method === 'credit' && (saleData as any).client_id) {
        stmts.updateClientBalance.run(saleData.total_price, (saleData as any).client_id);
      }
    });

    transaction(sale, items);

    // Emit outbox events (outside transaction to avoid blocking)
    emitOutbox(db, sale.store_id, 'sale', sale.id, 'create', sale as unknown as Record<string, unknown>);
    for (const item of items) {
      emitOutbox(db, sale.store_id, 'sale_item', item.id, 'create', item as unknown as Record<string, unknown>);
    }
  },

  updateSale(
    saleId: string,
    updates: Partial<Omit<LocalSale, 'id' | 'store_id' | 'created_at'>>
  ): LocalSale | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      return stmts.getSale.get(saleId) as LocalSale | undefined;
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE sales SET ${assignments} WHERE id = @id`).run({
      id: saleId,
      ...Object.fromEntries(normalizedEntries),
    });
    
    return stmts.getSale.get(saleId) as LocalSale | undefined;
  },

  deleteSale(saleId: string) {
    const transaction = db.transaction((id: string) => {
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
      db.prepare('DELETE FROM sales WHERE id = ?').run(id);
    });
    transaction(saleId);
  },

  listSaleItems(saleId: string): LocalSaleItem[] {
    return stmts.listItems.all(saleId) as LocalSaleItem[];
  },

  insertSaleItem(item: LocalSaleItem) {
    stmts.insertItem.run({
      ...item,
      product_id: item.product_id ?? null,
      discount: item.discount ?? 0,
      batch_id: item.batch_id ?? null,
    });
    // Retrieve store_id from the parent sale for the outbox event
    const sale = stmts.getSale.get(item.sale_id) as { store_id: string } | undefined;
    if (sale) {
      emitOutbox(db, sale.store_id, 'sale_item', item.id, 'create', item as unknown as Record<string, unknown>);
    }
  },
};
};
};
