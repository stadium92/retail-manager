import Database from 'better-sqlite3';
import crypto from 'crypto';
import { getDeviceIdentity } from './device.repo.js';

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  THE CHANGE JOURNAL
 * ─────────────────────────────────────────────────────────────────────────
 *
 * "A table where we record everything, used in future when we have data
 * conflicts."
 *
 * The test this table has to pass is a single question asked six months from
 * now, by someone who was not there: *this row in the cloud says X, the till
 * says Y - what happened?* Answering it needs six things, and every column
 * below exists to supply exactly one of them:
 *
 *   WHAT changed      entity_type, entity_id, op, before_json, after_json
 *   WHO changed it    device_id, device_label, actor_user_id
 *   WHEN             local_ts (device clock, when it happened),
 *                    recorded_ts (when it was journalled),
 *                    synced_ts (when the push finished),
 *                    server_ts (the cloud's own clock at that moment)
 *   WHAT WE TRIED    outbox_id, base_version, new_version, attempt, http_status
 *   WHAT HAPPENED    outcome, error
 *   WHO WON          remote_before_json, remote_version, resolution,
 *                    resolved_at, resolved_by
 *
 * FIELD NOTES (why each one, and what breaks without it):
 *
 *  outbox_id       The join back to the queue entry. One journal row per
 *                  outbox entry, updated in place across retries, so the
 *                  journal reads as a list of *intents* rather than a list of
 *                  HTTP calls. UNIQUE, which is also what makes the
 *                  record-then-attempt sequence safe to re-run.
 *
 *  device_id       Without it none of this means anything - "the till
 *  device_label    overwrote it" is not a sentence you can write when writes
 *                  are anonymous. The label is denormalised on purpose: it is
 *                  the machine name *at the time of the write*, which is what
 *                  a human recognises, and it must not change retroactively
 *                  when a PC is renamed or replaced.
 *
 *  actor_user_id   Distinguishes "the manager repriced it" from "the cashier's
 *                  sale deducted it". Populated from the request context; NULL
 *                  for machine-originated writes (backfill sweep, scheduler),
 *                  which is accurate rather than guessed.
 *
 *  local_ts vs     Two clocks, never conflated. local_ts is the device's own
 *  recorded_ts vs  clock and is the ONLY thing that orders a device's own
 *  synced_ts vs    writes; server_ts is taken from the cloud response's Date
 *  server_ts       header. A shop PC with a wrong RTC is common, and the gap
 *                  between local_ts and server_ts is what exposes it. The
 *                  observed incident - "a March snapshot stamped today" - is
 *                  precisely a clock/ordering question, and it is unanswerable
 *                  from one timestamp.
 *
 *  base_version    The precondition that was sent and the value that was
 *  new_version     claimed. Together with remote_version they reconstruct the
 *                  compare-and-swap exactly: "I believed you were at 4, I
 *                  tried to make you 5, you were actually at 7."
 *
 *  before_json     The whole point. A conflict report that says only "a
 *  after_json      conflict happened" is worthless; one that shows the value
 *                  before, the value the device wanted, and the value the
 *                  cloud actually held is a decision a human can make. Stored
 *                  as full snapshots because a diff computed today cannot be
 *                  re-computed later against rows that have since moved on.
 *
 *  outcome         The terminal state of the attempt, and the field this
 *                  table is queried by. Deliberately distinguishes 'conflict'
 *                  (we refused to write) from 'failed' (we could not write) -
 *                  they have completely different remedies, and collapsing
 *                  them is how a silent data loss gets filed as a network
 *                  glitch.
 *
 *  remote_*        The cloud's row as it stood at the instant of the conflict,
 *                  captured immediately, because by the time anyone looks it
 *                  will have changed again.
 *
 *  resolution      Nullable on purpose. NULL against outcome='conflict' means
 *  resolved_at     UNRESOLVED - a write this device made that is not in the
 *  resolved_by     cloud and that nobody has adjudicated. That set is the
 *                  thing the operator has to be shown, and it is the set
 *                  retention is forbidden to delete.
 *
 *  remote_journaled Whether this row also reached the cloud journal. A journal
 *                  that lives only on the device that lost the write is weak
 *                  evidence - if that PC dies, so does the record of what it
 *                  did. This flag says, per row, whether a second copy exists.
 *
 *  app_version     Which build produced the write. Sync bugs are shipped, and
 *                  "everything from build X is suspect" is a real query.
 *
 * WHY NOT audit_logs: audit_logs records what a human did in the UI. On the
 * reference install it holds 3349 rows of which the large majority are
 * MODULE_ENTER navigation telemetry, it is never synced, its old_value /
 * new_value are free-text strings, and it has no concept of a version, a
 * device, an attempt or an outcome. Bolting eleven replication columns onto
 * it would mix navigation noise with forensic evidence and force one
 * retention policy onto two kinds of record with opposite lifetimes. The two
 * tables cross-reference by (entity_type, entity_id) when you need both.
 */

export type JournalOutcome =
  /** Local mutation recorded, not yet attempted against the cloud. */
  | 'queued'
  /** Applied under a version precondition - the safe path. */
  | 'applied'
  /** Applied by blind upsert because the cloud has no version column yet. */
  | 'applied_unguarded'
  /** Row did not exist in the cloud and was inserted. */
  | 'inserted'
  /** The cloud had moved on. Nothing was written. */
  | 'conflict'
  /** Transport or server error. Retryable. */
  | 'failed'
  /** Deliberately not attempted (no mapping, remote table missing, ...). */
  | 'skipped';

export type JournalResolution =
  /** A pre-outbox snapshot that would have overwritten a live cloud row. */
  | 'stale_snapshot_suppressed'
  /** Cloud row had never been written under version control; adopted. */
  | 'adopted_unversioned'
  /** Held for a human. The local value is NOT in the cloud. */
  | 'parked'
  /** Operator chose the local value; re-queued against the current version. */
  | 'keep_local'
  /** Operator chose the cloud value; the local write is abandoned. */
  | 'keep_remote'
  /** Target table does not exist in the cloud yet. */
  | 'remote_table_missing'
  /** No payload/table mapping for this entity type. */
  | 'no_mapping';

export interface JournalRow {
  id: string;
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
  outcome: JournalOutcome;
  http_status: number | null;
  attempt: number;
  error: string | null;
  remote_before_json: string | null;
  remote_version: number | null;
  resolution: JournalResolution | null;
  resolved_at: string | null;
  resolved_by: string | null;
  remote_journaled: number;
  app_version: string | null;
}

export interface RecordMutationParams {
  outbox_id: string | null;
  store_id: string | null;
  entity_type: string;
  entity_id: string;
  op: string;
  actor_user_id?: string | null;
  local_ts: string;
  base_version?: number | null;
  new_version?: number | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface RecordAttemptParams {
  outbox_id: string;
  outcome: JournalOutcome;
  http_status?: number | null;
  server_ts?: string | null;
  error?: string | null;
  remote_before?: Record<string, unknown> | null;
  remote_version?: number | null;
  resolution?: JournalResolution | null;
  remote_journaled?: boolean;
}

/**
 * Retention. A shop PC is not a data warehouse: this table must not be the
 * reason a till runs out of disk. Three rules, applied in order:
 *
 *   1. Unresolved conflicts are NEVER deleted, at any age. They are the
 *      entire reason the table exists, and an aged-out conflict is a data
 *      loss that has been quietly forgotten - the exact failure mode this
 *      design is meant to eliminate.
 *   2. Rows older than RETENTION_DAYS are removed, cleanly-applied ones
 *      first. Ninety days comfortably covers "we noticed the numbers are
 *      wrong last quarter" while bounding the table to roughly one quarter
 *      of one device's mutation volume (~4k rows / 5 months on the reference
 *      install, so a few megabytes).
 *   3. A hard row cap as a backstop, in case a runaway loop produces more
 *      rows in ninety days than anyone anticipated. Oldest applied rows go
 *      first; conflicts still survive.
 */
const RETENTION_DAYS = 90;
const HARD_ROW_CAP = 200_000;

const APP_VERSION = process.env.APP_VERSION ?? null;

export const createSyncJournalRepo = (db: Database.Database) => {
  const device = () => getDeviceIdentity(db);

  const repo = {
    /**
     * Records the *intent*: a local mutation that is expected to reach the
     * cloud. Written in the same synchronous flow as the outbox entry, so a
     * crash between the two is not possible in practice (better-sqlite3 is
     * synchronous and both statements run before the request returns).
     */
    journalMutation(params: RecordMutationParams): string | null {
      try {
        const dev = device();
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        db.prepare(
          `INSERT OR IGNORE INTO sync_journal (
             id, outbox_id, device_id, device_label, store_id,
             entity_type, entity_id, op, actor_user_id,
             local_ts, recorded_ts, base_version, new_version,
             before_json, after_json, outcome, attempt, remote_journaled, app_version
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, 0, ?)`
        ).run(
          id,
          params.outbox_id,
          dev.device_id,
          dev.device_label,
          params.store_id,
          params.entity_type,
          params.entity_id,
          params.op,
          params.actor_user_id ?? null,
          params.local_ts,
          now,
          params.base_version ?? null,
          params.new_version ?? null,
          params.before ? JSON.stringify(params.before) : null,
          params.after ? JSON.stringify(params.after) : null,
          APP_VERSION
        );
        return id;
      } catch {
        // Journalling must never be the thing that stops a sale from being
        // recorded. A missing journal row is a diagnostic gap; a failed
        // checkout is lost revenue.
        return null;
      }
    },

    /**
     * Records the outcome of a push attempt against an existing intent row,
     * incrementing the attempt counter. Idempotent-ish by design: the last
     * attempt's outcome is what the row reports, because that is the state
     * the world is actually in.
     *
     * If no intent row exists (entry predates the journal, e.g. the whole
     * historical backlog on an upgraded install), one is synthesised from the
     * outbox entry so that draining a legacy queue is still fully recorded.
     */
    journalAttempt(params: RecordAttemptParams): void {
      try {
        const now = new Date().toISOString();
        const existing = db
          .prepare('SELECT id, attempt FROM sync_journal WHERE outbox_id = ? LIMIT 1')
          .get(params.outbox_id) as { id: string; attempt: number } | undefined;

        if (!existing) {
          const entry = db
            .prepare(
              `SELECT id, store_id, entity_type, entity_id, op_type, payload_json,
                      base_version, created_at, retry_count, device_id
               FROM sync_outbox WHERE id = ? LIMIT 1`
            )
            .get(params.outbox_id) as
            | {
                id: string;
                store_id: string;
                entity_type: string;
                entity_id: string;
                op_type: string;
                payload_json: string;
                base_version: number | null;
                created_at: string;
                retry_count: number;
                device_id: string | null;
              }
            | undefined;
          if (!entry) return;
          const dev = device();
          db.prepare(
            `INSERT OR IGNORE INTO sync_journal (
               id, outbox_id, device_id, device_label, store_id,
               entity_type, entity_id, op, actor_user_id,
               local_ts, recorded_ts, base_version,
               before_json, after_json, outcome, attempt, remote_journaled, app_version
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, 'queued', ?, 0, ?)`
          ).run(
            crypto.randomUUID(),
            entry.id,
            entry.device_id ?? dev.device_id,
            dev.device_label,
            entry.store_id,
            entry.entity_type,
            entry.entity_id,
            entry.op_type,
            entry.created_at,
            now,
            entry.base_version,
            entry.payload_json,
            entry.retry_count,
            APP_VERSION
          );
        }

        db.prepare(
          `UPDATE sync_journal SET
             outcome = ?,
             http_status = ?,
             server_ts = COALESCE(?, server_ts),
             synced_ts = ?,
             attempt = attempt + 1,
             error = ?,
             remote_before_json = COALESCE(?, remote_before_json),
             remote_version = COALESCE(?, remote_version),
             resolution = COALESCE(?, resolution),
             remote_journaled = CASE WHEN ? = 1 THEN 1 ELSE remote_journaled END
           WHERE outbox_id = ?`
        ).run(
          params.outcome,
          params.http_status ?? null,
          params.server_ts ?? null,
          now,
          params.error ?? null,
          params.remote_before ? JSON.stringify(params.remote_before) : null,
          params.remote_version ?? null,
          params.resolution ?? null,
          params.remote_journaled ? 1 : 0,
          params.outbox_id
        );
      } catch {
        /* never block the drain on a journal write */
      }
    },

    /**
     * Rows that have not yet been copied to the cloud journal, oldest first.
     *
     * Mirroring is done in batches at the END of a drain rather than one HTTP
     * call per journal row: a device draining a five-month backlog has ~4000
     * entries, and doubling the number of round trips to journal them would
     * roughly double the time to catch up. One request per 100 rows is
     * negligible against the writes themselves.
     */
    listJournalRowsToMirror(limit = 500): JournalRow[] {
      return db
        .prepare(
          `SELECT * FROM sync_journal
           WHERE remote_journaled = 0 AND outcome != 'queued'
           ORDER BY recorded_ts ASC LIMIT ?`
        )
        .all(limit) as JournalRow[];
    },

    markJournalMirrored(ids: string[]): void {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE sync_journal SET remote_journaled = 1 WHERE id IN (${placeholders})`).run(
        ...ids
      );
    },

    /**
     * Unresolved conflicts, newest first. This is the operator's queue: every
     * row here is a local change that is NOT in the cloud and that nobody has
     * decided about.
     */
    listConflicts(options: { store_id?: string; limit?: number; include_resolved?: boolean } = {}): {
      data: JournalRow[];
      total: number;
    } {
      const clauses = ["outcome = 'conflict'"];
      const params: Record<string, unknown> = {};
      if (!options.include_resolved) clauses.push('resolution IS NULL');
      if (options.store_id) {
        clauses.push('store_id = @store_id');
        params.store_id = options.store_id;
      }
      const where = clauses.join(' AND ');
      const total = (
        db.prepare(`SELECT COUNT(*) as count FROM sync_journal WHERE ${where}`).get(params) as {
          count: number;
        }
      ).count;
      const rows = db
        .prepare(`SELECT * FROM sync_journal WHERE ${where} ORDER BY recorded_ts DESC LIMIT @limit`)
        .all({ ...params, limit: options.limit ?? 100 }) as JournalRow[];
      return { data: rows, total };
    },

    getJournalEntry(id: string): JournalRow | undefined {
      return db.prepare('SELECT * FROM sync_journal WHERE id = ? LIMIT 1').get(id) as
        | JournalRow
        | undefined;
    },

    /** Full history for one record - the "what happened to this product" view. */
    listJournalForEntity(entityType: string, entityId: string, limit = 200): JournalRow[] {
      return db
        .prepare(
          `SELECT * FROM sync_journal
           WHERE entity_type = ? AND entity_id = ?
           ORDER BY local_ts DESC LIMIT ?`
        )
        .all(entityType, entityId, limit) as JournalRow[];
    },

    markJournalResolved(id: string, resolution: JournalResolution, resolvedBy: string | null): void {
      db.prepare(
        'UPDATE sync_journal SET resolution = ?, resolved_at = ?, resolved_by = ? WHERE id = ?'
      ).run(resolution, new Date().toISOString(), resolvedBy, id);
    },

    getJournalStats(): {
      total: number;
      queued: number;
      applied: number;
      conflicts_open: number;
      conflicts_resolved: number;
      failed: number;
      skipped: number;
      not_remote_journaled: number;
      oldest_recorded_at: string | null;
    } {
      const row = db
        .prepare(
          `SELECT
             COUNT(*) as total,
             COALESCE(SUM(CASE WHEN outcome = 'queued' THEN 1 ELSE 0 END), 0) as queued,
             COALESCE(SUM(CASE WHEN outcome IN ('applied','applied_unguarded','inserted') THEN 1 ELSE 0 END), 0) as applied,
             COALESCE(SUM(CASE WHEN outcome = 'conflict' AND resolution IS NULL THEN 1 ELSE 0 END), 0) as conflicts_open,
             COALESCE(SUM(CASE WHEN outcome = 'conflict' AND resolution IS NOT NULL THEN 1 ELSE 0 END), 0) as conflicts_resolved,
             COALESCE(SUM(CASE WHEN outcome = 'failed' THEN 1 ELSE 0 END), 0) as failed,
             COALESCE(SUM(CASE WHEN outcome = 'skipped' THEN 1 ELSE 0 END), 0) as skipped,
             COALESCE(SUM(CASE WHEN remote_journaled = 0 THEN 1 ELSE 0 END), 0) as not_remote_journaled,
             MIN(recorded_ts) as oldest_recorded_at
           FROM sync_journal`
        )
        .get() as any;
      return {
        total: row?.total ?? 0,
        queued: row?.queued ?? 0,
        applied: row?.applied ?? 0,
        conflicts_open: row?.conflicts_open ?? 0,
        conflicts_resolved: row?.conflicts_resolved ?? 0,
        failed: row?.failed ?? 0,
        skipped: row?.skipped ?? 0,
        not_remote_journaled: row?.not_remote_journaled ?? 0,
        oldest_recorded_at: row?.oldest_recorded_at ?? null,
      };
    },

    /** See the RETENTION notes at the top of this file. */
    pruneJournal(now: Date = new Date()): { deleted_by_age: number; deleted_by_cap: number } {
      let deletedByAge = 0;
      let deletedByCap = 0;
      try {
        const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString();
        deletedByAge = db
          .prepare(
            `DELETE FROM sync_journal
             WHERE recorded_ts < ?
               AND NOT (outcome = 'conflict' AND resolution IS NULL)`
          )
          .run(cutoff).changes;

        const total = (
          db.prepare('SELECT COUNT(*) as count FROM sync_journal').get() as { count: number }
        ).count;
        if (total > HARD_ROW_CAP) {
          deletedByCap = db
            .prepare(
              `DELETE FROM sync_journal WHERE id IN (
                 SELECT id FROM sync_journal
                 WHERE NOT (outcome = 'conflict' AND resolution IS NULL)
                 ORDER BY recorded_ts ASC
                 LIMIT ?
               )`
            )
            .run(total - HARD_ROW_CAP).changes;
        }
      } catch {
        /* retention is housekeeping - never fatal */
      }
      return { deleted_by_age: deletedByAge, deleted_by_cap: deletedByCap };
    },
  };

  return repo;
};
