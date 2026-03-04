import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { env } from '../env.js';
import { db } from '../db/index.js';
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
  // Handshake / capabilities endpoint
  app.get('/sync/handshake', async (_request, reply) => {
    return reply.send({
      server_time: new Date().toISOString(),
      min_supported_client: '0.1.0',
      feature_flags: {
        push_enabled: true,
        pull_enabled: true,
        conflict_resolution: 'server_wins',
      },
    });
  });

  // Sync diagnostics endpoint for admins
  app.get('/sync/diagnostics', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const storeId = (request.query as { store_id?: string }).store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'MissingStoreId', message: 'store_id query parameter is required.' });
    }

    const stats = db.getOutboxStats(storeId);
    const syncState = db.getSyncState(storeId);

    return reply.send({
      store_id: storeId,
      outbox: stats,
      sync_state: syncState ?? {
        store_id: storeId,
        last_push_at: null,
        last_pull_cursor: null,
        last_success_at: null,
        last_error: null,
      },
    });
  });

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
    const claims = authenticateRequest(request, reply, ['worker', 'master', 'supabase-sync']);
    if (!claims) return;

    if (!env.supabaseUrl || !env.supabaseServiceKey) {
      return reply.status(400).send({ error: 'ConfigMissing', message: 'Supabase credentials not configured.' });
    }

    const storeId = (request.query as { store_id?: string }).store_id || claims.store_id;
    if (!storeId) {
        return reply.status(400).send({ error: 'StoreRequired', message: 'Store ID is required for pulling data.' });
    }

    let pulledCount = 0;

    try {
        // 1. Pull Families
        const familyUrl = new URL(`${env.supabaseUrl}/rest/v1/product_families`);
        familyUrl.searchParams.set('store_id', `eq.${storeId}`);
        const famRes = await fetch(familyUrl.toString(), { headers: buildSupabaseHeaders() });
        if (famRes.ok) {
            const families = await famRes.json();
            for (const fam of families) {
                db.insertProductFamily({
                    id: fam.id,
                    store_id: fam.store_id,
                    name: fam.name,
                    description: fam.description,
                    parent_id: fam.parent_id,
                    created_at: fam.created_at,
                    updated_at: fam.updated_at
                });
            }
            pulledCount += families.length;
        }

        // 2. Pull Suppliers
        const supplierUrl = new URL(`${env.supabaseUrl}/rest/v1/suppliers`);
        supplierUrl.searchParams.set('store_id', `eq.${storeId}`);
        const supRes = await fetch(supplierUrl.toString(), { headers: buildSupabaseHeaders() });
        if (supRes.ok) {
            const suppliers = await supRes.json();
            for (const sup of suppliers) {
                db.insertSupplier({
                    id: sup.id,
                    store_id: sup.store_id,
                    name: sup.name,
                    email: sup.email,
                    phone: sup.phone,
                    address: sup.address,
                    balance: sup.balance || 0,
                    created_at: sup.created_at,
                    updated_at: sup.updated_at
                });
            }
            pulledCount += suppliers.length;
        }

        // 3. Pull Profiles (Users)
        const profileUrl = new URL(`${env.supabaseUrl}/rest/v1/profiles`);
        const profRes = await fetch(profileUrl.toString(), { headers: buildSupabaseHeaders() });
        if (profRes.ok) {
            const profiles = await profRes.json();
            for (const profile of profiles) {
                db.insertUser({
                    id: profile.id,
                    email: profile.email,
                    full_name: profile.full_name,
                    phone: profile.phone,
                    password_hash: '', // We don't have the hash, but it allows mapping
                    created_at: profile.created_at,
                    updated_at: profile.updated_at || profile.created_at,
                    role: 'worker' // Default to worker, roles are in user_roles
                });
            }
            pulledCount += profiles.length;
        }

        // 4. Pull Products
        const url = new URL(`${env.supabaseUrl}/rest/v1/products`);
        url.searchParams.set('store_id', `eq.${storeId}`);

        const res = await fetch(url.toString(), {
          headers: buildSupabaseHeaders(),
        });

        if (!res.ok) {
          throw new Error('Failed to pull products from Supabase');
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
            wholesale_price_ht: product.wholesale_price_ht ?? null,
            selling_price_2: product.selling_price_2 ?? null,
            selling_price_3: product.selling_price_3 ?? null,
            selling_price_4: product.selling_price_4 ?? null,
            min_quantity: product.min_quantity ?? 0,
            quantity: product.quantity ?? 0,
            image_url: product.image_url ?? null,
            unit_type: product.unit_type ?? 'Piece',
            packaging: product.packaging ?? '1',
            created_at: product.created_at ?? new Date().toISOString(),
            updated_at: product.updated_at ?? new Date().toISOString(),
            created_by: null,
            updated_by: null,
          });
        }
        pulledCount += products.length;

        return reply.send({ pulled: pulledCount, products: products.length });
    } catch (e: any) {
        console.error('[Sync] Pull failed:', e);
        return reply.status(502).send({ error: 'SyncFailed', message: e.message });
    }
  });
}
