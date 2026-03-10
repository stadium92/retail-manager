
import Database from 'better-sqlite3';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = '/Users/mohamedcoulibaly/Library/Application Support/Retail Manager/data/localbridge.sqlite';
const PRODUCTS_CSV = '/Users/mohamedcoulibaly/Downloads/SANNIFERE_EXTRACTED_DATA/SANNIFERE_EXPORTED_DATA/products.csv';
const CLIENTS_CSV = '/Users/mohamedcoulibaly/Downloads/SANNIFERE_EXTRACTED_DATA/SANNIFERE_EXPORTED_DATA/clients.csv';

const db = new Database(DB_PATH);

// ... (schema init removed for brevity if you want, but better to keep it for safety)

// 2. Target Existing Store
const storeId = '6d1d135d-7230-480a-90e5-aac372a7bf84'; // Magasin principal
const now = new Date().toISOString();

const existingStore = db.prepare('SELECT id FROM stores WHERE id = ?').get(storeId);
if (!existingStore) {
    console.log('Creating default store...');
    db.prepare(`
        INSERT INTO stores (id, name, address, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(storeId, 'SANNIFERE MAIN STORE', 'Bamako, Mali', '', now, now);
}

// 3. Process Products & Families
console.log('Migrating products...');
const productsRaw = fs.readFileSync(PRODUCTS_CSV, 'utf-8');
const products = parse(productsRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
});

const families = new Map();

db.transaction(() => {
    for (const p of products) {
        const familyName = p.FAMILLE || 'GENERAL';
        if (!families.has(familyName)) {
            const familyId = uuidv4();
            db.prepare(`
                INSERT OR IGNORE INTO product_families (id, store_id, name, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(familyId, storeId, familyName, now, now);
            
            // Get the ID (either the one we just inserted or the existing one)
            const row = db.prepare('SELECT id FROM product_families WHERE name = ? AND store_id = ?').get(familyName, storeId);
            families.set(familyName, row.id);
        }

        const familyId = families.get(familyName);
        const productId = uuidv4();

        db.prepare(`
            INSERT INTO products (
                id, store_id, name, barcode, cost_price, unit_price, 
                selling_price_2, selling_price_3, selling_price_4,
                quantity, min_quantity, low_stock_threshold,
                category, packaging, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            productId,
            storeId,
            p.DESIGNA,
            p.CODECIP || null,
            parseFloat(p.PRIX_GROS) || 0,
            parseFloat(p.PRIX_PUB) || 0,
            parseFloat(p.PRIX_2) || 0,
            parseFloat(p.PRIX_3) || 0,
            parseFloat(p.PRIX_4) || 0,
            parseFloat(p.QTE_STOCK) || 0,
            parseFloat(p.STOCK_MINI) || 0,
            parseFloat(p.STOCK_MINI) || 0,
            familyId,
            p.UNITE || '1',
            now,
            now
        );
    }
})();

// 4. Process Clients
console.log('Migrating clients...');
const clientsRaw = fs.readFileSync(CLIENTS_CSV, 'utf-8');
const clients = parse(clientsRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
});

db.transaction(() => {
    for (const c of clients) {
        if (!c.NOM) continue;
        const clientId = uuidv4();
        db.prepare(`
            INSERT INTO clients (
                id, store_id, name, code, phone, address, 
                credit_limit, current_balance, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            clientId,
            storeId,
            c.NOM,
            c.CODE_CLI || null,
            c.TEL || null,
            c.ADRESSE || null,
            parseFloat(c.LIMITE) || 0,
            parseFloat(c.SOLDE) || 0,
            c.OBSERV || null,
            now,
            now
        );
    }
})();

console.log('Migration completed successfully!');
db.close();
