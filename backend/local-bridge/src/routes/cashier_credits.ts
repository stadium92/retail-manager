import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const cashierCreditQuerySchema = z.object({
  store_id: z.string().optional(),
});

const cashierCreditCreateSchema = z.object({
  id: z.string().optional(),
  store_id: z.string().optional(),
  client_name: z.string().min(1),
  amount: z.number().min(0.01),
  notes: z.string().nullable().optional(),
  status: z.enum(['unpaid', 'paid']).optional(),
  created_at: z.string().optional(),
});

const cashierCreditUpdateSchema = z.object({
  status: z.enum(['unpaid', 'paid']),
});

export async function registerCashierCreditsRoutes(app: FastifyInstance) {
  app.get('/rest/v1/cashier_credits', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = cashierCreditQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    let storeId = parsed.data.store_id ?? claims.store_id;
    if (claims.role !== 'master') {
      storeId = claims.store_id;
    }

    const credits = db.listCashierCredits(storeId || undefined);
    return reply.send(credits);
  });

  app.get('/rest/v1/cashier_credits/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const id = (request.params as { id: string }).id;
    const credit = db.getCashierCreditById(id);

    if (!credit) {
      return reply.status(404).send({ error: 'NotFound', message: 'Credit record not found.' });
    }

    if (claims.role !== 'master' && claims.store_id && credit.store_id !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied.' });
    }

    return reply.send(credit);
  });

  app.post('/rest/v1/cashier_credits', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = cashierCreditCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const now = new Date().toISOString();
    const credit = {
      id: parsed.data.id || crypto.randomUUID(),
      store_id: storeId,
      worker_id: claims.sub,
      client_name: parsed.data.client_name,
      amount: parsed.data.amount,
      status: parsed.data.status ?? 'unpaid',
      notes: parsed.data.notes ?? null,
      created_at: parsed.data.created_at || now,
      updated_at: now,
    };

    db.insertCashierCredit(credit);
    return reply.status(201).send(credit);
  });

  app.patch('/rest/v1/cashier_credits/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const id = (request.params as { id: string }).id;
    const parsed = cashierCreditUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const credit = db.getCashierCreditById(id);
    if (!credit) {
      return reply.status(404).send({ error: 'NotFound', message: 'Credit record not found.' });
    }

    if (claims.role !== 'master' && claims.store_id && credit.store_id !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied.' });
    }

    const updated = db.updateCashierCreditStatus(id, parsed.data.status);
    return reply.send(updated);
  });

  app.delete('/rest/v1/cashier_credits/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const id = (request.params as { id: string }).id;
    const credit = db.getCashierCreditById(id);
    if (!credit) {
      return reply.status(404).send({ error: 'NotFound', message: 'Credit record not found.' });
    }

    if (claims.role !== 'master' && claims.store_id && credit.store_id !== claims.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied.' });
    }

    db.deleteCashierCredit(id);
    return reply.send({ success: true });
  });
}
