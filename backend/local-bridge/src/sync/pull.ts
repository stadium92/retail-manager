import type DatabaseType from 'better-sqlite3';

/**
 * Cloud -> local hydration.
 *
 * The previous implementation was a single inline block in routes/sync.ts that
 * fetched ONLY products, wrote them with a plain INSERT, and dropped every
 * price tier on the way in. It also answered on GET while the desktop app has
 * always sent POST, so in practice it returned 404 and no client has ever
 * pulled anything.
 *
 * The rules encoded here are what make a pull safe to run repeatedly on a
 * till that is also selling:
 *
 *  1. UPSERT, never plain INSERT. A second pull must be a no-op, not a
 *     UNIQUE-constraint crash.
 *  2. Newer-wins. A row is only overwritten when the cloud copy's updated_at
 *     is at least as new as the local copy, so a pull cannot revert an edit
 *     the shop made seconds ago while offline.
 *  3. Some columns are NEVER overwritten on a row that already exists
 *     locally - see `preserve` below. This is the important one.
 */
export type PullTableSpec = {
  /** Local table name. Must match the Supabase table name. */
  table: string;
  /** Columns hydrated from the cloud row. */
  columns: string[];
  /**
   * Columns that must never be overwritten on a row that ALREADY exists
   * locally. New rows still take the cloud value.
   *
   * `products.quantity` is the critical entry. This app is offline-first: the
   * till sells without a network, so local stock is the authoritative copy and
   * the cloud figure is usually stale. Letting a pull overwrite quantity would
   * silently reintroduce exactly the "inventory resets by 20 or 40" bug that
   * started this whole investigation - except sourced from the server, where
   * it would be far harder to trace. Stock converges through the movement
   * ledger, not by copying an absolute value downward.
   *
   * `clients.current_balance` is the same argument: local settlements adjust
   * it, so the cloud value lags.
   */
  preserve: string[];
};

/**
 * Reference and catalogue data only, in FK-friendly order.
 *
 * Sales are deliberately absent. They are append-only, locally authoritative,
 * and large; the local DB is the source of truth that PUSHES them upward. A
 * pull exists to hydrate a fresh install and to receive catalogue edits made
 * on the web dashboard - not to mirror the ledger back down.
 */
export const PULL_TABLES: PullTableSpec[] = [
  {
    // First: clients.store_id and other tables reference it.
    table: 'stores',
    columns: ['id', 'name', 'address', 'phone', 'owner_id', 'created_at', 'updated_at', 'default_price_tier', 'version', 'deleted_at'],
    preserve: [],
  },
  {
    table: 'product_families',
    columns: ['id', 'store_id', 'name', 'description', 'parent_id', 'created_at', 'updated_at'],
    preserve: [],
  },
  {
    table: 'suppliers',
    columns: [
      'id', 'store_id', 'name', 'phone', 'email', 'address', 'balance',
      'created_at', 'updated_at', 'default_purchase_type', 'price_notes',
    ],
    preserve: ['balance'],
  },
  {
    table: 'clients',
    columns: [
      'id', 'store_id', 'service_id', 'name', 'code', 'phone', 'email', 'address',
      'credit_limit', 'current_balance', 'loyalty_points', 'notes',
      'created_at', 'updated_at', 'version', 'deleted_at',
    ],
    preserve: ['current_balance', 'loyalty_points'],
  },
  {
    table: 'products',
    columns: [
      'id', 'store_id', 'name', 'sku', 'barcode', 'description',
      'cost_price', 'unit_price',
      // Every price tier. The old pull carried only `wholesale_price` - the
      // legacy column that is NULL on ~97% of real products - so a hydrated
      // catalogue would have shown 0 CFA in every Prix Gros column and billed
      // wholesale customers at retail. Same defect that was just fixed on the
      // read side; it must not re-enter through the write side.
      'wholesale_price', 'wholesale_price_ht', 'wholesale_price_ttc',
      'selling_price_2', 'selling_price_3', 'selling_price_4',
      'min_quantity', 'low_stock_threshold', 'quantity', 'category', 'image_url',
      'aisle', 'brand', 'unit_type', 'packaging', 'expiry_date', 'reorder_quantity',
      'created_at', 'updated_at', 'version', 'deleted_at',
    ],
    preserve: ['quantity'],
  },
];

/** PostgREST caps a request at 1000 rows by default. */
const PAGE_SIZE = 1000;

export type PullTableResult = {
  table: string;
  fetched: number;
  written: number;
  /** Present only when this table failed; other tables still run. */
  error?: string;
  /**
   * Columns the spec wanted but the cloud did not provide, so they were left
   * untouched locally rather than overwritten with NULL.
   */
  skippedColumns?: string[];
  /** Dangling foreign keys nulled so the row could still be stored. */
  droppedRefs?: number;
  /** The table does not exist in the cloud schema - a gap, not a failure. */
  absentInCloud?: boolean;
};

/**
 * The set of columns this pull is actually allowed to write, computed at
 * runtime as the intersection of three things: what the spec asks for, what
 * this local schema has, and **what the cloud row actually carried**.
 *
 * That last term is not defensive nicety, it is the difference between a pull
 * and a data-loss event. The live cloud `products` table has no price-tier
 * columns at all - no selling_price_2/3/4, no wholesale_price_ttc - while the
 * local table does, and those local values are the only copy of the shop's
 * wholesale pricing that exists anywhere. Binding a missing cloud column to
 * NULL and letting `DO UPDATE SET selling_price_3 = excluded.selling_price_3`
 * run would have silently erased every gros price on the till the first time
 * anyone pressed Sync.
 *
 * Omitting a column also fixes NOT NULL drift for free: `products.version` is
 * NOT NULL DEFAULT 1 locally and does not exist in the cloud at all, so
 * leaving it out of the INSERT lets SQLite apply its own default instead of
 * failing the row.
 */
const effectiveColumns = (
  db: DatabaseType.Database,
  spec: PullTableSpec,
  cloudKeys: Set<string>
): { columns: string[]; missingRequired: string[] } => {
  const info = db.prepare(`PRAGMA table_info(${spec.table})`).all() as {
    name: string;
    notnull: number;
    dflt_value: unknown;
  }[];
  const local = new Map(info.map(c => [c.name, c]));

  const columns = spec.columns.filter(c => local.has(c) && cloudKeys.has(c));

  // A local column that is NOT NULL, has no default, and is absent from the
  // cloud payload cannot be satisfied - every INSERT would fail. Report it
  // rather than throwing the same constraint error once per row.
  const missingRequired = info
    .filter(c => c.notnull && c.dflt_value === null && !columns.includes(c.name))
    .map(c => c.name);

  return { columns, missingRequired };
};

/**
 * Foreign keys declared by the LOCAL schema, limited to columns this pull
 * actually writes.
 *
 * Needed because the cloud is not internally consistent: cloud products carry
 * 45 distinct `category` family ids while the cloud `product_families` table
 * is completely empty, so a straight insert dies on
 * "FOREIGN KEY constraint failed" and hydrates nothing at all. Dropping the
 * dangling reference keeps the product - a catalogue with an unfiled item is
 * worth far more to the shop than no catalogue.
 */
const foreignKeysFor = (db: DatabaseType.Database, table: string, cols: string[]) => {
  const fks = db.prepare(`PRAGMA foreign_key_list(${table})`).all() as {
    from: string;
    table: string;
    to: string | null;
  }[];
  return fks
    .filter(fk => cols.includes(fk.from))
    .map(fk => ({
      column: fk.from,
      exists: db.prepare(`SELECT 1 FROM ${fk.table} WHERE ${fk.to || 'id'} = ? LIMIT 1`),
    }));
};

const buildUpsert = (db: DatabaseType.Database, spec: PullTableSpec, cols: string[]) => {
  const updatable = cols.filter(c => c !== 'id' && !spec.preserve.includes(c));

  // NULL never wins. The cloud is a DEGRADED copy of this data, not a
  // superset: it has no price-tier columns at all, its product_families table
  // is empty while 45 distinct family ids are referenced, and `category` is
  // NULL on most rows that have a real family locally. A plain
  // `col = excluded.col` would therefore let a pull blank out real local
  // values wholesale. COALESCE means the cloud can only ever ADD information
  // or change a value to another non-null value - never erase one.
  const setClause = updatable
    .map(c => `${c} = COALESCE(excluded.${c}, ${spec.table}.${c})`)
    .join(',\n        ');

  // Newer-wins guard. COALESCE because a NULL on either side would make the
  // comparison NULL (never true) and silently freeze that row forever.
  const guard = cols.includes('updated_at')
    ? `WHERE COALESCE(excluded.updated_at, '') >= COALESCE(${spec.table}.updated_at, '')`
    : '';
  if (updatable.length === 0) {
    // Nothing to update (every shared column is preserved) - insert-only.
    return db.prepare(`
      INSERT INTO ${spec.table} (${cols.join(', ')})
      VALUES (${cols.map(c => `@${c}`).join(', ')})
      ON CONFLICT(id) DO NOTHING
    `);
  }

  return db.prepare(`
    INSERT INTO ${spec.table} (${cols.join(', ')})
    VALUES (${cols.map(c => `@${c}`).join(', ')})
    ON CONFLICT(id) DO UPDATE SET
        ${setClause}
    ${guard}
  `);
};

/**
 * Fetch every page of one table from Supabase and upsert it locally.
 * Returns counts; throws only on a network/HTTP failure.
 */
const pullTable = async (
  db: DatabaseType.Database,
  spec: PullTableSpec,
  supabaseUrl: string,
  headers: Record<string, string>,
  storeId?: string
): Promise<PullTableResult> => {
  let stmt: DatabaseType.Statement | null = null;
  let cols: string[] = [];
  let fetched = 0;
  let written = 0;
  let skippedColumns: string[] = [];
  let fks: { column: string; exists: DatabaseType.Statement }[] = [];
  let droppedRefs = 0;

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL(`${supabaseUrl}/rest/v1/${spec.table}`);
    url.searchParams.set('select', '*');
    // Stable ordering is required for offset paging to be correct - without
    // it PostgREST may return overlapping or skipped rows between pages.
    url.searchParams.set('order', 'id');
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(offset));
    if (storeId) url.searchParams.set('store_id', `eq.${storeId}`);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // PGRST205 = the table does not exist in the cloud schema at all (the
      // live `clients` table is in exactly this state). That is a known gap,
      // not a sync failure - reporting it as an error would make `ok` false
      // on every otherwise-healthy pull and destroy the value of the flag.
      if (body.includes('PGRST205')) {
        return { table: spec.table, fetched: 0, written: 0, absentInCloud: true };
      }
      throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
    }

    const rows = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    fetched += rows.length;

    // Built once, from the first real row - only the cloud can tell us which
    // columns it actually carries.
    if (!stmt) {
      const cloudKeys = new Set(Object.keys(rows[0]));
      const resolved = effectiveColumns(db, spec, cloudKeys);
      if (resolved.missingRequired.length > 0) {
        throw new Error(
          `cloud table is missing required column(s): ${resolved.missingRequired.join(', ')}`
        );
      }
      if (!resolved.columns.includes('id')) {
        throw new Error('cloud rows have no id column');
      }
      cols = resolved.columns;
      skippedColumns = spec.columns.filter(c => !cols.includes(c));
      stmt = buildUpsert(db, spec, cols);
      fks = foreignKeysFor(db, spec.table, cols);
    }

    // One transaction per page: a partial page never lands.
    const writePage = db.transaction((batch: Record<string, unknown>[]) => {
      for (const row of batch) {
        // Bind every declared column explicitly. A cloud row missing a column
        // this local schema has (or carrying extras it does not) must not
        // throw - better-sqlite3 rejects both missing and surplus named
        // parameters, and cloud/local schemas drift constantly here.
        const bound: Record<string, unknown> = {};
        for (const col of cols) {
          const v = row[col];
          bound[col] = v === undefined ? null : v;
        }
        if (!bound.id) continue;

        // Drop references the local DB cannot satisfy rather than losing the
        // whole row to a constraint error.
        for (const fk of fks) {
          const v = bound[fk.column];
          if (v != null && !fk.exists.get(v)) {
            bound[fk.column] = null;
            droppedRefs += 1;
          }
        }

        stmt!.run(bound);
        written += 1;
      }
    });
    writePage(rows);

    if (rows.length < PAGE_SIZE) break;
  }

  // skippedColumns is reported, not swallowed: "products synced fine" while
  // every wholesale price was quietly left behind is exactly the kind of
  // half-success this codebase has been bitten by repeatedly.
  return { table: spec.table, fetched, written, skippedColumns, droppedRefs };
};

/**
 * Hydrate every table in PULL_TABLES.
 *
 * A failure on one table is recorded and the rest still run: a missing or
 * renamed cloud table should degrade the pull, not abort it and leave the
 * install with nothing.
 */
export const pullAll = async (
  db: DatabaseType.Database,
  supabaseUrl: string,
  headers: Record<string, string>,
  storeId?: string
): Promise<PullTableResult[]> => {
  const results: PullTableResult[] = [];
  for (const spec of PULL_TABLES) {
    try {
      results.push(await pullTable(db, spec, supabaseUrl, headers, storeId));
    } catch (err) {
      results.push({
        table: spec.table,
        fetched: 0,
        written: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
};
