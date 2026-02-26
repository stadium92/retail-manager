import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const txCreateSchema = z.object({
  store_id: z.string().optional(),
  type: z.enum(['in', 'out']),
  amount: z.number().min(0.01),
  category: z.string().min(1),
  description: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
});

export async function registerCashRoutes(app: FastifyInstance) {
  app.get('/rest/v1/cash_transactions', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const storeId = (request.query as any).store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired' });
    }

    return reply.send(db.listCashTransactions(storeId));
  });

  app.post('/rest/v1/cash_transactions', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = txCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) return reply.status(400).send({ error: 'StoreRequired' });

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    db.insertCashTransaction({
      ...parsed.data,
      id,
      store_id: storeId,
      worker_id: claims.sub,
      created_at: now,
      updated_at: now,
    });

    return reply.status(201).send({ id });
  });
}
