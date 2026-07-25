import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './db/index.js';

const seedConfig = {
  masterEmail: process.env.SEED_MASTER_EMAIL || 'master@offline.local',
  masterPassword: process.env.SEED_MASTER_PASSWORD || 'Password123!',
  masterName: process.env.SEED_MASTER_NAME || 'Offline Master',
  storeName: process.env.SEED_STORE_NAME || 'Demo Store',
};

const now = new Date().toISOString();
const forceSeed = process.env.SEED_FORCE === '1';

const ensureMasterAndStore = () => {
  const existingMaster = db.getMasterUser();
  if (existingMaster) {
    if (existingMaster.store_id) {
      return { userId: existingMaster.id, storeId: existingMaster.store_id, created: false };
    }

    const ownedStores = db.listStoresByOwner(existingMaster.id);
    if (ownedStores.length > 0) {
      return { userId: existingMaster.id, storeId: ownedStores[0].id, created: false };
    }
  }

  const userId = crypto.randomUUID();
  const storeId = crypto.randomUUID();

  db.insertUser({
    id: userId,
    email: seedConfig.masterEmail,
    password_hash: bcrypt.hashSync(seedConfig.masterPassword, 10),
    full_name: seedConfig.masterName,
    phone: null,
    created_at: now,
    updated_at: now,
    role: 'master',
  });

  db.insertStore({
    id: storeId,
    name: seedConfig.storeName,
    owner_id: userId,
    default_price_tier: 1,
    created_at: now,
    updated_at: now,
  });

  db.insertRole({
    id: crypto.randomUUID(),
    user_id: userId,
    role: 'master',
    store_id: storeId,
    created_at: now,
  });

  return { userId, storeId, created: true };
};

const seedFamiliesAndProducts = (storeId: string) => {
  const families = [
    { id: crypto.randomUUID(), name: 'Epicerie' },
    { id: crypto.randomUUID(), name: 'Boissons' },
    { id: crypto.randomUUID(), name: 'Hygiène' },
  ];

  families.forEach((family) => {
    db.insertProductFamily({
      id: family.id,
      store_id: storeId,
      name: family.name,
      description: null,
      parent_id: null,
      created_at: now,
      updated_at: now,
    });
  });

  const products = [
    {
      name: 'Riz local 5kg',
      sku: 'RIZ-5KG',
      unit_price: 4500,
      cost_price: 3800,
      quantity: 24,
      min_quantity: 5,
      category: families[0].id,
    },
    {
      name: 'Sucre 1kg',
      sku: 'SUCRE-1KG',
      unit_price: 850,
      cost_price: 650,
      quantity: 40,
      min_quantity: 10,
      category: families[0].id,
    },
    {
      name: 'Eau 1.5L',
      sku: 'EAU-1.5L',
      unit_price: 500,
      cost_price: 300,
      quantity: 60,
      min_quantity: 20,
      category: families[1].id,
    },
    {
      name: 'Jus Orange 1L',
      sku: 'JUS-ORANGE',
      unit_price: 1200,
      cost_price: 850,
      quantity: 30,
      min_quantity: 8,
      category: families[1].id,
    },
    {
      name: 'Savon liquide 500ml',
      sku: 'SAVON-500',
      unit_price: 1500,
      cost_price: 1000,
      quantity: 18,
      min_quantity: 4,
      category: families[2].id,
    },
  ];

  products.forEach((product) => {
    db.insertProduct({
      id: crypto.randomUUID(),
      store_id: storeId,
      name: product.name,
      sku: product.sku,
      barcode: null,
      description: null,
      cost_price: product.cost_price,
      unit_price: product.unit_price,
      wholesale_price: null,
      min_quantity: product.min_quantity,
      quantity: product.quantity,
      category: product.category,
      image_url: null,
      created_at: now,
      updated_at: now,
      created_by: null,
      updated_by: null,
    });
  });
};

// Fixtures for the Playwright E2E suite (frontend/e2e) - gated behind
// SEED_E2E=1 so normal dev seeding is untouched. Creates a fixed set of
// worker accounts directly in SQLite (not via POST /auth/workers, which
// now requires a real Supabase service key to provision - these are for
// tests that need a pre-existing worker, not for testing provisioning
// itself) plus a second store for the store-reassignment test.
const E2E_WORKER_PASSWORD = 'Password123!';
const e2eWorkers = [
  { email: 'worker.gate@e2e.local', name: 'Worker Gate' },
  { email: 'worker.promote@e2e.local', name: 'Worker Promote' },
  { email: 'worker.delete@e2e.local', name: 'Worker Delete' },
  { email: 'worker.store@e2e.local', name: 'Worker Store' },
];

const seedE2EFixtures = (ownerId: string, primaryStoreId: string) => {
  for (const w of e2eWorkers) {
    if (db.getUserByEmail(w.email)) continue;
    const userId = crypto.randomUUID();
    db.insertUser({
      id: userId,
      email: w.email,
      password_hash: bcrypt.hashSync(E2E_WORKER_PASSWORD, 10),
      full_name: w.name,
      phone: null,
      created_at: now,
      updated_at: now,
      role: 'worker',
    });
    db.insertRole({
      id: crypto.randomUUID(),
      user_id: userId,
      role: 'worker',
      store_id: primaryStoreId,
      created_at: now,
    });
  }

  const ownedStores = db.listStoresByOwner(ownerId);
  if (ownedStores.length < 2) {
    db.insertStore({
      id: crypto.randomUUID(),
      name: 'Second Store E2E',
      owner_id: ownerId,
      default_price_tier: 1,
      created_at: now,
      updated_at: now,
    });
  }

  console.log('Seeded E2E fixtures: 4 workers + a second store.');
};

const run = () => {
  const { userId, storeId, created } = ensureMasterAndStore();
  const existingProducts = db.listProducts(storeId);
  const existingFamilies = db.listProductFamilies(storeId);

  if (!forceSeed && (existingProducts.length > 0 || existingFamilies.length > 0)) {
    console.log('Seed skipped: existing data detected. Set SEED_FORCE=1 to override.');
  } else {
    seedFamiliesAndProducts(storeId);

    if (created) {
      console.log('Seeded LocalBridge with demo master account and data.');
      console.log(`Email: ${seedConfig.masterEmail}`);
      console.log(`Password: ${seedConfig.masterPassword}`);
    } else {
      console.log('Seeded LocalBridge with demo data.');
    }
  }

  if (process.env.SEED_E2E === '1') {
    seedE2EFixtures(userId, storeId);
  }
};

export const seed = run;

if (require.main === module) {
  run();
}
