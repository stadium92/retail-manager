import { rawDb } from '../src/db/connection.js';

console.log('Cleaning up unsupported sync outbox entries...');
try {
  const result = rawDb.prepare(`
    DELETE FROM sync_outbox 
    WHERE entity_type NOT IN ('product', 'sale', 'sale_item')
  `).run();
  console.log(`Deleted ${result.changes} unsupported entries.`);
} catch (e) {
  console.error('Failed to clean outbox:', e);
}
