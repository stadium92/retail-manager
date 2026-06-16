import Database from 'better-sqlite3';
import { LocalSale, LocalSaleItem } from '../types.js';
import { emitOutbox } from './sync_helpers.js';

export const createSalesRepo = (db: Database.Database) => {
  // Pre-prepare common statements for performance
  const stmts = {
    insertSale: db.prepare(`
      INSERT INTO sales (
        id, store_id, worker_id, client_id, customer_name, customer_phone,
        sale_type, total_price, amount_paid, discount, tax, payment_method,
        payment_status, notes, invoice_number, created_at, updated_at
      ) VALUES (
        @id, @store_id, @worker_id, @client_id, @customer_name, @customer_phone,
        @sale_type, @total_price, @amount_paid, @discount, @tax, @payment_method,
        @payment_status, @notes, @invoice_number, @created_at, @updated_at
      )
      ON CONFLICT(id) DO NOTHING
    `),
    insertItem: db.prepare(`
      INSERT INTO sale_items (
        id, sale_id, product_id, product_name, quantity, unit_price,
        discount, total, batch_id, created_at
      ) VALUES (
        @id, @sale_id, @product_id, @product_name, @quantity, @unit_price,
        @discount, @total, @batch_id, @created_at
      )
      ON CONFLICT(id) DO NOTHING
    `),
    getSale: db.prepare('SELECT * FROM sales WHERE id = ? LIMIT 1'),
    listItems: db.prepare(`
      SELECT si.*, pf.name as category_name, p.name as current_product_name
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      LEFT JOIN product_families pf ON p.category = pf.id
      WHERE si.sale_id = ?
      ORDER BY si.created_at ASC
    `),
    updateClientBalance: db.prepare('UPDATE clients SET current_balance = current_balance + ? WHERE id = ?'),
    getProductStock: db.prepare('SELECT id, quantity FROM products WHERE id = ? LIMIT 1'),
    deductStock: db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?'),
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

    const rows = db.prepare(sql).all(...params) as any[];
    
    // Enrich with items
    return rows.map(sale => {
      const items = stmts.listItems.all(sale.id);
      return {
        ...sale,
        items
      };
    }) as LocalSale[];
  },

  getSaleById(saleId: string): LocalSale | undefined {
    return stmts.getSale.get(saleId) as LocalSale | undefined;
  },

  insertSale(sale: LocalSale): LocalSale | undefined {
    const result = stmts.insertSale.run({
      ...sale,
      worker_id: sale.worker_id ?? null,
      client_id: (sale as any).client_id ?? null,
      customer_name: sale.customer_name ?? null,
      customer_phone: sale.customer_phone ?? null,
      amount_paid: (sale as any).amount_paid ?? sale.total_price ?? 0,
      discount: sale.discount ?? 0,
      tax: sale.tax ?? 0,
      payment_method: sale.payment_method ?? 'cash',
      payment_status: sale.payment_status ?? 'paid',
      notes: sale.notes ?? null,
      invoice_number: sale.invoice_number ?? null,
    });
    if (result.changes > 0) {
      emitOutbox(db, sale.store_id, 'sale', sale.id, 'create', sale as unknown as Record<string, unknown>);
    }
    return stmts.getSale.get(sale.id) as LocalSale | undefined;
  },

  /**
   * Atomic transaction to create a sale and its items.
   * - Idempotent: ON CONFLICT(id) DO NOTHING prevents duplicates on retry.
   * - Stock is explicitly deducted within the transaction for non-proforma sales.
   * - Rolls back entirely if any step fails.
   * Returns the sale as stored in the database.
   */
  createSaleWithItems(sale: LocalSale, items: LocalSaleItem[]): LocalSale | undefined {
    const transaction = db.transaction((saleData: LocalSale, itemsData: LocalSaleItem[]) => {
      // 1. Insert Sale (idempotent — ON CONFLICT DO NOTHING)
      const saleResult = stmts.insertSale.run({
        ...saleData,
        worker_id: saleData.worker_id ?? null,
        client_id: (saleData as any).client_id ?? null,
        customer_name: saleData.customer_name ?? null,
        customer_phone: saleData.customer_phone ?? null,
        amount_paid: (saleData as any).amount_paid ?? saleData.total_price ?? 0,
        discount: saleData.discount ?? 0,
        tax: saleData.tax ?? 0,
        payment_method: saleData.payment_method ?? 'cash',
        payment_status: saleData.payment_status ?? 'paid',
        notes: saleData.notes ?? null,
        invoice_number: saleData.invoice_number ?? null,
      });

      // If sale already exists (idempotent retry), skip items & stock
      if (saleResult.changes === 0) {
        return;
      }

      // 2. Insert Items + 3. Deduct Stock
      for (const item of itemsData) {
        const itemResult = stmts.insertItem.run({
          ...item,
          product_id: item.product_id ?? null,
          discount: item.discount ?? 0,
          batch_id: item.batch_id ?? null,
        });

        // EXPLICIT STOCK DEDUCTION
        if (itemResult.changes > 0 && item.product_id && saleData.sale_type !== 'proforma') {
          stmts.deductStock.run(item.quantity, item.product_id);
        }
      }

      // 4. Update Client Balance if credit sale
      if (saleData.payment_method === 'credit' && (saleData as any).client_id) {
        stmts.updateClientBalance.run(saleData.total_price, (saleData as any).client_id);
      }
    });

    transaction(sale, items);

    // Emit outbox events (outside transaction to avoid blocking)
    // Only emit if the sale was actually created (getSale confirms it exists)
    const created = stmts.getSale.get(sale.id) as LocalSale | undefined;
    if (created) {
      emitOutbox(db, sale.store_id, 'sale', sale.id, 'create', sale as unknown as Record<string, unknown>);
      for (const item of items) {
        emitOutbox(db, sale.store_id, 'sale_item', item.id, 'create', item as unknown as Record<string, unknown>);
      }
    }

    return created;
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

    const updated = stmts.getSale.get(saleId) as LocalSale | undefined;
    if (updated) {
      // Emit outbox so this update (e.g. a partial credit settlement) is synced to Supabase
      emitOutbox(db, updated.store_id, 'sale', saleId, 'update', updated as unknown as Record<string, unknown>);
    }
    return updated;
  },

  deleteSale(saleId: string) {
      const sale = stmts.getSale.get(saleId) as LocalSale | undefined;
      if (!sale) return;

      const items = stmts.listItems.all(saleId) as LocalSaleItem[];

      const transaction = db.transaction(() => {
        // Revert stock for each item if it was a real sale (not proforma)
        if (sale.sale_type !== 'proforma') {
          for (const item of items) {
            if (item.product_id) {
              // Add stock back
              db.prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?').run(item.quantity, item.product_id);
            }
          }
        }
        
        // Revert client balance if it was a credit sale
        if (sale.payment_method === 'credit' && (sale as any).client_id) {
          db.prepare('UPDATE clients SET current_balance = current_balance - ? WHERE id = ?').run(sale.total_price, (sale as any).client_id);
        }

        db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId);
        db.prepare('DELETE FROM sales WHERE id = ?').run(saleId);
      });
      transaction();

      // Emit outbox events
      for (const item of items) {
        emitOutbox(db, sale.store_id, 'sale_item', item.id, 'delete', { id: item.id } as any);
      }
      emitOutbox(db, sale.store_id, 'sale', sale.id, 'delete', { id: sale.id } as any);
    },

  listSaleItems(saleId: string): LocalSaleItem[] {
    return stmts.listItems.all(saleId) as LocalSaleItem[];
  },

  insertSaleItem(item: LocalSaleItem) {
    const result = stmts.insertItem.run({
      ...item,
      product_id: item.product_id ?? null,
      discount: item.discount ?? 0,
      batch_id: item.batch_id ?? null,
    });
    // Only emit outbox if the item was actually inserted (not a duplicate)
    if (result.changes > 0) {
      const sale = stmts.getSale.get(item.sale_id) as { store_id: string } | undefined;
      if (sale) {
        emitOutbox(db, sale.store_id, 'sale_item', item.id, 'create', item as unknown as Record<string, unknown>);
      }
    }
  },
};
};
