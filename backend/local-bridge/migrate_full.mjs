import Database from 'better-sqlite3';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

// PATHS - Update these if running on Windows
const DB_PATH = process.platform === 'darwin' 
    ? `/Users/${process.env.USER}/Library/Application Support/Retail Manager/data/localbridge.sqlite`
    : `${process.env.APPDATA}/Retail Manager/data/localbridge.sqlite`;

const PRODUCTS_CSV = './data/products.csv';
const CLIENTS_CSV = './data/clients.csv';

const db = new Database(DB_PATH);
const now = new Date().toISOString();

// Identify Store ID
const store = db.prepare("SELECT id FROM stores WHERE name LIKE '%principal%' OR name LIKE '%Demo%' LIMIT 1").get();
const STORE_ID = store ? store.id : null;

if (!STORE_ID) {
    console.error('ERROR: Could not find a Store ID. Please create a store in the app first.');
    process.exit(1);
}

console.log(`Starting Migration into Store: ${STORE_ID}`);

db.transaction(() => {
    // 1. Schema Fixes
    try {
        db.exec(`
            ALTER TABLE product_families ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
            ALTER TABLE product_families ADD COLUMN deleted_at TEXT;
            ALTER TABLE suppliers ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
            ALTER TABLE suppliers ADD COLUMN deleted_at TEXT;
        `);
    } catch (e) {}

    // 2. Families & Products
    const products = parse(fs.readFileSync(PRODUCTS_CSV, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });
    const familyMap = new Map();
    const supplierMap = new Map();

    for (const p of products) {
        // Family Hierarchy
        let parentName = p.FAMILLE || p.CATEGORIE || 'GENERAL';
        if (!familyMap.has(parentName)) {
            const id = uuidv4();
            db.prepare("INSERT OR IGNORE INTO product_families (id, store_id, name, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").run(id, STORE_ID, parentName, now, now);
            const row = db.prepare("SELECT id FROM product_families WHERE name = ?").get(parentName);
            familyMap.set(parentName, row.id);
        }

        // Supplier Extraction
        const brand = (p.FORMES || '').trim();
        if (brand && !supplierMap.has(brand)) {
            const id = uuidv4();
            db.prepare("INSERT OR IGNORE INTO suppliers (id, store_id, name, balance, version, created_at, updated_at) VALUES (?, ?, ?, 0, 1, ?, ?)").run(id, STORE_ID, brand, now, now);
            supplierMap.set(brand, id);
        }

        // Product Injection
        db.prepare(`
            INSERT INTO products (id, store_id, name, sku, barcode, cost_price, unit_price, selling_price_2, selling_price_3, selling_price_4, quantity, min_quantity, low_stock_threshold, category, brand, packaging, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(`sannifere-p-${p.CODE_PROD}`, STORE_ID, p.DESIGNA, p.CODE_PROD, p.CODECIP || null, parseFloat(p.PRIX_GROS)||0, parseFloat(p.PRIX_PUB)||0, parseFloat(p.PRIX_2)||0, parseFloat(p.PRIX_3)||0, parseFloat(p.PRIX_4)||0, parseFloat(p.QTE_STOCK)||0, parseFloat(p.STOCK_MINI)||0, parseFloat(p.STOCK_MINI)||0, familyMap.get(parentName), brand, p.UNITE, now, now);
    }

    // 3. Clients
    const clients = parse(fs.readFileSync(CLIENTS_CSV, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });
    for (const c of clients) {
        if (!c.NOM) continue;
        db.prepare("INSERT OR IGNORE INTO clients (id, store_id, name, code, phone, credit_limit, current_balance, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").run(uuidv4(), STORE_ID, c.NOM, c.CODE_CLI, c.TEL, parseFloat(c.LIMITE)||0, parseFloat(c.SOLDE)||0, now, now);
    }

    db.prepare("INSERT INTO products_fts(products_fts) VALUES('rebuild')").run();
})();

console.log('Migration Successfully Finished!');
