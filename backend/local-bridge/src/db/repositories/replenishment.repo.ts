import Database from 'better-sqlite3';
import { LocalReplenishmentRequest, ReplenishmentNeed, LocalProduct } from '../types.js';

export const createReplenishmentRepo = (db: Database.Database) => ({
  listReplenishmentRequests(storeId: string): LocalReplenishmentRequest[] {
    const rows = db
      .prepare('SELECT * FROM replenishment_requests WHERE store_id = ? ORDER BY created_at DESC')
      .all(storeId);
    return rows as LocalReplenishmentRequest[];
  },

  insertReplenishmentRequest(request: LocalReplenishmentRequest) {
    db.prepare(
      `
      INSERT INTO replenishment_requests (
        id, store_id, product_id, requested_by, quantity_requested, reason, status, created_at, updated_at
      ) VALUES (
        @id, @store_id, @product_id, @requested_by, @quantity_requested, @reason, @status, @created_at, @updated_at
      )
    `
    ).run({
      ...request,
      requested_by: request.requested_by ?? null,
      quantity_requested: request.quantity_requested ?? null,
      reason: request.reason ?? null,
    });
  },

  getReplenishmentNeeds(storeId: string): ReplenishmentNeed[] {
    // 1. Get Low Stock Products (quantity <= min_quantity)
    const lowStockProducts = db
      .prepare(`
        SELECT p.*, pf.name as category_name
        FROM products p
        LEFT JOIN product_families pf ON p.category = pf.id
        WHERE p.store_id = ? AND p.quantity <= COALESCE(p.min_quantity, 10)
      `)
      .all(storeId) as LocalProduct[];

    // 2. Get Pending Requests
    const pendingRequests = db
      .prepare(`
        SELECT rr.*, p.name as product_name, p.sku, p.quantity as current_stock, p.min_quantity,
               p.unit_type, p.packaging, p.unit_price, p.cost_price,
               p.wholesale_price_ht, p.wholesale_price_ttc,
               p.selling_price_2, p.selling_price_3, p.selling_price_4,
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
        wholesale_price_ht: number;
        wholesale_price_ttc: number;
        selling_price_2: number;
        selling_price_3: number;
        selling_price_4: number;
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
        wholesale_price_ht: p.wholesale_price_ht || 0,
        wholesale_price_ttc: p.wholesale_price_ttc || 0,
        selling_price_2: p.selling_price_2 || 0,
        selling_price_3: p.selling_price_3 || 0,
        selling_price_4: p.selling_price_4 || 0,
        source: 'low_stock',
        suggested_qty: Math.max(10, (p.min_quantity || 10) * 2 - (p.quantity || 0)),
      } as any);
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
          wholesale_price_ht: req.wholesale_price_ht || 0,
          wholesale_price_ttc: req.wholesale_price_ttc || 0,
          selling_price_2: req.selling_price_2 || 0,
          selling_price_3: req.selling_price_3 || 0,
          selling_price_4: req.selling_price_4 || 0,
          source: 'worker_request',
          suggested_qty: req.quantity_requested || 10,
          request_id: req.id,
          request_reason: req.reason || undefined,
          requester_name: req.requester_name || undefined,
        } as any);
      }
    }

    return Array.from(needsMap.values());
  },
});
