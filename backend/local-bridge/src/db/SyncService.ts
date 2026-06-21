import { supabase } from '../utils/supabase.js';
import { db } from './index.js';
import type { RealtimeChannel } from '@supabase/supabase-js';

const PUSH_INTERVAL_MS = 5000;      // Push outbox every 5s
const PULL_INTERVAL_MS = 30000;     // Poll pull changes every 30s
const DEBOUNCE_PULL_MS = 2000;      // Debounce realtime pulls by 2s

const TABLE_MAP: Record<string, string> = {
  product: 'products',
  sale: 'sales',
  sale_item: 'sale_items',
  cashier_credit: 'cashier_credits',
  stock_adjustment: 'stock_adjustments',
};

const PRODUCT_COLS = [
  'id', 'store_id', 'name', 'sku', 'barcode', 'description', 'cost_price', 'unit_price',
  'wholesale_price', 'wholesale_price_ht', 'wholesale_price_ttc', 'selling_price_2',
  'selling_price_3', 'selling_price_4', 'min_quantity', 'low_stock_threshold', 'quantity',
  'category', 'image_url', 'aisle', 'brand', 'unit_type', 'packaging', 'expiry_date',
  'reorder_quantity', 'version', 'deleted_at', 'created_at', 'updated_at'
] as const;

const SALE_COLS = [
  'id', 'store_id', 'worker_id', 'client_id', 'customer_name', 'customer_phone',
  'sale_type', 'total_price', 'amount_paid', 'discount', 'tax', 'payment_method',
  'payment_status', 'notes', 'invoice_number', 'version', 'deleted_at', 'created_at', 'updated_at'
] as const;

const SALE_ITEM_COLS = [
  'id', 'sale_id', 'product_id', 'product_name', 'quantity', 'unit_price',
  'discount', 'total', 'version', 'deleted_at', 'created_at', 'batch_id'
] as const;

const CASHIER_CREDIT_COLS = [
  'id', 'store_id', 'worker_id', 'client_name', 'amount', 'status',
  'notes', 'version', 'deleted_at', 'created_at', 'updated_at'
] as const;

const STOCK_ADJUSTMENT_COLS = [
  'id', 'store_id', 'worker_id', 'product_id', 'adjustment_type',
  'quantity_adjusted', 'reason', 'version', 'deleted_at', 'created_at'
] as const;

function pick<T extends string>(
  row: Record<string, any>,
  keys: readonly T[]
): Record<T, any> {
  const out = {} as Record<T, any>;
  const now = new Date().toISOString();
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) {
      out[k] = row[k];
    } else {
      if (k === 'created_at' || k === 'updated_at') {
        out[k] = now;
      } else {
        out[k] = null;
      }
    }
  }
  return out;
}

function mapToSupabase(entityType: string, raw: any): Record<string, any> {
  const now = new Date().toISOString();

  if (entityType === 'product') {
    return {
      id: raw.id,
      store_id: raw.store_id,
      name: raw.name,
      sku: raw.sku ?? null,
      barcode: raw.barcode ?? null,
      description: raw.description ?? null,
      cost_price: raw.cost_price ?? 0,
      unit_price: raw.unit_price ?? 0,
      wholesale_price: raw.wholesale_price ?? 0,
      wholesale_price_ht: raw.wholesale_price_ht ?? 0,
      wholesale_price_ttc: raw.wholesale_price_ttc ?? 0,
      selling_price_2: raw.selling_price_2 ?? 0,
      selling_price_3: raw.selling_price_3 ?? 0,
      selling_price_4: raw.selling_price_4 ?? 0,
      min_quantity: raw.min_quantity ?? 0,
      low_stock_threshold: raw.low_stock_threshold ?? 0,
      quantity: raw.quantity ?? 0,
      category: raw.category ?? null,
      image_url: raw.image_url ?? null,
      aisle: raw.aisle ?? null,
      brand: raw.brand ?? null,
      unit_type: raw.unit_type ?? null,
      packaging: raw.packaging ?? null,
      expiry_date: raw.expiry_date ?? null,
      reorder_quantity: raw.reorder_quantity ?? null,
      version: raw.version ?? 1,
      deleted_at: raw.deleted_at ?? null,
      created_at: raw.created_at ?? now,
      updated_at: raw.updated_at ?? now,
    };
  }

  if (entityType === 'sale') {
    return {
      id: raw.id,
      store_id: raw.store_id,
      worker_id: raw.worker_id ?? null,
      client_id: raw.client_id ?? null,
      customer_name: raw.customer_name ?? null,
      customer_phone: raw.customer_phone ?? null,
      sale_type: raw.sale_type ?? 'detail',
      total_price: raw.total_price ?? 0,
      amount_paid: raw.amount_paid ?? 0,
      discount: raw.discount ?? 0,
      tax: raw.tax ?? 0,
      payment_method: raw.payment_method ?? 'cash',
      payment_status: raw.payment_status ?? 'paid',
      notes: raw.notes ?? null,
      invoice_number: raw.invoice_number ?? null,
      version: raw.version ?? 1,
      deleted_at: raw.deleted_at ?? null,
      created_at: raw.created_at ?? now,
      updated_at: raw.updated_at ?? now,
    };
  }

  if (entityType === 'sale_item') {
    return {
      id: raw.id,
      sale_id: raw.sale_id,
      product_id: raw.product_id ?? null,
      product_name: raw.product_name,
      quantity: raw.quantity ?? 1,
      unit_price: raw.unit_price ?? 0,
      discount: raw.discount ?? 0,
      total: raw.total ?? 0,
      version: raw.version ?? 1,
      deleted_at: raw.deleted_at ?? null,
      created_at: raw.created_at ?? now,
    };
  }

  if (entityType === 'cashier_credit') {
    return {
      id: raw.id,
      store_id: raw.store_id,
      worker_id: raw.worker_id,
      client_name: raw.client_name,
      amount: Number(raw.amount) || 0,
      status: raw.status ?? 'unpaid',
      notes: raw.notes ?? null,
      version: raw.version ?? 1,
      deleted_at: raw.deleted_at ?? null,
      created_at: raw.created_at ?? now,
      updated_at: raw.updated_at ?? now,
    };
  }

  if (entityType === 'stock_adjustment') {
    return {
      id: raw.id,
      store_id: raw.store_id,
      worker_id: raw.worker_id,
      product_id: raw.product_id,
      adjustment_type: raw.adjustment_type,
      quantity_adjusted: Number(raw.quantity_adjusted) || 0,
      reason: raw.reason ?? null,
      version: raw.version ?? 1,
      deleted_at: raw.deleted_at ?? null,
      created_at: raw.created_at ?? now,
    };
  }

  return {};
}

export class SyncService {
  private static pushing = false;
  private static pulling = false;
  private static pushTimer: NodeJS.Timeout | null = null;
  private static pullTimer: NodeJS.Timeout | null = null;
  private static debounceTimer: NodeJS.Timeout | null = null;
  private static channels: RealtimeChannel[] = [];
  private static sseClients: Set<any> = new Set();

  static start() {
    console.log('[SyncService] Starting background sync daemon…');
    this.schedulePush();
    this.schedulePull();
    this.subscribeRealtime();
  }

  static stop() {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    if (this.pullTimer) clearTimeout(this.pullTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.channels.forEach((ch) => void supabase.removeChannel(ch));
    this.channels = [];
    console.log('[SyncService] Stopped.');
  }

  // ── SSE Broadcaster ────────────────────────────────────────────────────────
  static addSseClient(res: any) {
    this.sseClients.add(res);
    console.log(`[SyncService] SSE Client registered. Total clients: ${this.sseClients.size}`);
  }

  static removeSseClient(res: any) {
    this.sseClients.delete(res);
    console.log(`[SyncService] SSE Client disconnected. Total clients: ${this.sseClients.size}`);
  }

  static broadcast(event: string, data: any) {
    const formatted = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.raw.write(formatted);
      } catch (err) {
        console.error('[SyncService] Error writing to SSE client:', err);
      }
    }
  }

  // ── PUSH Loop ──────────────────────────────────────────────────────────────
  private static schedulePush() {
    this.pushTimer = setTimeout(async () => {
      await this.pushOutbox();
      this.schedulePush();
    }, PUSH_INTERVAL_MS);
  }

  public static async pushOutbox() {
    if (this.pushing) return;
    this.pushing = true;


    try {
      const stores = db.listStores();
      for (const store of stores) {
        const entries = db.listOutboxEntries(store.id, 'pending', 50);
        if (entries.length === 0) continue;

        console.log(`[SyncService] Pushing ${entries.length} mutations for store ${store.name}…`);

        for (const entry of entries) {
          try {
            const table = TABLE_MAP[entry.entity_type];
            if (!table) {
              throw new Error(`No Supabase table mapping for: ${entry.entity_type}`);
            }

            const rawPayload = JSON.parse(entry.payload_json);
            const mapped = mapToSupabase(entry.entity_type, rawPayload);

            if (entry.op_type === 'delete') {
              const { error } = await supabase.from(table).delete().eq('id', entry.entity_id);
              if (error) throw error;
            } else {
              const { error } = await supabase.from(table).upsert(mapped, { onConflict: 'id' });
              if (error) throw error;
            }

            db.updateOutboxStatus(entry.id, 'sent');
          } catch (err: any) {
            console.error(`[SyncService] Failed to push mutation ${entry.id}:`, err.message || err);
            db.incrementOutboxRetry(entry.id, err.message || String(err));
          }
        }
      }
    } catch (err) {
      console.error('[SyncService] Outbox push loop error:', err);
    } finally {
      this.pushing = false;
    }
  }

  // ── PULL Loop ──────────────────────────────────────────────────────────────
  private static schedulePull() {
    this.pullTimer = setTimeout(async () => {
      await this.pullData();
      this.schedulePull();
    }, PULL_INTERVAL_MS);
  }

  public static async pullData() {
    if (this.pulling) return;
    this.pulling = true;


    try {
      const stores = db.listStores();
      for (const store of stores) {
        const state = db.getSyncState(store.id);
        const since = state?.last_pull_cursor ?? new Date(0).toISOString();
        const pulledAt = new Date().toISOString();

        console.log(`[SyncService] Pulling updates for ${store.name} since ${since}…`);

        const [products, sales, cashier_credits, stock_adjustments] = await Promise.all([
          this.fetchTable('products', since, store.id),
          this.fetchTable('sales', since, store.id),
          this.fetchTable('cashier_credits', since, store.id),
          this.fetchTable('stock_adjustments', since, store.id),
        ]);

        const saleItems: any[] = [];
        const cleanedSales = sales.map((sale: any) => {
          if (sale.sale_items) {
            saleItems.push(...sale.sale_items);
          }
          const { sale_items, ...rest } = sale;
          return rest;
        });

        const total = products.length + cleanedSales.length + saleItems.length + cashier_credits.length + stock_adjustments.length;
        if (total === 0) continue;

        console.log(`[SyncService] Merging ${total} updates locally for store ${store.name}…`);

        const upsertProduct = db.db.prepare(`
          INSERT OR REPLACE INTO products (
            id, store_id, name, sku, barcode, description, cost_price, unit_price,
            wholesale_price, wholesale_price_ht, wholesale_price_ttc, selling_price_2,
            selling_price_3, selling_price_4, min_quantity, low_stock_threshold, quantity,
            category, image_url, aisle, brand, unit_type, packaging, expiry_date,
            reorder_quantity, version, deleted_at, created_at, updated_at
          ) VALUES (
            @id, @store_id, @name, @sku, @barcode, @description, @cost_price, @unit_price,
            @wholesale_price, @wholesale_price_ht, @wholesale_price_ttc, @selling_price_2,
            @selling_price_3, @selling_price_4, @min_quantity, @low_stock_threshold, @quantity,
            @category, @image_url, @aisle, @brand, @unit_type, @packaging, @expiry_date,
            @reorder_quantity, @version, @deleted_at, @created_at, @updated_at
          )
        `);

        const upsertSale = db.db.prepare(`
          INSERT OR REPLACE INTO sales (
            id, store_id, worker_id, client_id, customer_name, customer_phone,
            sale_type, total_price, amount_paid, discount, tax, payment_method,
            payment_status, notes, invoice_number, version, deleted_at, created_at, updated_at
          ) VALUES (
            @id, @store_id, @worker_id, @client_id, @customer_name, @customer_phone,
            @sale_type, @total_price, @amount_paid, @discount, @tax, @payment_method,
            @payment_status, @notes, @invoice_number, @version, @deleted_at, @created_at, @updated_at
          )
        `);

        const upsertSaleItem = db.db.prepare(`
          INSERT OR REPLACE INTO sale_items (
            id, sale_id, product_id, product_name, quantity, unit_price,
            discount, total, version, deleted_at, created_at, batch_id
          ) VALUES (
            @id, @sale_id, @product_id, @product_name, @quantity, @unit_price,
            @discount, @total, @version, @deleted_at, @created_at, @batch_id
          )
        `);

        const upsertCashierCredit = db.db.prepare(`
          INSERT OR REPLACE INTO cashier_credits (
            id, store_id, worker_id, client_name, amount, status,
            notes, version, deleted_at, created_at, updated_at
          ) VALUES (
            @id, @store_id, @worker_id, @client_name, @amount, @status,
            @notes, @version, @deleted_at, @created_at, @updated_at
          )
        `);

        const upsertStockAdjustment = db.db.prepare(`
          INSERT OR REPLACE INTO stock_adjustments (
            id, store_id, worker_id, product_id, adjustment_type,
            quantity_adjusted, reason, version, deleted_at, created_at
          ) VALUES (
            @id, @store_id, @worker_id, @product_id, @adjustment_type,
            @quantity_adjusted, @reason, @version, @deleted_at, @created_at
          )
        `);

        const checkCategory = db.db.prepare(`SELECT id FROM product_families WHERE id = ?`);

        db.db.transaction(() => {
          for (const row of products) {
            if (row.category) {
              const family = checkCategory.get(row.category);
              if (!family) row.category = null;
            }
            upsertProduct.run(pick(row, PRODUCT_COLS));
          }
          for (const row of cleanedSales) {
            upsertSale.run(pick(row, SALE_COLS));
          }
          for (const row of saleItems) {
            upsertSaleItem.run(pick(row, SALE_ITEM_COLS));
          }
          for (const row of cashier_credits) {
            upsertCashierCredit.run(pick(row, CASHIER_CREDIT_COLS));
          }
          for (const row of stock_adjustments) {
            upsertStockAdjustment.run(pick(row, STOCK_ADJUSTMENT_COLS));
          }

          db.upsertSyncState(store.id, {
            last_pull_cursor: pulledAt,
            last_success_at: new Date().toISOString()
          });
        })();

        // Broadcast notifications to connected SSE clients
        if (products.length > 0) this.broadcast('data_merged', { type: 'product' });
        if (cleanedSales.length > 0 || saleItems.length > 0) this.broadcast('data_merged', { type: 'sale' });
        if (cashier_credits.length > 0) this.broadcast('data_merged', { type: 'cashier_credit' });
        if (stock_adjustments.length > 0) this.broadcast('data_merged', { type: 'inventory' });
      }
    } catch (err) {
      console.error('[SyncService] Pull loop error:', err);
    } finally {
      this.pulling = false;
    }
  }

  private static async fetchTable(
    table: string,
    since: string,
    storeId: string
  ): Promise<any[]> {
    const selectFields = table === 'sales' ? '*, sale_items(*)' : '*';
    const dateField = table === 'stock_adjustments' ? 'created_at' : 'updated_at';
    const query = supabase.from(table).select(selectFields).gt(dateField, since);

    if (table !== 'sale_items') {
      query.eq('store_id', storeId);
    }

    const { data, error } = await query.order(dateField, { ascending: true });
    if (error) {
      console.error(`[SyncService] Fetch error on ${table}:`, error.message);
      return [];
    }
    return data || [];
  }

  // ── Realtime Listener ──────────────────────────────────────────────────────
  private static subscribeRealtime() {
    const stores = db.listStores();
    const tables = ['products', 'sales', 'sale_items', 'cashier_credits', 'stock_adjustments'] as const;

    for (const store of stores) {
      tables.forEach((table) => {
        const filterStr = table === 'sale_items' ? undefined : `store_id=eq.${store.id}`;
        const channel = supabase
          .channel(`realtime-backend:${table}-${store.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table, filter: filterStr },
            (payload) => {
              console.log(`[SyncService] Realtime ${payload.eventType} on ${table} for ${store.name} — scheduling pull`);
              this.scheduleDebouncedPull();
            }
          )
          .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
              console.log(`[SyncService] Realtime subscribed to "${table}" for ${store.name}.`);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn(`[SyncService] Realtime issue on "${table}" for ${store.name}: ${status}`, err);
            }
          });

        this.channels.push(channel);
      });
    }
  }

  private static scheduleDebouncedPull() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      await this.pullData();
    }, DEBOUNCE_PULL_MS);
  }
}
