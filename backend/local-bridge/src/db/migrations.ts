import Database from 'better-sqlite3';

export const runMigrations = (db: Database.Database) => {
  // sale_items_ai used to be force-recreated here too, WITHOUT the "not a
  // proforma" guard that schema.ts's initializeSchema() (which always runs
  // immediately before this, in db/index.ts) creates it with - two files
  // defining the same trigger drifted out of sync, and this one silently
  // won on every single app startup. Net effect: saving a proforma (a
  // quote, not a real sale) deducted real stock like an actual sale, with
  // no real transaction behind it - the confirmed root cause of inventory
  // "resetting" by a line item's quantity with no matching sale (and
  // double-deducting when a quote was later converted into the real
  // sale). schema.ts is now the ONLY place this trigger is defined -
  // don't add a second copy here again.

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
