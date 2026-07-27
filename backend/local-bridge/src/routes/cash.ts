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

const closingCreateSchema = z.object({
  store_id: z.string().optional(),
  cashier_name: z.string().nullable().optional(),
  opening_balance: z.number().optional().default(0),
  total_sales: z.number().optional().default(0),
  expected_balance: z.number().optional().default(0),
  actual_balance: z.number().optional().default(0),
  difference: z.number().optional().default(0),
  bill_details_json: z.string().nullable().optional(),
  observations: z.string().nullable().optional(),
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

  // Fermeture de Caisse (end-of-day cash closing). Didn't exist at all -
  // the frontend's save button posted here and 404'd silently, so no
  // closing was ever actually persisted.
  app.get('/rest/v1/cash_closings', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const storeId = (request.query as any).store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired' });
    }

    return reply.send(db.listCashClosings(storeId));
  });

  app.post('/rest/v1/cash_closings', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = closingCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) return reply.status(400).send({ error: 'StoreRequired' });

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    db.insertCashClosing({
      ...parsed.data,
      id,
      store_id: storeId,
      worker_id: claims.sub,
      created_at: now,
    });

    return reply.status(201).send({ id });
  });
}
