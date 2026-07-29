import Database from 'better-sqlite3';
import crypto from 'crypto';
import { getDeviceIdentity } from './device.repo.js';
import { createSyncJournalRepo } from './sync_journal.repo.js';
import { getActorUserId } from '../../sync/actor_context.js';

/**
 * The journal repo is stateless apart from its prepared statements; memoise
 * one per database handle so emitting an outbox entry does not rebuild it.
 */
const journalRepos = new WeakMap<Database.Database, ReturnType<typeof createSyncJournalRepo>>();
const journalFor = (db: Database.Database) => {
  let repo = journalRepos.get(db);
  if (!repo) {
    repo = createSyncJournalRepo(db);
    journalRepos.set(db, repo);
  }
  return repo;
};

export interface EmitOutboxOptions {
  /**
   * The row as it stood BEFORE this change. Supplied by the value-entity
   * repositories (products, stores, suppliers, clients), which read the row
   * before updating it. It is the single most useful field in a conflict
   * report - "the cloud says 40, the till says 12" is unresolvable without
   * knowing that the till went 55 → 12 while the cloud went 55 → 40.
   */
  before?: Record<string, unknown> | null;
  /** Overrides the actor when the caller knows better than the request context. */
  actorUserId?: string | null;
}

/**
 * Queues a mutation for the cloud and records it in the change journal.
 *
 * Two changes from the original beyond the journal call:
 *
 *  1. Every entry is stamped with this installation's device_id. Nothing
 *     downstream - conflict attribution, the cloud journal, "which till did
 *     this" - is expressible without it.
 *
 *  2. The idempotency key is now unique per outbox ENTRY rather than per
 *     (store, entity, id, op, millisecond). The old key was
 *     `${storeId}:${entityType}:${entityId}:${opType}:${now}` under a UNIQUE
 *     index with INSERT OR IGNORE, so two updates to the same record inside
 *     the same millisecond silently dropped the second one - and because the
 *     payload is a full post-update snapshot, the dropped entry's values were
 *     the NEWER ones. That is a silent data loss dressed up as
 *     de-duplication. It never de-duplicated anything useful either: retries
 *     reuse the same outbox row, so the row id is the natural idempotency
 *     unit, and the backfill sweep de-duplicates by (entity_type, entity_id)
 *     rather than by this key. The semantic prefix is kept so the column
 *     stays readable by a human reading the table.
 */
export const emitOutbox = (
  db: Database.Database,
  storeId: string,
  entityType: string,
  entityId: string,
  opType: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>,
  baseVersion?: number | null,
  options?: EmitOutboxOptions
) => {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const idempotencyKey = `${storeId}:${entityType}:${entityId}:${opType}:${now}:${id}`;

  let deviceId: string | null = null;
  try {
    deviceId = getDeviceIdentity(db).device_id;
  } catch {
    /* an install whose identity could not be created still records the entry */
  }

  try {
    db.prepare(
      `INSERT OR IGNORE INTO sync_outbox (id, store_id, entity_type, entity_id, op_type, payload_json, base_version, created_at, status, retry_count, last_error, idempotency_key, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)`
    ).run(
      id,
      storeId,
      entityType,
      entityId,
      opType,
      JSON.stringify(payload),
      baseVersion ?? null,
      now,
      idempotencyKey,
      deviceId
    );
  } catch (_) {
    /* sync outbox write should never block main flow */
    return;
  }

  try {
    journalFor(db).journalMutation({
      outbox_id: id,
      store_id: storeId,
      entity_type: entityType,
      entity_id: entityId,
      op: opType,
      actor_user_id: options?.actorUserId ?? getActorUserId(),
      local_ts: now,
      base_version: baseVersion ?? null,
      new_version:
        typeof (payload as Record<string, unknown>).version === 'number'
          ? ((payload as Record<string, unknown>).version as number)
          : null,
      before: options?.before ?? null,
      after: payload,
    });
  } catch (_) {
    /* journalling must never block the main flow either */
  }
};
