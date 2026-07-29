import fs from 'fs';
import path from 'path';
import { rawDb, dbFile } from './connection.js';
import { initializeSchema } from './schema.js';
import { runMigrations } from './migrations.js';

import { createAuditRepo } from './repositories/audit.repo.js';
import { createSyncRepo } from './repositories/sync.repo.js';
import { createInvitationsRepo } from './repositories/invitations.repo.js';
import { createAuthRepo } from './repositories/auth.repo.js';
import { createStoresRepo } from './repositories/stores.repo.js';
import { createInventoryRepo } from './repositories/inventory.repo.js';
import { createSuppliersRepo } from './repositories/suppliers.repo.js';
import { createSchedulingRepo } from './repositories/scheduling.repo.js';
import { createAnalyticsRepo } from './repositories/analytics.repo.js';
import { createPurchasingRepo } from './repositories/purchasing.repo.js';
import { createDeliveriesRepo } from './repositories/deliveries.repo.js';
import { createSalesRepo } from './repositories/sales.repo.js';
import { createReplenishmentRepo } from './repositories/replenishment.repo.js';
import { createProductsRepo } from './repositories/products.repo.js';
import { createClientsRepo } from './repositories/clients.repo.js';
import { createClientServicesRepo } from './repositories/client_services.repo.js';
import { createSyncOutboxRepo } from './repositories/sync_outbox.repo.js';
import { createCashRepo } from './repositories/cash.repo.js';
import { createCashClosingsRepo } from './repositories/cash_closings.repo.js';
import { createOutboxBackfillRepo } from './repositories/outbox_backfill.repo.js';
import { createDeviceRepo, ensureDeviceIdentity } from './repositories/device.repo.js';
import { createSyncJournalRepo } from './repositories/sync_journal.repo.js';

// Everything in this module runs at IMPORT time, which in ES modules means
// before index.ts installs its uncaughtException handler and EPIPE guards.
// Anything thrown here therefore escapes completely unhandled: node prints to
// stderr and exits 1, having written nothing to backend-startup.log. This
// emergency logger exists so that class of failure leaves a trace at all.
const schemaLog = (msg: string) => {
  try {
    const dir = path.join(process.env.LOCALAPPDATA || '', 'retail-manager-logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'backend-startup.log'), `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    /* logging must never be what takes the process down */
  }
};

// 1. Initialize Schema & Migrations first!
// This ensures tables exist before repositories try to prepare statements.
let schemaInitFailed = false;
try {
  initializeSchema(rawDb);
  runMigrations(rawDb);
  // Must run inside this guarded block and immediately after the schema: it
  // creates this installation's device_id and backfills it onto the existing
  // sync_outbox backlog. Every outbox emit and every journal write reads it,
  // so a failure here has to be reported with the same prominence as a
  // failed ALTER TABLE rather than surfacing later as anonymous writes.
  ensureDeviceIdentity(rawDb);
} catch (e) {
  // This used to be console.error only, which on a packaged Windows build
  // goes to a stdout nobody captured - so a half-applied schema was completely
  // invisible. It matters far more than it looks: initializeSchema() is what
  // runs the ~50 ensureColumn() ALTER TABLE backfills that bring an older
  // database up to the current shape. If it throws PART WAY through, every
  // backfill after the failure point silently never runs, and we continue
  // below to build the repositories against a database that is now missing
  // columns the code assumes exist.
  schemaInitFailed = true;
  schemaLog(`CRITICAL: schema initialization/migration failed: ${e}`);
  console.error('[DB] Initialization failed:', e);
}

// 2. Repositories. Several of these (sales.repo and friends) call
// db.prepare() at FACTORY level, i.e. right here at import time, not lazily
// inside their methods. A prepare() against a missing table or column throws
// SqliteError immediately - unhandled, before any logging exists - so the
// whole backend dies with "spawned successfully / exited with status 1" and
// an empty startup log. Confirmed reproducible: running current repositories
// against an older database fails with
//   SqliteError: table sales has no column named client_id
//       at createSalesRepo (...)  at db/index.js  <- module load
// Catching it here cannot make the query work, but it converts a silent,
// undiagnosable process death into a precise statement of which column is
// missing - which is the difference between a five minute fix and a day of
// guessing.
const buildRepos = () => ({
  db: rawDb,
  dbFile,
  initialize: () => initializeSchema(rawDb),
  migrate: () => runMigrations(rawDb),

  ...createAuditRepo(rawDb),
  ...createSyncRepo(rawDb),
  ...createInvitationsRepo(rawDb),
  ...createAuthRepo(rawDb),
  ...createStoresRepo(rawDb),
  ...createInventoryRepo(rawDb),
  ...createSuppliersRepo(rawDb),
  ...createSchedulingRepo(rawDb),
  ...createAnalyticsRepo(rawDb),
  ...createPurchasingRepo(rawDb),
  ...createDeliveriesRepo(rawDb),
  ...createSalesRepo(rawDb),
  ...createReplenishmentRepo(rawDb),
  ...createProductsRepo(rawDb),
  ...createClientsRepo(rawDb),
  ...createClientServicesRepo(rawDb),
  ...createSyncOutboxRepo(rawDb),
  ...createCashRepo(rawDb),
  ...createCashClosingsRepo(rawDb),
  ...createOutboxBackfillRepo(rawDb),
  ...createDeviceRepo(rawDb),
  ...createSyncJournalRepo(rawDb),
});

let db: ReturnType<typeof buildRepos>;
try {
  db = buildRepos();
} catch (e) {
  const detail = e instanceof Error ? e.message : String(e);
  schemaLog(
    `CRITICAL: could not prepare database statements: ${detail}\n` +
      `  This almost always means the database on this machine predates the ` +
      `current app version and is missing a column or table the code expects ` +
      `("table X has no column named Y" above says exactly which).\n` +
      (schemaInitFailed
        ? `  Schema initialization ALSO failed earlier this run - see the line ` +
          `above - so the ALTER TABLE backfills that would have added it never ` +
          `completed. Fix that error first; this one is its consequence.\n`
        : `  Schema initialization reported success, so the missing column has ` +
          `no ensureColumn() backfill in schema.ts. Add one there.\n`) +
      `  A copy of the database from just before this run is in the backups ` +
      `folder next to it - nothing has been modified or deleted.`
  );
  throw e;
}

export { db, rawDb };
export * from './types.js';
