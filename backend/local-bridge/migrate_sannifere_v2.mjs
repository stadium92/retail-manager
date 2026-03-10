
import Database from 'better-sqlite3';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = '/Users/mohamedcoulibaly/Library/Application Support/Retail Manager/data/localbridge.sqlite';
const PRODUCTS_CSV = '/Users/mohamedcoulibaly/Downloads/SANNIFERE_EXTRACTED_DATA/SANNIFERE_EXPORTED_DATA/products.csv';
const CLIENTS_CSV = '/Users/mohamedcoulibaly/Downloads/SANNIFERE_EXTRACTED_DATA/SANNIFERE_EXPORTED_DATA/clients.csv';
const STORE_ID = '6d1d135d-7230-480a-90e5-aac372a7bf84'; // Magasin principal

const db = new Database(DB_PATH);
const now = new Date().toISOString();

console.log('--- STARTING CLEAN HIERARCHICAL MIGRATION ---');

// 1. Load Backup Data
const productsRaw = fs.readFileSync(PRODUCTS_CSV, 'utf-8');
const products = parse(productsRaw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
});

// Maps to keep track of created IDs
const familyMap = new Map(); // name -> id (Parent)
const categoryMap = new Map(); // parentId:childName -> id (Child)

db.transaction(() => {
    // Clear previously migrated products/families to avoid duplicates and fix hierarchy
    // ONLY for our migrated records (those not in the original 16)
    // Actually, for safety on a live app, we will use "INSERT OR IGNORE" and updates.
    
    console.log('Processing Hierarchical Families...');

    for (const p of products) {
        let parentName = p.FAMILLE || 'GENERAL';
        let childName = p.CATEGORIE || '';

        // Handle case where FAMILLE is empty but CATEGORIE exists
        if (!p.FAMILLE && p.CATEGORIE) {
            parentName = p.CATEGORIE;
            childName = '';
        }

        // 1. Create Parent (FAMILLE)
        if (!familyMap.has(parentName)) {
            let parentId;
            const existing = db.prepare('SELECT id FROM product_families WHERE name = ? AND store_id = ? AND parent_id IS NULL').get(parentName, STORE_ID);
            
            if (existing) {
                parentId = existing.id;
            } else {
                parentId = uuidv4();
                db.prepare(`
                    INSERT INTO product_families (id, store_id, name, parent_id, created_at, updated_at)
                    VALUES (?, ?, ?, NULL, ?, ?)
                `).run(parentId, STORE_ID, parentName, now, now);
            }
            familyMap.set(parentName, parentId);
        }

        const parentId = familyMap.get(parentName);
        let finalFamilyId = parentId;

        // 2. Create Child (CATEGORIE) if it exists and is different from Parent
        if (childName && childName !== parentName) {
            const key = `${parentId}:${childName}`;
            if (!categoryMap.has(key)) {
                let childId;
                const existingChild = db.prepare('SELECT id FROM product_families WHERE name = ? AND parent_id = ? AND store_id = ?').get(childName, parentId, STORE_ID);
                
                if (existingChild) {
                    childId = existingChild.id;
                } else {
                    childId = uuidv4();
                    db.prepare(`
                        INSERT INTO product_families (id, store_id, name, parent_id, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).run(childId, STORE_ID, childName, parentId, now, now);
                }
                categoryMap.set(key, childId);
            }
            finalFamilyId = categoryMap.get(key);
        }

        // 3. Inject/Update Product
        // We use INSERT OR REPLACE to ensure the new hierarchy is applied
        db.prepare(`
            INSERT INTO products (
                id, store_id, name, barcode, cost_price, unit_price, 
                selling_price_2, selling_price_3, selling_price_4,
                quantity, min_quantity, low_stock_threshold,
                category, packaging, created_at, updated_at, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(id) DO UPDATE SET
                category = excluded.category,
                name = excluded.name,
                unit_price = excluded.unit_price,
                cost_price = excluded.cost_price,
                quantity = excluded.quantity
        `).run(
            // We need a stable ID for the product based on its legacy CODE_PROD 
            // to avoid duplicates if we run this multiple times.
            // Sannifere CODE_PROD is unique. We'll use a deterministic UUID or prefix it.
            `sannifere-p-${p.CODE_PROD}`, 
            STORE_ID,
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
            finalFamilyId,
            p.UNITE || '1',
            now,
            now
        );
    }
})();

console.log('Migration Completed with Hierarchical Families!');
console.log(`- Parent Families: ${familyMap.size}`);
console.log(`- Sub-Categories: ${categoryMap.size}`);
db.close();
