import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { env } from '../env.js';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';
import { buildSupabasePayload, getSupabaseTableForEntity } from '../db/repositories/sync_payload_map.js';
import { getWriteMode } from '../sync/entity_policy.js';
import {
  mirrorJournalRows,
  writeOutboxEntry,
  type SupabaseWriteResult,
} from '../sync/supabase_writer.js';

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

/**
 * Local journal row → cloud journal row.
 *
 * Only the forensic columns travel. Deliberately dropped:
 *  - `id`: the cloud journal is keyed on (device_id, outbox_id), which is
 *    what makes the mirror idempotent under retry AND doubles as the cloud's
 *    record of which outbox entries it has already seen.
 *  - `remote_journaled`: meaningless once the row IS in the cloud.
 * before_json / after_json / remote_before_json are parsed back into real
 * JSONB so the cloud copy is queryable (`after_json->>'quantity'`) rather
 * than being opaque text that has to be re-parsed by hand months later.
 */
const parseJson = (value: string | null): unknown => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return { _unparseable: value };
  }
};

const toCloudJournalRow = (row: {
  outbox_id: string | null;
  device_id: string;
  device_label: string | null;
  store_id: string | null;
  entity_type: string;
  entity_id: string;
  op: string;
  actor_user_id: string | null;
  local_ts: string;
  recorded_ts: string;
  synced_ts: string | null;
  server_ts: string | null;
  base_version: number | null;
  new_version: number | null;
  before_json: string | null;
  after_json: string | null;
  outcome: string;
  http_status: number | null;
  attempt: number;
  error: string | null;
  remote_before_json: string | null;
  remote_version: number | null;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  app_version: string | null;
}): Record<string, unknown> => ({
  device_id: row.device_id,
  outbox_id: row.outbox_id,
  device_label: row.device_label,
  store_id: row.store_id,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  op: row.op,
  actor_user_id: row.actor_user_id,
  local_ts: row.local_ts,
  recorded_ts: row.recorded_ts,
  synced_ts: row.synced_ts,
  server_ts: row.server_ts,
  base_version: row.base_version,
  new_version: row.new_version,
  before_json: parseJson(row.before_json),
  after_json: parseJson(row.after_json),
  outcome: row.outcome,
  http_status: row.http_status,
  attempt: row.attempt,
  error: row.error,
  remote_before_json: parseJson(row.remote_before_json),
  remote_version: row.remote_version,
  resolution: row.resolution,
  resolved_at: row.resolved_at,
  resolved_by: row.resolved_by,
  app_version: row.app_version,
});

export async function registerSyncRoutes(app: FastifyInstance) {
  // Handshake / capabilities endpoint
  app.get('/sync/handshake', async (_request, reply) => {
    return reply.send({
      server_time: new Date().toISOString(),
      min_supported_client: '0.1.0',
      device: db.getDeviceIdentity(),
      feature_flags: {
        push_enabled: true,
        pull_enabled: true,
        // Was advertised as 'server_wins', which was not true in either
        // direction: the client's blind upsert meant the CLIENT always won,
        // unconditionally, including with months-old snapshots.
        conflict_resolution: 'optimistic_concurrency',
        journal: true,
      },
    });
  });

  // Health check for the "local bridge reachable" indicator - the frontend
  // (LocalBridgeSyncService.checkNetworkHealth) polls this exact path. It
  // used to poll a path that was never registered here, so the indicator
  // always read OFFLINE regardless of the bridge's real state.
  app.get('/sync/health', async (_request, reply) => {
    // Answering this request at all already proves the local bridge itself
    // is up - the frontend's fetch would fail/throw before ever getting
    // here otherwise. What this endpoint used to NOT check is the actual
    // Supabase leg: env.supabaseUrl/env.supabaseServiceKey being wrong, DNS,
    // firewall, or real internet being down would all fail silently in
    // /sync/push and /sync/pull while this kept reporting ONLINE, since
    // nothing here ever made an outbound call. Ping Supabase itself so
    // "bridge is up but can't reach Supabase" is a distinct, visible state
    // instead of indistinguishable from "everything is fine".
    if (!env.supabaseUrl || !env.supabaseServiceKey) {
      return reply.send({
        status: 'OFFLINE',
        message: 'Supabase non configuré sur cette installation (URL ou clé manquante).',
      });
    }

    try {
      const res = await fetch(`${env.supabaseUrl}/rest/v1/`, {
        headers: { apikey: env.supabaseServiceKey },
      });
      // Anything outside 2xx (not just 5xx) means the same call /sync/push
      // and /sync/pull make would also fail - notably 401/403, which is
      // exactly what a wrong or revoked service key looks like here.
      if (!res.ok) {
        return reply.send({ status: 'OFFLINE', message: `Supabase injoignable (HTTP ${res.status}).` });
      }
      return reply.send({ status: 'ONLINE', message: 'Connected to local sync bridge' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.send({ status: 'OFFLINE', message: `Supabase injoignable: ${message}` });
    }
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

  // Who am I. The frontend can show this in Settings so a shop with two
  // tills can tell them apart when reading a conflict report.
  app.get('/sync/device', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['any']);
    if (!claims) return;
    return reply.send(db.getDeviceIdentity());
  });

  // ── Conflict inbox ───────────────────────────────────────────────────
  // Every row here is a change this device made that is NOT in the cloud and
  // that nobody has adjudicated. This endpoint existing at all is the point:
  // a conflict that is only ever written to a table nobody reads is barely
  // better than the silent overwrite it replaced.
  app.get('/sync/conflicts', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const query = request.query as { store_id?: string; limit?: string; include_resolved?: string };
    const { data, total } = db.listConflicts({
      store_id: query.store_id,
      limit: query.limit ? Number(query.limit) : 100,
      include_resolved: query.include_resolved === 'true',
    });

    return reply.send({
      total,
      device: db.getDeviceIdentity(),
      conflicts: data.map((row) => ({
        ...row,
        before: row.before_json ? JSON.parse(row.before_json) : null,
        after: row.after_json ? JSON.parse(row.after_json) : null,
        remote_before: row.remote_before_json ? JSON.parse(row.remote_before_json) : null,
      })),
    });
  });

  // Full history for one record - "what has ever happened to this product,
  // on this device, and what did the cloud say each time".
  app.get('/sync/journal', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const query = request.query as { entity_type?: string; entity_id?: string; limit?: string };
    if (!query.entity_type || !query.entity_id) {
      return reply.status(400).send({
        error: 'MissingParams',
        message: 'entity_type and entity_id query parameters are required.',
      });
    }
    return reply.send({
      entries: db.listJournalForEntity(
        query.entity_type,
        query.entity_id,
        query.limit ? Number(query.limit) : 200
      ),
    });
  });

  // Adjudicate a conflict. This is the ONLY path by which a conflicted write
  // ever reaches the cloud, and it always requires a person:
  //
  //   keep_local  - re-base the parked entry onto the version the cloud is
  //                 actually at now and re-queue it. The next drain retries
  //                 the compare-and-swap against that version, so if the
  //                 cloud has moved again in the meantime it conflicts again
  //                 rather than silently overwriting a second edit.
  //   keep_remote - abandon the local write. Recorded, not deleted: the value
  //                 that was given up stays in the journal forever.
  //
  // There is deliberately no "resolve all automatically" option. An automatic
  // rule here would be indistinguishable from the blind overwrite this whole
  // change exists to remove.
  app.post('/sync/conflicts/:id/resolve', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const parsed = z
      .object({ resolution: z.enum(['keep_local', 'keep_remote']) })
      .safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const journalId = (request.params as { id: string }).id;
    const entry = db.getJournalEntry(journalId);
    if (!entry) {
      return reply.status(404).send({ error: 'NotFound', message: 'Journal entry not found.' });
    }
    if (entry.outcome !== 'conflict') {
      return reply.status(400).send({
        error: 'NotAConflict',
        message: `Journal entry is in state "${entry.outcome}", not "conflict".`,
      });
    }
    if (entry.resolution) {
      return reply.status(409).send({
        error: 'AlreadyResolved',
        message: `Already resolved as "${entry.resolution}" at ${entry.resolved_at}.`,
      });
    }

    if (parsed.data.resolution === 'keep_local') {
      if (!entry.outbox_id) {
        return reply.status(400).send({
          error: 'NotReplayable',
          message: 'This journal entry has no outbox entry to re-queue.',
        });
      }
      // Re-base onto the version the cloud reported at the moment of the
      // conflict. If it has moved on again since, the re-queued entry simply
      // conflicts again - which is correct, and is why this is a re-base
      // rather than an unconditional force.
      db.requeueOutboxEntry(entry.outbox_id, entry.remote_version ?? null);
    }

    db.markJournalResolved(journalId, parsed.data.resolution, claims.sub ?? null);

    return reply.send({
      id: journalId,
      resolution: parsed.data.resolution,
      requeued: parsed.data.resolution === 'keep_local',
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
      device: db.getDeviceIdentity(),
      outbox: stats,
      journal: db.getJournalStats(),
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
    let conflicts = 0;
    let skipped = 0;

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
    // Drain in repeated batches under a wall-clock budget rather than stopping
    // dead at one batch. A real install was found holding 3,919 entries going
    // back five months (the push endpoint used to 403 every caller, so the
    // queue only ever grew). At one 300-entry batch per launch that backlog
    // needs ~13 restarts before the phone/cloud shows current data, which in
    // practice means it never catches up. Looping until the queue is empty or
    // the budget expires clears it in a launch or two, while the budget still
    // protects against a single request running for minutes.
    const OUTBOX_DRAIN_BUDGET_MS = 60_000;
    const drainStartedAt = Date.now();
    let outboxBatch = db.listPendingOutboxAll(MAX_OUTBOX_PUSH_PER_CALL);

    // A retried entry stays status='pending' (see incrementOutboxRetry), so
    // re-selecting "pending" hands back the SAME rows the batch just failed on.
    // An earlier comment here claimed that could not happen - it was wrong, and
    // the consequence is severe: one brief connectivity drop mid-drain would
    // fail the head of the queue, immediately re-select it, and burn all
    // MAX_OUTBOX_RETRIES attempts within a single request, parking up to 300
    // real sales as permanently 'failed' in a few seconds. Recovering them then
    // needs manual intervention.
    //
    // Two guards: never look at the same entry twice in one call, and stop
    // entirely once a whole batch produced no successes - if nothing is getting
    // through, the far end is down and continuing only destroys retry budget
    // that a later, healthier call would have used.
    const attemptedThisCall = new Set<string>();
    let touchedJournalEntries = 0;

    while (outboxBatch.length > 0) {
    // "Progress" is any TERMINAL outcome, not just a successful push. A batch
    // that produced only conflicts made real progress - those entries left
    // the pending set and will never be re-selected - and it also proves the
    // far end is reachable, which is the only thing the stop-early guard
    // below is actually trying to detect.
    const progressBeforeBatch = pushed + conflicts + skipped;
    for (const entry of outboxBatch) {
      if (attemptedThisCall.has(entry.id)) continue;
      attemptedThisCall.add(entry.id);
      const table = getSupabaseTableForEntity(entry.entity_type);
      if (!table) {
        // Unknown entity_type - nothing we can map it to. Don't retry.
        failed += 1;
        const message = `No Supabase table mapping for entity_type "${entry.entity_type}"`;
        db.updateOutboxStatus(entry.id, 'failed', message);
        db.journalAttempt({
          outbox_id: entry.id,
          outcome: 'skipped',
          resolution: 'no_mapping',
          error: message,
        });
        touchedJournalEntries += 1;
        continue;
      }

      try {
        // ── The write itself. Which strategy applies is decided entirely by
        // (a) whether this entity is a value or a ledger record and (b)
        // whether the cloud table can enforce a precondition yet. That
        // decision lives in writeOutboxEntry() so it can be tested directly;
        // this loop is only queue bookkeeping. ──
        const mode = getWriteMode(entry.entity_type);
        const raw =
          entry.op_type === 'delete'
            ? null
            : (JSON.parse(entry.payload_json) as Record<string, unknown>);

        const result: SupabaseWriteResult = await writeOutboxEntry({
          table,
          entityType: entry.entity_type,
          opType: entry.op_type,
          entityId: entry.entity_id,
          baseVersion: entry.base_version,
          payload: raw ? buildSupabasePayload(entry.entity_type, raw) : null,
          localVersion: raw && typeof raw.version === 'number' ? raw.version : null,
          mode,
        });

        db.journalAttempt({
          outbox_id: entry.id,
          outcome: result.outcome,
          http_status: result.httpStatus,
          server_ts: result.serverTs,
          error: result.error ?? null,
          remote_before: result.remoteBefore ?? null,
          remote_version: result.remoteVersion ?? null,
          resolution: result.resolution ?? null,
        });
        touchedJournalEntries += 1;

        if (result.outcome === 'applied' || result.outcome === 'applied_unguarded' || result.outcome === 'inserted') {
          pushed += 1;
          db.updateOutboxStatus(entry.id, 'acked');
          continue;
        }

        if (result.outcome === 'conflict') {
          // NOT a failure and NOT retryable. Retrying a failed precondition
          // either keeps failing forever or - much worse - eventually lands
          // against a version it was never checked against. The entry is
          // parked in its own terminal state and waits for a human decision
          // via /sync/conflicts. The value is not lost: the full payload is
          // in both the outbox entry and the journal row.
          conflicts += 1;
          db.updateOutboxStatus(entry.id, 'conflict', result.error ?? 'Conflict');
          continue;
        }

        if (result.outcome === 'skipped') {
          // Nothing to retry against - most often the target table does not
          // exist in Supabase yet. Parked as 'failed' so the existing
          // "Retry failed" button in Settings releases the whole batch once
          // the migration has been applied.
          skipped += 1;
          db.updateOutboxStatus(entry.id, 'failed', result.error ?? 'Skipped');
          continue;
        }

        // Genuine transport/server failure: retry budget applies, unchanged.
        failed += 1;
        const errorText = (result.error ?? 'Unknown error').slice(0, 2000);
        if (entry.retry_count + 1 >= MAX_OUTBOX_RETRIES) {
          db.updateOutboxStatus(entry.id, 'failed', errorText);
        } else {
          db.incrementOutboxRetry(entry.id, errorText);
        }
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        db.journalAttempt({
          outbox_id: entry.id,
          outcome: 'failed',
          error: message.slice(0, 2000),
        });
        touchedJournalEntries += 1;
        if (entry.retry_count + 1 >= MAX_OUTBOX_RETRIES) {
          db.updateOutboxStatus(entry.id, 'failed', message.slice(0, 2000));
        } else {
          db.incrementOutboxRetry(entry.id, message.slice(0, 2000));
        }
      }
    }

      if (Date.now() - drainStartedAt > OUTBOX_DRAIN_BUDGET_MS) {
        // Out of time for this request - whatever is left stays pending and
        // the next push picks it up. Never an error, just a partial drain.
        break;
      }
      if (pushed + conflicts + skipped === progressBeforeBatch) {
        // A full batch with zero terminal outcomes means the far end is
        // unreachable or rejecting everything. Keep going and we would simply
        // walk the queue exhausting each entry's retry budget against a server
        // that is down. Stop; the entries stay pending and a later call
        // retries them intact.
        break;
      }
      // Re-select excludes acked/failed rows, but NOT rows that were retried
      // (those stay pending by design) - attemptedThisCall is what stops those
      // being re-processed inside this same request.
      outboxBatch = db.listPendingOutboxAll(MAX_OUTBOX_PUSH_PER_CALL);
      if (outboxBatch.every((e) => attemptedThisCall.has(e.id))) {
        // Everything the query can still return has already been tried this
        // call - nothing further to do without re-attacking the same rows.
        break;
      }
    }

    // ── Mirror the journal to the cloud ──────────────────────────────────
    // A journal that exists only on the device is weak evidence for exactly
    // the situation it is meant to explain: if the till that lost a write is
    // the till that dies, the record of the loss dies with it. It is also
    // structurally unable to show the multi-till case, because device A's
    // journal cannot contain device B's writes.
    //
    // Best-effort and batched. A failure here never affects data that has
    // already been written - it only leaves remote_journaled = 0 on those
    // rows, which is itself recorded, so the gap is visible instead of
    // assumed away. Before the migration that creates public.sync_journal
    // this silently no-ops, which is the intended behaviour: the local
    // journal is complete either way.
    let mirrored = 0;
    try {
      const toMirror = db.listJournalRowsToMirror(500);
      const CHUNK = 100;
      for (let i = 0; i < toMirror.length; i += CHUNK) {
        const chunk = toMirror.slice(i, i + CHUNK);
        const ok = await mirrorJournalRows(chunk.map(toCloudJournalRow));
        if (!ok) break; // table missing or unreachable - stop, try next push
        db.markJournalMirrored(chunk.map((r) => r.id));
        mirrored += chunk.length;
      }
    } catch (err) {
      request.log.warn({ err }, '[sync] cloud journal mirror failed (non-fatal)');
    }

    // Retention. Cheap, bounded, and never touches an unresolved conflict.
    try {
      db.pruneJournal();
    } catch (err) {
      request.log.warn({ err }, '[sync] journal retention pass failed (non-fatal)');
    }

    const remainingPendingMutations = db.listPendingMutations('pending').length;
    const remainingOutbox = db.countPendingOutbox();

    return reply.send({
      pushed,
      failed,
      // Writes that were REFUSED because the cloud had moved on. Deliberately
      // reported separately from `failed`: a failure is a delivery problem, a
      // conflict is a data problem, and the remedies are nothing alike.
      conflicts,
      skipped,
      journal: { recorded: touchedJournalEntries, mirrored },
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
