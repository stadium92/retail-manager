import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

const rolesQuerySchema = z.object({
  role: z.enum(['master', 'worker', 'deliverer']).optional(),
});

const deliveriesQuerySchema = z.object({
  deliverer_id: z.string().optional(),
  store_id: z.string().optional(),
});

export async function registerTeamRoutes(app: FastifyInstance) {
  app.get('/rest/v1/users', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const users = db.listUsers();
    return reply.send(
      users.map((user) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone ?? null,
        created_at: user.created_at,
        updated_at: user.updated_at ?? user.created_at,
      }))
    );
  });

  app.get('/rest/v1/user_roles', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    const parsed = rolesQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const roles = db.listUserRoles(parsed.data.role);
    return reply.send(roles);
  });

  app.get('/rest/v1/deliverer_stats', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const parsed = deliveriesQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ValidationFailed', details: parsed.error.flatten() });
    }

    const deliveries = db.listDeliveries(parsed.data.store_id, parsed.data.deliverer_id);
    const stats = deliveries.reduce((acc, delivery) => {
      if (!delivery.deliverer_id) return acc;
      if (!acc[delivery.deliverer_id]) {
        acc[delivery.deliverer_id] = { total: 0, completed: 0 };
      }
      acc[delivery.deliverer_id].total += 1;
      if (delivery.status === 'delivered') {
        acc[delivery.deliverer_id].completed += 1;
      }
      return acc;
    }, {} as Record<string, { total: number; completed: number }>);

    return reply.send(stats);
  });
}
