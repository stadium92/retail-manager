import Database from 'better-sqlite3';
import { LocalPurchaseOrder, LocalPurchaseItem, LocalSupplier, LocalSupplierPayment } from '../types.js';
import { emitOutbox } from './sync_helpers.js';

export const createPurchasingRepo = (db: Database.Database) => ({
  listPurchaseOrders(storeId: string, status?: string): (LocalPurchaseOrder & { supplier?: LocalSupplier })[] {
    let sql = `
      SELECT po.*, 
             s.id as s_id, s.name as s_name, s.phone as s_phone, s.email as s_email, s.address as s_address, s.balance as s_balance
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.store_id = ?
    `;
    
    const params: any[] = [storeId];
    if (status) {
      sql += ' AND po.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY po.created_at DESC';

    const rows = db.prepare(sql).all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      store_id: row.store_id,
      supplier_id: row.supplier_id,
      status: row.status,
      total_amount: row.total_amount,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      supplier: row.s_id ? {
        id: row.s_id,
        store_id: row.store_id,
        name: row.s_name,
        phone: row.s_phone,
        email: row.s_email,
        address: row.s_address,
        balance: row.s_balance,
        created_at: '', // Not needed for display
        updated_at: ''
      } : undefined
    }));
  },

  getPurchaseOrderById(orderId: string): (LocalPurchaseOrder & { supplier?: LocalSupplier }) | undefined {
    const row = db.prepare(`
      SELECT po.*, 
             s.id as s_id, s.name as s_name, s.phone as s_phone, s.email as s_email, s.address as s_address, s.balance as s_balance
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = ?
      LIMIT 1
    `).get(orderId) as any;

    if (!row) return undefined;

    return {
      ...row,
      supplier: row.s_id ? {
        id: row.s_id,
        store_id: row.store_id,
        name: row.s_name,
        phone: row.s_phone,
        email: row.s_email,
        address: row.s_address,
        balance: row.s_balance,
        created_at: '', 
        updated_at: ''
      } : undefined
    };
  },

  insertPurchaseOrder(order: LocalPurchaseOrder) {
    db.prepare(
      `
      INSERT INTO purchase_orders (
        id,
        store_id,
        supplier_id,
        status,
        total_amount,
        notes,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @store_id,
        @supplier_id,
        @status,
        @total_amount,
        @notes,
        @created_at,
        @updated_at
      )
    `
    ).run({
      ...order,
      notes: order.notes ?? null,
    });
    emitOutbox(db, order.store_id, 'purchase_order', order.id, 'create', order as any);
  },

  updatePurchaseOrder(
    orderId: string,
    updates: Partial<Omit<LocalPurchaseOrder, 'id' | 'store_id' | 'supplier_id' | 'created_at'>>
  ): LocalPurchaseOrder | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      const row = db.prepare('SELECT * FROM purchase_orders WHERE id = ? LIMIT 1').get(orderId);
      return row as LocalPurchaseOrder | undefined;
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE purchase_orders SET ${assignments}, version = version + 1 WHERE id = @id`).run({
      id: orderId,
      ...Object.fromEntries(normalizedEntries),
    });
    const row = db.prepare('SELECT * FROM purchase_orders WHERE id = ? LIMIT 1').get(orderId);
    const updated = row as LocalPurchaseOrder | undefined;
    if (updated) {
      emitOutbox(db, updated.store_id, 'purchase_order', orderId, 'update', updated as any, (updated as any).version - 1);
    }
    return updated;
  },

  deletePurchaseOrder(orderId: string) {
    const existing = db.prepare('SELECT store_id FROM purchase_orders WHERE id = ?').get(orderId) as any;
    db.prepare('DELETE FROM purchase_items WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(orderId);
    if (existing) {
      emitOutbox(db, existing.store_id, 'purchase_order', orderId, 'delete', { id: orderId });
    }
  },

  listPurchaseItems(orderId: string): (LocalPurchaseItem & { product?: { id: string; name: string; packaging: string } })[] {
    const rows = db
      .prepare(`
        SELECT pi.*, p.id as p_id, p.name as p_name, p.packaging as p_packaging
        FROM purchase_items pi
        LEFT JOIN products p ON pi.product_id = p.id
        WHERE pi.order_id = ?
        ORDER BY pi.created_at ASC
      `)
      .all(orderId) as any[];
      
    return rows.map(row => ({
      id: row.id,
      order_id: row.order_id,
      product_id: row.product_id,
      quantity_ordered: row.quantity_ordered,
      quantity_received: row.quantity_received,
      unit_cost: row.unit_cost,
      created_at: row.created_at,
      product: row.p_id ? {
        id: row.p_id,
        name: row.p_name,
        packaging: row.p_packaging
      } : undefined
    }));
  },

  insertPurchaseItem(item: LocalPurchaseItem) {
    db.prepare(
      `
      INSERT INTO purchase_items (
        id,
        order_id,
        product_id,
        quantity_ordered,
        quantity_received,
        unit_cost,
        created_at
      ) VALUES (
        @id,
        @order_id,
        @product_id,
        @quantity_ordered,
        @quantity_received,
        @unit_cost,
        @created_at
      )
    `
    ).run(item);
    // Fetch store_id for outbox
    const order = db.prepare('SELECT store_id FROM purchase_orders WHERE id = ?').get(item.order_id) as any;
    if (order) {
      emitOutbox(db, order.store_id, 'purchase_item', item.id, 'create', item as any);
    }
  },

  updatePurchaseItem(
    itemId: string,
    updates: Partial<Omit<LocalPurchaseItem, 'id' | 'order_id' | 'product_id' | 'created_at'>>
  ): LocalPurchaseItem | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      const row = db.prepare('SELECT * FROM purchase_items WHERE id = ? LIMIT 1').get(itemId);
      return row as LocalPurchaseItem | undefined;
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE purchase_items SET ${assignments}, version = version + 1 WHERE id = @id`).run({
      id: itemId,
      ...Object.fromEntries(normalizedEntries),
    });
    const row = db.prepare('SELECT * FROM purchase_items WHERE id = ? LIMIT 1').get(itemId);
    const updated = row as LocalPurchaseItem | undefined;
    if (updated) {
      const order = db.prepare('SELECT store_id FROM purchase_orders WHERE id = ?').get(updated.order_id) as any;
      if (order) {
        emitOutbox(db, order.store_id, 'purchase_item', itemId, 'update', updated as any, (updated as any).version - 1);
      }
    }
    return updated;
  },

  deletePurchaseItem(itemId: string) {
    db.prepare('DELETE FROM purchase_items WHERE id = ?').run(itemId);
  },

  listAllPurchaseItems(storeId: string, dateFrom?: string, dateTo?: string): any[] {
    let sql = `
      SELECT pi.*, p.name as product_name, pf.name as category_name, po.created_at
      FROM purchase_items pi
      JOIN purchase_orders po ON pi.order_id = po.id
      JOIN products p ON pi.product_id = p.id
      LEFT JOIN product_families pf ON p.category = pf.id
      WHERE po.store_id = ?
    `;
    const params: any[] = [storeId];

    if (dateFrom) {
      sql += ' AND po.created_at >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND po.created_at <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY po.created_at DESC';
    return db.prepare(sql).all(...params);
  },

  listSupplierPayments(storeId: string, supplierId?: string): LocalSupplierPayment[] {
    let sql = 'SELECT * FROM supplier_payments WHERE store_id = ?';
    const params: any[] = [storeId];
    if (supplierId) {
      sql += ' AND supplier_id = ?';
      params.push(supplierId);
    }
    sql += ' ORDER BY created_at DESC';
    const rows = db.prepare(sql).all(...params);
    return rows as LocalSupplierPayment[];
  },

  insertSupplierPayment(payment: LocalSupplierPayment) {
    const insertPayment = db.prepare(`
      INSERT INTO supplier_payments (
        id,
        store_id,
        supplier_id,
        amount,
        payment_method,
        reference,
        notes,
        confirmed_at,
        created_at
      ) VALUES (
        @id,
        @store_id,
        @supplier_id,
        @amount,
        @payment_method,
        @reference,
        @notes,
        @confirmed_at,
        @created_at
      )
    `);

    const updateBalance = db.prepare(`
      UPDATE suppliers
      SET balance = balance - @amount, updated_at = @created_at
      WHERE id = @supplier_id
    `);

    const transaction = db.transaction((paymentData) => {
      insertPayment.run(paymentData);
      updateBalance.run({
        amount: paymentData.amount,
        created_at: paymentData.created_at,
        supplier_id: paymentData.supplier_id,
      });
    });

    transaction({
      ...payment,
      reference: payment.reference ?? null,
      notes: payment.notes ?? null,
      confirmed_at: payment.confirmed_at ?? null,
    });
  },

  getSupplierPaymentById(paymentId: string): LocalSupplierPayment | undefined {
    const row = db.prepare('SELECT * FROM supplier_payments WHERE id = ? LIMIT 1').get(paymentId);
    return row as LocalSupplierPayment | undefined;
  },

  updateSupplierPayment(
    paymentId: string,
    updates: Partial<Omit<LocalSupplierPayment, 'id' | 'store_id' | 'supplier_id' | 'amount' | 'created_at'>>
  ): LocalSupplierPayment | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      const row = db.prepare('SELECT * FROM supplier_payments WHERE id = ? LIMIT 1').get(paymentId);
      return row as LocalSupplierPayment | undefined;
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    db.prepare(`UPDATE supplier_payments SET ${assignments} WHERE id = @id`).run({
      id: paymentId,
      ...Object.fromEntries(normalizedEntries),
    });
    const row = db.prepare('SELECT * FROM supplier_payments WHERE id = ? LIMIT 1').get(paymentId);
    return row as LocalSupplierPayment | undefined;
  },

  listSupplierTransactions(storeId: string, supplierId: string): any[] {
    // Get payments
    const payments = db.prepare(`
      SELECT id, 'payment' as type, amount, payment_method as method, NULL as status, notes, confirmed_at, created_at
      FROM supplier_payments
      WHERE store_id = ? AND supplier_id = ?
    `).all(storeId, supplierId) as any[];

    // Get purchases
    const purchases = db.prepare(`
      SELECT id, 'purchase' as type, total_amount as amount, NULL as method, status, notes, NULL as confirmed_at, created_at
      FROM purchase_orders
      WHERE store_id = ? AND supplier_id = ? AND (status = 'received' OR status = 'partial')
    `).all(storeId, supplierId) as any[];

    // Merge and sort by date descending
    return [...payments, ...purchases].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
});
