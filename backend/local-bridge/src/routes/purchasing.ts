import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db.js';
import { authenticateRequest } from './utils/auth.js';

const listSchema = z.object({
  store_id: z.string().optional(),
  status: z.string().optional(),
});

const supplierCreateSchema = z.object({
  store_id: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  balance: z.number().optional(),
});

const supplierUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  balance: z.number().optional(),
});

const orderCreateSchema = z.object({
  store_id: z.string().optional(),
  supplier_id: z.string().min(1),
  status: z.enum(['draft', 'ordered', 'received', 'partial']).optional(),
  total_amount: z.number().optional(),
  notes: z.string().nullable().optional(),
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

const updateProductInventory = (productId: string, receivedQty: number, unitCost?: number, storeId?: string, actorId?: string) => {
  const product = db.getProductById(productId);
  if (!product) return;
  const newQuantity = (product.quantity ?? 0) + receivedQty;
  const updates: Record<string, number> = { quantity: newQuantity };
  if (typeof unitCost === 'number') {
    updates.cost_price = unitCost;
  }
  const now = new Date().toISOString();
  db.updateProduct(productId, {
    ...updates,
    updated_at: now,
    updated_by: actorId ?? null,
  });

  if (receivedQty > 0 && storeId) {
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
        created_at: now,
      }),
      created_at: now,
      status: 'pending',
    });
  }
};

export async function registerPurchasingRoutes(app: FastifyInstance) {
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
    const orderId = crypto.randomUUID();
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

    itemsPayload.data.forEach((item) => {
      db.updatePurchaseItem(item.id, {
        quantity_received: item.quantity_received,
        unit_cost: item.unit_cost,
      });
    });

    const updatedItems = db.listPurchaseItems(orderId);
    updatedItems.forEach((item) => {
      const received = itemsPayload.data.find((payload) => payload.id === item.id);
      if (received) {
        updateProductInventory(item.product_id, received.quantity_received, received.unit_cost, order.store_id, claims.sub);
      }
    });

    const allReceived = updatedItems.every((item) => item.quantity_received >= item.quantity_ordered);
    const status = allReceived ? 'received' : 'partial';
    db.updatePurchaseOrder(orderId, { status, updated_at: new Date().toISOString() });

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

    const payments = db.listSupplierPayments(storeId);
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
}
