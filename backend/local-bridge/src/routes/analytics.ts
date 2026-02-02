import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db.js';
import { authenticateRequest } from './utils/auth.js';

const analyticsQuerySchema = z.object({
  store_id: z.string().optional(),
});

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  app.get('/rest/v1/analytics/dashboard', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = analyticsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store ID is required for analytics.' });
    }

    // Parallelize queries for performance
    const dailyRevenue = db.getDailyRevenue(storeId);
    const weeklyRevenue = db.getWeeklyRevenue(storeId);
    const topProducts = db.getTopProducts(storeId, 5);
    const topWorkers = db.getTopWorkers(storeId, 5);

    return reply.send({
      daily_revenue: dailyRevenue,
      weekly_revenue: weeklyRevenue,
      top_products: topProducts,
      top_workers: topWorkers,
    });
  });

  app.get('/rest/v1/analytics/stock-valuation', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = analyticsQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const storeId = parsed.data.store_id ?? claims.store_id;
    if (!storeId) {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store ID is required.' });
    }

    const valuation = db.getStockValuation(storeId);
    return reply.send(valuation);
  });
}
