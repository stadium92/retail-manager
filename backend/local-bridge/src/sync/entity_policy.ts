/**
 * ─────────────────────────────────────────────────────────────────────────
 *  WHICH ENTITIES GET A CONCURRENCY CHECK, AND WHICH MUST NOT
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Not every table wants the same write semantics, and applying one rule to
 * all of them breaks something either way.
 *
 * VALUE entities (products, stores, suppliers, clients, purchase orders,
 * deliveries) describe *current state*. Two writers can hold genuinely
 * incompatible opinions about a product's price, and the last push to arrive
 * is not necessarily the most recent decision - the observed incident on this
 * product was a March snapshot landing on top of a June edit, because the
 * March entry was still sitting undrained in the outbox. These need a
 * precondition: write only if the cloud is still where I last saw it.
 *
 * LEDGER entities (sales, sale items, cash transactions, inventory movements)
 * describe *events that happened*. They are append-only, keyed by a stable
 * client-generated UUID, and are never edited by a second party. For these an
 * unconditional upsert on the primary key is not a bug, it is the entire
 * mechanism that makes a retried push safe: replaying the same sale a hundred
 * times converges on one sale. Putting a version precondition on them would
 * turn an idempotent retry into a spurious conflict and would break the one
 * part of this system that is already correct. They are deliberately left
 * exactly as they were.
 *
 * (`sale` does get edited locally - settling a credit sale changes
 * amount_paid - but only ever by the till that owns it. Single-writer edits
 * on a stable key are still safely upserted.)
 *
 * COUNTER fields are called out separately because they are the case a
 * version check genuinely cannot solve. See the note on COUNTER_FIELDS.
 */

export type WriteMode = 'value' | 'ledger';

const VALUE_ENTITIES = new Set([
  'product',
  'store',
  'supplier',
  'client',
  'purchase_order',
  'delivery',
]);

const LEDGER_ENTITIES = new Set([
  'sale',
  'sale_item',
  'cash_transaction',
  'inventory_movement',
  'purchase_item',
]);

export const getWriteMode = (entityType: string): WriteMode =>
  VALUE_ENTITIES.has(entityType) ? 'value' : 'ledger';

export const isValueEntity = (entityType: string): boolean => VALUE_ENTITIES.has(entityType);

export const isLedgerEntity = (entityType: string): boolean => LEDGER_ENTITIES.has(entityType);

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  COUNTERS: the fields a version check cannot save
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `products.quantity` and `clients.current_balance` are not values, they are
 * running totals, and they are being replicated as values.
 *
 * Two tills, one product at stock 10, each sells one unit. Both compute 9
 * locally. Both push {quantity: 9}. The cloud ends at 9; the true answer is
 * 8. A version precondition does not catch this, because neither snapshot is
 * stale in any detectable way - both were computed from the same base and
 * both are individually correct. The loss is in the semantics: a counter was
 * shipped as a value, so one of the two decrements was never expressed
 * anywhere in the payload.
 *
 * This map exists so that:
 *   - the journal captures the before/after of these fields specifically, so
 *     the size of any drift can be measured after the fact rather than
 *     guessed at, and
 *   - the code that eventually derives these totals from their ledgers has a
 *     single declaration of which fields are affected, rather than the
 *     knowledge being spread across payload builders.
 *
 * The fix is not in this file - it is to stop shipping the total and start
 * shipping the ledger it is a sum of. That ledger is inventory_movements
 * (written locally by the sale_items_ai trigger, created in the cloud by
 * frontend/supabase/migrations/20260729120000_sync_conflict_journal.sql,
 * which also carries the full reasoning and the cutover plan).
 */
export const COUNTER_FIELDS: Record<string, string[]> = {
  product: ['quantity'],
  client: ['current_balance', 'loyalty_points'],
  supplier: ['balance'],
};

export const getCounterFields = (entityType: string): string[] =>
  COUNTER_FIELDS[entityType] ?? [];

/**
 * Extracts just the counter fields from a row, for the journal. Kept small
 * and separate from the full before/after snapshots because these are the
 * numbers a reconciliation will actually be run against.
 */
export const pickCounters = (
  entityType: string,
  row: Record<string, unknown> | null | undefined
): Record<string, unknown> | null => {
  if (!row) return null;
  const fields = getCounterFields(entityType);
  if (fields.length === 0) return null;
  const out: Record<string, unknown> = {};
  let found = false;
  for (const field of fields) {
    if (row[field] !== undefined) {
      out[field] = row[field];
      found = true;
    }
  }
  return found ? out : null;
};
