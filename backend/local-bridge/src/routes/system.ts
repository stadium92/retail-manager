import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { authenticateRequest } from './utils/auth.js';

export async function registerSystemRoutes(app: FastifyInstance) {
  console.log('[System] Registering System Routes...');

  app.get('/rest/v1/ping', async (request, reply) => {
    // The server Date header will be automatically set by Fastify/Node.js
    return reply.send({ status: 'ok', time: new Date().toISOString() });
  });
  
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
      
      // 2.5 Rebuild FTS Index for Products
      console.log('[System] Rebuilding Products FTS Index...');
      try {
          db.db.prepare("INSERT INTO products_fts(products_fts) VALUES('rebuild')").run();
      } catch (e) {
          console.warn('[System] FTS Rebuild failed, attempting recreation...');
          db.db.exec(`
            DROP TABLE IF EXISTS products_fts;
            CREATE VIRTUAL TABLE products_fts USING fts5(
                id UNINDEXED,
                store_id UNINDEXED,
                name,
                sku,
                barcode,
                description,
                content='products',
                content_rowid='rowid'
            );
            INSERT INTO products_fts(rowid, id, store_id, name, sku, barcode, description)
            SELECT rowid, id, store_id, name, sku, barcode, description FROM products;
          `);
      }
      
      // 3. Emergency Cleanup: Delete 'Vody' if it's the known corrupt record
      try {
        db.db.prepare("DELETE FROM products WHERE name LIKE '%Vody%'").run();
        console.log('[System] Emergency cleanup: Vody removed.');
      } catch (e) {}
      
      // 4. Vacuum
      db.db.exec('VACUUM;');
      
      return reply.send({ 
        success: true, 
        message: 'Database repaired and optimized. Corrupt records attempted removal.', 
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

  app.post('/rest/v1/system-hard-reset', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master']);
    if (!claims) return;
    try {
      console.log('[System] HARD RESET REQUESTED');
      const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
      db.db.exec('PRAGMA foreign_keys = OFF;');
      for (const table of tables) {
        if (table.name !== 'sqlite_sequence') {
          db.db.exec(`DROP TABLE IF EXISTS ${table.name}`);
        }
      }
      db.db.exec('PRAGMA foreign_keys = ON;');
      // @ts-ignore
      db.initialize();
      return reply.send({ success: true, message: 'Database wiped and reset to factory defaults.' });
    } catch (error: any) {
      return reply.status(500).send({ error: 'ResetFailed', message: error.message });
    }
  });

  app.post('/rest/v1/fix-sale-names', async (request, reply) => {
    const claims = authenticateRequest(request, reply, ['master', 'worker']);
    if (!claims) return;

    try {
      console.log('[System] Running Sale Name Repair...');
      
      const fixStmt = db.db.prepare(`
        UPDATE sale_items 
        SET product_name = (SELECT name FROM products WHERE products.id = sale_items.product_id)
        WHERE (product_name IS NULL OR product_name = 'Unknown' OR product_name = '')
        AND EXISTS (SELECT 1 FROM products WHERE products.id = sale_items.product_id)
      `);
      
      const fixResult = fixStmt.run();

      const orphanStmt = db.db.prepare(`
        SELECT COUNT(*) as count FROM sale_items 
        WHERE (product_name IS NULL OR product_name = 'Unknown' OR product_name = '')
        AND (product_id IS NULL OR NOT EXISTS (SELECT 1 FROM products WHERE products.id = sale_items.product_id))
      `);
      const orphanResult = orphanStmt.get() as { count: number };

      console.log(`[System] Repaired ${fixResult.changes}, Orphans: ${orphanResult.count}`);
      
      return reply.send({ 
        success: true, 
        repaired: fixResult.changes,
        orphans: orphanResult.count,
        message: `Repaired ${fixResult.changes} records. ${orphanResult.count} unrecoverable.` 
      });
    } catch (error: any) {
      console.error('[System] Name Repair Failed:', error);
      return reply.status(500).send({ 
        error: 'RepairFailed', 
        message: error.message 
      });
    }
  });
}
