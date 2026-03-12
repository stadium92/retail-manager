
import Database from 'better-sqlite3';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = '/Users/mohamedcoulibaly/Library/Application Support/Retail Manager/data/localbridge.sqlite';
const PRODUCTS_CSV = '/Users/mohamedcoulibaly/Downloads/SANNIFERE_EXTRACTED_DATA/SANNIFERE_EXPORTED_DATA/products.csv';
const STORE_ID = '6d1d135d-7230-480a-90e5-aac372a7bf84'; // Magasin principal

const db = new Database(DB_PATH);
const now = new Date().toISOString();

console.log('--- STARTING FINAL SUPPLIER & PRODUCT UPDATE ---');

// 1. Prepare Suppliers Table Schema for Master Visibility
console.log('Ensuring Supplier schema is ready...');
try {
    db.exec(`
        ALTER TABLE suppliers ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE suppliers ADD COLUMN deleted_at TEXT;
    `);
} catch (e) {
    // Columns might already exist
}

// 2. Load Products Data
const productsRaw = fs.readFileSync(PRODUCTS_CSV, 'utf-8');
const products = parse(productsRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
});

// 3. Extract and Inject Unique Suppliers (from FORMES)
const supplierMap = new Map(); // BrandName -> supplierId

db.transaction(() => {
    console.log('Migrating Suppliers from brands (FORMES)...');
    
    for (const p of products) {
        const brandName = (p.FORMES || '').trim();
        if (!brandName) continue;

        if (!supplierMap.has(brandName)) {
            let supplierId;
            const existing = db.prepare('SELECT id FROM suppliers WHERE name = ? AND store_id = ?').get(brandName, STORE_ID);
            
            if (existing) {
                supplierId = existing.id;
            } else {
                supplierId = uuidv4();
                db.prepare(`
                    INSERT INTO suppliers (id, store_id, name, balance, version, created_at, updated_at)
                    VALUES (?, ?, ?, 0, 1, ?, ?)
                `).run(supplierId, STORE_ID, brandName, now, now);
            }
            supplierMap.set(brandName, supplierId);
        }

        // Update the product's Brand field to link it to the supplier for filtering
        const supplierId = supplierMap.get(brandName);
        db.prepare(`
            UPDATE products SET brand = ? WHERE name = ? AND store_id = ?
        `).run(brandName, p.DESIGNA, STORE_ID);
    }
})();

console.log('Final Migration Complete!');
console.log(`- Unique Suppliers Added/Verified: ${supplierMap.size}`);
db.close();
