import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const storeCreateSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

const storeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  default_price_tier: z.number().int().min(1).max(4).optional(),
});

export async function registerStoreRoutes(app: FastifyInstance) {
  app.get('/rest/v1/stores', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    // Workers can see all stores (to map IDs to names), or filter?
    // db.listStores(claims.sub) filters by owner_id.
    // If worker is not owner, it returns empty list?
    // We should probably allow listing all stores for name resolution.
    // Or check if db.listStores handles null ownerId to return all?
    const stores = db.listStores(); // Remove claim.sub filter to allow seeing all stores
    return reply.send(stores);
  });

  app.post('/rest/v1/stores', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const parsed = storeCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const now = new Date().toISOString();
    const storeId = crypto.randomUUID();
    db.insertStore({
      id: storeId,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      owner_id: claims.sub,
      default_price_tier: 1,
      created_at: now,
      updated_at: now,
    });

    return reply.status(201).send(db.getStoreById(storeId));
  });

  app.patch('/rest/v1/stores/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const parsed = storeUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = (request.params as { id: string }).id;
    const existing = db.getStoreById(storeId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Store not found.' });
    }
    const updated = db.updateStore(storeId, { ...parsed.data, updated_at: new Date().toISOString() });
    return reply.send(updated);
  });

  app.delete('/rest/v1/stores/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const storeId = (request.params as { id: string }).id;
    const existing = db.getStoreById(storeId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Store not found.' });
    }
    db.deleteStore(storeId);
    return reply.send({ message: 'Store deleted.' });
  });
}
