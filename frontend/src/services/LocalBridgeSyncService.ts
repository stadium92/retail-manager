import { supabase } from '../lib/supabase';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Configuration ────────────────────────────────────────────────────────────
const PUSH_INTERVAL_MS = 5000;   // 5s outbox polling (Base)
const PULL_INTERVAL_MS = 30000;  // 30s incremental pull fallback (Base)
const MAX_BACKOFF_MS = 120000;   // 2 minutes max backoff
const DEBOUNCE_PULL_MS = 2000;   // 2s realtime debounce
const MAX_OUTBOX_BATCH = 100;

// ─── Types ────────────────────────────────────────────────────────────────────
export type NetworkHealthStatus = 'ONLINE' | 'OFFLINE' | 'CLOCK_SKEW' | 'FIREWALL_BLOCKED' | 'ISP_BLOCKED' | 'RATE_LIMITED';

type EntityType = 'product' | 'sale' | 'sale_item' | 'users' | 'user_roles' | 'cashier_credit' | 'stock_adjustment';
type Operation = 'create' | 'update' | 'delete' | 'upsert';

interface OutboxEntry {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  operation: Operation;
  payload: string; // JSON-encoded entity row
  status: 'pending' | 'acked' | 'failed';
  retry_count: number;
  created_at: string;
}

interface StatusUpdate {
  synced: string[];
  failed: Array<{ id: string; error: string }>;
}

interface ProductRow {
  id: string;
  store_id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  cost_price?: number | null;
  unit_price?: number | null;
  wholesale_price?: number | null;
  wholesale_price_ht?: number | null;
  wholesale_price_ttc?: number | null;
  selling_price_2?: number | null;
  selling_price_3?: number | null;
  selling_price_4?: number | null;
  min_quantity?: number | null;
  low_stock_threshold?: number | null;
  quantity?: number | null;
  category?: string | null;
  image_url?: string | null;
  aisle?: string | null;
  brand?: string | null;
  unit_type?: string | null;
  packaging?: string | null;
  expiry_date?: string | null;
  reorder_quantity?: number | null;
  version?: number | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface SaleRow {
  id: string;
  store_id: string;
  worker_id?: string | null;
  client_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  sale_type?: string | null;
  total_price?: number | null;
  amount_paid?: number | null;
  discount?: number | null;
  tax?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  notes?: string | null;
  invoice_number?: string | null;
  version?: number | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id?: string | null;
  product_name: string;
  quantity?: number | null;
  unit_price?: number | null;
  discount?: number | null;
  total?: number | null;
  version?: number | null;
  deleted_at?: string | null;
  created_at?: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
  role?: string;
}

interface UserRoleRow {
  id: string;
  user_id: string;
  role: string;
  store_id?: string | null;
  created_at?: string;
}

type EntityRow = ProductRow | SaleRow | SaleItemRow | UserRow | UserRoleRow;

const TABLE_MAP: Record<EntityType | 'store', string> = {
  product: 'products',
  sale: 'sales',
  sale_item: 'sale_items',
  store: 'stores',
  users: 'offline_users',
  user_roles: 'user_roles',
  cashier_credit: 'cashier_credits',
  stock_adjustment: 'stock_adjustments',
};

function mapToSupabase(entityType: EntityType, raw: EntityRow): Record<string, unknown> {
  const now = new Date().toISOString();

  if (entityType === 'product') {
    const p = raw as ProductRow;
    return {
      id: p.id,
      store_id: p.store_id,
      name: p.name,
      sku: p.sku ?? null,
      barcode: p.barcode ?? null,
      description: p.description ?? null,
      cost_price: p.cost_price ?? 0,
      unit_price: p.unit_price ?? 0,
      wholesale_price: p.wholesale_price ?? 0,
      wholesale_price_ht: p.wholesale_price_ht ?? 0,
      wholesale_price_ttc: p.wholesale_price_ttc ?? 0,
      selling_price_2: p.selling_price_2 ?? 0,
      selling_price_3: p.selling_price_3 ?? 0,
      selling_price_4: p.selling_price_4 ?? 0,
      min_quantity: p.min_quantity ?? 0,
      low_stock_threshold: p.low_stock_threshold ?? 0,
      quantity: p.quantity ?? 0,
      category: p.category ?? null,
      image_url: p.image_url ?? null,
      aisle: p.aisle ?? null,
      brand: p.brand ?? null,
      unit_type: p.unit_type ?? null,
      packaging: p.packaging ?? null,
      expiry_date: p.expiry_date ?? null,
      reorder_quantity: p.reorder_quantity ?? null,
      version: p.version ?? 1,
      deleted_at: p.deleted_at ?? null,
      created_at: p.created_at ?? now,
      updated_at: p.updated_at ?? now,
    };
  }

  if (entityType === 'store' as any) {
    const s = raw as any;
    return {
      id: s.id,
      name: s.name,
      address: s.address ?? null,
      phone: s.phone ?? null,
      owner_id: s.owner_id ?? null,
      default_price_tier: s.default_price_tier ?? 1,
      created_at: s.created_at ?? now,
      updated_at: s.updated_at ?? now,
    };
  }

  if (entityType === 'sale') {
    const s = raw as SaleRow;
    return {
      id: s.id,
      store_id: s.store_id,
      worker_id: s.worker_id ?? null,
      client_id: s.client_id ?? null,
      customer_name: s.customer_name ?? null,
      customer_phone: s.customer_phone ?? null,
      sale_type: s.sale_type ?? 'detail',
      total_price: s.total_price ?? 0,
      amount_paid: s.amount_paid ?? 0,
      discount: s.discount ?? 0,
      tax: s.tax ?? 0,
      payment_method: s.payment_method ?? 'cash',
      payment_status: s.payment_status ?? 'paid',
      notes: s.notes ?? null,
      invoice_number: s.invoice_number ?? null,
      version: s.version ?? 1,
      deleted_at: s.deleted_at ?? null,
      created_at: s.created_at ?? now,
      updated_at: s.updated_at ?? now,
    };
  }

  if (entityType === 'users') {
    const u = raw as UserRow;
    return {
      id: u.id,
      email: u.email,
      password_hash: u.password_hash,
      full_name: u.full_name,
      phone: u.phone ?? null,
      created_at: u.created_at ?? now,
      updated_at: u.updated_at ?? now,
    };
  }

  if (entityType === 'user_roles') {
    const ur = raw as UserRoleRow;
    return {
      id: ur.id,
      user_id: ur.user_id,
      role: ur.role,
      store_id: ur.store_id ?? null,
      created_at: ur.created_at ?? now,
    };
  }

  if (entityType === 'sale_item') {
    const si = raw as SaleItemRow;
    return {
      id: si.id,
      sale_id: si.sale_id,
      product_id: si.product_id ?? null,
      product_name: si.product_name,
      quantity: si.quantity ?? 1,
      unit_price: si.unit_price ?? 0,
      discount: si.discount ?? 0,
      total: si.total ?? 0,
      version: si.version ?? 1,
      deleted_at: si.deleted_at ?? null,
      created_at: si.created_at ?? now,
    };
  }

  if (entityType === 'cashier_credit') {
    const c = raw as any;
    return {
      id: c.id,
      store_id: c.store_id,
      worker_id: c.worker_id,
      client_name: c.client_name,
      amount: Number(c.amount) || 0,
      status: c.status ?? 'unpaid',
      notes: c.notes ?? null,
      version: c.version ?? 1,
      deleted_at: c.deleted_at ?? null,
      created_at: c.created_at ?? now,
      updated_at: c.updated_at ?? now,
    };
  }

  if (entityType === 'stock_adjustment') {
    const s = raw as any;
    return {
      id: s.id,
      store_id: s.store_id,
      worker_id: s.worker_id,
      product_id: s.product_id,
      adjustment_type: s.adjustment_type,
      quantity_adjusted: Number(s.quantity_adjusted) || 0,
      reason: s.reason ?? null,
      version: s.version ?? 1,
      deleted_at: s.deleted_at ?? null,
      created_at: s.created_at ?? now,
    };
  }

  return {};
}

export class LocalBridgeSyncService {
  private static running = false;
  private static pushing = false;
  private static pushTimer: ReturnType<typeof setTimeout> | null = null;
  private static pullTimer: ReturnType<typeof setTimeout> | null = null;
  private static debounceId: ReturnType<typeof setTimeout> | null = null;
  private static channels: RealtimeChannel[] = [];
  private static currentStoreId: string | null = null;

  // Diagnostics & Backoff
  private static currentHealth: NetworkHealthStatus = 'ONLINE';
  private static currentHealthMessage: string = 'Connected to cloud';
  private static healthListeners: Array<(status: NetworkHealthStatus, message: string) => void> = [];
  private static currentPullInterval = PULL_INTERVAL_MS;
  private static currentPushInterval = PUSH_INTERVAL_MS;

  static onHealthChange(cb: (status: NetworkHealthStatus, message: string) => void) {
    this.healthListeners.push(cb);
    cb(this.currentHealth, this.currentHealthMessage);
    return () => {
      this.healthListeners = this.healthListeners.filter(l => l !== cb);
    };
  }

  private static updateHealth(status: NetworkHealthStatus, message: string) {
    if (this.currentHealth !== status || this.currentHealthMessage !== message) {
      this.currentHealth = status;
      this.currentHealthMessage = message;
      this.healthListeners.forEach(cb => cb(status, message));
    }
  }

  static async checkNetworkHealth(): Promise<void> {
    const dataClient = getDataClient();
    try {
      const resp = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/health`);
      if (resp.ok) {
        const data = await resp.json();
        this.updateHealth(data.status, data.message);
      } else {
        this.updateHealth('OFFLINE', 'Local bridge is unreachable.');
      }
    } catch (e) {
      this.updateHealth('OFFLINE', 'Local bridge is unreachable.');
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  static start(storeId: string): void {
    if (this.running && this.currentStoreId === storeId) return;
    this.stop();

    this.currentStoreId = storeId;
    this.running = true;
    this.currentPullInterval = PULL_INTERVAL_MS;
    this.currentPushInterval = PUSH_INTERVAL_MS;

    // Run initial sync cycle and health check
    void this.checkNetworkHealth();
    void this.pushPendingMutations(storeId);
    void this.pullData(storeId);

    const schedulePush = () => {
      if (!this.running) return;
      this.pushTimer = setTimeout(() => {
        void this.pushPendingMutations(storeId).finally(schedulePush);
      }, this.currentPushInterval);
    };

    const schedulePull = () => {
      if (!this.running) return;
      this.pullTimer = setTimeout(() => {
        void this.pullData(storeId).finally(schedulePull);
      }, this.currentPullInterval);
    };

    schedulePush();
    schedulePull();

    this.subscribeRealtime(storeId);
    console.log(`[LocalBridgeSyncService] Started for store ${storeId}.`);
  }

  static stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.pushTimer) clearTimeout(this.pushTimer);
    if (this.pullTimer) clearTimeout(this.pullTimer);
    if (this.debounceId) clearTimeout(this.debounceId);

    this.channels.forEach((ch) => void supabase.removeChannel(ch));
    this.channels = [];
    this.currentStoreId = null;

    console.log('[LocalBridgeSyncService] Stopped.');
  }

  // ── PUSH: outbox → Supabase ────────────────────────────────────────────────
  static async pushPendingMutations(storeId?: string): Promise<{ pushed: number; failed: number; pending: number }> {
    if (this.pushing) return { pushed: 0, failed: 0, pending: 0 };
    this.pushing = true;

    const dataClient = getDataClient();
    const targetStoreId = storeId || this.currentStoreId;

    if (!targetStoreId) {
      this.pushing = false;
      return { pushed: 0, failed: 0, pending: 0 };
    }

    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) {
        this.pushing = false;
        return { pushed: 0, failed: 0, pending: 0 };
      }

      const response = await smartFetch(
        `${dataClient.localBridgeBaseUrl}/sync/outbox?store_id=${targetStoreId}&limit=${MAX_OUTBOX_BATCH}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`Outbox fetch failed: HTTP ${response.status}`);
      }

      const entries: OutboxEntry[] = await response.json();
      if (entries.length === 0) {
        this.pushing = false;
        return { pushed: 0, failed: 0, pending: 0 };
      }

      console.log(`[LocalBridgeSyncService] Pushing ${entries.length} outbox entries…`);

      const results = await Promise.allSettled(
        entries.map((e) => this.upsertEntry(e))
      );

      const update: StatusUpdate = { synced: [], failed: [] };

      results.forEach((result, i) => {
        const entry = entries[i];
        if (result.status === 'fulfilled') {
          update.synced.push(entry.id);
        } else {
          const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
          update.failed.push({ id: entry.id, error });
          console.error(`[LocalBridgeSyncService] Upsert failed for ${entry.entity_type}:${entry.entity_id} —`, error);
        }
      });

      // Report outcomes      // Post completion status
      const statusRes = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/outbox/status`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      if (!statusRes.ok) throw new Error(`Status update failed: HTTP ${statusRes.ok}`);

      const diagnosticRes = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/diagnostics?store_id=${targetStoreId}`, {
        headers
      });
      const diagnostics = diagnosticRes.ok ? await diagnosticRes.json() : null;
      const pendingCount = diagnostics?.outbox?.pending ?? 0;

      console.log(`[LocalBridgeSyncService] Push complete — synced: ${update.synced.length}, failed: ${update.failed.length}`);

      this.pushing = false;
      this.currentPushInterval = PUSH_INTERVAL_MS; // Reset backoff on success
      if (this.currentHealth !== 'ONLINE') {
        void this.checkNetworkHealth();
      }

      return {
        pushed: update.synced.length,
        failed: update.failed.length,
        pending: pendingCount
      };
    } catch (err) {
      console.error('[LocalBridgeSyncService] pushPendingMutations error:', err);
      this.pushing = false;
      this.currentPushInterval = Math.min(this.currentPushInterval * 1.5, MAX_BACKOFF_MS); // Exponential backoff
      void this.checkNetworkHealth();
      return { pushed: 0, failed: 0, pending: 0 };
    }
  }

  private static async upsertEntry(entry: OutboxEntry): Promise<void> {
    const table = TABLE_MAP[entry.entity_type];
    if (!table) throw new Error(`No Supabase table mapped for entity_type: "${entry.entity_type}"`);

    const raw: EntityRow = JSON.parse(entry.payload);
    const mapped = mapToSupabase(entry.entity_type, raw);

    if (entry.operation === 'delete') {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', entry.entity_id);
      if (error) throw new Error(`Supabase delete error on "${table}": ${error.message}`);
    } else {
      const { error } = await supabase
        .from(table)
        .upsert(mapped, { onConflict: 'id' });
      if (error) throw new Error(`Supabase upsert error on "${table}": ${error.message}`);
    }
  }

  // ── PULL: Supabase → local bridge /sync/merge ──────────────────────────────
  static async pullData(storeId?: string): Promise<{ pulled: number } | null> {
    const dataClient = getDataClient();
    const targetStoreId = storeId || this.currentStoreId;

    if (!targetStoreId) return null;

    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return null;

      // 1. Fetch the stored cursor from the local bridge
      const cursorResp = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/cursor?store_id=${targetStoreId}`, {
        headers
      });
      const { last_pulled_at }: { last_pulled_at: string | null } = cursorResp.ok
        ? await cursorResp.json()
        : { last_pulled_at: null };

      // Default cursor to epoch zero
      const since = last_pulled_at ?? new Date(0).toISOString();
      const pulledAt = new Date().toISOString();

      console.log(`[LocalBridgeSyncService] Pulling changes since ${since}…`);

      // 2. Fetch changed rows from Supabase (sales includes nested sale_items)
      const [products, sales, cashier_credits, stock_adjustments] = await Promise.all([
        this.fetchTable('products', since, targetStoreId),
        this.fetchTable('sales', since, targetStoreId),
        this.fetchTable('cashier_credits', since, targetStoreId),
        this.fetchTable('stock_adjustments', since, targetStoreId),
      ]);

      // Extract and flatten sale_items from the sales payload
      const saleItems: any[] = [];
      const cleanedSales = sales.map((sale: any) => {
        if (sale.sale_items) {
          saleItems.push(...sale.sale_items);
        }
        const { sale_items, ...rest } = sale;
        return rest;
      });

      const total = products.length + cleanedSales.length + saleItems.length + cashier_credits.length + stock_adjustments.length;
      if (total === 0) {
        console.log('[LocalBridgeSyncService] No remote changes found.');
        return { pulled: 0 };
      }

      console.log(`[LocalBridgeSyncService] Merging ${products.length} products, ${cleanedSales.length} sales, ${saleItems.length} sale_items, ${cashier_credits.length} cashier_credits, ${stock_adjustments.length} stock_adjustments…`);

      // 3. Post to /sync/merge
      const mergeResp = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/merge`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: targetStoreId,
          products,
          sales: cleanedSales,
          sale_items: saleItems,
          cashier_credits,
          stock_adjustments,
          pulled_at: pulledAt,
        }),
      });

      if (!mergeResp.ok) {
        const body = await mergeResp.text().catch(() => '(no body)');
        throw new Error(`/sync/merge responded ${mergeResp.status}: ${body}`);
      }

      const mergeResult = await mergeResp.json();
      console.log('[LocalBridgeSyncService] Merge complete:', mergeResult.merged);

      if (mergeResult.merged) {
        const { products, sales, sale_items, cashier_credits, stock_adjustments } = mergeResult.merged;
        if (products > 0) {
          window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'product' } }));
        }
        if (sales > 0 || sale_items > 0) {
          window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));
        }
        if (cashier_credits > 0) {
          window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'cashier_credit' } }));
        }
        if (stock_adjustments > 0) {
          window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
        }
      }
      
      this.currentPullInterval = PULL_INTERVAL_MS; // Reset backoff on success
      if (this.currentHealth !== 'ONLINE') {
        void this.checkNetworkHealth();
      }

      return {
        pulled: (mergeResult.merged?.products || 0) +
                (mergeResult.merged?.sales || 0) +
                (mergeResult.merged?.sale_items || 0) +
                (mergeResult.merged?.cashier_credits || 0) +
                (mergeResult.merged?.stock_adjustments || 0)
      };
    } catch (err) {
      console.error('[LocalBridgeSyncService] pullData error:', err);
      this.currentPullInterval = Math.min(this.currentPullInterval * 1.5, MAX_BACKOFF_MS); // Exponential backoff
      void this.checkNetworkHealth();
      return null;
    }
  }

  private static async fetchTable(
    table: string,
    since: string,
    storeId: string
  ): Promise<Record<string, unknown>[]> {
    const selectFields = table === 'sales' ? '*, sale_items(*)' : '*';
    const dateField = table === 'stock_adjustments' ? 'created_at' : 'updated_at';
    const query = supabase.from(table).select(selectFields).gt(dateField, since);

    // Filter by store_id relation
    if (table === 'products' || table === 'sales' || table === 'cashier_credits' || table === 'stock_adjustments') {
      query.eq('store_id', storeId);
    }

    const { data, error } = await query.order(dateField, { ascending: true });

    if (error) {
      console.error(`[LocalBridgeSyncService] Pull error on "${table}":`, error.message);
      return [];
    }

    return (data as Record<string, unknown>[]) ?? [];
  }

  // ── Realtime ───────────────────────────────────────────────────────────────
  private static subscribeRealtime(storeId: string): void {
    const tables = ['products', 'sales', 'sale_items', 'cashier_credits', 'stock_adjustments'] as const;

    tables.forEach((table) => {
      const filterStr = table === 'sale_items' ? undefined : `store_id=eq.${storeId}`;
      const channel = supabase
        .channel(`realtime-retail:${table}-${storeId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: filterStr },
          (payload) => {
            console.log(`[LocalBridgeSyncService] Realtime ${payload.eventType} on ${table} — scheduling pull`);
            this.scheduleDebouncedPull(storeId);
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[LocalBridgeSyncService] Realtime subscribed to "${table}".`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[LocalBridgeSyncService] Realtime issue on "${table}": ${status}`, err);
          }
        });

      this.channels.push(channel);
    });
  }

  private static scheduleDebouncedPull(storeId: string): void {
    if (this.debounceId) clearTimeout(this.debounceId);
    this.debounceId = setTimeout(() => {
      void this.pullData(storeId);
    }, DEBOUNCE_PULL_MS);
  }

  // ── Manual retry ───────────────────────────────────────────────────────────
  static async retryFailed(): Promise<void> {
    const dataClient = getDataClient();
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;

      const resp = await smartFetch(`${dataClient.localBridgeBaseUrl}/sync/outbox/retry`, {
        method: 'POST',
        headers
      });
      if (!resp.ok) throw new Error(`Retry reset failed: HTTP ${resp.status}`);
      const { reset_count } = await resp.json();
      console.log(`[LocalBridgeSyncService] ${reset_count} failed entries reset — retrying…`);
      if (this.currentStoreId) {
        await this.pushPendingMutations(this.currentStoreId);
      }
    } catch (err) {
      console.error('[LocalBridgeSyncService] retryFailed error:', err);
    }
  }
}
