import Database from 'better-sqlite3';

export const runMigrations = (db: Database.Database) => {
  // Force recreate triggers to ensure they are active
  try {
    db.exec('DROP TRIGGER IF EXISTS sale_items_ai;');
    db.exec(`
      CREATE TRIGGER sale_items_ai AFTER INSERT ON sale_items
      BEGIN
        UPDATE products
        SET quantity = quantity - new.quantity
        WHERE id = new.product_id;
      END;
    `);
    console.log('[DB] Trigger sale_items_ai recreated.');
  } catch (e) {
    console.warn('[DB] Trigger migration failed:', e);
  }

  // Migration for existing audit_logs table
  try {
    db.exec(`ALTER TABLE audit_logs ADD COLUMN severity TEXT DEFAULT 'INFO';`);
  } catch (err) {
    // ignore if column exists
  }
  try {
    db.exec(`ALTER TABLE audit_logs ADD COLUMN app_version TEXT;`);
  } catch (err) {
    // ignore if column exists
  }
};
