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

const db = {
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
};

// Auto-initialize on import (simulating class constructor behavior)
// Though constructor logic was "new LocalBridgeDatabase()" at the end of db.ts
// connection.ts does "new Database()"
// We need to run initialize() and migrate() once.
// Ideally, the app entry point should call this, but for backward compatibility, 
// we can run it here or assume connection.ts setup is enough + db.ts constructor behavior.
// The old db.ts constructor called initialize() and migrate().
// So we should call them.

try {
  initializeSchema(rawDb);
  runMigrations(rawDb);
} catch (e) {
  console.error('[DB] Initialization failed:', e);
}

export { db };
export * from './types.js';
