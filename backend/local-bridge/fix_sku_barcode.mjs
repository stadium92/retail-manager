import Database from 'better-sqlite3';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const DB_PATH = '/Users/mohamedcoulibaly/Library/Application Support/Retail Manager/data/localbridge.sqlite';
const PRODUCTS_CSV = '/Users/mohamedcoulibaly/Downloads/SANNIFERE_EXTRACTED_DATA/SANNIFERE_EXPORTED_DATA/products.csv';
const STORE_ID = '6d1d135d-7230-480a-90e5-aac372a7bf84';

const db = new Database(DB_PATH);

const productsRaw = fs.readFileSync(PRODUCTS_CSV, 'utf-8');
const products = parse(productsRaw, { columns: true, skip_empty_lines: true, trim: true, bom: true });

db.transaction(() => {
    console.log('Fixing SKU/Barcode mapping...');
    for (const p of products) {
        db.prepare(`
            UPDATE products 
            SET sku = ?, barcode = ?
            WHERE id = ? AND store_id = ?
        `).run(
            p.CODE_PROD || null,  // Original Sannifere Reference goes to SKU
            p.CODECIP || null,    // Barcode goes to BARCODE
            `sannifere-p-${p.CODE_PROD}`,
            STORE_ID
        );
    }
    // Rebuild FTS5 for correct search
    db.prepare("INSERT INTO products_fts(products_fts) VALUES('rebuild')").run();
})();

console.log('SKU and Barcode fields have been separated and fixed!');
db.close();
