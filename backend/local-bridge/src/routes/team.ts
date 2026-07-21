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

  // Path-param :id, matching every other /rest/v1/<resource>/:id delete
  // route in this backend (products, clients, stores, ...) - didn't exist
  // at all before, so every team-member delete from the master dashboard
  // 404'd. Also removes the user record itself once their last role is
  // gone, matching the "backend also deletes the user if no other roles
  // remain" behavior the frontend already assumes.
  app.delete('/rest/v1/user_roles/:id', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    const { id } = request.params as { id: string };
    const role = db.getRoleById(id);
    if (!role) {
      return reply.status(404).send({ error: 'NotFound', message: 'Role not found.' });
    }

    db.deleteRole(id);

    const remaining = db.getRolesForUser(role.user_id);
    if (remaining.length === 0) {
      db.deleteUser(role.user_id);
    }

    return reply.send({ message: 'Deleted' });
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
