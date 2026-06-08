import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

/**
 * registerSyncRoutes - Handles local synchronization logic.
 * Supabase-specific cloud sync has been stripped out.
 * Future cloud sync will be handled by the Rust Master API.
 */
import fs from 'fs';
import path from 'path';

// Helper to get environment variables from the root .env
function getCloudConfig() {
  const envFilePath = path.join(process.cwd(), '../../.env');
  if (!fs.existsSync(envFilePath)) return null;
  const envContent = fs.readFileSync(envFilePath, 'utf-8');
  const config: Record<string, string> = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      config[match[1].trim()] = match[2].trim();
    }
  });
  return {
    token: config.MASTER_TOKEN,
    machineId: config.MACHINE_ID,
    url: config.CLOUD_URL || 'https://djati-cloud-hub.moh-kuhh.workers.dev'
  };
}

export async function registerSyncRoutes(app: FastifyInstance) {
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

  // Sync diagnostics endpoint for admins
  app.get('/sync/diagnostics', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const storeId = (request.query as { store_id?: string }).store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'MissingStoreId', message: 'store_id query parameter is required.' });
    }

    const stats = db.getOutboxStats(storeId);
    const syncState = db.getSyncState(storeId);

    return reply.send({
      store_id: storeId,
      outbox: stats,
      sync_state: syncState ?? {
        store_id: storeId,
        last_push_at: null,
        last_pull_cursor: null,
        last_success_at: null,
        last_error: null,
      },
    });
  });

  // Legacy PUSH endpoint - Handled via frontend LocalBridgeSyncService for now
  app.post('/rest/v1/sync/push', async (request, reply) => {
    return reply.send({ 
      message: 'Cloud sync push handled by frontend LocalBridgeSyncService.',
      pushed: 0,
      failed: 0,
      pending: 0
    });
  });

  // PULL endpoint - Fetches from Cloudflare Worker and merges into local SQLite
  app.get('/rest/v1/sync/pull', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const config = getCloudConfig();
    if (!config || !config.token) {
      return reply.status(400).send({ error: 'NotConfigured', message: 'Master Token not configured in .env' });
    }

    try {
      const fetchResponse = await fetch(`${config.url}/api/v1/sync?sync_token=${config.token}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!fetchResponse.ok) {
        throw new Error(`Cloud hub returned ${fetchResponse.status}`);
      }

      const data = await fetchResponse.json() as any;
      if (!data.success) {
        throw new Error(data.error || 'Unknown cloud error');
      }

      let salesInserted = 0;
      let inventoryInserted = 0;

      // Wrap in a transaction
      db.db.transaction(() => {
        // Helper to ensure store exists
        const ensureStore = (storeId: string, machineId: string) => {
          const exists = db.db.prepare('SELECT 1 FROM stores WHERE id = ?').get(storeId);
          if (!exists) {
            db.db.prepare(`
              INSERT INTO stores (id, name, owner_id, created_at, updated_at) 
              VALUES (?, ?, ?, ?, ?)
            `).run(
              storeId, 
              `Synced Store (${machineId})`, 
              claims.sub, // assign to the master user who is pulling
              new Date().toISOString(), 
              new Date().toISOString()
            );
          }
        };

        // 1. Insert Sales
        if (data.sales && Array.isArray(data.sales)) {
          const stmt = db.db.prepare(`
            INSERT OR IGNORE INTO sales (id, store_id, sale_type, total_amount, payment_method, cashier_id, status, created_at, updated_at)
            VALUES (@id, @store_id, @sale_type, @total_amount, @payment_method, @cashier_id, @status, @created_at, @updated_at)
          `);
          
          const itemsStmt = db.db.prepare(`
            INSERT OR IGNORE INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, subtotal)
            VALUES (@id, @sale_id, @product_id, @product_name, @quantity, @unit_price, @subtotal)
          `);

          for (const sale of data.sales) {
            try {
              ensureStore(sale.store_id, sale.machine_id || 'Unknown');
              stmt.run({
                id: sale.id,
                store_id: sale.store_id,
                sale_type: sale.sale_type || 'detail',
                total_amount: sale.total_amount || 0,
                payment_method: sale.payment_method || 'cash',
                cashier_id: sale.cashier_id || null,
                status: sale.status || 'completed',
                created_at: sale.created_at,
                updated_at: sale.updated_at || sale.created_at
              });
              
              if (sale.items && Array.isArray(sale.items)) {
                 for (const item of sale.items) {
                    itemsStmt.run({
                      id: item.id || crypto.randomUUID(),
                      sale_id: sale.id,
                      product_id: item.product_id || item.productId,
                      product_name: item.product_name || item.designation,
                      quantity: item.quantity,
                      unit_price: item.unit_price || item.unitPrice,
                      subtotal: item.subtotal || item.lineTotal || (item.quantity * (item.unit_price || item.unitPrice))
                    });
                 }
              }
              salesInserted++;
            } catch (e) {
              console.error('Error inserting pulled sale:', e);
            }
          }
        }

        // 2. Insert Inventory/Products
        if (data.inventory && Array.isArray(data.inventory)) {
           const stmt = db.db.prepare(`
              INSERT OR REPLACE INTO products (id, store_id, name, sku, barcode, description, category, unit_price, cost_price, wholesale_price, quantity, min_quantity, created_at, updated_at)
              VALUES (@id, @store_id, @name, @sku, @barcode, @description, @category, @unit_price, @cost_price, @wholesale_price, @quantity, @min_quantity, @created_at, @updated_at)
           `);

           for (const item of data.inventory) {
              try {
                ensureStore(item.store_id, item.machine_id || 'Unknown');
                stmt.run({
                  id: item.id || item.product_id,
                  store_id: item.store_id,
                  name: item.name || item.designation,
                  sku: item.sku || null,
                  barcode: item.barcode || null,
                  description: item.description || null,
                  category: item.category || null,
                  unit_price: item.unit_price || 0,
                  cost_price: item.cost_price || 0,
                  wholesale_price: item.wholesale_price || 0,
                  quantity: item.quantity || item.stock || 0,
                  min_quantity: item.min_quantity || 0,
                  created_at: item.created_at || new Date().toISOString(),
                  updated_at: item.updated_at || new Date().toISOString()
                });
                inventoryInserted++;
              } catch(e) {
                console.error('Error inserting pulled inventory:', e);
              }
           }
        }
      })();

      return reply.send({ 
        message: 'Successfully pulled and merged data from Cloud Hub.',
        pulledSales: salesInserted,
        pulledInventory: inventoryInserted 
      });

    } catch (err: any) {
      return reply.status(500).send({ error: 'PullFailed', message: err.message });
    }
  });
}
