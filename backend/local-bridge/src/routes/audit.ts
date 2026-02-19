import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';
import { randomUUID } from 'crypto';

export async function registerAuditRoutes(app: FastifyInstance) {
  app.get('/rest/v1/audit_logs', async (request, reply) => {
    const user = authenticateRequest(request, reply);
    if (!user) return;

    const { store_id, user_id, action_type, limit, offset } = request.query as any;
    
    // Authorization: Only master can see all logs, workers only their own store
    if (user.role !== 'master' && store_id !== user.store_id) {
      return reply.status(403).send({ message: 'Forbidden' });
    }

    const logs = db.listAuditLogs({
      store_id,
      user_id,
      action_type,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });

    return logs;
  });

  app.post('/rest/v1/audit_logs', async (request, reply) => {
    const user = authenticateRequest(request, reply);
    if (!user) return;

    const body = request.body as any;

    const log = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      user_id: user.id, // Use authenticated user ID
      store_id: user.store_id || body.store_id, // Use auth store or body
      ...body
    };

    db.insertAuditLog(log);
    return log;
  });
}