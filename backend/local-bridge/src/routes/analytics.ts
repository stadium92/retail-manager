import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const analyticsQuerySchema = z.object({
  store_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// Non-masters are pinned to their own store, whatever the query says. The old
// `parsed.store_id ?? claims.store_id` resolution meant any WORKER could send
// `?store_id=` (empty string) and receive the aggregate of every store - the
// "Master (All Stores)" convention with no role check behind it. Masters keep
// the empty-string convention; everyone else gets their claim, full stop.
const resolveStoreScope = (
  requested: string | undefined,
  claims: { role?: string; store_id?: string | null }
): string => {
  if (claims.role === 'master') return requested ?? claims.store_id ?? '';
  return claims.store_id ?? '';
};

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  app.get('/rest/v1/analytics/dashboard', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = analyticsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = resolveStoreScope(parsed.data.store_id, claims);
    if (!storeId && claims.role !== 'master') {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store ID is required for analytics.' });
    }

    const fromDate = parsed.data.from;
    const toDate = parsed.data.to;

    const dailyRevenue = db.getDailyRevenue(storeId, fromDate, toDate);
    const weeklyRevenue = db.getWeeklyRevenue(storeId, fromDate, toDate);
    const topProducts = db.getTopProducts(storeId, 5, fromDate, toDate);
    const topWorkers = db.getTopWorkers(storeId, 5, fromDate, toDate);
    const stockHealth = db.getStockHealth(storeId);
    const totalProfit = db.getProfit(storeId, fromDate, toDate);

    return reply.send({
      daily_revenue: dailyRevenue,
      weekly_revenue: weeklyRevenue,
      top_products: topProducts,
      top_workers: topWorkers,
      stock_health: stockHealth,
      total_profit: totalProfit,
    });
  });

  app.get('/rest/v1/analytics/stock-valuation', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = analyticsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = resolveStoreScope(parsed.data.store_id, claims);
    if (!storeId && claims.role !== 'master') {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store ID is required.' });
    }

    const valuation = db.getStockValuation(storeId || '');
    return reply.send(valuation);
  });
}
