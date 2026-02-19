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

    -- Trigger to deduct inventory when a sale item is recorded
    CREATE TRIGGER IF NOT EXISTS sale_items_ai AFTER INSERT ON sale_items
    BEGIN
      UPDATE products
      SET quantity = quantity - new.quantity
      WHERE id = new.product_id;
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
    CREATE INDEX IF NOT EXISTS idx_replenishment_requests_store ON replenishment_requests(store_id);
    CREATE INDEX IF NOT EXISTS idx_replenishment_requests_status ON replenishment_requests(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_orders_next_run ON scheduled_orders(next_run_date);
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
  
  // New Product Fields
  ensureColumn('products', 'aisle', `ALTER TABLE products ADD COLUMN aisle TEXT`);
  ensureColumn('products', 'brand', `ALTER TABLE products ADD COLUMN brand TEXT`);
  ensureColumn('products', 'unit_type', `ALTER TABLE products ADD COLUMN unit_type TEXT`);
  ensureColumn('products', 'packaging', `ALTER TABLE products ADD COLUMN packaging TEXT`);
  ensureColumn('products', 'expiry_date', `ALTER TABLE products ADD COLUMN expiry_date TEXT`);
  ensureColumn('products', 'reorder_quantity', `ALTER TABLE products ADD COLUMN reorder_quantity INTEGER`);
  ensureColumn('products', 'wholesale_price_ht', `ALTER TABLE products ADD COLUMN wholesale_price_ht REAL`);
  ensureColumn('products', 'wholesale_price_ttc', `ALTER TABLE products ADD COLUMN wholesale_price_ttc REAL`);
};
