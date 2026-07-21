import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { env } from '../env.js';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';
import { buildSupabasePayload, getSupabaseTableForEntity } from '../db/repositories/sync_payload_map.js';

type SupabaseHeaders = Record<string, string>;

// After this many failed attempts, a sync_outbox entry is parked in a
// terminal 'failed' state instead of being retried again on every future
// /sync/push call. Without a cap, an entry that can never succeed (e.g. its
// target table doesn't exist yet in Supabase) would be retried forever,
// burning a request on every single app launch indefinitely.
const MAX_OUTBOX_RETRIES = 8;

// Cap on how many sync_outbox entries are actually pushed to Supabase (i.e.
// how many outbound HTTP calls are made) in a single /sync/push call. The
// backfill sweep that runs first can queue thousands of historical records
// in one local DB pass (cheap - no network calls); draining that whole
// backlog in one HTTP request per record could make a single /sync/push
// call take minutes on a large existing dataset. Leftover pending entries
// are simply picked up by the next call (every app launch, or a manual
// retry), so a large backlog drains over a few launches rather than one.
const MAX_OUTBOX_PUSH_PER_CALL = 300;

const pushSchema = z.object({
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

  // Health check for the "local bridge reachable" indicator - the frontend
  // (LocalBridgeSyncService.checkNetworkHealth) polls this exact path. It
  // used to poll a path that was never registered here, so the indicator
  // always read OFFLINE regardless of the bridge's real state.
  app.get('/sync/health', async (_request, reply) => {
    return reply.send({ status: 'ONLINE', message: 'Connected to local sync bridge' });
  });

  // Minimal SSE stream so the frontend's EventSource actually connects -
  // it also used to point at an unregistered path, whose permanent
  // connection failure kept flipping the health indicator back to OFFLINE
  // seconds after every successful health check. No live data_merged
  // events are emitted yet (push/pull still work via polling), this only
  // keeps the connection open so onopen/onerror reflect real reachability.
  app.get('/sync/events', (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    reply.raw.write(':ok\n\n');
    const heartbeat = setInterval(() => {
      reply.raw.write(':heartbeat\n\n');
    }, 20000);
    request.raw.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  // Manual "retry failed" button in Settings - resets failed outbox
  // entries back to pending so the next push drain picks them up again.
  app.post('/sync/outbox/retry', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['any']);
    if (!claims) return;
    const reset_count = db.resetFailedOutboxEntries();
    return reply.send({ reset_count });
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
    // Was gated on role 'supabase-sync', a role no real login ever issues
    // (users only ever get master/worker/deliverer) - every call from the
    // actual app 403'd unconditionally. The Supabase service key itself
    // isn't a caller-supplied credential at all - it's baked into this
    // process's own env at build time and used directly below via
    // buildSupabaseHeaders(); any authenticated local session may trigger
    // a push/pull, same as every other local-bridge endpoint.
    const claims = authenticateRequest(request, reply, ['any']);
    if (!claims) return;

    const parsed = pushSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    if (!env.supabaseServiceKey) {
      return reply.status(400).send({ error: 'ConfigMissing', message: 'SUPABASE_SERVICE_KEY not configured on this build.' });
    }

    if (!env.supabaseUrl) {
      return reply.status(400).send({ error: 'ConfigMissing', message: 'SUPABASE_URL not configured.' });
    }

    // One-time (idempotent, safe to re-run every call) catch-up sweep for
    // records that predate the outbox wiring on their table - see
    // outbox_backfill.repo.ts. Runs before both drains below so newly
    // queued historical records get picked up in the same call.
    let backfill: { totalScanned: number; totalQueued: number } | null = null;
    try {
      backfill = db.runOutboxBackfill();
    } catch (err) {
      request.log.error({ err }, '[sync] outbox backfill sweep failed');
    }

    let pushed = 0;
    let failed = 0;

    // --- Drain 1: pending_mutations (legacy queue - inventory_movements,
    // product cost/qty updates from purchase receiving, and the ad-hoc
    // single-mutation push below). Unchanged from before this fix. ---
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

    // --- Drain 2: sync_outbox. This table has been populated by every
    // create/update/delete in sales/clients/deliveries/stores/cash/products/
    // suppliers/purchase_orders/purchase_items (via emitOutbox()) since
    // those repositories were written, but until this fix nothing ever read
    // it back out - it was a dead letter queue. This loop is what actually
    // makes that data reach Supabase. ---
    const outboxBatch = db.listPendingOutboxAll(MAX_OUTBOX_PUSH_PER_CALL);
    for (const entry of outboxBatch) {
      const table = getSupabaseTableForEntity(entry.entity_type);
      if (!table) {
        // Unknown entity_type - nothing we can map it to. Don't retry.
        failed += 1;
        db.updateOutboxStatus(entry.id, 'failed', `No Supabase table mapping for entity_type "${entry.entity_type}"`);
        continue;
      }

      try {
        let res: Response;
        if (entry.op_type === 'delete') {
          res = await fetch(
            `${env.supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(entry.entity_id)}`,
            { method: 'DELETE', headers: buildSupabaseHeaders() }
          );
        } else {
          const raw = JSON.parse(entry.payload_json) as Record<string, unknown>;
          const payload = buildSupabasePayload(entry.entity_type, raw);
          if (!payload) {
            failed += 1;
            db.updateOutboxStatus(entry.id, 'failed', `No payload mapping for entity_type "${entry.entity_type}"`);
            continue;
          }
          res = await fetch(
            `${env.supabaseUrl}/rest/v1/${table}`,
            {
              method: 'POST',
              headers: buildSupabaseHeaders(),
              body: JSON.stringify([payload]),
            }
          );
        }

        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          failed += 1;
          if (entry.retry_count + 1 >= MAX_OUTBOX_RETRIES) {
            db.updateOutboxStatus(entry.id, 'failed', errorText.slice(0, 2000));
          } else {
            db.incrementOutboxRetry(entry.id, errorText.slice(0, 2000));
          }
          continue;
        }

        pushed += 1;
        db.updateOutboxStatus(entry.id, 'acked');
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        if (entry.retry_count + 1 >= MAX_OUTBOX_RETRIES) {
          db.updateOutboxStatus(entry.id, 'failed', message.slice(0, 2000));
        } else {
          db.incrementOutboxRetry(entry.id, message.slice(0, 2000));
        }
      }
    }

    const remainingPendingMutations = db.listPendingMutations('pending').length;
    const remainingOutbox = db.countPendingOutbox();

    return reply.send({
      pushed,
      failed,
      pending: remainingPendingMutations + remainingOutbox,
      backfill: backfill ? { scanned: backfill.totalScanned, queued: backfill.totalQueued } : null,
    });
  });

  app.get('/sync/pull', async (request, reply) => {
    // Same fix as /sync/push above - 'supabase-sync' is not a role any
    // real login ever has.
    const claims = authenticateRequest(request, reply, ['any']);
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
