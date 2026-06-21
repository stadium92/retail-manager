import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';
import { env } from '../env.js';
import { SyncService } from '../db/SyncService.js';


interface OutboxEntry {
  id: string;
  store_id: string;
  entity_type: string;
  entity_id: string;
  op_type: string;
  payload_json: string;
  base_version: number | null;
  created_at: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  idempotency_key: string;
}

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

export async function registerSyncRoutes(app: FastifyInstance) {
  // Network Health Diagnostic Endpoint
  app.get('/sync/health', async (_request, reply) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // Fallback Supabase URL if not defined in env (matches frontend lib/supabase.ts)
      const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://kvxqutffphaxlhjyyjsw.supabase.co";
      
      const res = await fetch(`${supabaseUrl}/rest/v1/`, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        return reply.send({ status: 'RATE_LIMITED', message: 'Too many requests to cloud' });
      }

      return reply.send({ status: 'ONLINE', message: 'Connected to cloud' });
    } catch (err: any) {
      const errMsg = err.message || '';
      const code = err.cause?.code || err.code || '';
      
      if (errMsg.includes('abort') || code === 'UND_ERR_CONNECT_TIMEOUT') {
         return reply.send({ status: 'FIREWALL_BLOCKED', message: 'Connection timed out. Firewall suspected.' });
      }
      if (code === 'ECONNREFUSED') {
         return reply.send({ status: 'FIREWALL_BLOCKED', message: 'Connection refused. Firewall suspected.' });
      }
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
         return reply.send({ status: 'ISP_BLOCKED', message: 'DNS resolution failed. ISP block or no internet.' });
      }
      if (code.includes('CERT') || errMsg.includes('certificate')) {
         return reply.send({ status: 'CLOCK_SKEW', message: 'SSL certificate error. System clock is likely incorrect.' });
      }

      return reply.send({ status: 'OFFLINE', message: `Unknown network error: ${code || errMsg}` });
    }
  });
  // Handshake / capabilities endpoint
  app.get('/sync/handshake', async (_request, reply) => {
    return reply.send({
      server_time: new Date().toISOString(),
      min_supported_client: '0.1.0',
      feature_flags: {
        push_enabled: true,
        pull_enabled: true,
        cloud_sync: 'enabled',
        conflict_resolution: 'local_wins',
      },
    });
  });

  // Get pending outbox entries
  app.get('/sync/outbox', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const { store_id, limit } = request.query as { store_id?: string; limit?: string };
    if (!store_id) {
      return reply.status(400).send({ error: 'MissingStoreId', message: 'store_id query parameter is required.' });
    }

    const entries = db.listOutboxEntries(store_id, 'pending', limit ? parseInt(limit, 10) : 100);
    
    // Map entries payload for frontend client convenience
    const mappedEntries = entries.map(e => ({
      id: e.id,
      entity_type: e.entity_type,
      entity_id: e.entity_id,
      operation: e.op_type,
      payload: e.payload_json,
      status: e.status,
      retry_count: e.retry_count,
      created_at: e.created_at
    }));

    return reply.send(mappedEntries);
  });

  // Update outbox entry status (batch update)
  app.post('/sync/outbox/status', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const { synced = [], failed = [] } = request.body as {
      synced?: string[];
      failed?: Array<{ id: string; error: string }>;
    };

    db.db.transaction(() => {
      for (const id of synced) {
        db.updateOutboxStatus(id, 'acked', null);
      }
      for (const { id, error } of failed) {
        db.incrementOutboxRetry(id, error);
      }
    })();

    return reply.send({ success: true, synced_count: synced.length, failed_count: failed.length });
  });

  // Reset failed outbox entries (retry loop trigger)
  app.post('/sync/outbox/retry', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const info = db.db.prepare(
      `UPDATE sync_outbox
       SET status = 'pending', last_error = NULL
       WHERE status = 'failed' AND retry_count < 5`
    ).run();

    return reply.send({ success: true, reset_count: info.changes });
  });

  // Get pull cursor
  app.get('/sync/cursor', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const { store_id } = request.query as { store_id?: string };
    const actualStoreId = store_id || claims.store_id;

    if (!actualStoreId) {
      return reply.status(400).send({ error: 'MissingStoreId', message: 'store_id parameter is required.' });
    }

    const state = db.getSyncState(actualStoreId);
    return reply.send({ last_pulled_at: state?.last_pull_cursor ?? null });
  });

  // Merge pulled remote changes into SQLite
  app.post('/sync/merge', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const {
      products = [],
      sales = [],
      sale_items = [],
      cashier_credits = [],
      stock_adjustments = [],
      pulled_at,
      store_id: req_store_id
    } = request.body as {
      products?: Record<string, any>[];
      sales?: Record<string, any>[];
      sale_items?: Record<string, any>[];
      cashier_credits?: Record<string, any>[];
      stock_adjustments?: Record<string, any>[];
      pulled_at?: string;
      store_id?: string;
    };

    const actualStoreId = req_store_id || claims.store_id;
    if (!actualStoreId) {
      return reply.status(400).send({ error: 'MissingStoreId', message: 'store_id parameter is required.' });
    }

    try {
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
        // Direct database writes will not fire repository event emitters, preventing sync loops
        for (const row of products) {
          if (row.category) {
            const family = checkCategory.get(row.category);
            if (!family) {
              row.category = null; // Auto-heal: sanitize invalid FK to prevent transaction crash
            }
          }
          upsertProduct.run(pick(row, PRODUCT_COLS));
        }
        for (const row of sales) {
          upsertSale.run(pick(row, SALE_COLS));
        }
        for (const row of sale_items) {
          upsertSaleItem.run(pick(row, SALE_ITEM_COLS));
        }
        for (const row of cashier_credits) {
          upsertCashierCredit.run(pick(row, CASHIER_CREDIT_COLS));
        }
        for (const row of stock_adjustments) {
          upsertStockAdjustment.run(pick(row, STOCK_ADJUSTMENT_COLS));
        }

        // Advance pull cursor
        db.upsertSyncState(actualStoreId, {
          last_pull_cursor: pulled_at || new Date().toISOString(),
          last_success_at: new Date().toISOString()
        });
      })();

      const merged = {
        products: products.length,
        sales: sales.length,
        sale_items: sale_items.length,
        cashier_credits: cashier_credits.length,
        stock_adjustments: stock_adjustments.length
      };

      request.log.info(
        '[Sync] Merge complete - products: %d, sales: %d, sale_items: %d',
        merged.products,
        merged.sales,
        merged.sale_items
      );

      return reply.send({ ok: true, merged });
    } catch (err: any) {
      request.log.error(err, '[Sync] Merge transaction failed');
      return reply.status(500).send({ error: 'MergeFailed', message: err.message });
    }
  });

  // Diagnostics endpoint
  app.get('/sync/diagnostics', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const { store_id } = request.query as { store_id?: string };
    const actualStoreId = store_id || claims.store_id;

    if (!actualStoreId) {
      return reply.status(400).send({ error: 'MissingStoreId', message: 'store_id parameter is required.' });
    }

    const stats = db.getOutboxStats(actualStoreId);
    const syncState = db.getSyncState(actualStoreId);

    return reply.send({
      store_id: actualStoreId,
      outbox: stats,
      sync_state: syncState ?? {
        store_id: actualStoreId,
        last_push_at: null,
        last_pull_cursor: null,
        last_success_at: null,
        last_error: null,
      },
    });
  });

  // Server-Sent Events endpoint for real-time synchronization updates
  app.get('/sync/events', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    reply.raw.write('comment: connection established\n\n');
    SyncService.addSseClient(reply);

    request.raw.on('close', () => {
      SyncService.removeSseClient(reply);
    });
  });

  // Trigger manual outbox push immediately
  app.post('/sync/push', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const { store_id } = request.query as { store_id?: string };
    const actualStoreId = store_id || claims.store_id;

    if (!actualStoreId) {
      return reply.status(400).send({ error: 'MissingStoreId', message: 'store_id parameter is required.' });
    }

    try {
      await SyncService.pushOutbox();
      const stats = db.getOutboxStats(actualStoreId);
      return reply.send({
        pushed: stats.sent,
        failed: stats.failed,
        pending: stats.pending
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'PushFailed', message: err.message });
    }
  });

  // Trigger manual remote pull immediately
  app.post('/sync/pull', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    try {
      await SyncService.pullData();
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: 'PullFailed', message: err.message });
    }
  });
}

