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

// 1. Initialize Schema & Migrations first! 
// This ensures tables exist before repositories try to prepare statements.
try {
  initializeSchema(rawDb);
  runMigrations(rawDb);
} catch (e) {
  console.error('[DB] Initialization failed:', e);
}

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
  ...createSyncOutboxRepo(rawDb),
  ...createCashRepo(rawDb),
};

export { db };
export * from './types.js';
