
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = '/Users/mohamedcoulibaly/Library/Application Support/Retail Manager/data/localbridge.sqlite';
const STORE_ID = '6d1d135d-7230-480a-90e5-aac372a7bf84'; // Magasin principal
const db = new Database(DB_PATH);
const now = new Date().toISOString();

console.log('--- ADDING CLIENT SERVICES ---');

const serviceId = uuidv4();
const serviceName = 'Clientèle Standard (CLTS)';

db.transaction(() => {
    // 1. Add the CLTS service if it doesn't exist
    const existing = db.prepare('SELECT id FROM client_services WHERE name = ? AND store_id = ?').get(serviceName, STORE_ID);
    
    let finalServiceId;
    if (existing) {
        finalServiceId = existing.id;
        console.log(`- Service "${serviceName}" already exists.`);
    } else {
        finalServiceId = serviceId;
        db.prepare(`
            INSERT INTO client_services (id, store_id, name, default_discount_percent, description, version, created_at, updated_at)
            VALUES (?, ?, ?, 0, 'Service par défaut de Sannifere', 1, ?, ?)
        `).run(finalServiceId, STORE_ID, serviceName, now, now);
        console.log(`- Added Service: ${serviceName}`);
    }

    // 2. Link all existing Sannifere clients to this service
    const updateResult = db.prepare(`
        UPDATE clients 
        SET service_id = ?, version = 1, deleted_at = NULL 
        WHERE store_id = ? AND (service_id IS NULL OR service_id = '')
    `).run(finalServiceId, STORE_ID);
    
    console.log(`- Updated ${updateResult.changes} clients to use "${serviceName}".`);
})();

console.log('--- CLIENT SERVICES UPDATE COMPLETE ---');
db.close();
