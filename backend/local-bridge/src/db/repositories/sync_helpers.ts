import Database from 'better-sqlite3';
import crypto from 'crypto';

const SUPPORTED_SYNC_ENTITIES = ['product', 'sale', 'sale_item', 'store'];

export const emitOutbox = (
  db: Database.Database,
  storeId: string,
  entityType: string,
  entityId: string,
  opType: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>,
  baseVersion?: number | null
) => {
  if (!SUPPORTED_SYNC_ENTITIES.includes(entityType)) {
    return;
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const idempotencyKey = `${storeId}:${entityType}:${entityId}:${opType}:${now}`;
  try {
    db.prepare(
      `INSERT OR IGNORE INTO sync_outbox (id, store_id, entity_type, entity_id, op_type, payload_json, base_version, created_at, status, retry_count, last_error, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?)`
    ).run(id, storeId, entityType, entityId, opType, JSON.stringify(payload), baseVersion ?? null, now, idempotencyKey);
  } catch (_) { /* sync outbox write should never block main flow */ }
};
