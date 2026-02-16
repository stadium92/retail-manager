/**
 * LocalDatabase - IndexedDB-based local storage for offline-first functionality
 * Handles users, roles, workers, sales, inventory, and sync queue
 */

const DB_NAME = 'retail_manager_offline';
const DB_VERSION = 3;

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



export interface LocalUser {
  id: string;
  email: string;
  password_hash: string; // Simple hash for offline verification
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
  created_at: string;
  synced: boolean;
}

export interface LocalSale {
  id: string;
  store_id?: string;
  worker_id?: string;
  items: any[];
  total_price: number;
  payment_method: string; // 'cash' | 'card' | 'credit'
  sale_type: 'detail' | 'gros' | 'proforma';
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
  synced: boolean;
}

export interface LocalInventory {
  id: string;
  store_id: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  wholesale_price?: number;
  wholesale_price_ht?: number;
  wholesale_price_ttc?: number;
  cost?: number;
  category?: string;
  aisle?: string;
  brand?: string;
  unit_type?: string;
  packaging?: string;
  expiry_date?: string;
  reorder_quantity?: number;
  updated_at: string;
  synced: boolean;
}

export interface SyncQueueItem {
  id: string;
  type: 'user_create' | 'user_update' | 'user_delete' | 'role_create' | 'role_delete' | 'sale' | 'sale_delete' | 'inventory_update' | 'inventory_delete' | 'delivery_update' | 'store_create' | 'store_update' | 'pending_mutation';
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
        console.log('LocalDatabase: Opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Users store
        if (!db.objectStoreNames.contains('users')) {
          const usersStore = db.createObjectStore('users', { keyPath: 'id' });
          usersStore.createIndex('email', 'email', { unique: true });
          usersStore.createIndex('synced', 'synced', { unique: false });
        }

        // Roles store
        if (!db.objectStoreNames.contains('roles')) {
          const rolesStore = db.createObjectStore('roles', { keyPath: 'id' });
          rolesStore.createIndex('user_id', 'user_id', { unique: false });
          rolesStore.createIndex('synced', 'synced', { unique: false });
        }

        // Sales store
        if (!db.objectStoreNames.contains('sales')) {
          const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
          salesStore.createIndex('store_id', 'store_id', { unique: false });
          salesStore.createIndex('worker_id', 'worker_id', { unique: false });
          salesStore.createIndex('synced', 'synced', { unique: false });
        }

        // Inventory store
        if (!db.objectStoreNames.contains('inventory')) {
          const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id' });
          inventoryStore.createIndex('store_id', 'store_id', { unique: false });
          inventoryStore.createIndex('synced', 'synced', { unique: false });
        }

        // Stores store
        if (!db.objectStoreNames.contains('stores')) {
          const storesStore = db.createObjectStore('stores', { keyPath: 'id' });
          storesStore.createIndex('synced', 'synced', { unique: false });
        }

        // Sync queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('type', 'type', { unique: false });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Session store for offline auth
        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session', { keyPath: 'key' });
        }

        // Product Families store
        if (!db.objectStoreNames.contains('product_families')) {
          const familyStore = db.createObjectStore('product_families', { keyPath: 'id' });
          familyStore.createIndex('store_id', 'store_id', { unique: false });
          familyStore.createIndex('synced', 'synced', { unique: false });
        }

        console.log('LocalDatabase: Schema created/upgraded');
      };
    });

    return this.initPromise;
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  // ==================== USERS ====================

  async saveUser(user: LocalUser): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const request = store.put(user);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUser(id: string): Promise<LocalUser | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getUserByEmail(email: string): Promise<LocalUser | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const index = store.index('email');
      const request = index.get(email);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllUsers(): Promise<LocalUser[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedUsers(): Promise<LocalUser[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const request = store.getAll();
      request.onsuccess = () => {
        const users = request.result || [];
        resolve(users.filter(u => !u.synced));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== ROLES ====================

  async saveRole(role: LocalRole): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('roles', 'readwrite');
      const store = tx.objectStore('roles');
      const request = store.put(role);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRolesByUserId(userId: string): Promise<LocalRole[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('roles', 'readonly');
      const store = tx.objectStore('roles');
      const index = store.index('user_id');
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRoles(): Promise<LocalRole[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('roles', 'readonly');
      const store = tx.objectStore('roles');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedRoles(): Promise<LocalRole[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('roles', 'readonly');
      const store = tx.objectStore('roles');
      const request = store.getAll();
      request.onsuccess = () => {
        const roles = request.result || [];
        resolve(roles.filter(r => !r.synced));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRole(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('roles', 'readwrite');
      const store = tx.objectStore('roles');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRolesByUserId(userId: string): Promise<void> {
    const db = await this.ensureDb();
    const roles = await this.getRolesByUserId(userId);
    for (const role of roles) {
      await this.deleteRole(role.id);
    }
  }

  // ==================== USERS (continued) ====================

  async deleteUser(id: string): Promise<void> {
    const db = await this.ensureDb();
    // Also delete associated roles
    await this.deleteRolesByUserId(id);

    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== SALES ====================

  async saveSale(sale: LocalSale): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sales', 'readwrite');
      const store = tx.objectStore('sales');
      const request = store.put(sale);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSales(storeId?: string): Promise<LocalSale[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sales', 'readonly');
      const store = tx.objectStore('sales');

      if (storeId) {
        const index = store.index('store_id');
        const request = index.getAll(storeId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } else {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }
    });
  }

  async getUnsyncedSales(): Promise<LocalSale[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sales', 'readonly');
      const store = tx.objectStore('sales');
      const request = store.getAll();
      request.onsuccess = () => {
        const sales = request.result || [];
        resolve(sales.filter(s => !s.synced));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markSaleSynced(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise(async (resolve, reject) => {
      const tx = db.transaction('sales', 'readwrite');
      const store = tx.objectStore('sales');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const sale = getRequest.result;
        if (sale) {
          sale.synced = true;
          const putRequest = store.put(sale);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteSale(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sales', 'readwrite');
      const store = tx.objectStore('sales');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== INVENTORY ====================

  async saveInventoryItem(item: LocalInventory): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('inventory', 'readwrite');
      const store = tx.objectStore('inventory');
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getInventory(storeId?: string): Promise<LocalInventory[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('inventory', 'readonly');
      const store = tx.objectStore('inventory');

      if (storeId) {
        const index = store.index('store_id');
        const request = index.getAll(storeId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } else {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }
    });
  }

  async getInventoryItem(id: string): Promise<LocalInventory | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('inventory', 'readonly');
      const store = tx.objectStore('inventory');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteInventoryItem(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('inventory', 'readwrite');
      const store = tx.objectStore('inventory');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async markInventoryItemSynced(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise(async (resolve, reject) => {
      const tx = db.transaction('inventory', 'readwrite');
      const store = tx.objectStore('inventory');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.synced = true;
          const putRequest = store.put(item);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // ==================== SYNC QUEUE ====================

  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const request = store.put(item);
      request.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('localDbQueueUpdated'));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result || [];
        // Sort by timestamp
        items.sort((a, b) => a.timestamp - b.timestamp);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const request = store.delete(id);
      request.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('localDbQueueUpdated'));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncQueueSize(): Promise<number> {
    const queue = await this.getSyncQueue();
    return queue.length;
  }

  // ==================== SESSION ====================

  async saveSession(session: any): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('session', 'readwrite');
      const store = tx.objectStore('session');
      const request = store.put({ key: 'current_session', ...session });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(): Promise<any | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('session', 'readonly');
      const store = tx.objectStore('session');
      const request = store.get('current_session');
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const { key, ...session } = result;
          resolve(session);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearSession(): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('session', 'readwrite');
      const store = tx.objectStore('session');
      const request = store.delete('current_session');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== STORES ====================

  async saveStore(store: LocalStore): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('stores', 'readwrite');
      const objStore = tx.objectStore('stores');
      const request = objStore.put(store);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStore(id: string): Promise<LocalStore | null> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('stores', 'readonly');
      const objStore = tx.objectStore('stores');
      const request = objStore.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllStores(): Promise<LocalStore[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('stores', 'readonly');
      const objStore = tx.objectStore('stores');
      const request = objStore.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedStores(): Promise<LocalStore[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('stores', 'readonly');
      const objStore = tx.objectStore('stores');
      const request = objStore.getAll();
      request.onsuccess = () => {
        const stores = request.result || [];
        resolve(stores.filter(s => !s.synced));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markStoreSynced(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise(async (resolve, reject) => {
      const tx = db.transaction('stores', 'readwrite');
      const objStore = tx.objectStore('stores');
      const getRequest = objStore.get(id);

      getRequest.onsuccess = () => {
        const store = getRequest.result;
        if (store) {
          store.synced = true;
          const putRequest = objStore.put(store);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // ==================== PRODUCT FAMILIES ====================

  async saveProductFamily(family: LocalProductFamily): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('product_families', 'readwrite');
      const store = tx.objectStore('product_families');
      const request = store.put(family);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getProductFamilies(storeId?: string): Promise<LocalProductFamily[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('product_families', 'readonly');
      const store = tx.objectStore('product_families');

      if (storeId) {
        const index = store.index('store_id');
        const request = index.getAll(storeId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } else {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }
    });
  }

  async deleteStore(id: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('stores', 'readwrite');
      const objStore = tx.objectStore('stores');
      const request = objStore.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== UTILITIES ====================

  async clearAll(): Promise<void> {
    const db = await this.ensureDb();
    const stores = ['users', 'roles', 'sales', 'inventory', 'stores', 'sync_queue', 'session'];

    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  // Clear only session, keep other data for sync
  async clearSessionOnly(): Promise<void> {
    const db = await this.ensureDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('session', 'readwrite');
      const store = tx.objectStore('session');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Simple hash function for offline password verification
  hashPassword(password: string): string {
    // This is a simple hash for offline verification only
    // Real passwords are verified by Supabase when online
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'offline_' + Math.abs(hash).toString(36);
  }

  verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }
}

export const LocalDatabase = new LocalDatabaseService();
