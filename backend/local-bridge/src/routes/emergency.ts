import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { authenticateRequest } from './utils/auth.js';

export async function registerEmergencyRoutes(app: FastifyInstance) {
  console.log('[Emergency] Registering Emergency Routes...');

  // Simple ping to verify connectivity
  app.get('/rest/v1/emergency/ping', async () => {
    return { status: 'ok', message: 'Emergency routes are active' };
  });

  app.post('/rest/v1/system-repair', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    try {
      console.log('[System] Running Deep DB Repair...');
      db.db.exec('REINDEX;');
      db.db.pragma('integrity_check');
      
      // Force delete Vody
      try {
        db.db.prepare("DELETE FROM products WHERE name LIKE '%Vody%'").run();
        console.log('[System] Vody removed.');
      } catch (e) {}
      
      db.db.exec('VACUUM;');
      return reply.send({ success: true, message: 'Database repaired and Vody removed.' });
    } catch (error: any) {
      console.error('[System] Repair error:', error);
      return reply.status(500).send({ error: 'RepairFailed', message: error.message });
    }
  });

  app.post('/rest/v1/system-hard-reset', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    try {
      console.log('[System] HARD RESET - WIPING TABLES');
      db.db.exec('PRAGMA foreign_keys = OFF;');
      const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
      for (const table of tables) {
        if (!table.name.startsWith('sqlite_')) {
          db.db.exec(`DROP TABLE IF EXISTS ${table.name}`);
        }
      }
      db.db.exec('PRAGMA foreign_keys = ON;');
      db.initialize();
      return reply.send({ success: true, message: 'Database wiped successfully.' });
    } catch (error: any) {
      console.error('[System] Reset error:', error);
      return reply.status(500).send({ error: 'ResetFailed', message: error.message });
    }
  });
}
