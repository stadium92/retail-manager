import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const analyticsQuerySchema = z.object({
  store_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
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
    if (!storeId && storeId !== '') { // Allow empty string for Master (All Stores)
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store ID is required for analytics.' });
    }

    const fromDate = parsed.data.from;
    const toDate = parsed.data.to;

    // Parallelize queries for performance
    const dailyRevenue = db.getDailyRevenue(storeId || '', fromDate, toDate);
    const weeklyRevenue = db.getWeeklyRevenue(storeId || '', fromDate, toDate);
    const topProducts = db.getTopProducts(storeId || '', 5, fromDate, toDate);
    const topWorkers = db.getTopWorkers(storeId || '', 5, fromDate, toDate);
    const stockHealth = db.getStockHealth(storeId || '');

    return reply.send({
      daily_revenue: dailyRevenue,
      weekly_revenue: weeklyRevenue,
      top_products: topProducts,
      top_workers: topWorkers,
      stock_health: stockHealth,
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
    // Allow empty string for Master to view all stores
    if (storeId === undefined && claims.role !== 'master') {
      return reply.status(400).send({ error: 'StoreRequired', message: 'Store ID is required.' });
    }

    const valuation = db.getStockValuation(storeId || '');
    return reply.send(valuation);
  });
}
