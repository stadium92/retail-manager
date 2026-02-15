import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { authenticateRequest } from './utils/auth.js';

export async function registerSystemRoutes(app: FastifyInstance) {
  app.post('/rest/v1/system/repair-db', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    try {
      console.log('[System] Running DB Integrity Check...');
      // better-sqlite3 pragma execution
      const integrity = db.db.pragma('integrity_check');
      console.log('[System] Integrity Result:', integrity);
      
      console.log('[System] Vacuuming...');
      db.db.exec('VACUUM;');
      
      return reply.send({ 
        success: true, 
        message: 'Database optimized and verified.', 
        integrity 
      });
    } catch (error) {
      console.error('[System] DB Repair Failed:', error);
      return reply.status(500).send({ 
        error: 'RepairFailed', 
        message: 'Failed to repair database. Physical corruption may require file deletion.' 
      });
    }
  });
}
