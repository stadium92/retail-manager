import Database from 'better-sqlite3';
import { LocalPurchaseOrder, LocalPurchaseItem, LocalSupplier, LocalSupplierPayment } from '../types.js';

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

  getPurchaseOrderById(orderId: string): LocalPurchaseOrder | undefined {
    const row = db.prepare('SELECT * FROM purchase_orders WHERE id = ? LIMIT 1').get(orderId);
    return row as LocalPurchaseOrder | undefined;
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
    db.prepare(`UPDATE purchase_orders SET ${assignments} WHERE id = @id`).run({
      id: orderId,
      ...Object.fromEntries(normalizedEntries),
    });
    const row = db.prepare('SELECT * FROM purchase_orders WHERE id = ? LIMIT 1').get(orderId);
    return row as LocalPurchaseOrder | undefined;
  },

  deletePurchaseOrder(orderId: string) {
    db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(orderId);
    db.prepare('DELETE FROM purchase_items WHERE order_id = ?').run(orderId);
  },

  listPurchaseItems(orderId: string): (LocalPurchaseItem & { product?: { id: string; name: string } })[] {
    const rows = db
      .prepare(`
        SELECT pi.*, p.id as p_id, p.name as p_name
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
        name: row.p_name
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
    db.prepare(`UPDATE purchase_items SET ${assignments} WHERE id = @id`).run({
      id: itemId,
      ...Object.fromEntries(normalizedEntries),
    });
    const row = db.prepare('SELECT * FROM purchase_items WHERE id = ? LIMIT 1').get(itemId);
    return row as LocalPurchaseItem | undefined;
  },

  deletePurchaseItem(itemId: string) {
    db.prepare('DELETE FROM purchase_items WHERE id = ?').run(itemId);
  },

  listSupplierPayments(storeId: string): LocalSupplierPayment[] {
    const rows = db
      .prepare('SELECT * FROM supplier_payments WHERE store_id = ? ORDER BY created_at DESC')
      .all(storeId);
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
        created_at
      ) VALUES (
        @id,
        @store_id,
        @supplier_id,
        @amount,
        @payment_method,
        @reference,
        @notes,
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
    });
  },
});
