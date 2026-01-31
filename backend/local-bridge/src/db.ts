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
  wholesale_price?: number | null;
  min_quantity?: number;
  quantity?: number;
  category?: string | null;
  image_url?: string | null;
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

class LocalBridgeDatabase {
  private readonly dbPath: string;
  private readonly db: Database.Database;

  constructor() {
    if (!fs.existsSync(env.dataDir)) {
      fs.mkdirSync(env.dataDir, { recursive: true });
    }

    this.dbPath = path.join(env.dataDir, 'localbridge.sqlite');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize() {
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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT,
        FOREIGN KEY (category) REFERENCES product_families(id) ON DELETE SET NULL
      );

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

      

      

      CREATE TABLE IF NOT EXISTS pending_mutations (
        id TEXT PRIMARY KEY,
        store_id TEXT,
        mutation_type TEXT NOT NULL,
        entity TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
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
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        discount REAL DEFAULT 0,
        total REAL NOT NULL,
        created_at TEXT NOT NULL
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
      .prepare('SELECT * FROM products WHERE store_id = ? ORDER BY name ASC')
      .all(storeId);
    return rows as LocalProduct[];
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
    const searchQuery = query.trim().toLowerCase();
    const likeQuery = `%${searchQuery}%`;
    let filterClause = '';
    
    if (filter === 'in_stock') {
        filterClause = 'AND quantity > 0';
    } else if (filter === 'out_of_stock') {
        filterClause = 'AND quantity <= 0';
    } else if (filter === 'low_stock') {
        // Assuming min_quantity defaults to 0 or 10 if null, but SQL needs explicit handling if column is nullable
        // The table definition has DEFAULT 0 for min_quantity.
        filterClause = 'AND quantity > 0 AND quantity <= COALESCE(min_quantity, 10)';
    }

    const countResult = this.db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM products 
      WHERE store_id = ? 
      AND (
        LOWER(name) LIKE ? OR 
        LOWER(sku) LIKE ? OR 
        LOWER(barcode) LIKE ?
      )
      ${filterClause}
    `
      )
      .get(storeId, likeQuery, likeQuery, likeQuery) as { count: number };

    const rows = this.db
      .prepare(
        `
      SELECT * 
      FROM products 
      WHERE store_id = ? 
      AND (
        LOWER(name) LIKE ? OR 
        LOWER(sku) LIKE ? OR 
        LOWER(barcode) LIKE ?
      )
      ${filterClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `
      )
      .all(storeId, likeQuery, likeQuery, likeQuery, limit, offset);

    return {
      data: rows as LocalProduct[],
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
          min_quantity,
          quantity,
          category,
          image_url,
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
          @min_quantity,
          @quantity,
          @category,
          @image_url,
          @created_at,
          @updated_at,
          @created_by,
          @updated_by
        )
      `)
      .run({
        ...product,
        sku: product.sku ?? null,
        barcode: product.barcode ?? null,
        description: product.description ?? null,
        cost_price: product.cost_price ?? null,
        unit_price: product.unit_price ?? null,
        wholesale_price: product.wholesale_price ?? null,
        min_quantity: product.min_quantity ?? 0,
        quantity: product.quantity ?? 0,
        category: product.category ?? null,
        image_url: product.image_url ?? null,
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
  listPurchaseOrders(storeId: string, status?: string): LocalPurchaseOrder[] {
    if (status) {
      return this.db
        .prepare('SELECT * FROM purchase_orders WHERE store_id = ? AND status = ? ORDER BY created_at DESC')
        .all(storeId, status) as LocalPurchaseOrder[];
    }
    return this.db
      .prepare('SELECT * FROM purchase_orders WHERE store_id = ? ORDER BY created_at DESC')
      .all(storeId) as LocalPurchaseOrder[];
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
  listPurchaseItems(orderId: string): LocalPurchaseItem[] {
    const rows = this.db
      .prepare('SELECT * FROM purchase_items WHERE order_id = ? ORDER BY created_at ASC')
      .all(orderId);
    return rows as LocalPurchaseItem[];
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
    this.db
      .prepare(
        `
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
      `
      )
      .run({
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
}

export const db = new LocalBridgeDatabase();
