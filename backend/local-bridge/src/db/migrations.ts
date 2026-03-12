import Database from 'better-sqlite3';

export const runMigrations = (db: Database.Database) => {
  // Force recreate triggers to ensure they are active
  

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
