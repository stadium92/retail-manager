/**
 * Maps sync_outbox `entity_type` values (set by emitOutbox() call sites
 * throughout the repositories) to the real Supabase/PostgREST table name,
 * and builds a payload for each entity that only contains columns confirmed
 * to exist on the Supabase side.
 *
 * Why this exists: emitOutbox() captures the *entire* local SQLite row
 * (including local-only columns like `version`, `deleted_at`, computed join
 * columns like `category_name`, and columns that don't exist at all in the
 * Supabase schema). Forwarding that raw row straight to PostgREST risks a
 * hard failure ("could not find column X in schema cache") for the whole
 * record. Every field list below was cross-checked against the CREATE TABLE
 * statements in Djati-stores/supabase/migrations/*.sql as of 2026-07.
 *
 * IMPORTANT - auth.users foreign keys: `sales.worker_id`,
 * `deliveries.deliverer_id` and `stores.owner_id` all have
 * `REFERENCES auth.users(id)` in Supabase. Local-bridge users are created
 * entirely locally (bcrypt password hashes, locally-generated UUIDs) and are
 * NEVER provisioned as real Supabase Auth users, so these ids never exist in
 * `auth.users`. Sending them would violate the FK constraint and permanently
 * fail the whole record. We deliberately null these fields out rather than
 * lose the entire sale/delivery/store - see the local-bridge sync report for
 * the full reasoning and the follow-up work this implies (provisioning real
 * Supabase Auth accounts for local-bridge workers is a separate project).
 *
 * IMPORTANT - unconfirmed tables: `clients` and `cash_transactions` could
 * NOT be confirmed to exist in the Djati-stores Supabase project (no
 * migration creates them, and the Djati-stores frontend never references
 * `clients` at all). They are mapped here on a best-effort basis so that
 * mutations are captured and will start flowing automatically the moment a
 * human adds the matching tables - until then pushes for these two entities
 * are expected to fail cleanly (marked 'failed' in sync_outbox after a few
 * retries) rather than corrupt anything.
 */

export const SUPABASE_TABLE_MAP: Record<string, string> = {
  sale: 'sales',
  sale_item: 'sale_items',
  client: 'clients',
  cash_transaction: 'cash_transactions',
  delivery: 'deliveries',
  store: 'stores',
  product: 'products',
  supplier: 'suppliers',
  purchase_order: 'purchase_orders',
  purchase_item: 'purchase_items',
};

type PayloadBuilder = (raw: Record<string, unknown>) => Record<string, unknown>;

const pick = (raw: Record<string, unknown>, keys: string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  return out;
};

const PAYLOAD_BUILDERS: Record<string, PayloadBuilder> = {
  sale: (raw) => ({
    ...pick(raw, [
      'id', 'store_id', 'customer_name', 'customer_phone', 'sale_type',
      'total_price', 'discount', 'tax', 'payment_method', 'payment_status',
      'notes', 'invoice_number', 'created_at', 'updated_at',
    ]),
    // worker_id / client_id intentionally omitted: worker_id references
    // auth.users (local worker ids never exist there); client_id has no
    // matching column in Supabase's sales table.
  }),

  sale_item: (raw) => pick(raw, [
    'id', 'sale_id', 'product_id', 'product_name', 'quantity', 'unit_price',
    'discount', 'total', 'created_at',
  ]),

  client: (raw) => pick(raw, [
    'id', 'store_id', 'service_id', 'name', 'code', 'phone', 'email',
    'address', 'credit_limit', 'current_balance', 'loyalty_points', 'notes',
    'created_at', 'updated_at',
  ]),

  cash_transaction: (raw) => ({
    ...pick(raw, [
      'id', 'store_id', 'type', 'amount', 'category', 'description',
      'reference', 'created_at', 'updated_at',
    ]),
    // worker_id omitted defensively - see auth.users FK note above.
  }),

  delivery: (raw) => ({
    ...pick(raw, [
      'id', 'sale_id', 'store_id', 'customer_name', 'customer_phone',
      'delivery_address', 'status', 'notes', 'scheduled_at', 'delivered_at',
      'created_at', 'updated_at',
    ]),
    deliverer_id: null, // references auth.users - see note above.
  }),

  store: (raw) => ({
    ...pick(raw, ['id', 'name', 'address', 'phone', 'created_at', 'updated_at']),
    owner_id: null, // references auth.users - see note above.
  }),

  product: (raw) => ({
    ...pick(raw, [
      'id', 'store_id', 'name', 'description', 'sku', 'barcode',
      'unit_price', 'wholesale_price', 'cost_price', 'quantity',
      'min_quantity', 'image_url', 'expiry_date', 'created_at', 'updated_at',
    ]),
    // category omitted defensively: Supabase's products.category is a FK to
    // product_families(id), and local product_families rows are not
    // currently synced at all, so forwarding it risks an FK failure on
    // every categorized product. Fine-grained price tiers / aisle / brand /
    // packaging / low_stock_threshold / reorder_quantity / created_by /
    // updated_by are local-only extensions with no Supabase column.
    category: null,
  }),

  supplier: (raw) => pick(raw, [
    'id', 'store_id', 'name', 'phone', 'email', 'address', 'balance',
    'created_at', 'updated_at',
  ]),

  purchase_order: (raw) => pick(raw, [
    'id', 'store_id', 'supplier_id', 'status', 'total_amount', 'notes',
    'created_at', 'updated_at',
  ]),

  purchase_item: (raw) => pick(raw, [
    'id', 'order_id', 'product_id', 'quantity_ordered', 'quantity_received',
    'unit_cost', 'created_at',
  ]),
};

/**
 * Builds the JSON body to send to Supabase for a create/update outbox entry.
 * Returns null if the entity type has no known mapping (caller should treat
 * this as a permanent, non-retryable failure rather than guess a payload).
 */
export const buildSupabasePayload = (
  entityType: string,
  raw: Record<string, unknown>
): Record<string, unknown> | null => {
  const builder = PAYLOAD_BUILDERS[entityType];
  if (!builder) return null;
  return builder(raw);
};

export const getSupabaseTableForEntity = (entityType: string): string | undefined =>
  SUPABASE_TABLE_MAP[entityType];
