import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const listSchema = z.object({
  store_id: z.string().optional(),
  status: z.string().optional(),
  supplier_id: z.string().optional(),
});

const supplierCreateSchema = z.object({
  store_id: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  balance: z.number().optional(),
  default_purchase_type: z.string().nullable().optional(),
  price_notes: z.string().nullable().optional(),
});

const supplierUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  balance: z.number().optional(),
  default_purchase_type: z.string().nullable().optional(),
  price_notes: z.string().nullable().optional(),
});

const orderCreateSchema = z.object({
  id: z.string().optional(),
  store_id: z.string().optional(),
  supplier_id: z.string().min(1),
  status: z.enum(['draft', 'ordered', 'received', 'partial']).optional(),
  total_amount: z.number().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    product_id: z.string().min(1),
    quantity_ordered: z.number().min(0),
    quantity_received: z.number().min(0),
    unit_cost: z.number().min(0),
  })).optional()
});

const orderUpdateSchema = z.object({
  status: z.enum(['draft', 'ordered', 'received', 'partial']).optional(),
  total_amount: z.number().optional(),
  notes: z.string().nullable().optional(),
});

const itemCreateSchema = z.object({
  order_id: z.string().min(1),
  product_id: z.string().min(1),
  quantity_ordered: z.number().min(0).optional(),
  quantity_received: z.number().min(0).optional(),
  unit_cost: z.number().min(0).optional(),
});

const itemUpdateSchema = z.object({
  quantity_ordered: z.number().min(0).optional(),
  quantity_received: z.number().min(0).optional(),
  unit_cost: z.number().min(0).optional(),
});

const paymentCreateSchema = z.object({
  store_id: z.string().optional(),
  supplier_id: z.string().min(1),
  amount: z.number().min(0),
  payment_method: z.string().min(1),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const paymentUpdateSchema = z.object({
  confirmed_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const scheduledOrderCreateSchema = z.object({
  store_id: z.string().optional(),
  supplier_id: z.string().optional(),
  name: z.string().min(1),
  recurrence_type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  recurrence_value: z.string().min(1),
  is_active: z.boolean().optional(),
  products: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.number().min(1)
  })).min(1)
});

const updateProductInventory = (
  productId: string, 
  receivedQty: number, 
  unitCost: number | undefined, 
  storeId: string | undefined, 
  actorId: string | undefined,
  orderId: string | undefined,
  supplierId: string | undefined
) => {
  const product = db.getProductById(productId);
  if (!product) return;

  const currentQty = product.quantity ?? 0;
  const currentCost = product.cost_price ?? 0;
  const newQuantity = currentQty + receivedQty;
  
  let newCost = currentCost;
  if (typeof unitCost === 'number' && newQuantity > 0) {
    // Weighted Average Cost: ((OldQty * OldCost) + (NewQty * NewCost)) / TotalQty
    const oldValue = currentQty * currentCost;
    const newValue = receivedQty * unitCost;
    newCost = (oldValue + newValue) / newQuantity;
  }

  const updates: Record<string, any> = { 
    quantity: newQuantity,
    cost_price: newCost 
  };
  
  const now = new Date().toISOString();
  db.updateProduct(productId, {
    ...updates,
    updated_at: now,
    updated_by: actorId ?? null,
  });

  // CRITICAL FIX: Ensure the product update is synced to Supabase
  if (storeId) {
    db.insertPendingMutation({
      id: crypto.randomUUID(),
      store_id: storeId,
      mutation_type: 'update',
      entity: 'products',
      payload: JSON.stringify({
        id: productId,
        ...updates,
        updated_at: now,
        updated_by: actorId ?? null,
      }),
      created_at: now,
      status: 'pending',
    });
  }

  // Create Product Batch
  if (receivedQty > 0 && storeId && typeof unitCost === 'number') {
    const batchId = crypto.randomUUID();
    db.insertProductBatch({
      id: batchId,
      store_id: storeId,
      product_id: productId,
      supplier_id: supplierId ?? null,
      purchase_order_id: orderId ?? null,
      purchase_price: unitCost,
      purchase_type: 'wholesale', // Default
      quantity_received: receivedQty,
      quantity_remaining: receivedQty,
      received_at: now,
      created_at: now,
      notes: orderId ? `Received from PO ${orderId.slice(0,8)}` : 'Manual reception'
    });

    const movementId = crypto.randomUUID();
    db.insertInventoryMovement({
      id: movementId,
      store_id: storeId,
      product_id: productId,
      product_name: product.name,
      movement_type: 'in',
      quantity: receivedQty,
      reason: 'Purchase receipt',
      source: 'purchase_order',
      batch_id: batchId, // Link movement to batch
      created_at: now,
      created_by: actorId ?? null,
    });

    db.insertPendingMutation({
      id: crypto.randomUUID(),
      store_id: storeId,
      mutation_type: 'upsert',
      entity: 'inventory_movements',
      payload: JSON.stringify({
        id: movementId,
        store_id: storeId,
        product_id: productId,
        product_name: product.name,
        movement_type: 'in',
        quantity: receivedQty,
        reason: 'Purchase receipt',
        source: 'purchase_order',
        batch_id: batchId,
        created_at: now,
      }),
      created_at: now,
      status: 'pending',
    });
  }
};

// Helper to calculate next run date
const calculateNextRunDate = (type: string, value: string): string => {
  const now = new Date();
  let next = new Date();
  
  if (type === 'daily') {
    next.setDate(now.getDate() + parseInt(value || '1'));
  } else if (type === 'weekly') {
    // value is day of week (0-6 or 1-7). Let's assume 0=Sunday, 1=Monday
    const targetDay = parseInt(value);
    const currentDay = now.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    next.setDate(now.getDate() + daysToAdd);
  } else if (type === 'monthly') {
    const targetDate = parseInt(value);
    next.setMonth(now.getMonth() + 1);
    next.setDate(targetDate);
  }
  return next.toISOString();
};

export async function registerPurchasingRoutes(app: FastifyInstance) {
  // --- Scheduled Orders ---
  app.get('/rest/v1/scheduled_orders', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = listSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const orders = db.listScheduledOrders(storeId);
    // Enrich with items
    const fullOrders = orders.map(o => ({
      ...o,
      items: db.listScheduledOrderItems(o.id)
    }));
    
    return reply.send(fullOrders);
  });

  app.post('/rest/v1/scheduled_orders', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = scheduledOrderCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const now = new Date().toISOString();
    const orderId = crypto.randomUUID();
    const nextRun = calculateNextRunDate(parsed.data.recurrence_type, parsed.data.recurrence_value);

    db.insertScheduledOrder({
      id: orderId,
      store_id: storeId,
      supplier_id: parsed.data.supplier_id ?? null,
      name: parsed.data.name,
      recurrence_type: parsed.data.recurrence_type,
      recurrence_value: parsed.data.recurrence_value,
      next_run_date: nextRun,
      is_active: (parsed.data.is_active ?? true) ? 1 : 0,
      created_at: now,
      updated_at: now,
    });

    for (const item of parsed.data.products) {
      db.insertScheduledOrderItem({
        id: crypto.randomUUID(),
        scheduled_order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity
      });
    }

    return reply.status(201).send({ message: 'Scheduled order created', id: orderId, next_run: nextRun });
  });

  app.delete('/rest/v1/scheduled_orders/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;
    const id = (request.params as { id: string }).id;
    db.deleteScheduledOrder(id);
    return reply.send({ message: 'Scheduled order deleted' });
  });

  app.get('/rest/v1/suppliers', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = listSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    return reply.send(db.listSuppliers(storeId));
  });

  app.post('/rest/v1/suppliers', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = supplierCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const store = db.getStoreById(storeId);
    if (!store) {
      return reply.status(400).send({ error: 'InvalidStore', message: 'Selected store does not exist.' });
    }

    const now = new Date().toISOString();
    const supplierId = crypto.randomUUID();
    db.insertSupplier({
      id: supplierId,
      store_id: storeId,
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      address: parsed.data.address ?? null,
      balance: parsed.data.balance ?? 0,
      default_purchase_type: parsed.data.default_purchase_type ?? null,
      price_notes: parsed.data.price_notes ?? null,
      created_at: now,
      updated_at: now,
    });

    return reply.status(201).send(db.getSupplierById(supplierId));
  });

  app.patch('/rest/v1/suppliers/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = supplierUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const supplierId = (request.params as { id: string }).id;
    const existing = db.getSupplierById(supplierId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Supplier not found.' });
    }
    if (claims.store_id && claims.store_id !== existing.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot update supplier.' });
    }

    const updated = db.updateSupplier(supplierId, {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });
    return reply.send(updated);
  });

  app.delete('/rest/v1/suppliers/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const supplierId = (request.params as { id: string }).id;
    const existing = db.getSupplierById(supplierId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Supplier not found.' });
    }

    if (claims.store_id && claims.store_id !== existing.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot delete supplier.' });
    }

    db.deleteSupplier(supplierId);
    return reply.send({ message: 'Supplier deleted.' });
  });

  app.get('/rest/v1/purchasing/needs', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = listSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const needs = db.getReplenishmentNeeds(storeId);
    return reply.send(needs);
  });

  app.get('/rest/v1/purchasing/all_items', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const query = z.object({
      store_id: z.string().optional(),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
    }).safeParse(request.query ?? {});

    if (!query.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: query.error.flatten() });
    }

    const storeId = query.data.store_id ?? claims.store_id;
    if (!storeId) return reply.status(400).send({ error: 'StoreRequired' });

    return reply.send(db.listAllPurchaseItems(storeId, query.data.date_from, query.data.date_to));
  });

  app.get('/rest/v1/purchase_orders', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = listSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    return reply.send(db.listPurchaseOrders(storeId, parsed.data.status));
  });

  app.post('/rest/v1/purchase_orders', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = orderCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const supplier = db.getSupplierById(parsed.data.supplier_id);
    if (!supplier) {
      return reply.status(400).send({ error: 'InvalidSupplier', message: 'Supplier not found.' });
    }
    if (supplier.store_id !== storeId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Supplier belongs to another store.' });
    }

    const now = new Date().toISOString();
    const orderId = parsed.data.id || crypto.randomUUID();
    db.insertPurchaseOrder({
      id: orderId,
      store_id: storeId,
      supplier_id: parsed.data.supplier_id,
      status: parsed.data.status ?? 'draft',
      total_amount: parsed.data.total_amount ?? 0,
      notes: parsed.data.notes ?? null,
      created_at: now,
      updated_at: now,
    });

    if (parsed.data.items && parsed.data.items.length > 0) {
      for (const item of parsed.data.items) {
        db.insertPurchaseItem({
          id: item.id || crypto.randomUUID(),
          order_id: orderId,
          product_id: item.product_id,
          quantity_ordered: item.quantity_ordered,
          quantity_received: item.quantity_received,
          unit_cost: item.unit_cost,
          created_at: now,
        });
      }
    }

    return reply.status(201).send(db.getPurchaseOrderById(orderId));
  });

  app.patch('/rest/v1/purchase_orders/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = orderUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const orderId = (request.params as { id: string }).id;
    const existing = db.getPurchaseOrderById(orderId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Order not found.' });
    }
    if (claims.store_id && claims.store_id !== existing.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot update order.' });
    }

    const updated = db.updatePurchaseOrder(orderId, {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });
    return reply.send(updated);
  });

  app.delete('/rest/v1/purchase_orders/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const orderId = (request.params as { id: string }).id;
    const existing = db.getPurchaseOrderById(orderId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Order not found.' });
    }
    if (claims.store_id && claims.store_id !== existing.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot delete order.' });
    }
    db.deletePurchaseOrder(orderId);
    return reply.send({ message: 'Order deleted.' });
  });

  app.get('/rest/v1/purchase_items', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const query = z.object({ order_id: z.string().min(1) }).safeParse(request.query ?? {});
    if (!query.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: query.error.flatten() });
    }

    const order = db.getPurchaseOrderById(query.data.order_id);
    if (!order) {
      return reply.status(404).send({ error: 'NotFound', message: 'Order not found.' });
    }
    if (claims.store_id && claims.store_id !== order.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot view items.' });
    }

    return reply.send(db.listPurchaseItems(query.data.order_id));
  });

  app.post('/rest/v1/purchase_items', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = itemCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const order = db.getPurchaseOrderById(parsed.data.order_id);
    if (!order) {
      return reply.status(404).send({ error: 'NotFound', message: 'Order not found.' });
    }
    if (claims.store_id && claims.store_id !== order.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot add items.' });
    }

    const now = new Date().toISOString();
    const itemId = crypto.randomUUID();
    db.insertPurchaseItem({
      id: itemId,
      order_id: parsed.data.order_id,
      product_id: parsed.data.product_id,
      quantity_ordered: parsed.data.quantity_ordered ?? 0,
      quantity_received: parsed.data.quantity_received ?? 0,
      unit_cost: parsed.data.unit_cost ?? 0,
      created_at: now,
    });

    return reply.status(201).send(db.listPurchaseItems(parsed.data.order_id));
  });

  app.patch('/rest/v1/purchase_items/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = itemUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const itemId = (request.params as { id: string }).id;
    const existing = db.updatePurchaseItem(itemId, {});
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Item not found.' });
    }
    const order = db.getPurchaseOrderById(existing.order_id);
    if (order && claims.store_id && claims.store_id !== order.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot update items.' });
    }

    const updated = db.updatePurchaseItem(itemId, parsed.data);
    return reply.send(updated);
  });

  app.delete('/rest/v1/purchase_items/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const itemId = (request.params as { id: string }).id;
    const existing = db.updatePurchaseItem(itemId, {});
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Item not found.' });
    }
    const order = db.getPurchaseOrderById(existing.order_id);
    if (order && claims.store_id && claims.store_id !== order.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot delete items.' });
    }
    db.deletePurchaseItem(itemId);
    return reply.send({ message: 'Item deleted.' });
  });

  app.post('/rest/v1/purchase_orders/:id/receive', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const orderId = (request.params as { id: string }).id;
    const itemsPayload = z
      .array(
        z.object({
          id: z.string().min(1),
          quantity_received: z.number().min(0),
          unit_cost: z.number().min(0),
        })
      )
      .safeParse(request.body ?? []);
    if (!itemsPayload.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: itemsPayload.error.flatten() });
    }

    const order = db.getPurchaseOrderById(orderId);
    if (!order) {
      return reply.status(404).send({ error: 'NotFound', message: 'Order not found.' });
    }
    if (claims.store_id && claims.store_id !== order.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot receive order.' });
    }

    let newTotalAmount = 0;
    itemsPayload.data.forEach((item) => {
      db.updatePurchaseItem(item.id, {
        quantity_received: item.quantity_received,
        unit_cost: item.unit_cost,
      });
      newTotalAmount += (item.quantity_received * item.unit_cost);
    });

    const updatedItems = db.listPurchaseItems(orderId);
    updatedItems.forEach((item) => {
      const received = itemsPayload.data.find((payload) => payload.id === item.id);
      if (received) {
        updateProductInventory(
          item.product_id, 
          received.quantity_received, 
          received.unit_cost, 
          order.store_id, 
          claims.sub, 
          order.id, 
          order.supplier_id
        );
      }
    });

    const allReceived = updatedItems.every((item) => item.quantity_received >= item.quantity_ordered);
    const status = allReceived ? 'received' : 'partial';
    
    // Update order with actual received total
    db.updatePurchaseOrder(orderId, { 
      status, 
      total_amount: newTotalAmount,
      updated_at: new Date().toISOString() 
    });

    // Update supplier balance based on actual received total
    const supplier = db.getSupplierById(order.supplier_id);
    if (supplier) {
      db.updateSupplier(order.supplier_id, {
        balance: (supplier.balance || 0) + newTotalAmount,
        updated_at: new Date().toISOString()
      });
    }

    return reply.send({
      order: db.getPurchaseOrderById(orderId),
      items: updatedItems,
    });
  });

  app.get('/rest/v1/supplier_payments', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = listSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const payments = db.listSupplierPayments(storeId, parsed.data.supplier_id);
    const withSupplier = payments.map((payment) => {
      const supplier = db.getSupplierById(payment.supplier_id);
      return {
        ...payment,
        supplier: supplier ? { name: supplier.name } : null,
      };
    });
    return reply.send(withSupplier);
  });

  app.post('/rest/v1/supplier_payments', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = paymentCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const supplier = db.getSupplierById(parsed.data.supplier_id);
    if (!supplier) {
      return reply.status(400).send({ error: 'InvalidSupplier', message: 'Supplier not found.' });
    }
    if (supplier.store_id !== storeId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Supplier belongs to another store.' });
    }

    const now = new Date().toISOString();
    const paymentId = crypto.randomUUID();
    db.insertSupplierPayment({
      id: paymentId,
      store_id: storeId,
      supplier_id: parsed.data.supplier_id,
      amount: parsed.data.amount,
      payment_method: parsed.data.payment_method,
      reference: parsed.data.reference ?? null,
      notes: parsed.data.notes ?? null,
      created_at: now,
    });

    const newBalance = (supplier.balance || 0) - parsed.data.amount;
    db.updateSupplier(parsed.data.supplier_id, {
      balance: newBalance,
      updated_at: now,
    });

    return reply.status(201).send(db.listSupplierPayments(storeId));
  });

  app.patch('/rest/v1/supplier_payments/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = paymentUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const paymentId = (request.params as { id: string }).id;
    const existing = db.getSupplierPaymentById(paymentId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Payment not found.' });
    }
    
    if (claims.store_id && claims.store_id !== existing.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot update payment.' });
    }

    const updated = db.updateSupplierPayment(paymentId, parsed.data);
    return reply.send(updated);
  });

  app.get('/rest/v1/supplier_transactions', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const query = z.object({
      store_id: z.string().optional(),
      supplier_id: z.string().min(1),
    }).safeParse(request.query ?? {});

    if (!query.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: query.error.flatten() });
    }

    const storeId = query.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const transactions = db.listSupplierTransactions(storeId, query.data.supplier_id);
    return reply.send(transactions);
  });
}
