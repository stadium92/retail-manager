import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const listSchema = z.object({
  store_id: z.string().optional(),
  deliverer_id: z.string().optional(),
});

const deliveryCreateSchema = z.object({
  sale_id: z.string().optional(),
  store_id: z.string().optional(),
  deliverer_id: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  delivery_address: z.string().min(1),
  status: z.enum(['pending', 'assigned', 'in_transit', 'delivered', 'cancelled']).optional(),
  notes: z.string().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
});

const deliveryUpdateSchema = z.object({
  deliverer_id: z.string().nullable().optional(),
  status: z.enum(['pending', 'assigned', 'in_transit', 'delivered', 'cancelled']).optional(),
  notes: z.string().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
});

export async function registerDeliveryRoutes(app: FastifyInstance) {
  app.get('/rest/v1/deliveries', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = listSchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id ?? undefined;
    const delivererId = parsed.data.deliverer_id ?? (claims.role === 'deliverer' ? claims.sub : undefined);

    if (!storeId && !delivererId && claims.role !== 'master') {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const deliveries = db.listDeliveries(storeId, delivererId);
    return reply.send(deliveries);
  });

  app.post('/rest/v1/deliveries', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = deliveryCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const now = new Date().toISOString();
    const deliveryId = crypto.randomUUID();
    db.insertDelivery({
      id: deliveryId,
      sale_id: parsed.data.sale_id ?? null,
      store_id: storeId,
      deliverer_id: parsed.data.deliverer_id ?? null,
      customer_name: parsed.data.customer_name ?? null,
      customer_phone: parsed.data.customer_phone ?? null,
      delivery_address: parsed.data.delivery_address,
      status: parsed.data.status ?? 'pending',
      notes: parsed.data.notes ?? null,
      scheduled_at: parsed.data.scheduled_at ?? null,
      delivered_at: parsed.data.delivered_at ?? null,
      created_at: now,
      updated_at: now,
    });

    return reply.status(201).send(db.getDeliveryById(deliveryId));
  });

  app.patch('/rest/v1/deliveries/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker', 'deliverer']);
    if (!claims) return;

    const parsed = deliveryUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const deliveryId = (request.params as { id: string }).id;
    const existing = db.getDeliveryById(deliveryId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Delivery not found.' });
    }

    if (claims.role === 'deliverer' && existing.deliverer_id !== claims.sub) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot update this delivery.' });
    }
    if (claims.role !== 'master' && claims.store_id && existing.store_id !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot update this delivery.' });
    }

    const updated = db.updateDelivery(deliveryId, {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });
    return reply.send(updated);
  });

  app.delete('/rest/v1/deliveries/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const deliveryId = (request.params as { id: string }).id;
    const existing = db.getDeliveryById(deliveryId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Delivery not found.' });
    }
    if (claims.store_id && existing.store_id && claims.store_id !== existing.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot delete this delivery.' });
    }

    db.deleteDelivery(deliveryId);
    return reply.send({ message: 'Delivery deleted.' });
  });
}
