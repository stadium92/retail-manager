
import Database from 'better-sqlite3';

const DB_PATH = '/Users/mohamedcoulibaly/Library/Application Support/Retail Manager/data/localbridge.sqlite';
const db = new Database(DB_PATH);

console.log('--- STARTING CLEAN SLATE OPERATION ---');
console.log('Preserving: Users, Roles, Stores, and Sessions.');
console.log('Wiping: Products, Families, Clients, Suppliers, Sales, and Logs...');

const tablesToWipe = [
    'products',
    'product_families',
    'clients',
    'client_services',
    'suppliers',
    'sales',
    'sale_items',
    'purchase_orders',
    'purchase_items',
    'supplier_payments',
    'inventory_movements',
    'product_batches',
    'cash_transactions',
    'cash_closings',
    'sync_outbox',
    'sync_state',
    'audit_logs',
    'pending_mutations',
    'replenishment_requests',
    'scheduled_orders',
    'scheduled_order_items',
    'deliveries',
    'worker_invitations'
];

db.transaction(() => {
    for (const table of tablesToWipe) {
        try {
            db.prepare(`DELETE FROM ${table}`).run();
            console.log(`- Cleared: ${table}`);
        } catch (e) {
            console.log(`- Skipped: ${table} (Not found or error)`);
        }
    }

    // Rebuild FTS5 Virtual Table for products to clear search index
    try {
        db.prepare(`INSERT INTO products_fts(products_fts) VALUES('rebuild')`).run();
        console.log('- Rebuilt: products_fts index');
    } catch (e) {
        console.log('- Skipped: products_fts (Not found)');
    }
})();

console.log('--- CLEAN SLATE COMPLETE ---');
console.log('Ready for fresh migration.');
db.close();
