import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { emitOutbox } from '../db/repositories/sync_helpers.js';
import { authenticateRequest } from './utils/auth.js';

const salesQuerySchema = z.object({
  store_id: z.string().optional(),
  limit: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

const saleCreateSchema = z.object({
  id: z.string().optional(),
  store_id: z.string().optional(),
  worker_id: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  sale_type: z.enum(['detail', 'gros', 'proforma']).optional(),
  total_price: z.number().optional(),
  discount: z.number().nullable().optional(),
  tax: z.number().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  payment_status: z.string().nullable().optional(),
  // The credit ledger. Was absent from this schema, so zod stripped it from
  // every POST and no sale ever persisted a paid amount - which is why
  // Reglement CREDIT and every "Restant" read zero forever.
  amount_paid: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  created_at: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        product_id: z.string().nullable().optional(),
        product_name: z.string().min(1),
        quantity: z.number().min(0.01),
        unit_price: z.number().min(0),
        discount: z.number().nullable().optional(),
        total: z.number().min(0),
      })
    )
    .optional(),
});

const saleUpdateSchema = z.object({
  customer_name: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  sale_type: z.enum(['detail', 'gros', 'proforma']).optional(),
  total_price: z.number().optional(),
  discount: z.number().nullable().optional(),
  tax: z.number().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  payment_status: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
});

const saleItemsQuerySchema = z.object({
  sale_id: z.string().min(1),
});

export async function registerSalesRoutes(app: FastifyInstance) {
  app.get('/rest/v1/sales', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = salesQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const requestedStoreId = parsed.data.store_id;
    const limit = parsed.data.limit ? Number(parsed.data.limit) : undefined;
    const dateFrom = parsed.data.date_from;
    const dateTo = parsed.data.date_to;

    if (requestedStoreId) {
      // A non-master's requested store must match their own claim. Without
      // this check any worker could read another store's - or with the empty
      // string convention, EVERY store's - full sales history. Same class of
      // hole as the analytics endpoints, fixed the same day.
      if (claims.role !== 'master' && claims.store_id && requestedStoreId !== claims.store_id) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Cannot view another store.' });
      }
      const sales = db.listSales(requestedStoreId, limit, dateFrom, dateTo);
      return reply.send(sales);
    }

    if (claims.role === 'master') {
      return reply.send(db.listSales(undefined, limit, dateFrom, dateTo));
    }

    const storeId = claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const sales = db.listSales(storeId, limit, dateFrom, dateTo);
    return reply.send(sales);
  });

  app.get('/rest/v1/sales/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const saleId = (request.params as { id: string }).id;
    const sale = db.getSaleById(saleId);
    if (!sale) {
      return reply.status(404).send({ error: 'NotFound', message: 'Sale not found.' });
    }
    if (claims.store_id && claims.store_id !== sale.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot view this sale.' });
    }

    return reply.send(sale);
  });

  app.post('/rest/v1/sales', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = saleCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store is required.' });
    }

    const now = new Date().toISOString();
    const saleId = parsed.data.id || crypto.randomUUID();

    // Idempotency guard: if the caller retries a checkout with the SAME
    // sale id (e.g. after a client-side timeout that fired even though
    // this had already committed), return the existing sale instead of
    // creating a second, fully independent one. sale_items_ai fires per
    // row on INSERT with no duplicate-detection of its own, so a repeat
    // submission with a fresh id would silently double-deduct stock with
    // no DB error - this is the confirmed mechanism behind inventory
    // "resetting" by a line item's quantity with no matching transaction.
    if (parsed.data.id) {
      const existingSale = db.getSaleById(parsed.data.id);
      if (existingSale) {
        return reply.status(200).send(existingSale);
      }
    }

    const saleData = {
      id: saleId,
      store_id: storeId,
      worker_id: parsed.data.worker_id ?? claims.sub ?? null,
      client_id: parsed.data.client_id ?? null,
      customer_name: parsed.data.customer_name ?? null,
      customer_phone: parsed.data.customer_phone ?? null,
      sale_type: parsed.data.sale_type ?? 'detail',
      total_price: parsed.data.total_price ?? 0,
      discount: parsed.data.discount ?? 0,
      tax: parsed.data.tax ?? 0,
      payment_method: parsed.data.payment_method ?? 'cash',
      payment_status: parsed.data.payment_status ?? 'paid',
      // Default matches reality: a cash/card sale is fully paid at the till,
      // a credit sale starts with nothing received. Callers that track
      // partial payment can still send an explicit figure.
      amount_paid:
        parsed.data.amount_paid ??
        ((parsed.data.payment_method ?? 'cash') === 'credit' ? 0 : parsed.data.total_price ?? 0),
      notes: parsed.data.notes ?? null,
      invoice_number: parsed.data.invoice_number ?? null,
      created_at: parsed.data.created_at || now,
      updated_at: now,
    };

    const items = (parsed.data.items ?? []).map(item => ({
      id: item.id || crypto.randomUUID(),
      sale_id: saleId,
      product_id: item.product_id ?? null,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount ?? 0,
      total: item.total,
      created_at: now,
    }));

    // Use atomic transaction
    db.createSaleWithItems(saleData as any, items as any);

    return reply.status(201).send(db.getSaleById(saleId));
  });

  app.patch('/rest/v1/sales/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = saleUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const saleId = (request.params as { id: string }).id;
    const existing = db.getSaleById(saleId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Sale not found.' });
    }
    if (claims.store_id && claims.store_id !== existing.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot update sale.' });
    }

    const updated = db.updateSale(saleId, { ...parsed.data, updated_at: new Date().toISOString() });
    return reply.send(updated);
  });

  // Record a payment against a credit sale. The frontend
  // (ReglementsBonsModule) has called this exact path since the feature
  // shipped, but the route never existed - Fastify 404'd, the client threw,
  // and NO settlement was ever persisted anywhere. That, plus amount_paid
  // being stripped by the create schema, is the complete story of why
  // "Reglement CREDIT" could never show anything.
  //
  // Semantics are additive ON THE SERVER (amount_paid = amount_paid + n)
  // rather than accepting a client-computed new total: the client computes
  // its figure from a snapshot, so two settlements taken close together
  // would otherwise overwrite each other and lose one payment.
  app.patch('/rest/v1/sales/:id/settle', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const settleSchema = z.object({ amount: z.number().positive() });
    const parsed = settleSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const saleId = (request.params as { id: string }).id;
    const existing = db.getSaleById(saleId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Sale not found.' });
    }
    if (claims.store_id && claims.store_id !== existing.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot settle this sale.' });
    }

    const amount = parsed.data.amount;
    const now = new Date().toISOString();
    const alreadyPaid = Number((existing as any).amount_paid) || 0;
    const newPaid = alreadyPaid + amount;
    const newStatus = newPaid >= (Number(existing.total_price) || 0) ? 'paid' : 'partial';

    const runSettle = db.db.transaction(() => {
      db.db
        .prepare('UPDATE sales SET amount_paid = ?, payment_status = ?, updated_at = ? WHERE id = ?')
        .run(newPaid, newStatus, now, saleId);

      // A per-payment ledger row, so end-of-day cash counts can sum what was
      // RECEIVED TODAY rather than re-deriving it from cumulative amount_paid
      // (which double-counts a sale settled across several days).
      db.insertCashTransaction({
        id: crypto.randomUUID(),
        store_id: existing.store_id,
        worker_id: claims.sub,
        type: 'in',
        amount,
        category: 'client_payment',
        description: `Règlement vente ${existing.invoice_number || saleId.slice(0, 8)}`,
        // MUST be the client id, not the sale id. listClientTransactions()
        // builds a client's statement with
        //   WHERE category = 'client_payment' AND reference = <clientId>
        // so a row keyed by sale id is invisible there: the statement showed
        // the original credit SALE as a debit while the payment that cleared
        // it never appeared, making a settled invoice look permanently
        // outstanding. The sale is still identifiable from the description.
        reference: existing.client_id ?? saleId,
        created_at: now,
        updated_at: now,
      } as any);

      if (existing.client_id) {
        // Payment reduces what the client owes.
        db.updateClientBalance(existing.client_id, -amount);
      }
      // NOTE: a credit sale recorded against a walk-in (customer_name filled
      // in, client_id NULL) has no balance to reduce. amount_paid on the sale
      // is still updated, so "Restant" is correct on the invoice itself; there
      // simply is no client account to credit. Worth surfacing in the UI at
      // some point - silently doing nothing is how the earlier bugs hid.
    });

    try {
      runSettle();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: 'SettleFailed', message });
    }

    const updated = db.getSaleById(saleId);
    if (updated) {
      // Queue for Supabase so the phone's credit view converges too -
      // sync_payload_map already forwards amount_paid.
      emitOutbox(db.db, existing.store_id, 'sale', saleId, 'update', updated as unknown as Record<string, unknown>);
    }

    return reply.send(updated);
  });

  app.delete('/rest/v1/sales/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const saleId = (request.params as { id: string }).id;
    const existing = db.getSaleById(saleId);
    if (!existing) {
      return reply.status(404).send({ error: 'NotFound', message: 'Sale not found.' });
    }
    if (claims.store_id && claims.store_id !== existing.store_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot delete sale.' });
    }

    db.deleteSale(saleId);

    db.insertAuditLog({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      user_id: claims.sub,
      action_type: 'sale_deletion',
      entity_affected: 'sale',
      entity_id: saleId,
      old_value: JSON.stringify({ total_price: existing.total_price, created_at: existing.created_at }),
      store_id: existing.store_id,
    });

    return reply.send({ message: 'Sale deleted.' });
  });

  app.get('/rest/v1/sale_items', async (request, reply) => {
    const claims = authenticateRequest(request, reply);
    if (!claims) return;

    const parsed = saleItemsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const sale = db.getSaleById(parsed.data.sale_id);
    if (!sale) {
      return reply.status(404).send({ error: 'NotFound', message: 'Sale not found.' });
    }
    if (claims.store_id && claims.store_id !== sale.store_id && claims.role !== 'master') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Cannot view items.' });
    }

    return reply.send(db.listSaleItems(parsed.data.sale_id));
  });
}
