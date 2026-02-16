import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { env } from './env.js';

export interface LocalUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone?: string | null;
  created_at: string;
  updated_at: string;
  role?: "master" | "worker" | "deliverer";
}

export interface LocalRole {
  id: string;
  user_id: string;
  role: 'master' | 'worker' | 'deliverer';
  store_id?: string;
  created_at: string;
}

export interface LocalSession {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  created_at: string;
}

export interface LocalStore {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  owner_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalWorkerInvitation {
  id: string;
  email: string;
  role: 'worker' | 'deliverer';
  store_id?: string | null;
  invited_by?: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalProductFamily {
  id: string;
  store_id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalProduct {
  id: string;
  store_id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  cost_price?: number | null;
  unit_price?: number | null;
  wholesale_price?: number | null; // Deprecated/Generic
  wholesale_price_ht?: number | null;
  wholesale_price_ttc?: number | null;
  min_quantity?: number;
  quantity?: number;
  category?: string | null;
  image_url?: string | null;
  // New fields
  aisle?: string | null;
  brand?: string | null;
  unit_type?: string | null;
  packaging?: string | null;
  expiry_date?: string | null;
  reorder_quantity?: number;
  
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface LocalSupplier {
  id: string;
  store_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface LocalPurchaseOrder {
  id: string;
  store_id: string;
  supplier_id: string;
  status: 'draft' | 'ordered' | 'received' | 'partial';
  total_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalPurchaseItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  created_at: string;
}

export interface LocalSupplierPayment {
  id: string;
  store_id: string;
  supplier_id: string;
  amount: number;
  payment_method: string;
  reference?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface LocalDelivery {
  id: string;
  sale_id?: string | null;
  store_id?: string | null;
  deliverer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address: string;
  status: 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
  notes?: string | null;
  scheduled_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalSale {
  id: string;
  store_id: string;
  worker_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sale_type: 'detail' | 'gros' | 'proforma';
  total_price: number;
  discount?: number | null;
  tax?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  notes?: string | null;
  invoice_number?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalSaleItem {
  id: string;
  sale_id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount?: number | null;
  total: number;
  created_at: string;
}

export interface LocalScheduledOrder {
  id: string;
  store_id: string;
  supplier_id?: string | null;
  name: string;
  recurrence_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurrence_value: string;
  next_run_date: string;
  is_active: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface LocalScheduledOrderItem {
  id: string;
  scheduled_order_id: string;
  product_id: string;
  quantity: number;
}


export interface LocalInventoryMovement {
  id: string;
  store_id: string;
  product_id: string;
  product_name?: string | null;
  movement_type: 'adjustment' | 'in' | 'out';
  quantity: number;
  reason?: string | null;
  source?: string | null;
  created_at: string;
  created_by?: string | null;
}


export interface LocalPendingMutation {
  id: string;
  store_id?: string | null;
  mutation_type: string;
  entity: string;
  payload: string;
  created_at: string;
  status: 'pending' | 'synced' | 'failed';
}

export interface LocalReplenishmentRequest {
  id: string;
  store_id: string;
  product_id: string;
  requested_by?: string | null;
  quantity_requested?: number | null;
  reason?: string | null;
  status: 'pending' | 'ordered' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface LocalAuditLog {
  id: string;
  timestamp: string;
  user_id?: string | null;
  action_type: string;
  entity_affected?: string | null;
  entity_id?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  ip_address?: string | null;
  store_id?: string | null;
  severity?: 'INFO' | 'WARN' | 'ERROR';
  app_version?: string;
}

export interface ReplenishmentNeed {
  product_id: string;
  product_name: string;
  sku?: string;
  current_stock: number;
  min_stock: number;
  unit_type?: string;
  packaging?: string;
  unit_price?: number;
  cost_price?: number;
  supplier_id?: string;
  supplier_name?: string;
  source: 'low_stock' | 'worker_request';
  suggested_qty: number;
  request_id?: string;
  request_reason?: string;
  requester_name?: string;
}

// Helper to prevent database corruption from null bytes or control characters
const sanitizeString = (str?: string | null) => {
  if (!str) return str;
  // Remove control characters (0-31) except newlines/tabs, and delete (127)
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
};

class LocalBridgeDatabase {
  private readonly dbPath: string;
  public readonly db: Database.Database;

  constructor() {
    if (!fs.existsSync(env.dataDir)) {
      fs.mkdirSync(env.dataDir, { recursive: true });
    }

    this.dbPath = path.join(env.dataDir, 'localbridge.sqlite');
    
    // Handle pkg-packaged environment: specify native module location
    let options: Database.Options = {};
    if ((process as any).pkg) {
        const execDir = path.dirname(process.execPath);
        const resourcePath = path.resolve(execDir, '../Resources/binaries/better_sqlite3.node');
        const adjacentPath = path.join(execDir, 'better_sqlite3.node');

        if (fs.existsSync(resourcePath)) {
            console.log('[DB] Using native module from:', resourcePath);
            options.nativeBinding = resourcePath;
        } else if (fs.existsSync(adjacentPath)) {
            console.log('[DB] Using native module from:', adjacentPath);
            options.nativeBinding = adjacentPath;
        } else {
            console.error('[DB] ERROR: Could not find better_sqlite3.node in:', resourcePath, 'or', adjacentPath);
            // List what's actually in the directories for debugging
            try {
              const macosDir = path.resolve(execDir);
              const resourcesDir = path.resolve(execDir, '../Resources/binaries');
              console.error('[DB] Contents of MacOS dir:', fs.existsSync(macosDir) ? fs.readdirSync(macosDir) : 'DOES NOT EXIST');
              console.error('[DB] Contents of Resources/binaries:', fs.existsSync(resourcesDir) ? fs.readdirSync(resourcesDir) : 'DOES NOT EXIST');
            } catch (e) {
              console.error('[DB] Error listing directories:', e);
            }
        }
    }
    
    this.db = new Database(this.dbPath, options);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
    this.migrate();
  }
    
  private migrate() {
    // Force recreate triggers to ensure they are active
    try {
      this.db.exec('DROP TRIGGER IF EXISTS sale_items_ai;');
      this.db.exec(`
        CREATE TRIGGER sale_items_ai AFTER INSERT ON sale_items
        BEGIN
          UPDATE products
          SET quantity = quantity - new.quantity
          WHERE id = new.product_id;
        END;
      `);
      console.log('[DB] Trigger sale_items_ai recreated.');
    } catch (e) {
      console.warn('[DB] Trigger migration failed:', e);
    }

    // Migration for existing audit_logs table
    try {
      this.db.exec(`ALTER TABLE audit_logs ADD COLUMN severity TEXT DEFAULT 'INFO';`);
    } catch (err) {
      // ignore if column exists
    }
    try {
      this.db.exec(`ALTER TABLE audit_logs ADD COLUMN app_version TEXT;`);
    } catch (err) {
      // ignore if column exists
    }
  }
    
  public initialize() {
    this.db.exec(`
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
      const columns = this.db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((row: any) => row.name as string);
      if (!columns.includes(column)) {
        this.db.exec(ddl);
      }
    };

    const usersColumns = this.db
      .prepare(`PRAGMA table_info(users)`)
      .all()
      .map((row: any) => row.name as string);

    if (!usersColumns.includes('updated_at')) {
      this.db.exec(`ALTER TABLE users ADD COLUMN updated_at TEXT`);
    }
    if (!usersColumns.includes('role')) {
      this.db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'worker'`);
    }
    if (!usersColumns.includes('phone')) {
      this.db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`);
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
  }

  get dbFile() {
    return this.dbPath;
  }

  getMasterUser(): (LocalUser & LocalRole) | undefined {
    const row = this.db
      .prepare(`
        SELECT u.*, r.role, r.store_id
        FROM users u
        JOIN user_roles r ON r.user_id = u.id
        WHERE r.role = 'master'
        LIMIT 1
      `)
      .get();

    return row as (LocalUser & LocalRole) | undefined;
  }

  getUserByEmail(email: string): LocalUser | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1').get(email.toLowerCase());
    return row as LocalUser | undefined;
  }

  getUserById(userId: string): LocalUser | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(userId);
    return row as LocalUser | undefined;
  }

  getRolesForUser(userId: string): LocalRole[] {
    const rows = this.db.prepare('SELECT * FROM user_roles WHERE user_id = ?').all(userId);
    return rows as LocalRole[];
  }

  insertUser(user: LocalUser) {
    this.db
      .prepare(`
        INSERT INTO users (id, email, password_hash, full_name, phone, created_at, updated_at, role)
        VALUES (@id, @email, @password_hash, @full_name, @phone, @created_at, @updated_at, @role)
      `)
      .run({
        ...user,
        email: user.email.toLowerCase(),
        role: (user as LocalUser & { role?: string }).role ?? 'worker',
        phone: user.phone ?? null,
      });
  }

  listUsers(): LocalUser[] {
    const rows = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return rows as LocalUser[];
  }

  listUserRoles(role?: string): LocalRole[] {
    if (role) {
      return this.db
        .prepare('SELECT * FROM user_roles WHERE role = ? ORDER BY created_at DESC')
        .all(role) as LocalRole[];
    }
    return this.db
      .prepare('SELECT * FROM user_roles ORDER BY created_at DESC')
      .all() as LocalRole[];
  }

  insertRole(role: LocalRole) {
    this.db
      .prepare(`
        INSERT INTO user_roles (id, user_id, role, store_id, created_at)
        VALUES (@id, @user_id, @role, @store_id, @created_at)
      `)
      .run(role);
  }

  getSessionByRefreshToken(refreshToken: string): LocalSession | undefined {
    const row = this.db
      .prepare('SELECT * FROM sessions WHERE refresh_token = ? LIMIT 1')
      .get(refreshToken);
    return row as LocalSession | undefined;
  }

  createSession(session: LocalSession) {
    this.db
      .prepare(`
        INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at, created_at)
        VALUES (@id, @user_id, @access_token, @refresh_token, @expires_at, @created_at)
      `)
      .run(session);
  }

  updateSessionTokens(sessionId: string, accessToken: string, refreshToken: string, expiresAt: number) {
    this.db
      .prepare(`
        UPDATE sessions
        SET access_token = ?, refresh_token = ?, expires_at = ?, created_at = ?
        WHERE id = ?
      `)
      .run(accessToken, refreshToken, expiresAt, new Date().toISOString(), sessionId);
  }

  deleteSession(sessionId: string) {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }

  deleteExpiredSessions(currentEpoch: number) {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(currentEpoch);
  }

  getStoreById(storeId: string): LocalStore | undefined {
    const row = this.db.prepare('SELECT * FROM stores WHERE id = ? LIMIT 1').get(storeId);
    return row as LocalStore | undefined;
  }

  getStoreByName(name: string): LocalStore | undefined {
    const row = this.db.prepare('SELECT * FROM stores WHERE LOWER(name) = LOWER(?) LIMIT 1').get(name);
    return row as LocalStore | undefined;
  }

  listStores(ownerId?: string): LocalStore[] {
    if (ownerId) {
      return this.listStoresByOwner(ownerId);
    }
    const rows = this.db.prepare('SELECT * FROM stores ORDER BY name ASC').all();
    return rows as LocalStore[];
  }

  listStoresByOwner(ownerId: string): LocalStore[] {
    const rows = this.db.prepare('SELECT * FROM stores WHERE owner_id = ? ORDER BY name ASC').all(ownerId);
    return rows as LocalStore[];
  }

  insertStore(store: LocalStore) {
    this.db
      .prepare(
        `
        INSERT INTO stores (
          id,
          name,
          address,
          phone,
          owner_id,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @name,
          @address,
          @phone,
          @owner_id,
          @created_at,
          @updated_at
        )
      `
      )
      .run({
        ...store,
        address: store.address ?? null,
        phone: store.phone ?? null,
        owner_id: store.owner_id ?? null,
      });
  }

  updateStore(
    storeId: string,
    updates: Partial<Omit<LocalStore, 'id' | 'created_at'>>
  ): LocalStore | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      return this.getStoreById(storeId);
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    this.db.prepare(`UPDATE stores SET ${assignments} WHERE id = @id`).run({
      id: storeId,
      ...Object.fromEntries(normalizedEntries),
    });
    return this.getStoreById(storeId);
  }

  deleteStore(storeId: string) {
    this.db.prepare('DELETE FROM stores WHERE id = ?').run(storeId);
  }

  listProductFamilies(storeId: string): LocalProductFamily[] {
    const rows = this.db
      .prepare('SELECT * FROM product_families WHERE store_id = ? ORDER BY name ASC')
      .all(storeId);
    return rows as LocalProductFamily[];
  }

  getProductFamilyById(familyId: string): LocalProductFamily | undefined {
    const row = this.db.prepare('SELECT * FROM product_families WHERE id = ? LIMIT 1').get(familyId);
    return row as LocalProductFamily | undefined;
  }

  insertProductFamily(family: LocalProductFamily) {
    this.db
      .prepare(
        `
        INSERT INTO product_families (
          id,
          store_id,
          name,
          description,
          parent_id,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @store_id,
          @name,
          @description,
          @parent_id,
          @created_at,
          @updated_at
        )
      `
      )
      .run({
        ...family,
        description: family.description ?? null,
        parent_id: family.parent_id ?? null,
      });
  }

  updateProductFamily(
    familyId: string,
    updates: Partial<Omit<LocalProductFamily, 'id' | 'store_id'>>
  ): LocalProductFamily | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      return this.getProductFamilyById(familyId);
    }

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    this.db
      .prepare(`UPDATE product_families SET ${assignments} WHERE id = @id`)
      .run({ id: familyId, ...Object.fromEntries(normalizedEntries) });
    return this.getProductFamilyById(familyId);
  }

  deleteProductFamily(familyId: string) {
    this.db.prepare('DELETE FROM product_families WHERE id = ?').run(familyId);
    this.db
      .prepare('UPDATE products SET category = NULL WHERE category = ?')
      .run(familyId);
  }

  listProducts(storeId: string): LocalProduct[] {
    const rows = this.db
      .prepare(`
        SELECT p.*, pf.name as category_name 
        FROM products p
        LEFT JOIN product_families pf ON p.category = pf.id
        WHERE p.store_id = ? 
        ORDER BY p.name ASC
      `)
      .all(storeId);
      
    return rows.map((row: any) => ({
      ...row,
      category_name: row.category_name || null,
    })) as LocalProduct[];
  }

  listAllProducts(): LocalProduct[] {
    const rows = this.db.prepare('SELECT * FROM products ORDER BY name ASC').all();
    return rows as LocalProduct[];
  }

  searchProducts(
    storeId: string,
    query: string,
    limit: number = 50,
    offset: number = 0,
    filter?: 'in_stock' | 'out_of_stock' | 'low_stock'
  ): { data: LocalProduct[]; total: number } {
    const searchQuery = query.trim();
    
    // If query is empty, use standard fast scan
    if (!searchQuery) {
      let filterClause = '';
      if (filter === 'in_stock') filterClause = 'AND quantity > 0';
      else if (filter === 'out_of_stock') filterClause = 'AND quantity <= 0';
      else if (filter === 'low_stock') filterClause = 'AND quantity > 0 AND quantity <= COALESCE(min_quantity, 10)';

      const total = (this.db.prepare(`SELECT COUNT(*) as count FROM products WHERE store_id = ? ${filterClause}`).get(storeId) as any).count;
      const rows = this.db.prepare(`SELECT * FROM products WHERE store_id = ? ${filterClause} ORDER BY name ASC LIMIT ? OFFSET ?`).all(storeId, limit, offset);
      return { data: rows as LocalProduct[], total };
    }

    // FTS5 MATCH pattern (prefix search for each word)
    const matchPattern = searchQuery.split(/\s+/).map(word => `${word}*`).join(' ');
    
    let filterClause = '';
    if (filter === 'in_stock') filterClause = 'AND p.quantity > 0';
    else if (filter === 'out_of_stock') filterClause = 'AND p.quantity <= 0';
    else if (filter === 'low_stock') filterClause = 'AND p.quantity > 0 AND p.quantity <= COALESCE(p.min_quantity, 10)';

    const countResult = this.db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM products_fts f
      JOIN products p ON f.id = p.id
      WHERE f.store_id = ? 
      AND products_fts MATCH ?
      ${filterClause}
    `
      )
      .get(storeId, matchPattern) as { count: number };

    const rows = this.db
      .prepare(
        `
      SELECT p.*, pf.name as category_name
      FROM products_fts f
      JOIN products p ON f.id = p.id
      LEFT JOIN product_families pf ON p.category = pf.id
      WHERE f.store_id = ? 
      AND products_fts MATCH ?
      ${filterClause}
      ORDER BY rank -- FTS5 built-in relevance ranking
      LIMIT ? OFFSET ?
    `
      )
      .all(storeId, matchPattern, limit, offset);

    const mappedRows = rows.map((row: any) => ({
      ...row,
      category_name: row.category_name || null,
    }));

    return {
      data: mappedRows as LocalProduct[],
      total: countResult.count,
    };
  }

  getProductById(productId: string): LocalProduct | undefined {
    const row = this.db.prepare('SELECT * FROM products WHERE id = ? LIMIT 1').get(productId);
    return row as LocalProduct | undefined;
  }

  insertProduct(product: LocalProduct) {
    this.db
      .prepare(`
        INSERT INTO products (
          id,
          store_id,
          name,
          sku,
          barcode,
          description,
          cost_price,
          unit_price,
          wholesale_price,
          wholesale_price_ht,
          wholesale_price_ttc,
          min_quantity,
          quantity,
          category,
          image_url,
          aisle,
          brand,
          unit_type,
          packaging,
          expiry_date,
          reorder_quantity,
          created_at,
          updated_at,
          created_by,
          updated_by
        ) VALUES (
          @id,
          @store_id,
          @name,
          @sku,
          @barcode,
          @description,
          @cost_price,
          @unit_price,
          @wholesale_price,
          @wholesale_price_ht,
          @wholesale_price_ttc,
          @min_quantity,
          @quantity,
          @category,
          @image_url,
          @aisle,
          @brand,
          @unit_type,
          @packaging,
          @expiry_date,
          @reorder_quantity,
          @created_at,
          @updated_at,
          @created_by,
          @updated_by
        )
      `)
      .run({
        ...product,
        name: sanitizeString(product.name),
        sku: sanitizeString(product.sku) ?? null,
        barcode: sanitizeString(product.barcode) ?? null,
        description: sanitizeString(product.description) ?? null,
        cost_price: product.cost_price ?? null,
        unit_price: product.unit_price ?? null,
        wholesale_price: product.wholesale_price ?? null,
        wholesale_price_ht: product.wholesale_price_ht ?? null,
        wholesale_price_ttc: product.wholesale_price_ttc ?? null,
        min_quantity: product.min_quantity ?? 0,
        quantity: product.quantity ?? 0,
        category: product.category ?? null,
        image_url: product.image_url ?? null,
        aisle: product.aisle ?? null,
        brand: product.brand ?? null,
        unit_type: product.unit_type ?? null,
        packaging: product.packaging ?? null,
        expiry_date: product.expiry_date ?? null,
        reorder_quantity: product.reorder_quantity ?? null,
        created_by: product.created_by ?? null,
        updated_by: product.updated_by ?? null,
      });
  }

  // ===== Suppliers =====
  listSuppliers(storeId: string): LocalSupplier[] {
    const rows = this.db
      .prepare('SELECT * FROM suppliers WHERE store_id = ? ORDER BY name ASC')
      .all(storeId);
    return rows as LocalSupplier[];
  }

  getSupplierById(supplierId: string): LocalSupplier | undefined {
    const row = this.db.prepare('SELECT * FROM suppliers WHERE id = ? LIMIT 1').get(supplierId);
    return row as LocalSupplier | undefined;
  }

  insertSupplier(supplier: LocalSupplier) {
    this.db
      .prepare(
        `
        INSERT INTO suppliers (
          id,
          store_id,
          name,
          phone,
          email,
          address,
          balance,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @store_id,
          @name,
          @phone,
          @email,
          @address,
          @balance,
          @created_at,
          @updated_at
        )
      `
      )
      .run({
        ...supplier,
        phone: supplier.phone ?? null,
        email: supplier.email ?? null,
        address: supplier.address ?? null,
      });
  }

  updateSupplier(
    supplierId: string,
    updates: Partial<Omit<LocalSupplier, 'id' | 'store_id' | 'created_at'>>
  ): LocalSupplier | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      return this.getSupplierById(supplierId);
    }

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    this.db
      .prepare(`UPDATE suppliers SET ${assignments} WHERE id = @id`)
      .run({ id: supplierId, ...Object.fromEntries(normalizedEntries) });
    return this.getSupplierById(supplierId);
  }

  deleteSupplier(supplierId: string) {
    this.db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplierId);
  }

  // ===== Purchase Orders =====
  listPurchaseOrders(storeId: string, status?: string): (LocalPurchaseOrder & { supplier?: LocalSupplier })[] {
    let sql = `
      SELECT po.*, 
             s.id as s_id, s.name as s_name, s.phone as s_phone, s.email as s_email, s.address as s_address, s.balance as s_balance
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.store_id = ?
    `;
    
    const params: any[] = [storeId];
    if (status) {
      sql += ' AND po.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY po.created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      store_id: row.store_id,
      supplier_id: row.supplier_id,
      status: row.status,
      total_amount: row.total_amount,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      supplier: row.s_id ? {
        id: row.s_id,
        store_id: row.store_id,
        name: row.s_name,
        phone: row.s_phone,
        email: row.s_email,
        address: row.s_address,
        balance: row.s_balance,
        created_at: '', // Not needed for display
        updated_at: ''
      } : undefined
    }));
  }

  getPurchaseOrderById(orderId: string): LocalPurchaseOrder | undefined {
    const row = this.db.prepare('SELECT * FROM purchase_orders WHERE id = ? LIMIT 1').get(orderId);
    return row as LocalPurchaseOrder | undefined;
  }

  insertPurchaseOrder(order: LocalPurchaseOrder) {
    this.db
      .prepare(
        `
        INSERT INTO purchase_orders (
          id,
          store_id,
          supplier_id,
          status,
          total_amount,
          notes,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @store_id,
          @supplier_id,
          @status,
          @total_amount,
          @notes,
          @created_at,
          @updated_at
        )
      `
      )
      .run({
        ...order,
        notes: order.notes ?? null,
      });
  }

  updatePurchaseOrder(
    orderId: string,
    updates: Partial<Omit<LocalPurchaseOrder, 'id' | 'store_id' | 'supplier_id' | 'created_at'>>
  ): LocalPurchaseOrder | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      return this.getPurchaseOrderById(orderId);
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    this.db
      .prepare(`UPDATE purchase_orders SET ${assignments} WHERE id = @id`)
      .run({ id: orderId, ...Object.fromEntries(normalizedEntries) });
    return this.getPurchaseOrderById(orderId);
  }

  deletePurchaseOrder(orderId: string) {
    this.db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(orderId);
    this.db.prepare('DELETE FROM purchase_items WHERE order_id = ?').run(orderId);
  }

  // ===== Purchase Items =====
  listPurchaseItems(orderId: string): (LocalPurchaseItem & { product?: { id: string; name: string } })[] {
    const rows = this.db
      .prepare(`
        SELECT pi.*, p.id as p_id, p.name as p_name
        FROM purchase_items pi
        LEFT JOIN products p ON pi.product_id = p.id
        WHERE pi.order_id = ?
        ORDER BY pi.created_at ASC
      `)
      .all(orderId) as any[];
      
    return rows.map(row => ({
      id: row.id,
      order_id: row.order_id,
      product_id: row.product_id,
      quantity_ordered: row.quantity_ordered,
      quantity_received: row.quantity_received,
      unit_cost: row.unit_cost,
      created_at: row.created_at,
      product: row.p_id ? {
        id: row.p_id,
        name: row.p_name
      } : undefined
    }));
  }

  insertPurchaseItem(item: LocalPurchaseItem) {
    this.db
      .prepare(
        `
        INSERT INTO purchase_items (
          id,
          order_id,
          product_id,
          quantity_ordered,
          quantity_received,
          unit_cost,
          created_at
        ) VALUES (
          @id,
          @order_id,
          @product_id,
          @quantity_ordered,
          @quantity_received,
          @unit_cost,
          @created_at
        )
      `
      )
      .run(item);
  }

  updatePurchaseItem(
    itemId: string,
    updates: Partial<Omit<LocalPurchaseItem, 'id' | 'order_id' | 'product_id' | 'created_at'>>
  ): LocalPurchaseItem | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      const row = this.db.prepare('SELECT * FROM purchase_items WHERE id = ? LIMIT 1').get(itemId);
      return row as LocalPurchaseItem | undefined;
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    this.db
      .prepare(`UPDATE purchase_items SET ${assignments} WHERE id = @id`)
      .run({ id: itemId, ...Object.fromEntries(normalizedEntries) });
    const row = this.db.prepare('SELECT * FROM purchase_items WHERE id = ? LIMIT 1').get(itemId);
    return row as LocalPurchaseItem | undefined;
  }

  deletePurchaseItem(itemId: string) {
    this.db.prepare('DELETE FROM purchase_items WHERE id = ?').run(itemId);
  }

  // ===== Supplier Payments =====
  listSupplierPayments(storeId: string): LocalSupplierPayment[] {
    const rows = this.db
      .prepare('SELECT * FROM supplier_payments WHERE store_id = ? ORDER BY created_at DESC')
      .all(storeId);
    return rows as LocalSupplierPayment[];
  }

  insertSupplierPayment(payment: LocalSupplierPayment) {
    const insertPayment = this.db.prepare(`
      INSERT INTO supplier_payments (
        id,
        store_id,
        supplier_id,
        amount,
        payment_method,
        reference,
        notes,
        created_at
      ) VALUES (
        @id,
        @store_id,
        @supplier_id,
        @amount,
        @payment_method,
        @reference,
        @notes,
        @created_at
      )
    `);

    const updateBalance = this.db.prepare(`
      UPDATE suppliers
      SET balance = balance - @amount, updated_at = @created_at
      WHERE id = @supplier_id
    `);

    const transaction = this.db.transaction((paymentData) => {
      insertPayment.run(paymentData);
      updateBalance.run({
        amount: paymentData.amount,
        created_at: paymentData.created_at,
        supplier_id: paymentData.supplier_id,
      });
    });

    transaction({
      ...payment,
      reference: payment.reference ?? null,
      notes: payment.notes ?? null,
    });
  }



  // ===== Pending Mutations =====
  listPendingMutations(status: 'pending' | 'synced' | 'failed' = 'pending'): LocalPendingMutation[] {
    const rows = this.db
      .prepare('SELECT * FROM pending_mutations WHERE status = ? ORDER BY created_at ASC')
      .all(status);
    return rows as LocalPendingMutation[];
  }

  insertPendingMutation(mutation: LocalPendingMutation) {
    this.db
      .prepare(
        `
        INSERT INTO pending_mutations (
          id,
          store_id,
          mutation_type,
          entity,
          payload,
          created_at,
          status
        ) VALUES (
          @id,
          @store_id,
          @mutation_type,
          @entity,
          @payload,
          @created_at,
          @status
        )
      `
      )
      .run({
        ...mutation,
        store_id: mutation.store_id ?? null,
      });
  }

  updatePendingMutationStatus(id: string, status: 'pending' | 'synced' | 'failed') {
    this.db.prepare('UPDATE pending_mutations SET status = ? WHERE id = ?').run(status, id);
  }

  // ===== Inventory Movements =====
  listInventoryMovements(storeId?: string, limit?: number): LocalInventoryMovement[] {
    if (storeId) {
      const rows = this.db
        .prepare(
          `SELECT * FROM inventory_movements WHERE store_id = ? ORDER BY created_at DESC${limit ? ' LIMIT ?' : ''}`
        )
        .all(limit ? [storeId, limit] : [storeId]);
      return rows as LocalInventoryMovement[];
    }
    const rows = this.db
      .prepare(`SELECT * FROM inventory_movements ORDER BY created_at DESC${limit ? ' LIMIT ?' : ''}`)
      .all(limit ? [limit] : []);
    return rows as LocalInventoryMovement[];
  }

  insertInventoryMovement(movement: LocalInventoryMovement) {
    this.db
      .prepare(
        `
        INSERT INTO inventory_movements (
          id,
          store_id,
          product_id,
          product_name,
          movement_type,
          quantity,
          reason,
          source,
          created_at,
          created_by
        ) VALUES (
          @id,
          @store_id,
          @product_id,
          @product_name,
          @movement_type,
          @quantity,
          @reason,
          @source,
          @created_at,
          @created_by
        )
      `
      )
      .run({
        ...movement,
        product_name: movement.product_name ?? null,
        reason: movement.reason ?? null,
        source: movement.source ?? null,
        created_by: movement.created_by ?? null,
      });
  }

  // ===== Sales =====
  listSales(storeId?: string, limit?: number): LocalSale[] {
    if (storeId) {
      const rows = this.db
        .prepare(
          `SELECT * FROM sales WHERE store_id = ? ORDER BY created_at DESC${limit ? ' LIMIT ?' : ''}`
        )
        .all(limit ? [storeId, limit] : [storeId]);
      return rows as LocalSale[];
    }
    const rows = this.db
      .prepare(`SELECT * FROM sales ORDER BY created_at DESC${limit ? ' LIMIT ?' : ''}`)
      .all(limit ? [limit] : []);
    return rows as LocalSale[];
  }

  getSaleById(saleId: string): LocalSale | undefined {
    const row = this.db.prepare('SELECT * FROM sales WHERE id = ? LIMIT 1').get(saleId);
    return row as LocalSale | undefined;
  }

  insertSale(sale: LocalSale) {
    this.db
      .prepare(
        `
        INSERT INTO sales (
          id,
          store_id,
          worker_id,
          customer_name,
          customer_phone,
          sale_type,
          total_price,
          discount,
          tax,
          payment_method,
          payment_status,
          notes,
          invoice_number,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @store_id,
          @worker_id,
          @customer_name,
          @customer_phone,
          @sale_type,
          @total_price,
          @discount,
          @tax,
          @payment_method,
          @payment_status,
          @notes,
          @invoice_number,
          @created_at,
          @updated_at
        )
      `
      )
      .run({
        ...sale,
        worker_id: sale.worker_id ?? null,
        customer_name: sale.customer_name ?? null,
        customer_phone: sale.customer_phone ?? null,
        discount: sale.discount ?? 0,
        tax: sale.tax ?? 0,
        payment_method: sale.payment_method ?? 'cash',
        payment_status: sale.payment_status ?? 'paid',
        notes: sale.notes ?? null,
        invoice_number: sale.invoice_number ?? null,
      });
  }

  updateSale(
    saleId: string,
    updates: Partial<Omit<LocalSale, 'id' | 'store_id' | 'created_at'>>
  ): LocalSale | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      return this.getSaleById(saleId);
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    this.db.prepare(`UPDATE sales SET ${assignments} WHERE id = @id`).run({
      id: saleId,
      ...Object.fromEntries(normalizedEntries),
    });
    return this.getSaleById(saleId);
  }

  deleteSale(saleId: string) {
    this.db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId);
    this.db.prepare('DELETE FROM sales WHERE id = ?').run(saleId);
  }

  listSaleItems(saleId: string): LocalSaleItem[] {
    const rows = this.db
      .prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC')
      .all(saleId);
    return rows as LocalSaleItem[];
  }

  insertSaleItem(item: LocalSaleItem) {
    this.db
      .prepare(
        `
        INSERT INTO sale_items (
          id,
          sale_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          discount,
          total,
          created_at
        ) VALUES (
          @id,
          @sale_id,
          @product_id,
          @product_name,
          @quantity,
          @unit_price,
          @discount,
          @total,
          @created_at
        )
      `
      )
      .run({
        ...item,
        product_id: item.product_id ?? null,
        discount: item.discount ?? 0,
      });
  }

  // ===== Deliveries =====
  listDeliveries(storeId?: string, delivererId?: string): LocalDelivery[] {
    if (delivererId) {
      return this.db
        .prepare('SELECT * FROM deliveries WHERE deliverer_id = ? ORDER BY created_at DESC')
        .all(delivererId) as LocalDelivery[];
    }
    if (storeId) {
      return this.db
        .prepare('SELECT * FROM deliveries WHERE store_id = ? ORDER BY created_at DESC')
        .all(storeId) as LocalDelivery[];
    }
    return this.db.prepare('SELECT * FROM deliveries ORDER BY created_at DESC').all() as LocalDelivery[];
  }

  getDeliveryById(deliveryId: string): LocalDelivery | undefined {
    const row = this.db.prepare('SELECT * FROM deliveries WHERE id = ? LIMIT 1').get(deliveryId);
    return row as LocalDelivery | undefined;
  }

  insertDelivery(delivery: LocalDelivery) {
    this.db
      .prepare(
        `
        INSERT INTO deliveries (
          id,
          sale_id,
          store_id,
          deliverer_id,
          customer_name,
          customer_phone,
          delivery_address,
          status,
          notes,
          scheduled_at,
          delivered_at,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @sale_id,
          @store_id,
          @deliverer_id,
          @customer_name,
          @customer_phone,
          @delivery_address,
          @status,
          @notes,
          @scheduled_at,
          @delivered_at,
          @created_at,
          @updated_at
        )
      `
      )
      .run({
        ...delivery,
        sale_id: delivery.sale_id ?? null,
        store_id: delivery.store_id ?? null,
        deliverer_id: delivery.deliverer_id ?? null,
        customer_name: delivery.customer_name ?? null,
        customer_phone: delivery.customer_phone ?? null,
        notes: delivery.notes ?? null,
        scheduled_at: delivery.scheduled_at ?? null,
        delivered_at: delivery.delivered_at ?? null,
      });
  }

  updateDelivery(
    deliveryId: string,
    updates: Partial<Omit<LocalDelivery, 'id' | 'created_at'>>
  ): LocalDelivery | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      return this.getDeliveryById(deliveryId);
    }
    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    this.db
      .prepare(`UPDATE deliveries SET ${assignments} WHERE id = @id`)
      .run({ id: deliveryId, ...Object.fromEntries(normalizedEntries) });
    return this.getDeliveryById(deliveryId);
  }

  deleteDelivery(deliveryId: string) {
    this.db.prepare('DELETE FROM deliveries WHERE id = ?').run(deliveryId);
  }

  updateProduct(
    productId: string,
    updates: Partial<Omit<LocalProduct, 'id' | 'store_id'>>
  ): LocalProduct | undefined {
    console.log('[DB] updateProduct', productId, updates);
    // Sanitize string fields
    if (updates.name) updates.name = sanitizeString(updates.name)!;
    if (updates.sku) updates.sku = sanitizeString(updates.sku);
    if (updates.barcode) updates.barcode = sanitizeString(updates.barcode);
    if (updates.description) updates.description = sanitizeString(updates.description);

    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      return this.getProductById(productId);
    }

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    const statement = this.db.prepare(`UPDATE products SET ${assignments} WHERE id = @id`);
    statement.run({ id: productId, ...Object.fromEntries(normalizedEntries) });
    return this.getProductById(productId);
  }

  deleteProduct(productId: string) {
    this.db.prepare('DELETE FROM products WHERE id = ?').run(productId);
  }

  listInvitations(storeId?: string): LocalWorkerInvitation[] {
    if (storeId) {
      return this.db
        .prepare('SELECT * FROM worker_invitations WHERE store_id = ? ORDER BY created_at DESC')
        .all(storeId) as LocalWorkerInvitation[];
    }
    return this.db
      .prepare('SELECT * FROM worker_invitations ORDER BY created_at DESC')
      .all() as LocalWorkerInvitation[];
  }

  getInvitationById(invitationId: string): LocalWorkerInvitation | undefined {
    const row = this.db
      .prepare('SELECT * FROM worker_invitations WHERE id = ? LIMIT 1')
      .get(invitationId);
    return row as LocalWorkerInvitation | undefined;
  }

  getInvitationByToken(token: string): LocalWorkerInvitation | undefined {
    const row = this.db
      .prepare('SELECT * FROM worker_invitations WHERE token = ? LIMIT 1')
      .get(token);
    return row as LocalWorkerInvitation | undefined;
  }

  // ===== Analytics Aggregations =====
  getDailyRevenue(storeId: string): number {
    const row = this.db
      .prepare(`
        SELECT SUM(COALESCE(CAST(total_price AS REAL), 0)) as total
        FROM sales
        WHERE store_id = ? AND date(created_at) = date('now')
      `)
      .get(storeId) as { total: number };
    return row?.total || 0;
  }

  getWeeklyRevenue(storeId: string): { date: string; revenue: number }[] {
    const rows = this.db
      .prepare(`
        SELECT date(created_at) as date, SUM(COALESCE(CAST(total_price AS REAL), 0)) as revenue
        FROM sales
        WHERE store_id = ? AND created_at >= date('now', '-6 days')
        GROUP BY date(created_at)
        ORDER BY date(created_at) ASC
      `)
      .all(storeId) as { date: string; revenue: number }[];
    return rows;
  }

  getTopProducts(storeId: string, limit = 5): { name: string; quantity: number; revenue: number }[] {
    const rows = this.db
      .prepare(`
        SELECT 
          si.product_name as name, 
          SUM(si.quantity) as quantity, 
          SUM(COALESCE(CAST(si.total AS REAL), 0)) as revenue
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.store_id = ?
        GROUP BY si.product_name
        ORDER BY quantity DESC
        LIMIT ?
      `)
      .all(storeId, limit) as { name: string; quantity: number; revenue: number }[];
    return rows;
  }

  getTopWorkers(storeId: string, limit = 5): { name: string; sales_count: number; revenue: number }[] {
    const rows = this.db
      .prepare(`
        SELECT 
          u.full_name as name, 
          COUNT(s.id) as sales_count, 
          SUM(COALESCE(CAST(s.total_price AS REAL), 0)) as revenue
        FROM sales s
        LEFT JOIN users u ON s.worker_id = u.id
        WHERE s.store_id = ?
        GROUP BY u.full_name
        ORDER BY revenue DESC
        LIMIT ?
      `)
      .all(storeId, limit) as { name: string; sales_count: number; revenue: number }[];
    return rows;
  }

  getStockValuation(storeId: string): { total_cost: number; total_retail: number; item_count: number } {
    console.log('[DB] Calculating Stock Valuation for store:', storeId || 'ALL');
    const sql = `
        SELECT 
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(cost_price, 0) AS REAL)) as total_cost,
          SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(unit_price, 0) AS REAL)) as total_retail,
          COUNT(*) as item_count
        FROM products
        WHERE (? = '' OR store_id = ?) AND quantity > 0
    `;
    
    const row = this.db.prepare(sql).get(storeId || '', storeId || '') as any;
    console.log('[DB] Valuation Result:', row);
    
    return {
      total_cost: row?.total_cost || 0,
      total_retail: row?.total_retail || 0,
      item_count: row?.item_count || 0,
    };
  }

  // ===== Replenishment =====
  listReplenishmentRequests(storeId: string): LocalReplenishmentRequest[] {
    const rows = this.db
      .prepare('SELECT * FROM replenishment_requests WHERE store_id = ? ORDER BY created_at DESC')
      .all(storeId);
    return rows as LocalReplenishmentRequest[];
  }

  insertReplenishmentRequest(request: LocalReplenishmentRequest) {
    this.db
      .prepare(
        `
        INSERT INTO replenishment_requests (
          id, store_id, product_id, requested_by, quantity_requested, reason, status, created_at, updated_at
        ) VALUES (
          @id, @store_id, @product_id, @requested_by, @quantity_requested, @reason, @status, @created_at, @updated_at
        )
      `
      )
      .run({
        ...request,
        requested_by: request.requested_by ?? null,
        quantity_requested: request.quantity_requested ?? null,
        reason: request.reason ?? null,
      });
  }

  getReplenishmentNeeds(storeId: string): ReplenishmentNeed[] {
    // 1. Get Low Stock Products (quantity <= min_quantity)
    const lowStockProducts = this.db
      .prepare(`
        SELECT p.*, pf.name as category_name
        FROM products p
        LEFT JOIN product_families pf ON p.category = pf.id
        WHERE p.store_id = ? AND p.quantity <= COALESCE(p.min_quantity, 10)
      `)
      .all(storeId) as LocalProduct[];

    // 2. Get Pending Requests
    const pendingRequests = this.db
      .prepare(`
        SELECT rr.*, p.name as product_name, p.sku, p.quantity as current_stock, p.min_quantity,
               p.unit_type, p.packaging, p.unit_price, p.cost_price,
               u.full_name as requester_name
        FROM replenishment_requests rr
        JOIN products p ON rr.product_id = p.id
        LEFT JOIN users u ON rr.requested_by = u.id
        WHERE rr.store_id = ? AND rr.status = 'pending'
      `)
      .all(storeId) as (LocalReplenishmentRequest & {
        product_name: string;
        sku: string;
        current_stock: number;
        min_quantity: number;
        unit_type: string;
        packaging: string;
        unit_price: number;
        cost_price: number;
        requester_name?: string;
      })[];

    // 3. Merge Logic
    const needsMap = new Map<string, ReplenishmentNeed>();

    // Add Low Stock alerts
    for (const p of lowStockProducts) {
      needsMap.set(p.id, {
        product_id: p.id,
        product_name: p.name,
        sku: p.sku || undefined,
        current_stock: p.quantity || 0,
        min_stock: p.min_quantity || 0,
        packaging: p.packaging || '1',
        unit_type: p.unit_type || 'Pièce',
        unit_price: p.unit_price || 0,
        cost_price: p.cost_price || 0,
        source: 'low_stock',
        suggested_qty: Math.max(10, (p.min_quantity || 10) * 2 - (p.quantity || 0)),
      });
    }

    // Add Requests (override or add)
    for (const req of pendingRequests) {
      const existing = needsMap.get(req.product_id);
      if (existing) {
        existing.source = 'worker_request';
        existing.request_id = req.id;
        existing.request_reason = req.reason || undefined;
        existing.requester_name = req.requester_name || undefined;
        existing.suggested_qty = Math.max(existing.suggested_qty, req.quantity_requested || 0);
      } else {
        needsMap.set(req.product_id, {
          product_id: req.product_id,
          product_name: req.product_name,
          sku: req.sku,
          current_stock: req.current_stock,
          min_stock: req.min_quantity || 0,
          packaging: req.packaging || '1',
          unit_type: req.unit_type || 'Pièce',
          unit_price: req.unit_price || 0,
          cost_price: req.cost_price || 0,
          source: 'worker_request',
          suggested_qty: req.quantity_requested || 10,
          request_id: req.id,
          request_reason: req.reason || undefined,
          requester_name: req.requester_name || undefined,
        });
      }
    }

    return Array.from(needsMap.values());
  }

  insertInvitation(invitation: LocalWorkerInvitation) {
    this.db
      .prepare(
        `
        INSERT INTO worker_invitations (
          id,
          email,
          role,
          store_id,
          invited_by,
          token,
          status,
          expires_at,
          accepted_at,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @email,
          @role,
          @store_id,
          @invited_by,
          @token,
          @status,
          @expires_at,
          @accepted_at,
          @created_at,
          @updated_at
        )
      `
      )
      .run({
        ...invitation,
        store_id: invitation.store_id ?? null,
        invited_by: invitation.invited_by ?? null,
        accepted_at: invitation.accepted_at ?? null,
      });
  }

  updateInvitation(
    invitationId: string,
    updates: Partial<Omit<LocalWorkerInvitation, 'id' | 'token' | 'created_at'>>
  ): LocalWorkerInvitation | undefined {
    const normalizedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);
    if (normalizedEntries.length === 0) {
      return this.getInvitationById(invitationId);
    }

    const assignments = normalizedEntries.map(([key]) => `${key} = @${key}`).join(', ');
    const payload = {
      id: invitationId,
      updated_at: new Date().toISOString(),
      ...Object.fromEntries(
        normalizedEntries.map(([key, value]) => [
          key,
          value ?? null,
        ])
      ),
    };
    const updateAssignments = [...normalizedEntries.map(([key]) => `${key} = @${key}`), 'updated_at = @updated_at'].join(', ');
    this.db
      .prepare(`UPDATE worker_invitations SET ${updateAssignments} WHERE id = @id`)
      .run(payload);
    return this.getInvitationById(invitationId);
  }

  // ===== Scheduled Orders =====
  listScheduledOrders(storeId: string): LocalScheduledOrder[] {
    const rows = this.db
      .prepare('SELECT * FROM scheduled_orders WHERE store_id = ? ORDER BY next_run_date ASC')
      .all(storeId);
    return rows as LocalScheduledOrder[];
  }

  insertScheduledOrder(order: LocalScheduledOrder) {
    this.db
      .prepare(
        `
        INSERT INTO scheduled_orders (
          id, store_id, supplier_id, name, recurrence_type, recurrence_value, next_run_date, is_active, created_at, updated_at
        ) VALUES (
          @id, @store_id, @supplier_id, @name, @recurrence_type, @recurrence_value, @next_run_date, @is_active, @created_at, @updated_at
        )
      `
      )
      .run({
        ...order,
        supplier_id: order.supplier_id ?? null,
        is_active: order.is_active ? 1 : 0
      });
  }

  deleteScheduledOrder(id: string) {
    this.db.prepare('DELETE FROM scheduled_orders WHERE id = ?').run(id);
  }

  listScheduledOrderItems(scheduledOrderId: string): LocalScheduledOrderItem[] {
    const rows = this.db
      .prepare('SELECT * FROM scheduled_order_items WHERE scheduled_order_id = ?')
      .all(scheduledOrderId);
    return rows as LocalScheduledOrderItem[];
  }

  insertScheduledOrderItem(item: LocalScheduledOrderItem) {
    this.db
      .prepare(
        `
        INSERT INTO scheduled_order_items (
          id, scheduled_order_id, product_id, quantity
        ) VALUES (
          @id, @scheduled_order_id, @product_id, @quantity
        )
      `
      )
      .run(item);
  }

  // ===== Audit Logs =====
  insertAuditLog(log: LocalAuditLog) {
    this.db
      .prepare(
        `
        INSERT INTO audit_logs (
          id, timestamp, user_id, action_type, entity_affected, entity_id, old_value, new_value, ip_address, store_id, severity, app_version
        ) VALUES (
          @id, @timestamp, @user_id, @action_type, @entity_affected, @entity_id, @old_value, @new_value, @ip_address, @store_id, @severity, @app_version
        )
      `
      )
      .run({
        ...log,
        user_id: log.user_id ?? null,
        entity_affected: log.entity_affected ?? null,
        entity_id: log.entity_id ?? null,
        old_value: log.old_value ?? null,
        new_value: log.new_value ?? null,
        ip_address: log.ip_address ?? null,
        store_id: log.store_id ?? null,
        severity: log.severity ?? 'INFO',
        app_version: log.app_version ?? null,
      });
  }

  listAuditLogs(options: { 
    store_id?: string; 
    user_id?: string; 
    action_type?: string; 
    limit?: number; 
    offset?: number 
  }): { data: LocalAuditLog[]; total: number } {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
    const params: any = {};

    if (options.store_id) {
      sql += ' AND store_id = @store_id';
      countSql += ' AND store_id = @store_id';
      params.store_id = options.store_id;
    }
    if (options.user_id) {
      sql += ' AND user_id = @user_id';
      countSql += ' AND user_id = @user_id';
      params.user_id = options.user_id;
    }
    if (options.action_type) {
      sql += ' AND action_type = @action_type';
      countSql += ' AND action_type = @action_type';
      params.action_type = options.action_type;
    }

    const total = (this.db.prepare(countSql).get(params) as { count: number }).count;

    sql += ' ORDER BY timestamp DESC LIMIT @limit OFFSET @offset';
    params.limit = options.limit ?? 50;
    params.offset = options.offset ?? 0;

    const rows = this.db.prepare(sql).all(params) as LocalAuditLog[];

    return { data: rows, total };
  }
}

export const db = new LocalBridgeDatabase();