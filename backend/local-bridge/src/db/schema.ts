import Database from 'better-sqlite3';

export const initializeSchema = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      store_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      owner_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS product_families (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      parent_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      description TEXT,
      cost_price REAL,
      unit_price REAL,
      wholesale_price REAL,
      min_quantity INTEGER DEFAULT 0,
      low_stock_threshold INTEGER DEFAULT 0,
      quantity INTEGER DEFAULT 0,
      category TEXT,
      image_url TEXT,
      aisle TEXT,
      brand TEXT,
      unit_type TEXT,
      packaging TEXT,
      expiry_date TEXT,
      reorder_quantity INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT,
      updated_by TEXT,
      FOREIGN KEY (category) REFERENCES product_families(id) ON DELETE SET NULL
    );

    -- FTS5 Virtual Table for ultra-fast searching
    CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
      id UNINDEXED,
      store_id UNINDEXED,
      name,
      sku,
      barcode,
      description,
      content='products',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS index in sync with products table
    CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
      INSERT INTO products_fts(rowid, id, store_id, name, sku, barcode, description)
      VALUES (new.rowid, new.id, new.store_id, new.name, new.sku, new.barcode, new.description);
    END;

    CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid, id, store_id, name, sku, barcode, description)
      VALUES('delete', old.rowid, old.id, old.store_id, old.name, old.sku, old.barcode, old.description);
    END;

    CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid, id, store_id, name, sku, barcode, description)
      VALUES('delete', old.rowid, old.id, old.store_id, old.name, old.sku, old.barcode, old.description);
      INSERT INTO products_fts(rowid, id, store_id, name, sku, barcode, description)
      VALUES (new.rowid, new.id, new.store_id, new.name, new.sku, new.barcode, new.description);
    END;

    CREATE TABLE IF NOT EXISTS worker_invitations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      store_id TEXT,
      invited_by TEXT,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity_ordered INTEGER NOT NULL DEFAULT 0,
      quantity_received INTEGER NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      sale_id TEXT,
      store_id TEXT,
      deliverer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      delivery_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      scheduled_at TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      worker_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      sale_type TEXT NOT NULL DEFAULT 'detail',
      total_price REAL NOT NULL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      payment_status TEXT DEFAULT 'paid',
      notes TEXT,
      invoice_number TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS replenishment_requests (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      requested_by TEXT,
      quantity_requested INTEGER,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_mutations (
      id TEXT PRIMARY KEY,
      store_id TEXT,
      mutation_type TEXT NOT NULL,
      entity TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      user_id TEXT,
      action_type TEXT NOT NULL,
      entity_affected TEXT,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      store_id TEXT,
      severity TEXT DEFAULT 'INFO',
      app_version TEXT
    );
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT,
      movement_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT,
      source TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_transactions (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      worker_id TEXT,
      type TEXT NOT NULL, -- 'in' (income), 'out' (expense)
      amount REAL NOT NULL,
      category TEXT NOT NULL, -- 'petty_cash', 'bill', 'transfer', etc.
      description TEXT,
      reference TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- End-of-day cash register closing (Fermeture de Caisse). Was posted to
    -- by the frontend already but no route/table ever existed for it - the
    -- save button 404'd silently and nothing was ever actually persisted.
    CREATE TABLE IF NOT EXISTS cash_closings (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      worker_id TEXT,
      cashier_name TEXT,
      opening_balance REAL NOT NULL DEFAULT 0,
      total_sales REAL NOT NULL DEFAULT 0,
      expected_balance REAL NOT NULL DEFAULT 0,
      actual_balance REAL NOT NULL DEFAULT 0,
      difference REAL NOT NULL DEFAULT 0,
      bill_details_json TEXT,
      observations TEXT,
      created_at TEXT NOT NULL
    );

    -- Trigger to deduct inventory when a sale item is recorded.
    --
    -- The trigger ALSO writes the matching inventory_movements row. That is
    -- deliberate and the two statements must stay in this one trigger: the
    -- deduction and its ledger entry are the same fact, and any design where
    -- they live in different places (repo layer vs trigger) drifts apart the
    -- first time a new code path inserts a sale_item. Before this, the ledger
    -- recorded only manual adjustments and purchase receipts - on a real shop
    -- database, 20 movement rows against 2035 sold line items - which made
    -- products.quantity an unauditable number that could only ever be trusted
    -- or not trusted as a whole. Stock cannot be derived, reconciled or
    -- merged across devices without a complete movement log; this is it.
    --
    -- The id is a v4-shaped UUID built from randomblob() because SQLite has no
    -- uuid() function and the rest of the schema keys on UUID strings.
    -- The SELECT ... WHERE new.product_id IS NOT NULL yields zero rows (and so
    -- inserts nothing) for line items whose product was since deleted, which
    -- is also exactly when the UPDATE above matches nothing.
    DROP TRIGGER IF EXISTS sale_items_ai;
    CREATE TRIGGER sale_items_ai AFTER INSERT ON sale_items
    WHEN (SELECT sale_type FROM sales WHERE id = new.sale_id) != 'proforma'
    BEGIN
      UPDATE products
      SET quantity = quantity - new.quantity
      WHERE id = new.product_id;

      INSERT INTO inventory_movements (
        id, store_id, product_id, product_name, movement_type,
        quantity, reason, source, created_at, created_by
      )
      SELECT
        lower(hex(randomblob(4))) || '-' ||
          lower(hex(randomblob(2))) || '-4' ||
          substr(lower(hex(randomblob(2))), 2) || '-' ||
          substr('89ab', abs(random()) % 4 + 1, 1) ||
          substr(lower(hex(randomblob(2))), 2) || '-' ||
          lower(hex(randomblob(6))),
        s.store_id, new.product_id, new.product_name, 'out',
        new.quantity, 'sale:' || new.sale_id, 'sale',
        new.created_at, s.worker_id
      FROM sales s
      WHERE s.id = new.sale_id AND new.product_id IS NOT NULL;
    END;

    -- Scheduled Orders
    CREATE TABLE IF NOT EXISTS scheduled_orders (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      supplier_id TEXT,
      name TEXT NOT NULL,
      recurrence_type TEXT NOT NULL,
      recurrence_value TEXT NOT NULL,
      next_run_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_order_items (
      id TEXT PRIMARY KEY,
      scheduled_order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (scheduled_order_id) REFERENCES scheduled_orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_batches (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      supplier_id TEXT,
      purchase_order_id TEXT,
      purchase_price REAL NOT NULL,
      purchase_type TEXT NOT NULL DEFAULT 'wholesale',
      quantity_received INTEGER NOT NULL,
      quantity_remaining INTEGER NOT NULL,
      received_at TEXT NOT NULL,
      expiry_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS client_services (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      default_discount_percent REAL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      service_id TEXT,
      name TEXT NOT NULL,
      code TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      credit_limit REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      loyalty_points INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (service_id) REFERENCES client_services(id)
    );

    CREATE INDEX IF NOT EXISTS idx_worker_invitations_status ON worker_invitations(status);
    CREATE INDEX IF NOT EXISTS idx_worker_invitations_store ON worker_invitations(store_id);
    CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
    CREATE INDEX IF NOT EXISTS idx_product_families_store ON product_families(store_id);
    CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);
    CREATE INDEX IF NOT EXISTS idx_suppliers_store ON suppliers(store_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_store ON purchase_orders(store_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_order ON purchase_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_payments_store ON supplier_payments(store_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_store ON deliveries(store_id);
    CREATE INDEX IF NOT EXISTS idx_sales_store ON sales(store_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_store ON inventory_movements(store_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_pending_mutations_status ON pending_mutations(status);
    CREATE INDEX IF NOT EXISTS idx_pending_mutations_store ON pending_mutations(store_id);

    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      op_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      base_version INTEGER,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      idempotency_key TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_outbox_store_status_created ON sync_outbox(store_id, status, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbox_idempotency ON sync_outbox(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity_type, entity_id);

    CREATE TABLE IF NOT EXISTS sync_state (
      store_id TEXT PRIMARY KEY,
      last_push_at TEXT,
      last_pull_cursor TEXT,
      last_success_at TEXT,
      last_error TEXT
    );

    -- ── Device identity ────────────────────────────────────────────────
    -- Exactly one row (CHECK id = 1). Every outbox entry and every journal
    -- row is stamped with this installation's device_id. Without it, nothing
    -- else in this file is meaningful: "two tills disagree" is not a
    -- statement you can even make when no write carries the identity of the
    -- machine that made it.
    --
    -- It lives HERE, in the same SQLite file as the data it labels, and not
    -- in a config file / %TEMP% / the registry, so that (a) it survives the
    -- temp cleaners and profile resets that routinely wipe a shop PC, and
    -- (b) a database restored from the backups/ folder onto another machine
    -- carries its own history's identity with it rather than silently
    -- adopting the new machine's.
    CREATE TABLE IF NOT EXISTS device_identity (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      device_id TEXT NOT NULL UNIQUE,
      device_label TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT
    );

    -- ── Change journal ─────────────────────────────────────────────────
    -- One row per local mutation that is meant to reach the cloud, updated
    -- in place as that mutation is attempted, applied, conflicted or parked.
    -- See sync_journal.repo.ts for the field-by-field rationale. This is a
    -- separate table from audit_logs on purpose: audit_logs is a record of
    -- what a HUMAN did in the UI (3349 rows on a real install, mostly
    -- MODULE_ENTER navigation telemetry) and is never synced; this is a
    -- record of what REPLICATION did, keyed on outbox entries, and has to
    -- outlive both the outbox row and, ideally, the device.
    CREATE TABLE IF NOT EXISTS sync_journal (
      id TEXT PRIMARY KEY,
      outbox_id TEXT,
      device_id TEXT NOT NULL,
      device_label TEXT,
      store_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      op TEXT NOT NULL,
      actor_user_id TEXT,
      local_ts TEXT NOT NULL,
      recorded_ts TEXT NOT NULL,
      synced_ts TEXT,
      server_ts TEXT,
      base_version INTEGER,
      new_version INTEGER,
      before_json TEXT,
      after_json TEXT,
      outcome TEXT NOT NULL,
      http_status INTEGER,
      attempt INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      remote_before_json TEXT,
      remote_version INTEGER,
      resolution TEXT,
      resolved_at TEXT,
      resolved_by TEXT,
      remote_journaled INTEGER NOT NULL DEFAULT 0,
      app_version TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_journal_outbox ON sync_journal(outbox_id);
    CREATE INDEX IF NOT EXISTS idx_sync_journal_entity ON sync_journal(entity_type, entity_id, local_ts);
    CREATE INDEX IF NOT EXISTS idx_sync_journal_outcome ON sync_journal(outcome, recorded_ts);
    CREATE INDEX IF NOT EXISTS idx_sync_journal_recorded ON sync_journal(recorded_ts);
    CREATE INDEX IF NOT EXISTS idx_sync_journal_unresolved
      ON sync_journal(resolution, recorded_ts) WHERE outcome = 'conflict';
    CREATE INDEX IF NOT EXISTS idx_replenishment_requests_store ON replenishment_requests(store_id);
    CREATE INDEX IF NOT EXISTS idx_replenishment_requests_status ON replenishment_requests(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_orders_next_run ON scheduled_orders(next_run_date);
    CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_batches_store ON product_batches(store_id);
  `);

  const ensureColumn = (table: string, column: string, ddl: string) => {
    const columns = db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((row: any) => row.name as string);
    if (!columns.includes(column)) {
      db.exec(ddl);
    }
  };

  const usersColumns = db
    .prepare(`PRAGMA table_info(users)`)
    .all()
    .map((row: any) => row.name as string);

  if (!usersColumns.includes('updated_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN updated_at TEXT`);
  }
  if (!usersColumns.includes('role')) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'worker'`);
  }
  if (!usersColumns.includes('phone')) {
    db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
  }

  ensureColumn('suppliers', 'balance', `ALTER TABLE suppliers ADD COLUMN balance REAL NOT NULL DEFAULT 0`);
  ensureColumn('suppliers', 'default_purchase_type', `ALTER TABLE suppliers ADD COLUMN default_purchase_type TEXT DEFAULT 'wholesale'`);
  ensureColumn('suppliers', 'price_notes', `ALTER TABLE suppliers ADD COLUMN price_notes TEXT`);

  ensureColumn('supplier_payments', 'confirmed_at', `ALTER TABLE supplier_payments ADD COLUMN confirmed_at TEXT`);

  ensureColumn('purchase_orders', 'status', `ALTER TABLE purchase_orders ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`);
  ensureColumn('purchase_orders', 'total_amount', `ALTER TABLE purchase_orders ADD COLUMN total_amount REAL NOT NULL DEFAULT 0`);
  ensureColumn('deliveries', 'status', `ALTER TABLE deliveries ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
  ensureColumn('deliveries', 'delivery_address', `ALTER TABLE deliveries ADD COLUMN delivery_address TEXT NOT NULL DEFAULT ''`);
  ensureColumn('sales', 'updated_at', `ALTER TABLE sales ADD COLUMN updated_at TEXT`);
  ensureColumn('sales', 'sale_type', `ALTER TABLE sales ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'detail'`);
  ensureColumn('sales', 'total_price', `ALTER TABLE sales ADD COLUMN total_price REAL NOT NULL DEFAULT 0`);
  ensureColumn('sales', 'payment_method', `ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'cash'`);
  ensureColumn('sales', 'payment_status', `ALTER TABLE sales ADD COLUMN payment_status TEXT DEFAULT 'paid'`);
  ensureColumn('sales', 'customer_name', `ALTER TABLE sales ADD COLUMN customer_name TEXT`);
  ensureColumn('sales', 'customer_phone', `ALTER TABLE sales ADD COLUMN customer_phone TEXT`);
  ensureColumn('sales', 'notes', `ALTER TABLE sales ADD COLUMN notes TEXT`);
  ensureColumn('sales', 'invoice_number', `ALTER TABLE sales ADD COLUMN invoice_number TEXT`);
  ensureColumn('sale_items', 'discount', `ALTER TABLE sale_items ADD COLUMN discount REAL DEFAULT 0`);
  ensureColumn('sale_items', 'batch_id', `ALTER TABLE sale_items ADD COLUMN batch_id TEXT REFERENCES product_batches(id)`);
  
  // New Product Fields
  ensureColumn('products', 'aisle', `ALTER TABLE products ADD COLUMN aisle TEXT`);
  ensureColumn('products', 'brand', `ALTER TABLE products ADD COLUMN brand TEXT`);
  ensureColumn('products', 'unit_type', `ALTER TABLE products ADD COLUMN unit_type TEXT`);
  ensureColumn('products', 'packaging', `ALTER TABLE products ADD COLUMN packaging TEXT`);
  ensureColumn('products', 'expiry_date', `ALTER TABLE products ADD COLUMN expiry_date TEXT`);
  ensureColumn('products', 'reorder_quantity', `ALTER TABLE products ADD COLUMN reorder_quantity INTEGER`);
  ensureColumn('products', 'wholesale_price_ht', `ALTER TABLE products ADD COLUMN wholesale_price_ht REAL`);
  ensureColumn('products', 'wholesale_price_ttc', `ALTER TABLE products ADD COLUMN wholesale_price_ttc REAL`);
  ensureColumn('products', 'selling_price_2', `ALTER TABLE products ADD COLUMN selling_price_2 REAL`);
  ensureColumn('products', 'selling_price_3', `ALTER TABLE products ADD COLUMN selling_price_3 REAL`);
  ensureColumn('products', 'selling_price_4', `ALTER TABLE products ADD COLUMN selling_price_4 REAL`);

  ensureColumn('stores', 'default_price_tier', `ALTER TABLE stores ADD COLUMN default_price_tier INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('inventory_movements', 'batch_id', `ALTER TABLE inventory_movements ADD COLUMN batch_id TEXT REFERENCES product_batches(id)`);
  ensureColumn('sales', 'client_id', `ALTER TABLE sales ADD COLUMN client_id TEXT REFERENCES clients(id)`);

  // Sync version columns for offline→online sync
  ensureColumn('products', 'version', `ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('products', 'deleted_at', `ALTER TABLE products ADD COLUMN deleted_at TEXT`);
  ensureColumn('products', 'low_stock_threshold', `ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER DEFAULT 0`);

  ensureColumn('clients', 'version', `ALTER TABLE clients ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('clients', 'deleted_at', `ALTER TABLE clients ADD COLUMN deleted_at TEXT`);

  ensureColumn('client_services', 'version', `ALTER TABLE client_services ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('client_services', 'deleted_at', `ALTER TABLE client_services ADD COLUMN deleted_at TEXT`);

  ensureColumn('sales', 'version', `ALTER TABLE sales ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('sales', 'deleted_at', `ALTER TABLE sales ADD COLUMN deleted_at TEXT`);

  ensureColumn('sale_items', 'version', `ALTER TABLE sale_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('sale_items', 'deleted_at', `ALTER TABLE sale_items ADD COLUMN deleted_at TEXT`);

  ensureColumn('purchase_orders', 'version', `ALTER TABLE purchase_orders ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('purchase_orders', 'deleted_at', `ALTER TABLE purchase_orders ADD COLUMN deleted_at TEXT`);

  ensureColumn('purchase_items', 'version', `ALTER TABLE purchase_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('purchase_items', 'deleted_at', `ALTER TABLE purchase_items ADD COLUMN deleted_at TEXT`);

  ensureColumn('stores', 'version', `ALTER TABLE stores ADD COLUMN version INTEGER NOT NULL DEFAULT 1`);
  ensureColumn('stores', 'deleted_at', `ALTER TABLE stores ADD COLUMN deleted_at TEXT`);

  // cash_closings predates the Fermeture de Caisse work: an older schema
  // already shipped this table (id, store_id, worker_id, opening_balance,
  // expected_balance, actual_balance, difference, bill_details_json,
  // observations, status, created_at, updated_at). The CREATE TABLE above
  // says IF NOT EXISTS, so on any install that already had it the new
  // cashier_name/total_sales columns were never added - and
  // createCashClosingsRepo() prepares an INSERT naming them at import time,
  // which threw SqliteError before any error handling existed and killed the
  // backend on startup with an empty log. Confirmed from a real client
  // database: "table cash_closings has no column named cashier_name".
  ensureColumn('cash_closings', 'cashier_name', `ALTER TABLE cash_closings ADD COLUMN cashier_name TEXT`);
  ensureColumn('cash_closings', 'total_sales', `ALTER TABLE cash_closings ADD COLUMN total_sales REAL NOT NULL DEFAULT 0`);
  // The credit ledger. The whole chain above it (create schema, INSERT list,
  // the /settle route) was missing, so this column never existed locally even
  // though Supabase has carried it all along and the UI reads it everywhere.
  ensureColumn('sales', 'amount_paid', `ALTER TABLE sales ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0`);

  // ── Conflict-resolution / journal upgrade path ───────────────────────
  // sync_outbox predates device identity by thousands of rows on every
  // existing install (3919 on the reference client database, going back five
  // months). The column is added nullable and then backfilled - see
  // ensureDeviceIdentity() in device.repo.ts, which stamps every NULL row
  // with this installation's id. That backfill is sound because an outbox
  // entry can only ever have been written by the device whose SQLite file it
  // is sitting in; there has never been a second writer.
  //
  // Adding the column without the backfill would leave every historical
  // entry unattributable forever, and the whole point of this work is that
  // months later you can still say which machine produced a write.
  ensureColumn('sync_outbox', 'device_id', `ALTER TABLE sync_outbox ADD COLUMN device_id TEXT`);
  // Records the moment a push actually finished for this entry, so the
  // journal can be reconstructed even for entries whose journal row was
  // pruned by retention.
  ensureColumn('sync_outbox', 'last_attempt_at', `ALTER TABLE sync_outbox ADD COLUMN last_attempt_at TEXT`);

  // Journal columns are listed here as well as in the CREATE TABLE above so
  // that an install which received an earlier shape of sync_journal is
  // upgraded rather than left with a table the repository cannot write to.
  // (CREATE TABLE IF NOT EXISTS is a no-op on an existing table - the exact
  // trap that took cash_closings, and the whole app, down once already.)
  const journalColumns: Array<[string, string]> = [
    ['outbox_id', 'TEXT'],
    ['device_id', 'TEXT'],
    ['device_label', 'TEXT'],
    ['store_id', 'TEXT'],
    ['actor_user_id', 'TEXT'],
    ['local_ts', 'TEXT'],
    ['recorded_ts', 'TEXT'],
    ['synced_ts', 'TEXT'],
    ['server_ts', 'TEXT'],
    ['base_version', 'INTEGER'],
    ['new_version', 'INTEGER'],
    ['before_json', 'TEXT'],
    ['after_json', 'TEXT'],
    ['http_status', 'INTEGER'],
    ['attempt', 'INTEGER'],
    ['error', 'TEXT'],
    ['remote_before_json', 'TEXT'],
    ['remote_version', 'INTEGER'],
    ['resolution', 'TEXT'],
    ['resolved_at', 'TEXT'],
    ['resolved_by', 'TEXT'],
    ['remote_journaled', 'INTEGER'],
    ['app_version', 'TEXT'],
  ];
  for (const [column, type] of journalColumns) {
    ensureColumn('sync_journal', column, `ALTER TABLE sync_journal ADD COLUMN ${column} ${type}`);
  }

  // Index on the outbox device column, added after the column exists.
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sync_outbox_device ON sync_outbox(device_id, created_at);`);
};
