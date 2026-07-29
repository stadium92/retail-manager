import Database from 'better-sqlite3';
import crypto from 'crypto';
import { SyncOutboxEntry, SyncState } from '../types.js';
import { getDeviceIdentity } from './device.repo.js';

export const createSyncOutboxRepo = (db: Database.Database) => ({
  getOutboxEntry(id: string): SyncOutboxEntry | undefined {
    return db.prepare('SELECT * FROM sync_outbox WHERE id = ? LIMIT 1').get(id) as
      | SyncOutboxEntry
      | undefined;
  },

  listOutboxEntries(
    storeId: string,
    status: SyncOutboxEntry['status'] = 'pending',
    limit: number = 100
  ): SyncOutboxEntry[] {
    const rows = db
      .prepare(
        'SELECT * FROM sync_outbox WHERE store_id = ? AND status = ? ORDER BY created_at ASC LIMIT ?'
      )
      .all(storeId, status, limit);
    return rows as SyncOutboxEntry[];
  },

  /**
   * Cross-store pending outbox entries, oldest first. Used by /sync/push,
   * which (like the existing pending_mutations drain) processes the whole
   * device's backlog in one call rather than filtering by a single store.
   */
  listPendingOutboxAll(limit: number = 300): SyncOutboxEntry[] {
    const rows = db
      .prepare('SELECT * FROM sync_outbox WHERE status = ? ORDER BY created_at ASC LIMIT ?')
      .all('pending', limit);
    return rows as SyncOutboxEntry[];
  },

  /**
   * Idempotency check for the backfill sweep: has this local record already
   * been captured in the outbox (in any status)? Backed by
   * idx_sync_outbox_entity so this stays cheap even as the table grows.
   */
  outboxEntryExistsForRecord(entityType: string, entityId: string): boolean {
    const row = db
      .prepare('SELECT 1 FROM sync_outbox WHERE entity_type = ? AND entity_id = ? LIMIT 1')
      .get(entityType, entityId);
    return row !== undefined;
  },

  countPendingOutbox(): number {
    const row = db
      .prepare("SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending'")
      .get() as { count: number };
    return row.count;
  },

  insertOutboxEntry(entry: SyncOutboxEntry) {
    db.prepare(
      `
      INSERT OR IGNORE INTO sync_outbox (
        id, store_id, entity_type, entity_id, op_type,
        payload_json, base_version, created_at, status,
        retry_count, last_error, idempotency_key, device_id
      ) VALUES (
        @id, @store_id, @entity_type, @entity_id, @op_type,
        @payload_json, @base_version, @created_at, @status,
        @retry_count, @last_error, @idempotency_key, @device_id
      )
    `
    ).run({
      ...entry,
      base_version: entry.base_version ?? null,
      last_error: entry.last_error ?? null,
      device_id: entry.device_id ?? getDeviceIdentity(db).device_id,
    });
  },

  updateOutboxStatus(
    id: string,
    status: SyncOutboxEntry['status'],
    lastError?: string | null
  ) {
    db.prepare(
      'UPDATE sync_outbox SET status = ?, last_error = ?, last_attempt_at = ? WHERE id = ?'
    ).run(status, lastError ?? null, new Date().toISOString(), id);
  },

  /**
   * Puts a parked entry back in the queue with a fresh precondition.
   *
   * Used by the "keep local" conflict resolution: the operator has looked at
   * both values and decided this device's is correct, so the entry is
   * re-based onto the version the cloud is actually at now. This is the ONLY
   * path by which a conflicted write ever reaches the cloud - it is never
   * automatic, and the decision is stamped into the journal with the id of
   * the person who made it.
   */
  requeueOutboxEntry(id: string, newBaseVersion: number | null) {
    db.prepare(
      `UPDATE sync_outbox
       SET status = 'pending', retry_count = 0, last_error = NULL, base_version = ?
       WHERE id = ?`
    ).run(newBaseVersion, id);
  },

  resetFailedOutboxEntries(): number {
    const result = db
      .prepare("UPDATE sync_outbox SET status = 'pending', retry_count = 0, last_error = NULL WHERE status = 'failed'")
      .run();
    return result.changes;
  },

  incrementOutboxRetry(id: string, error: string) {
    db.prepare(
      'UPDATE sync_outbox SET retry_count = retry_count + 1, last_error = ?, status = ?, last_attempt_at = ? WHERE id = ?'
    ).run(error, 'pending', new Date().toISOString(), id);
  },

  getSyncState(storeId: string): SyncState | undefined {
    const row = db
      .prepare('SELECT * FROM sync_state WHERE store_id = ? LIMIT 1')
      .get(storeId);
    return row as SyncState | undefined;
  },

  upsertSyncState(storeId: string, updates: Partial<Omit<SyncState, 'store_id'>>) {
    const existing = db
      .prepare('SELECT * FROM sync_state WHERE store_id = ? LIMIT 1')
      .get(storeId);

    if (!existing) {
      db.prepare(
        `INSERT INTO sync_state (store_id, last_push_at, last_pull_cursor, last_success_at, last_error)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        storeId,
        updates.last_push_at ?? null,
        updates.last_pull_cursor ?? null,
        updates.last_success_at ?? null,
        updates.last_error ?? null
      );
      return;
    }

    const normalizedEntries = Object.entries(updates).filter(
      ([, value]) => value !== undefined
    );
    if (normalizedEntries.length === 0) return;

    const assignments = normalizedEntries
      .map(([key]) => `${key} = @${key}`)
      .join(', ');
    db.prepare(
      `UPDATE sync_state SET ${assignments} WHERE store_id = @store_id`
    ).run({ store_id: storeId, ...Object.fromEntries(normalizedEntries) });
  },

  getOutboxStats(storeId: string): {
    pending: number;
    sent: number;
    acked: number;
    failed: number;
    conflict: number;
    total: number;
    oldest_pending_at: string | null;
  } {
    const row = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
           COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) as sent,
           COALESCE(SUM(CASE WHEN status = 'acked' THEN 1 ELSE 0 END), 0) as acked,
           COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed,
           COALESCE(SUM(CASE WHEN status = 'conflict' THEN 1 ELSE 0 END), 0) as conflict,
           COUNT(*) as total,
           MIN(CASE WHEN status = 'pending' THEN created_at END) as oldest_pending_at
         FROM sync_outbox
         WHERE store_id = ?`
      )
      .get(storeId) as any;

    return {
      pending: row?.pending ?? 0,
      sent: row?.sent ?? 0,
      acked: row?.acked ?? 0,
      failed: row?.failed ?? 0,
      conflict: row?.conflict ?? 0,
      total: row?.total ?? 0,
      oldest_pending_at: row?.oldest_pending_at ?? null,
    };
  },

  emitSyncEvent(params: {
    storeId: string;
    entityType: string;
    entityId: string;
    opType: 'create' | 'update' | 'delete';
    payload: Record<string, unknown>;
    baseVersion?: number | null;
  }) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    // Unique per entry, not per (entity, op, millisecond) - see the long note
    // on the same change in sync_helpers.ts. The old key silently dropped the
    // second of two mutations to the same record inside one millisecond, and
    // since payloads are post-change snapshots, the dropped one held the
    // newer values.
    const idempotencyKey = `${params.storeId}:${params.entityType}:${params.entityId}:${params.opType}:${now}:${id}`;

    db.prepare(
      `
      INSERT OR IGNORE INTO sync_outbox (
        id, store_id, entity_type, entity_id, op_type,
        payload_json, base_version, created_at, status,
        retry_count, last_error, idempotency_key, device_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)
    `
    ).run(
      id,
      params.storeId,
      params.entityType,
      params.entityId,
      params.opType,
      JSON.stringify(params.payload),
      params.baseVersion ?? null,
      now,
      idempotencyKey,
      getDeviceIdentity(db).device_id
    );
  },
});
