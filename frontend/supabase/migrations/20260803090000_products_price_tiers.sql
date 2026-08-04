-- Give the cloud products table somewhere to store the shop's price tiers.
--
-- WHY THIS IS URGENT
-- The local SQLite carries selling_price_2/3/4 and wholesale_price_ttc; the
-- cloud table (niamana project onsqvduklnwffugsiybs) has no such columns, so
-- push has always dropped them. Result: 776 wholesale prices and every
-- merchandising field exist on exactly ONE computer, in one shop, with no copy
-- anywhere. A failed disk loses the shop's entire pricing structure with no
-- way to rebuild it. The rolling local backups do not help - they are on the
-- same disk.
--
-- The STIHL project (fpvrbxmbrotowdlyebqv, used by dibidani + niamakoro)
-- ALREADY has these columns; running this there is a harmless no-op thanks to
-- IF NOT EXISTS.
--
-- SAFETY
-- Every column is nullable (except `version`, which takes a constant default).
-- Postgres 11+ adds such columns without rewriting the table, so this does not
-- lock the table for any meaningful time and cannot alter existing rows.
--
-- AFTER RUNNING THIS
-- No redeploy is needed. local-bridge probes each cloud table's real column
-- set (supabase_writer.cloudColumnsFor) and widens the payload automatically
-- on the next push, within the 5-minute probe TTL. To force the existing 777
-- products to re-upload with their tiers, use the "retry failed" action in
-- Settings, or restart the app, which re-queues the backfill sweep.

BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS wholesale_price_ht    numeric,
  ADD COLUMN IF NOT EXISTS wholesale_price_ttc   numeric,
  ADD COLUMN IF NOT EXISTS selling_price_2       numeric,
  ADD COLUMN IF NOT EXISTS selling_price_3       numeric,
  ADD COLUMN IF NOT EXISTS selling_price_4       numeric,
  ADD COLUMN IF NOT EXISTS low_stock_threshold   numeric,
  ADD COLUMN IF NOT EXISTS reorder_quantity      numeric,
  ADD COLUMN IF NOT EXISTS aisle                 text,
  ADD COLUMN IF NOT EXISTS brand                 text,
  ADD COLUMN IF NOT EXISTS unit_type             text,
  ADD COLUMN IF NOT EXISTS packaging             text,
  ADD COLUMN IF NOT EXISTS version               integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at            timestamptz;

COMMIT;

-- Verify:
--   select column_name from information_schema.columns
--    where table_name = 'products'
--      and column_name in ('selling_price_3','wholesale_price_ttc','version');
