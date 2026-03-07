import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

/**
 * registerSyncRoutes - Handles local synchronization logic.
 * Supabase-specific cloud sync has been stripped out.
 * Future cloud sync will be handled by the Rust Master API.
 */
export async function registerSyncRoutes(app: FastifyInstance) {
  // Handshake / capabilities endpoint
  app.get('/sync/handshake', async (_request, reply) => {
    return reply.send({
      server_time: new Date().toISOString(),
      min_supported_client: '0.1.0',
      feature_flags: {
        push_enabled: false,
        pull_enabled: false,
        cloud_sync: 'disabled',
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

  // Legacy PUSH endpoint - Now a no-op
  app.post('/rest/v1/sync/push', async (request, reply) => {
    return reply.send({ 
      message: 'Cloud sync disabled. Local SQLite is the master source of truth.',
      pushed: 0,
      failed: 0,
      pending: 0
    });
  });

  // Legacy PULL endpoint - Now a no-op
  app.get('/rest/v1/sync/pull', async (request, reply) => {
    return reply.send({ 
      message: 'Cloud pull disabled. Local SQLite is the master source of truth.',
      pulled: 0,
      products: 0 
    });
  });
}
