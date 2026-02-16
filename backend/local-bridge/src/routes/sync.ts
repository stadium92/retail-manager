import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { env } from '../env.js';
import { db } from '../db.js';
import { authenticateRequest } from './utils/auth.js';

type SupabaseHeaders = Record<string, string>;

const pushSchema = z.object({
  supabase_service_key: z.string().min(1),
  entity: z.string().optional(),
  payload: z.any().optional(),
  store_id: z.string().optional(),
});

const buildSupabaseHeaders = (): SupabaseHeaders => ({
  apikey: env.supabaseServiceKey,
  Authorization: `Bearer ${env.supabaseServiceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates',
});

export async function registerSyncRoutes(app: FastifyInstance) {
  app.post('/sync/push', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['supabase-sync']);
    if (!claims) return;

    const parsed = pushSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    if (!env.supabaseServiceKey || parsed.data.supabase_service_key !== env.supabaseServiceKey) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid Supabase service key.' });
    }

    if (!env.supabaseUrl) {
      return reply.status(400).send({ error: 'ConfigMissing', message: 'SUPABASE_URL not configured.' });
    }

    let pending = db.listPendingMutations('pending');
    if (parsed.data.entity && parsed.data.payload) {
      const now = new Date().toISOString();
      db.insertPendingMutation({
        id: crypto.randomUUID(),
        store_id: parsed.data.store_id ?? null,
        mutation_type: 'upsert',
        entity: parsed.data.entity,
        payload: JSON.stringify(parsed.data.payload),
        created_at: now,
        status: 'pending',
      });
      pending = db.listPendingMutations('pending');
    }

    if (pending.length == 0) {
      return reply.send({ pushed: 0, failed: 0, pending: 0 });
    }

    let pushed = 0;
    let failed = 0;

    for (const mutation of pending) {
      try {
        const payload = JSON.parse(mutation.payload);
        const res = await fetch(
          `${env.supabaseUrl}/rest/v1/${mutation.entity}`,
          {
            method: 'POST',
            headers: buildSupabaseHeaders(),
            body: JSON.stringify(Array.isArray(payload) ? payload : [payload]),
          }
        );

        if (!res.ok) {
          failed += 1;
          db.updatePendingMutationStatus(mutation.id, 'failed');
          continue;
        }

        pushed += 1;
        db.updatePendingMutationStatus(mutation.id, 'synced');
      } catch {
        failed += 1;
        db.updatePendingMutationStatus(mutation.id, 'failed');
      }
    }

    const remaining = db.listPendingMutations('pending').length;
    return reply.send({ pushed, failed, pending: remaining });
  });

  app.get('/sync/pull', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['supabase-sync']);
    if (!claims) return;

    if (!env.supabaseUrl || !env.supabaseServiceKey) {
      return reply.status(400).send({ error: 'ConfigMissing', message: 'Supabase credentials not configured.' });
    }

    const url = new URL(`${env.supabaseUrl}/rest/v1/products`);
    const storeId = (request.query as { store_id?: string }).store_id;
    if (storeId) {
      url.searchParams.set('store_id', `eq.${storeId}`);
    }

    const res = await fetch(url.toString(), {
      headers: buildSupabaseHeaders(),
    });

    if (!res.ok) {
      return reply.status(502).send({ error: 'SupabaseError', message: 'Failed to pull data.' });
    }

    const products = await res.json();
    for (const product of products) {
      db.insertProduct({
        id: product.id,
        store_id: product.store_id,
        name: product.name,
        description: product.description ?? null,
        sku: product.sku ?? null,
        barcode: product.barcode ?? null,
        category: product.category ?? null,
        cost_price: product.cost_price ?? null,
        unit_price: product.unit_price ?? 0,
        wholesale_price: product.wholesale_price ?? null,
        min_quantity: product.min_quantity ?? 0,
        quantity: product.quantity ?? 0,
        image_url: product.image_url ?? null,
        created_at: product.created_at ?? new Date().toISOString(),
        updated_at: product.updated_at ?? new Date().toISOString(),
        created_by: null,
        updated_by: null,
      });
    }

    return reply.send({ pulled: products.length });
  });
}
