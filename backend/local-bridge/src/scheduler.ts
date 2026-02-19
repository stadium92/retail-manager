import { db } from './db/index.js';
import crypto from 'crypto';

export const runScheduler = () => {
  console.log('[Scheduler] Checking for scheduled orders...');
  const now = new Date();
  const allStores = db.listStores(); // We need to check for all stores, or iterate if db supports global query

  // Since db.listScheduledOrders requires storeId, we iterate stores.
  // Ideally, we'd add a global method to db.ts: listDueScheduledOrders()
  // For now, let's just assume we iterate active stores.
  
  for (const store of allStores) {
    const orders = db.listScheduledOrders(store.id);
    for (const order of orders) {
      if (!order.is_active) continue;
      
      const nextRun = new Date(order.next_run_date);
      if (nextRun <= now) {
        console.log(`[Scheduler] Processing order: ${order.name}`);
        processScheduledOrder(order);
      }
    }
  }
};

const processScheduledOrder = (order: any) => {
  const items = db.listScheduledOrderItems(order.id);
  if (items.length === 0) return;

  const now = new Date().toISOString();
  const newOrderId = crypto.randomUUID();

  // 1. Create Purchase Order
  db.insertPurchaseOrder({
    id: newOrderId,
    store_id: order.store_id,
    supplier_id: order.supplier_id || '', // Should ideally be mandatory or default
    status: 'draft',
    total_amount: 0, // Calculated later or ignored for draft
    notes: `Auto-generated from schedule: ${order.name}`,
    created_at: now,
    updated_at: now
  });

  // 2. Add Items
  for (const item of items) {
    db.insertPurchaseItem({
      id: crypto.randomUUID(),
      order_id: newOrderId,
      product_id: item.product_id,
      quantity_ordered: item.quantity,
      quantity_received: 0,
      unit_cost: 0, // Cost might change, so 0 for draft
      created_at: now
    });
  }

  // 3. Update Next Run Date
  const nextDate = calculateNextRunDate(order.recurrence_type, order.recurrence_value, new Date(order.next_run_date));
  db.db.prepare('UPDATE scheduled_orders SET next_run_date = ? WHERE id = ?').run(nextDate, order.id);

  // 4. Audit Log
  db.insertAuditLog({
    id: crypto.randomUUID(),
    timestamp: now,
    action_type: 'AUTO_ORDER_GENERATED',
    entity_affected: 'purchase_order',
    entity_id: newOrderId,
    store_id: order.store_id,
    severity: 'INFO',
    old_value: null,
    new_value: `Generated ${items.length} items`
  });
};

const calculateNextRunDate = (type: string, value: string, lastRun: Date): string => {
  const next = new Date(lastRun); // Start from the LAST scheduled date to avoid drift
  // If last run was way in the past, we might need to catch up. 
  // For simplicity, let's just add one interval.
  
  if (type === 'daily') {
    next.setDate(next.getDate() + parseInt(value || '1'));
  } else if (type === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (type === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  }
  
  // Safety: If next is still in the past (e.g. system was off for a month), 
  // fast-forward to tomorrow to avoid generating 30 orders at once.
  if (next < new Date()) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString();
  }

  return next.toISOString();
};
