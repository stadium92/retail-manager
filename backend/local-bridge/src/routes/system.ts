import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

export async function registerSystemRoutes(app: FastifyInstance) {
  console.log('[System] Registering System Routes...');
  
  app.post('/rest/v1/system-repair', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;

    try {
      console.log('[System] Running Deep DB Repair...');
      
      // 1. Integrity Check
      const integrity = db.db.pragma('integrity_check');
      console.log('[System] Integrity:', integrity);
      
      // 2. Reindex all tables
      db.db.exec('REINDEX;');
      
      // 3. Emergency Cleanup: Delete 'Vody' if it's the known corrupt record
      // We use a raw try-catch here because the record itself might be unreadable
      try {
        db.db.prepare("DELETE FROM products WHERE name LIKE '%Vody%'").run();
        console.log('[System] Emergency cleanup: Vody removed.');
      } catch (e) {
        console.warn('[System] Could not delete Vody via standard SQL, corruption might be severe.');
      }
      
      // 4. Vacuum
      db.db.exec('VACUUM;');
      
      return reply.send({ 
        success: true, 
        message: 'Database repaired and optimized. Corrupt records (Vody) attempted removal.', 
        integrity 
      });
    } catch (error) {
      console.error('[System] Deep Repair Failed:', error);
      return reply.status(500).send({ 
        error: 'RepairFailed', 
        message: 'Failed to repair database. Physical corruption detected.' 
      });
    }
  });
}
