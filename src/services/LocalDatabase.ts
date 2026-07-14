/**
 * LocalDatabase - IndexedDB-based local storage for offline-first functionality
 */

const DB_NAME = 'retail_manager_offline';
const DB_VERSION = 9; // Upgraded for cash_closings

export interface LocalCashClosing {
  id: string;
  store_id: string;
  worker_id: string;
  opening_balance?: number;
  expected_balance?: number;
  actual_balance: number;
  difference?: number;
  bill_details_json: string;
  observations?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface LocalProductFamily {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface LocalSupplier {
  id: string;
  store_id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  default_purchase_type?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface LocalUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
  is_active: boolean;
}

export interface LocalRole {
  id: string;
  user_id: string;
  role: 'master' | 'worker' | 'deliverer';
  store_id?: string;
  sub_role?: string;
  created_at: string;
  synced: boolean;
}

export interface LocalSale {
  id: string;
  store_id?: string;
  worker_id?: string;
  items: any[];
  total_price: number;
  payment_method: string;
  sale_type: 'detail' | 'gros' | 'proforma';
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  invoice_number?: string;
  order_ref?: string;
  payment_status?: string;
  created_at: string;
  synced: boolean;
  deleted_at?: string;
}

export interface LocalInventory {
  id: string;
  store_id: string;
  product_name: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  unit_price: number;
  wholesale_price?: number;
  wholesale_price_ht?: number;
  wholesale_price_ttc?: number;
  selling_price_2?: number;
  selling_price_3?: number;
  selling_price_4?: number;
  cost?: number;
  category?: string;
  aisle?: string;
  brand?: string;
  unit_type?: string;
  packaging?: string;
  expiry_date?: string;
  reorder_quantity?: number;
  low_stock_threshold?: number;
  updated_at: string;
  synced: boolean;
}

export interface LocalPurchaseOrder {
  id: string;
  store_id: string;
  supplier_id: string;
  status: string;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
  supplier_name?: string; // Cache for display
}

export interface SyncQueueItem {
  id: string;
  type: 'user_create' | 'user_update' | 'user_delete' | 'role_create' | 'role_delete' | 'sale' | 'sale_delete' | 'inventory_update' | 'inventory_delete' | 'delivery_update' | 'store_create' | 'store_update' | 'pending_mutation' | 'supplier_create' | 'supplier_update' | 'supplier_payment' | 'purchase_create' | 'purchase_update' | 'password_change';
  data: any;
  timestamp: number;
  retries: number;
}

export interface LocalStore {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  default_price_tier: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

class LocalDatabaseService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('LocalDatabase: Failed to open', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('LocalDatabase: Opened successfully (V' + DB_VERSION + ')');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        const stores = [
            { name: 'users', indexes: ['email', 'synced'] },
            { name: 'roles', indexes: ['user_id', 'synced'] },
            { name: 'sales', indexes: ['store_id', 'synced'] },
            { name: 'inventory', indexes: ['store_id', 'synced'] },
            { name: 'stores', indexes: ['synced'] },
            { name: 'suppliers', indexes: ['store_id', 'synced'] },
            { name: 'supplier_payments', indexes: ['store_id', 'synced'] },
            { name: 'product_families', indexes: ['store_id', 'synced'] },
            { name: 'purchase_orders', indexes: ['store_id', 'status', 'synced'] },
            { name: 'purchase_items', indexes: ['order_id'] },
            { name: 'cash_closings', indexes: ['store_id', 'synced'] },
            { name: 'sync_queue', indexes: ['type', 'timestamp'] },
            { name: 'system_settings', indexes: [] }
        ];

        stores.forEach(s => {
            if (!db.objectStoreNames.contains(s.name)) {
                const store = db.createObjectStore(s.name, { keyPath: 'id' });
                s.indexes.forEach(idx => store.createIndex(idx, idx, { unique: idx === 'email' }));
            }
        });

        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session', { keyPath: 'key' });
        }

        console.log('LocalDatabase: Schema updated to V' + DB_VERSION);
      };
    });

    return this.initPromise;
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  // ==================== CASH CLOSINGS ====================

  async saveCashClosing(closing: LocalCashClosing): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('cash_closings', 'readwrite');
    tx.objectStore('cash_closings').put(closing);
  }

  async getCashClosings(storeId?: string): Promise<LocalCashClosing[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const store = db.transaction('cash_closings', 'readonly').objectStore('cash_closings');
      const req = storeId ? store.index('store_id').getAll(storeId) : store.getAll();
      req.onsuccess = () => r(req.result || []);
    });
  }

  // ==================== PURCHASE ORDERS ====================

  async savePurchaseOrder(order: LocalPurchaseOrder): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('purchase_orders', 'readwrite');
    tx.objectStore('purchase_orders').put(order);
  }

  async savePurchaseItem(item: any): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('purchase_items', 'readwrite');
    tx.objectStore('purchase_items').put(item);
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    const db = await this.ensureDb();
    
    // Safety check: only delete if stores exist (prevents crash on old schemas)
    const hasOrders = db.objectStoreNames.contains('purchase_orders');
    const hasItems = db.objectStoreNames.contains('purchase_items');
    
    if (!hasOrders) {
        console.warn('LocalDatabase: purchase_orders store missing, skipping delete');
        return;
    }

    console.log('LocalDatabase: Deleting purchase order:', id);
    const stores = hasItems ? ['purchase_orders', 'purchase_items'] : ['purchase_orders'];
    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore('purchase_orders').delete(id);
    
    if (hasItems) {
        const itemStore = tx.objectStore('purchase_items');
        // Items might not have an index yet if schema is old but store exists
        if (itemStore.indexNames.contains('order_id')) {
            const index = itemStore.index('order_id');
            const request = index.getAllKeys(id);
            request.onsuccess = () => {
                const keys = request.result;
                keys.forEach(key => itemStore.delete(key));
            };
        }
    }
  }

  async getPurchaseOrders(storeId?: string): Promise<LocalPurchaseOrder[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const s = db.transaction('purchase_orders', 'readonly').objectStore('purchase_orders');
      const req = storeId ? s.index('store_id').getAll(storeId) : s.getAll();
      req.onsuccess = () => r(req.result || []);
    });
  }

  // ==================== SUPPLIERS ====================

  async saveSupplier(supplier: LocalSupplier): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('suppliers', 'readwrite');
    tx.objectStore('suppliers').put(supplier);
  }

  async getSuppliers(storeId?: string): Promise<LocalSupplier[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const s = db.transaction('suppliers', 'readonly').objectStore('suppliers');
      const req = storeId ? s.index('store_id').getAll(storeId) : s.getAll();
      req.onsuccess = () => r(req.result || []);
    });
  }

  async deleteSupplier(id: string): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('suppliers', 'readwrite').objectStore('suppliers').delete(id);
  }

  // ==================== PAYMENTS ====================

  async saveSupplierPayment(payment: any): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('supplier_payments', 'readwrite').objectStore('supplier_payments').put(payment);
  }

  async getSupplierPayments(storeId?: string): Promise<any[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const s = db.transaction('supplier_payments', 'readonly').objectStore('supplier_payments');
      const req = storeId ? s.index('store_id').getAll(storeId) : s.getAll();
      req.onsuccess = () => r(req.result || []);
    });
  }

  // ==================== USERS ====================

  async saveUser(user: LocalUser): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('users', 'readwrite').objectStore('users').put(user);
  }

  async getStore(id: string): Promise<LocalStore | undefined> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction('stores', 'readonly').objectStore('stores').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveStore(store: LocalStore): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction('stores', 'readwrite').objectStore('stores').put(store);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteStore(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction('stores', 'readwrite').objectStore('stores').delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async markStoreSynced(id: string): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('stores', 'readwrite');
    const store = tx.objectStore('stores');
    const req = store.get(id);
    req.onsuccess = () => {
        if (req.result) {
            req.result.synced = true;
            store.put(req.result);
        }
    };
  }

  async getUser(id: string): Promise<LocalUser | null> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const req = db.transaction('users', 'readonly').objectStore('users').get(id);
      req.onsuccess = () => r(req.result || null);
    });
  }

  async getUserByEmail(email: string): Promise<LocalUser | null> {
    const db = await this.ensureDb();
    return new Promise((resolve) => {
      try {
        const transaction = db.transaction('users', 'readonly');
        const store = transaction.objectStore('users');
        const index = store.index('email');
        const req = index.get(email.toLowerCase());
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  async getAllUsers(): Promise<LocalUser[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const req = db.transaction('users', 'readonly').objectStore('users').getAll();
      req.onsuccess = () => r(req.result || []);
    });
  }

  // ==================== ROLES ====================

  async saveRole(role: LocalRole): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('roles', 'readwrite').objectStore('roles').put(role);
  }

  async getAllRoles(): Promise<LocalRole[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const req = db.transaction('roles', 'readonly').objectStore('roles').getAll();
      req.onsuccess = () => r(req.result || []);
    });
  }

  async getRolesByUserId(userId: string): Promise<LocalRole[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const tx = db.transaction('roles', 'readonly');
      const store = tx.objectStore('roles');
      const index = store.index('user_id');
      const req = index.getAll(IDBKeyRange.only(userId));
      req.onsuccess = () => r(req.result || []);
      req.onerror = () => r([]);
    });
  }

  async deleteRolesByUserId(userId: string): Promise<void> {
    const db = await this.ensureDb();
    const roles = await this.getRolesByUserId(userId);
    return new Promise((resolve) => {
      const tx = db.transaction('roles', 'readwrite');
      const store = tx.objectStore('roles');
      for (const r of roles) {
        store.delete(r.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async deleteRole(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve) => {
      const tx = db.transaction('roles', 'readwrite');
      const store = tx.objectStore('roles');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async deleteUser(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  // ==================== SALES ====================

  async saveSale(sale: LocalSale): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('sales', 'readwrite').objectStore('sales').put(sale);
  }

  async getSales(storeId?: string): Promise<LocalSale[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const store = db.transaction('sales', 'readonly').objectStore('sales');
      const req = storeId ? store.index('store_id').getAll(storeId) : store.getAll();
      req.onsuccess = () => r(req.result || []);
    });
  }

  async markSaleSynced(id: string): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('sales', 'readwrite');
    const store = tx.objectStore('sales');
    const req = store.get(id);
    req.onsuccess = () => {
        if (req.result) {
            req.result.synced = true;
            store.put(req.result);
        }
    };
  }

  // ==================== INVENTORY ====================

  async saveInventoryItem(item: LocalInventory): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('inventory', 'readwrite').objectStore('inventory').put(item);
  }

  async getInventory(storeId?: string): Promise<LocalInventory[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const store = db.transaction('inventory', 'readonly').objectStore('inventory');
      const req = storeId ? store.index('store_id').getAll(storeId) : store.getAll();
      req.onsuccess = () => r(req.result || []);
    });
  }

  async getInventoryItem(id: string): Promise<LocalInventory | null> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const req = db.transaction('inventory', 'readonly').objectStore('inventory').get(id);
      req.onsuccess = () => r(req.result || null);
    });
  }

  async deleteInventoryItem(id: string): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('inventory', 'readwrite').objectStore('inventory').delete(id);
  }

  // ==================== SYNC QUEUE ====================

  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('sync_queue', 'readwrite').objectStore('sync_queue').put(item);
    window.dispatchEvent(new CustomEvent('localDbQueueUpdated'));
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const req = db.transaction('sync_queue', 'readonly').objectStore('sync_queue').getAll();
      req.onsuccess = () => r((req.result || []).sort((a:any, b:any) => a.timestamp - b.timestamp));
    });
  }

  async getSyncQueueSize(): Promise<number> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const req = db.transaction('sync_queue', 'readonly').objectStore('sync_queue').count();
      req.onsuccess = () => r(req.result || 0);
    });
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('sync_queue', 'readwrite').objectStore('sync_queue').delete(id);
    window.dispatchEvent(new CustomEvent('localDbQueueUpdated'));
  }

  // ==================== SESSION ====================

  async saveSession(session: any): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('session', 'readwrite').objectStore('session').put({ key: 'current_session', ...session });
  }

  async getSession(): Promise<any | null> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const req = db.transaction('session', 'readonly').objectStore('session').get('current_session');
      req.onsuccess = () => r(req.result ? req.result : null);
    });
  }

  async clearSession(): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('session', 'readwrite').objectStore('session').delete('current_session');
  }

  // ==================== SYSTEM SETTINGS ====================

  async saveSystemSetting(key: string, value: any): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction('system_settings', 'readwrite');
    tx.objectStore('system_settings').put({ id: key, value });
  }

  async getSystemSetting(key: string): Promise<any | null> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const req = db.transaction('system_settings', 'readonly').objectStore('system_settings').get(key);
      req.onsuccess = () => r(req.result ? req.result.value : null);
    });
  }


  async getAllStores(): Promise<LocalStore[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const req = db.transaction('stores', 'readonly').objectStore('stores').getAll();
      req.onsuccess = () => r(req.result || []);
    });
  }

  // ==================== PRODUCT FAMILIES ====================

  async saveProductFamily(family: LocalProductFamily): Promise<void> {
    const db = await this.ensureDb();
    db.transaction('product_families', 'readwrite').objectStore('product_families').put(family);
  }

  async getProductFamilies(storeId?: string): Promise<LocalProductFamily[]> {
    const db = await this.ensureDb();
    return new Promise(r => {
      const store = db.transaction('product_families', 'readonly').objectStore('product_families');
      const req = storeId ? store.index('store_id').getAll(storeId) : store.getAll();
      req.onsuccess = () => r(req.result || []);
    });
  }

  // ==================== UTILITIES ====================

  async clearAll(): Promise<void> {
    const db = await this.ensureDb();
    const stores = Array.from(db.objectStoreNames);
    console.log('LocalDatabase: Clearing all stores:', stores);
    
    for (const s of stores) {
        await new Promise((resolve) => {
            try {
                const tx = db.transaction(s, 'readwrite');
                tx.objectStore(s).clear();
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => {
                    console.warn(`LocalDatabase: Failed to clear store ${s}`, tx.error);
                    resolve(false);
                };
            } catch (e) {
                console.warn(`LocalDatabase: Transaction error for store ${s}`, e);
                resolve(false);
            }
        });
    }
    console.log('LocalDatabase: Clear all process finished');
  }

  async clearTable(tableName: string): Promise<void> {
    const db = await this.ensureDb();
    if (!db.objectStoreNames.contains(tableName)) {
        console.warn(`LocalDatabase: Table ${tableName} does not exist, skipping clear`);
        return;
    }
    return new Promise((resolve, reject) => {
        try {
            const tx = db.transaction(tableName, 'readwrite');
            tx.objectStore(tableName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        } catch (e) {
            reject(e);
        }
    });
  }

  hashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = ((hash << 5) - hash) + password.charCodeAt(i);
      hash |= 0;
    }
    return 'offline_' + Math.abs(hash).toString(36);
  }

  verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }
}

export const LocalDatabase = new LocalDatabaseService();
