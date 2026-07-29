-- ═══════════════════════════════════════════════════════════════════════
--  Multi-device conflict resolution + durable change journal
--  Project: onsqvduklnwffugsiybs (Niamana Dubai)
--
--  NOT YET APPLIED. Run it in the Supabase SQL editor (or via the CLI)
--  exactly once, top to bottom. Every statement is idempotent, so a partial
--  run can be re-run safely.
--
--  The local-bridge is written to work BOTH BEFORE AND AFTER this migration:
--  it probes for the `version` column and falls back to the previous blind
--  upsert when the column is absent, recording those writes in the journal as
--  `applied_unguarded`. So there is no flag day, and no window in which the
--  tills stop syncing. What you get by applying it:
--
--    section 1  real conflict detection on products / stores / suppliers
--    section 2  the cloud copy of the change journal
--    section 3  the stock ledger the tills have been queuing since the
--               local-bridge change (their entries are currently parked as
--               failed with "Table inventory_movements does not exist")
--
--  AFTER APPLYING, in this order:
--    1. Nothing needs restarting; the column probe re-checks every 5 minutes.
--    2. In the app: Settings → Sync → "Réessayer les échecs" (which calls
--       POST /sync/outbox/retry). This releases the inventory_movement
--       entries that were parked because section 3's table did not exist.
--    3. Check GET /sync/diagnostics?store_id=… - `journal.conflicts_open`
--       is now a real number and should be watched.
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
--  1. OPTIMISTIC CONCURRENCY
-- ───────────────────────────────────────────────────────────────────────
--
-- `version` is a compare-and-swap token, nothing more. The till writes
--     PATCH /products?id=eq.X&version=eq.<what I last saw>
-- with the new version in the body, so the write lands only if nobody has
-- touched the row since. Zero rows affected = conflict.
--
-- DEFAULT IS DELIBERATELY NULL, NOT 1.
--
-- Every row that exists today was written by the old unconditional upsert and
-- has no version history at all. Defaulting to 1 would make all 595 existing
-- products claim to be "at version 1", and since local versions on the
-- reference till run from 1 to 12, essentially every queued update would
-- report a false conflict and the entire five-month backlog would park itself
-- for manual adjudication - thousands of rows a human would have to click
-- through, which in practice means it never syncs again.
--
-- NULL instead means "never written under version control". The till treats
-- that as a one-time adoption: it re-issues the write filtered on
-- `version=is.null`, which is itself a compare-and-swap, so if two tills race
-- to adopt the same row exactly one wins and the other reports a real
-- conflict. After the first write each row has a real version and normal
-- rules apply from then on.
--
-- NOTE: no BEFORE UPDATE trigger bumps this. That is intentional and load
-- bearing - a server-side bump would rewrite the version the client just set,
-- so the client's NEXT base_version could never match and every subsequent
-- write would be a false conflict. The client owns the number; the server
-- only compares it. (public.sales already carries a version column from an
-- earlier migration; it is left alone, since sales are append-only and are
-- deliberately still written with an idempotent upsert.)

ALTER TABLE public.products   ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE public.stores     ADD COLUMN IF NOT EXISTS version integer;
ALTER TABLE public.suppliers  ADD COLUMN IF NOT EXISTS version integer;

COMMENT ON COLUMN public.products.version IS
  'Optimistic-concurrency token set by the writing device. NULL = never written under version control (adopt-once). Never bump this server-side.';
COMMENT ON COLUMN public.stores.version IS
  'Optimistic-concurrency token set by the writing device. See products.version.';
COMMENT ON COLUMN public.suppliers.version IS
  'Optimistic-concurrency token set by the writing device. See products.version.';


-- ───────────────────────────────────────────────────────────────────────
--  2. THE CHANGE JOURNAL (cloud copy)
-- ───────────────────────────────────────────────────────────────────────
--
-- The mirror of each till's local sync_journal. Two reasons it has to exist
-- here and not only on the device:
--
--   1. A journal that lives only on the device is weak evidence for exactly
--      the failure it documents. The till that lost a write is the till whose
--      disk dies, gets reimaged, or gets replaced - and with it the only
--      record that the write ever happened.
--   2. It is the ONLY place the multi-device picture exists. Till A's local
--      journal structurally cannot contain till B's writes, so "who wrote
--      this row, and what else was happening at that moment" is a question
--      that can only be answered here.
--
-- UNIQUE (device_id, outbox_id) is doing double duty: it makes the mirror
-- idempotent under retry, and it is the server-side record of which outbox
-- entries have already been seen - the foundation any future delta-based
-- (rather than snapshot-based) stock sync would need to be replay-safe.

CREATE TABLE IF NOT EXISTS public.sync_journal (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHO
  device_id           uuid NOT NULL,
  device_label        text,
  actor_user_id       uuid,
  store_id            uuid,

  -- WHAT
  outbox_id           uuid,
  entity_type         text NOT NULL,
  entity_id           uuid NOT NULL,
  op                  text NOT NULL,
  before_json         jsonb,
  after_json          jsonb,

  -- WHEN (four clocks, never conflated - a shop PC with a wrong RTC is
  -- common, and local_ts vs server_ts is what exposes it)
  local_ts            timestamptz NOT NULL,
  recorded_ts         timestamptz NOT NULL,
  synced_ts           timestamptz,
  server_ts           timestamptz,
  received_at         timestamptz NOT NULL DEFAULT now(),

  -- WHAT WE TRIED
  base_version        integer,
  new_version         integer,
  attempt             integer NOT NULL DEFAULT 0,
  http_status         integer,

  -- WHAT HAPPENED
  outcome             text NOT NULL,
  error               text,

  -- WHO WON
  remote_before_json  jsonb,
  remote_version      integer,
  resolution          text,
  resolved_at         timestamptz,
  resolved_by         uuid,

  app_version         text
);

-- `received_at` is the SERVER's clock, stamped by Postgres on arrival, and is
-- the only timestamp in this table that cannot be wrong or forged by a device
-- with a bad clock. Any forensic ordering across devices must use it.
COMMENT ON COLUMN public.sync_journal.received_at IS
  'Server clock at insert. The only trustworthy ordering key across devices; every other timestamp comes from the device.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_journal_device_outbox
  ON public.sync_journal (device_id, outbox_id);
CREATE INDEX IF NOT EXISTS idx_sync_journal_entity
  ON public.sync_journal (entity_type, entity_id, local_ts DESC);
CREATE INDEX IF NOT EXISTS idx_sync_journal_store_received
  ON public.sync_journal (store_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_journal_open_conflicts
  ON public.sync_journal (store_id, received_at DESC)
  WHERE outcome = 'conflict' AND resolution IS NULL;

ALTER TABLE public.sync_journal ENABLE ROW LEVEL SECURITY;

-- RLS. New tables in this project default to wide-open unless narrowed at
-- creation - that has bitten this codebase before - so the policies are
-- written here, with the table, and not left for later.
--
-- The tills write through the service-role key, which bypasses RLS entirely,
-- so these policies only govern what the web/mobile dashboard can see. It is
-- read-only: nothing outside a till has any business inventing journal
-- entries, and a forgeable audit trail is worse than none.
DROP POLICY IF EXISTS "Masters can read the sync journal" ON public.sync_journal;
CREATE POLICY "Masters can read the sync journal"
ON public.sync_journal
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can read their store's sync journal" ON public.sync_journal;
CREATE POLICY "Workers can read their store's sync journal"
ON public.sync_journal
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- Retention, cloud side. Deliberately NOT scheduled here: this project has no
-- pg_cron and adding a background job that silently deletes evidence is a
-- decision for a human, not a migration. Run manually, or wire to a scheduled
-- Edge Function once someone has agreed to the policy.
--
-- Note the exclusion: an unresolved conflict is never aged out. It is the one
-- row type whose disappearance would itself be the data loss.
--
--   DELETE FROM public.sync_journal
--   WHERE received_at < now() - interval '1 year'
--     AND NOT (outcome = 'conflict' AND resolution IS NULL);


-- ───────────────────────────────────────────────────────────────────────
--  3. THE STOCK LEDGER
-- ───────────────────────────────────────────────────────────────────────
--
-- Why this table decides the stock problem.
--
-- `products.quantity` is a running total that is being replicated as a value.
-- Two tills, one product at stock 10, each sells one unit: both compute 9
-- locally, both push {quantity: 9}, the cloud lands on 9 and the true answer
-- is 8. A version check does NOT catch this - neither snapshot is stale in
-- any detectable way, both were computed from the same base, and both are
-- individually correct. The loss is semantic: one of the two decrements was
-- never expressed in any payload, so no protocol operating on those payloads
-- can recover it.
--
-- The only fix is to stop shipping the total and start shipping the events it
-- is a sum of. This table is those events. Movements are append-only, keyed
-- by a client-generated UUID, and therefore upserted idempotently: replaying
-- one a hundred times still decrements stock once. That is the property
-- deltas alone would NOT give you - a naked "quantity -1" message applied
-- twice by a retry corrupts stock silently, which is why the delta approach
-- was rejected in favour of an identified ledger.
--
-- Local tills have been recording sale deductions here since the trigger
-- change (schema.ts, sale_items_ai) and have been queuing them for push;
-- until this table exists those entries park as failed.
--
-- CUTOVER ANCHOR - read before deriving anything from this table:
-- historical sales were NOT retro-fitted with movement rows. Inventing five
-- months of ledger entries for sales that never wrote any would produce a
-- ledger that disagrees with the very quantities it is meant to explain. So
-- derived stock is
--     opening_balance (products.quantity at cutover) + SUM(movements after)
-- and `stock_ledger_anchor` below is what records that opening balance. Until
-- an anchor row exists for a product, the ledger explains only the movement
-- of stock, not its absolute level.

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id             uuid PRIMARY KEY,
  store_id       uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id     uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name   text,
  -- 'in' | 'out' | 'adjustment'. quantity is always POSITIVE; the type
  -- carries the sign, matching what the local tills already store.
  movement_type  text NOT NULL,
  quantity       numeric NOT NULL,
  reason         text,
  source         text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  received_at    timestamptz NOT NULL DEFAULT now(),
  device_id      uuid
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product
  ON public.inventory_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_store
  ON public.inventory_movements (store_id, created_at DESC);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters can manage inventory movements" ON public.inventory_movements;
CREATE POLICY "Masters can manage inventory movements"
ON public.inventory_movements
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can read store inventory movements" ON public.inventory_movements;
CREATE POLICY "Workers can read store inventory movements"
ON public.inventory_movements
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- The opening balance each product's ledger is measured from. One row per
-- product, written once at cutover. Explicitly a table and not a guess: the
-- moment stock stops being an absolute that gets overwritten, "what was it
-- before we started counting" becomes a fact that has to be stored.
CREATE TABLE IF NOT EXISTS public.stock_ledger_anchor (
  product_id       uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  store_id         uuid NOT NULL,
  opening_balance  numeric NOT NULL,
  anchored_at      timestamptz NOT NULL DEFAULT now(),
  anchored_by      text
);

ALTER TABLE public.stock_ledger_anchor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters can manage stock anchors" ON public.stock_ledger_anchor;
CREATE POLICY "Masters can manage stock anchors"
ON public.stock_ledger_anchor
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'master'));

-- Derived stock. A view, not a materialised column, so that nothing can
-- overwrite it - which is the entire point.
--
-- This is REPORTING ONLY for now. `products.quantity` is still the number the
-- app reads, and the tills still push it. Cutting over means (a) anchoring
-- every product, (b) letting the ledger run long enough to trust it, then
-- (c) dropping `quantity` from the till's product payload so it stops being
-- replicated as a value at all. Comparing this view against products.quantity
-- is how you decide whether (b) has been satisfied - a growing gap is
-- precisely the two-till loss described above, finally made measurable.
CREATE OR REPLACE VIEW public.product_stock_derived AS
SELECT
  p.id                AS product_id,
  p.store_id,
  p.name,
  p.quantity          AS replicated_quantity,
  a.opening_balance,
  COALESCE(SUM(
    CASE
      WHEN m.movement_type = 'in'         THEN  m.quantity
      WHEN m.movement_type = 'out'        THEN -m.quantity
      WHEN m.movement_type = 'adjustment' THEN  m.quantity
      ELSE 0
    END
  ), 0)               AS net_movement,
  a.opening_balance + COALESCE(SUM(
    CASE
      WHEN m.movement_type = 'in'         THEN  m.quantity
      WHEN m.movement_type = 'out'        THEN -m.quantity
      WHEN m.movement_type = 'adjustment' THEN  m.quantity
      ELSE 0
    END
  ), 0)               AS derived_quantity,
  COUNT(m.id)         AS movement_count
FROM public.products p
LEFT JOIN public.stock_ledger_anchor a ON a.product_id = p.id
LEFT JOIN public.inventory_movements m
       ON m.product_id = p.id
      AND (a.anchored_at IS NULL OR m.created_at >= a.anchored_at)
GROUP BY p.id, p.store_id, p.name, p.quantity, a.opening_balance, a.anchored_at;


-- ───────────────────────────────────────────────────────────────────────
--  VERIFY (run these after applying; none of them modify anything)
-- ───────────────────────────────────────────────────────────────────────
--
--  1. Columns exist and are NULL, not 1:
--     SELECT count(*) FILTER (WHERE version IS NULL) AS unversioned,
--            count(*) AS total
--     FROM public.products;
--     -- expect unversioned = total on first run
--
--  2. Journal is reachable and locked down:
--     SELECT count(*) FROM public.sync_journal;
--     SELECT policyname, cmd FROM pg_policies WHERE tablename = 'sync_journal';
--     -- expect two SELECT-only policies
--
--  3. After the next push from a till, entries start arriving:
--     SELECT device_label, outcome, count(*)
--     FROM public.sync_journal GROUP BY 1, 2 ORDER BY 3 DESC;
--
--  4. Anything the tills refused to overwrite:
--     SELECT entity_type, entity_id, base_version, remote_version,
--            after_json, remote_before_json, error
--     FROM public.sync_journal
--     WHERE outcome = 'conflict' AND resolution IS NULL
--     ORDER BY received_at DESC;
