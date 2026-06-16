import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db, rawDb } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';
import { emitOutbox } from '../db/repositories/sync_helpers.js';

const stockAdjustmentQuerySchema = z.object({
  store_id: z.string().optional(),
});

const stockAdjustmentCreateSchema = z.object({
  id: z.string().optional(),
  store_id: z.string().optional(),
  product_id: z.string().min(1),
  adjustment_type: z.enum(['loss', 'damage', 'inventory_count', 'other']),
  quantity_adjusted: z.number(), // represents delta (e.g. -5, +2)
  reason: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

export async function registerStockAdjustmentsRoutes(app: FastifyInstance) {
  app.get('/rest/v1/stock_adjustments', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = stockAdjustmentQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    let storeId = parsed.data.store_id ?? claims.store_id;
    if (claims.role !== 'master') {
      storeId = claims.store_id;
    }

    const adjustments = db.listStockAdjustments(storeId || undefined);
    return reply.send(adjustments);
  });

  app.post('/rest/v1/stock_adjustments', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = stockAdjustmentCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const product = db.getProductById(parsed.data.product_id);
    if (!product) {
      return reply.status(404).send({ error: 'NotFound', message: 'Product not found.' });
    }

    const now = new Date().toISOString();
    const adjustmentId = parsed.data.id || crypto.randomUUID();
    const adjustment = {
      id: adjustmentId,
      store_id: storeId,
      worker_id: claims.sub,
      product_id: parsed.data.product_id,
      adjustment_type: parsed.data.adjustment_type,
      quantity_adjusted: parsed.data.quantity_adjusted,
      reason: parsed.data.reason ?? null,
      created_at: parsed.data.created_at || now,
    };

    // Begin SQLite Transaction
    try {
      rawDb.transaction(() => {
        // 1. Insert stock adjustment
        db.insertStockAdjustment(adjustment);

        // 2. Calculate new product quantity and update it
        const currentQty = Number(product.quantity) || 0;
        const newQty = Math.max(0, currentQty + parsed.data.quantity_adjusted);
        const updatedProduct = db.updateProduct(parsed.data.product_id, {
          quantity: newQty,
          updated_at: now,
          updated_by: claims.sub,
        });

        if (updatedProduct) {
          emitOutbox(rawDb, storeId, 'product', product.id, 'update', updatedProduct as any, (updatedProduct as any).version - 1);
        }

        // 3. Log inventory movement for tracking
        const movementId = crypto.randomUUID();
        const movement = {
          id: movementId,
          store_id: storeId,
          product_id: parsed.data.product_id,
          product_name: product.name,
          movement_type: 'adjustment',
          quantity: Math.abs(parsed.data.quantity_adjusted),
          reason: `Ajustement (${parsed.data.adjustment_type}): ${parsed.data.reason || ''}`,
          source: 'manual',
          created_at: now,
          created_by: claims.sub,
        };
        db.insertInventoryMovement(movement as any);

        // Audit Log
        db.insertAuditLog({
          id: crypto.randomUUID(),
          timestamp: now,
          user_id: claims.sub,
          action_type: 'stock_adjustment',
          entity_affected: 'product',
          entity_id: parsed.data.product_id,
          old_value: String(currentQty),
          new_value: String(newQty),
          store_id: storeId,
        });
      })();

      return reply.status(201).send(adjustment);
    } catch (e: any) {
      request.log.error(e, 'Failed to apply stock adjustment transaction');
      return reply.status(500).send({ error: 'InternalServerError', message: e.message });
    }
  });
}
