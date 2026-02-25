import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const salesQuerySchema = z.object({
  store_id: z.string().optional(),
  limit: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

const saleCreateSchema = z.object({
  id: z.string().optional(),
  store_id: z.string().optional(),
  worker_id: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  sale_type: z.enum(['detail', 'gros', 'proforma']).optional(),
  total_price: z.number().optional(),
  discount: z.number().nullable().optional(),
  tax: z.number().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  payment_status: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        product_id: z.string().nullable().optional(),
        product_name: z.string().min(1),
        quantity: z.number().min(0.01),
        unit_price: z.number().min(0),
        discount: z.number().nullable().optional(),
        total: z.number().min(0),
      })
    )
    .optional(),
});

const saleUpdateSchema = z.object({
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  sale_type: z.enum(['detail', 'gros', 'proforma']).optional(),
  total_price: z.number().optional(),
  discount: z.number().nullable().optional(),
  tax: z.number().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  payment_status: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
});

const saleItemsQuerySchema = z.object({
  sale_id: z.string().min(1),
});

export async function registerSalesRoutes(app: FastifyInstance) {
  app.get('/rest/v1/sales', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = salesQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const requestedStoreId = parsed.data.store_id;
    const limit = parsed.data.limit ? Number(parsed.data.limit) : undefined;
    const dateFrom = parsed.data.date_from;
    const dateTo = parsed.data.date_to;

    if (requestedStoreId) {
      const sales = db.listSales(requestedStoreId, limit, dateFrom, dateTo);
      return reply.send(sales);
    }

    if (claims.role === 'master') {
      return reply.send(db.listSales(undefined, limit, dateFrom, dateTo));
    }

    const storeId = claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const sales = db.listSales(storeId, limit, dateFrom, dateTo);
    return reply.send(sales);
  });

  app.get('/rest/v1/sales/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const saleId = (request.params as { id: string }).id;
    const sale = db.getSaleById(saleId);
    if (!sale) {
      return reply.status(404).send({ error: 'NotFound', message: 'Sale not found.' });
    }
    if (claims.store_id && claims.store_id !== sale.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot view this sale.' });
    }

    return reply.send(sale);
  });

  app.post('/rest/v1/sales', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = saleCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const now = new Date().toISOString();
    const saleId = parsed.data.id || crypto.randomUUID();
    
    const saleData = {
      id: saleId,
      store_id: storeId,
      worker_id: parsed.data.worker_id ?? claims.sub ?? null,
      client_id: parsed.data.client_id ?? null,
      customer_name: parsed.data.customer_name ?? null,
      customer_phone: parsed.data.customer_phone ?? null,
      sale_type: parsed.data.sale_type ?? 'detail',
      total_price: parsed.data.total_price ?? 0,
      discount: parsed.data.discount ?? 0,
      tax: parsed.data.tax ?? 0,
      payment_method: parsed.data.payment_method ?? 'cash',
      payment_status: parsed.data.payment_status ?? 'paid',
      notes: parsed.data.notes ?? null,
      invoice_number: parsed.data.invoice_number ?? null,
      created_at: now,
      updated_at: now,
    };

    const items = (parsed.data.items ?? []).map(item => ({
      id: item.id || crypto.randomUUID(),
      sale_id: saleId,
      product_id: item.product_id ?? null,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount ?? 0,
      total: item.total,
      created_at: now,
    }));

    // Use atomic transaction
    db.createSaleWithItems(saleData as any, items as any);

    return reply.status(201).send(db.getSaleById(saleId));
  });

  app.patch('/rest/v1/sales/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = saleUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const saleId = (request.params as { id: string }).id;
    const existing = db.getSaleById(saleId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Sale not found.' });
    }
    if (claims.store_id && claims.store_id !== existing.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot update sale.' });
    }

    const updated = db.updateSale(saleId, { ...parsed.data, updated_at: new Date().toISOString() });
    return reply.send(updated);
  });

  app.delete('/rest/v1/sales/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const saleId = (request.params as { id: string }).id;
    const existing = db.getSaleById(saleId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Sale not found.' });
    }
    if (claims.store_id && claims.store_id !== existing.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot delete sale.' });
    }

    db.deleteSale(saleId);

    db.insertAuditLog({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      user_id: claims.sub,
      action_type: 'sale_deletion',
      entity_affected: 'sale',
      entity_id: saleId,
      old_value: JSON.stringify({ total_price: existing.total_price, created_at: existing.created_at }),
      store_id: existing.store_id,
    });

    return reply.send({ message: 'Sale deleted.' });
  });

  app.get('/rest/v1/sale_items', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = saleItemsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const sale = db.getSaleById(parsed.data.sale_id);
    if (!sale) {
      return reply.status(404).send({ error: 'NotFound', message: 'Sale not found.' });
    }
    if (claims.store_id && claims.store_id !== sale.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot view items.' });
    }

    return reply.send(db.listSaleItems(parsed.data.sale_id));
  });
}
