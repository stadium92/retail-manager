import Database from 'better-sqlite3';
import crypto from 'crypto';
import os from 'os';

export interface DeviceIdentity {
  device_id: string;
  device_label: string | null;
  created_at: string;
  last_seen_at: string | null;
}

/**
 * Process-level cache. The device id is read on every single outbox emit and
 * every journal write; it never changes for the lifetime of the process.
 */
let cached: DeviceIdentity | null = null;

/**
 * Creates this installation's stable identity if it does not have one yet,
 * and backfills the identity onto every pre-existing sync_outbox row.
 *
 * Called from db/index.ts inside the same guarded block as initializeSchema(),
 * because everything downstream (outbox stamping, journalling, conflict
 * attribution) is meaningless without it.
 *
 * Deliberate choices:
 *  - Stored in the SQLite database, not in a file next to the executable, not
 *    in %TEMP% and not in the registry. A shop PC gets its temp directory
 *    cleaned, its profile reset and its app folder reinstalled; the database
 *    is the one thing that is treated as precious and is actually backed up.
 *  - A restored database keeps its original device_id. That is correct: the
 *    history in that file was produced by that identity, and re-labelling it
 *    with a new one would make the journal lie about who wrote what.
 *  - device_label (hostname) is stored separately and refreshed on every
 *    start, so a machine that is renamed stays recognisable without its
 *    identity changing.
 */
export const ensureDeviceIdentity = (db: Database.Database): DeviceIdentity => {
  const now = new Date().toISOString();

  let row = db
    .prepare('SELECT device_id, device_label, created_at, last_seen_at FROM device_identity WHERE id = 1')
    .get() as DeviceIdentity | undefined;

  if (!row) {
    const deviceId = crypto.randomUUID();
    let label: string | null = null;
    try {
      label = os.hostname();
    } catch {
      /* a machine that cannot report its own hostname still gets an id */
    }
    db.prepare(
      `INSERT OR IGNORE INTO device_identity (id, device_id, device_label, created_at, last_seen_at)
       VALUES (1, ?, ?, ?, ?)`
    ).run(deviceId, label, now, now);
    row = db
      .prepare('SELECT device_id, device_label, created_at, last_seen_at FROM device_identity WHERE id = 1')
      .get() as DeviceIdentity;
  } else {
    let label: string | null = row.device_label ?? null;
    try {
      label = os.hostname();
    } catch {
      /* keep the stored label */
    }
    db.prepare('UPDATE device_identity SET last_seen_at = ?, device_label = ? WHERE id = 1').run(now, label);
    row = { ...row, last_seen_at: now, device_label: label };
  }

  // Backfill. Every sync_outbox row that predates the device_id column was,
  // by construction, written by this device: it is sitting in this device's
  // own database file and there has never been a second writer to it. Leaving
  // them NULL would permanently orphan the entire existing backlog (3919
  // entries on the reference install) from the identity that produced it.
  //
  // Runs on every start but is a no-op once done - the WHERE clause matches
  // nothing - so there is no "did the one-time migration run?" failure mode,
  // which is the class of bug that took this product down over cash_closings.
  try {
    db.prepare('UPDATE sync_outbox SET device_id = ? WHERE device_id IS NULL').run(row.device_id);
  } catch {
    /* a failed backfill must not stop the app from starting */
  }

  cached = row;
  return row;
};

/**
 * The identity for this process. Falls back to reading (and if necessary
 * creating) it, so callers never have to worry about start-up ordering.
 */
export const getDeviceIdentity = (db: Database.Database): DeviceIdentity => {
  if (cached) return cached;
  return ensureDeviceIdentity(db);
};

export const createDeviceRepo = (db: Database.Database) => ({
  getDeviceIdentity(): DeviceIdentity {
    return getDeviceIdentity(db);
  },
});
