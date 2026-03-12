# DeepSearch Prompt for Retail POS Project Audit

**Instructions**: Copy the entire content below and paste it into OpenAI's DeepSearch (o1) model.

---

**Role**: You are a 10x Full Stack Developer and DevOps Expert with 20 years of experience in building high-frequency retail systems. You have conducted extensive user research with 4+ Store Owners and 50+ Tellers. You prioritize solidity, performance on constrained hardware, and security.

**Goal**: Conduct a deep technical audit of my "Retail Manager" POS application. Identify architectural flaws, performance bottlenecks for low-end hardware, and security gaps in the Offline-First implementation.

**Hardware Constraint (CRITICAL)**:
The application MUST run comfortably on an **Intel Dual Core CPU with 2.5GB of RAM** on Windows 10. Every architectural decision must respect this constraint.

**Project Context**:
- **Type**: Retail POS (Point of Sale) & Management System.
- **Architecture**: Hybrid Offline-First (LocalBridge + Supabase).
- **Frontend**: React (Vite), Electron, Tailwind, Shadcn UI.
- **Backend (Cloud)**: Supabase (Postgres).
- **Backend (Local)**: Node.js "LocalBridge" with SQLite (Fastify).
- **State Management**: Zustand (`useSalesStore`, `useMasterDataStore`).

## 1. Project Structure (Detailed)

### Frontend (`frontend/src`)
```
src/
├── components/
│   ├── worker/
│   │   ├── Modules/ (Feature Modules)
│   │   │   ├── SalesModule.tsx (Core POS Interface -> "Ventes")
│   │   │   ├── StockModule.tsx (Inventory -> "Stock")
│   │   │   ├── ReceptionAchatsModule.tsx (Purchasing -> "Reception")
│   │   │   ├── EditionModule.tsx (Reporting -> "Edition")
│   │   │   ├── FacturationModule.tsx (Invoicing)
│   │   │   └── FicheProduitsModule.tsx (Product Management)
│   │   └── Sales/ (Grid Components)
│   │       ├── SanifereGrid.tsx (Heavy Data Grid)
│   │       └── ...
├── services/ (Offline-First Layer)
│   ├── LocalBridgeSyncService.ts
│   ├── LocalDatabase.ts
│   ├── OfflineSalesService.ts
│   ├── OfflineDataService.ts (Unified Data Access for Reporting)
│   └── ...
```

## 2. Key Code Snippets

### A. Frontend: `SalesModule.tsx` (Input Source: "Ventes")
*Responsible for creating sales. Data flow starts here.*
```typescript
export function SalesModule({ storeId, mode }: SalesModuleProps) {
  // ...
  // When a sale is completed, it's saved via OfflineSalesService
  // This triggers a write to 'sales' table in LocalDB
}
```

### B. Frontend: `EditionModule.tsx` (Output Sink: "Edition/Suivi des Ventes")
*Responsible for aggregating and displaying sales data. Data flow ends here.*
```typescript
export function EditionModule({ storeId, mode }: EditionModuleProps) {
  // Mode: "suivi-ventes-jour" (Daily Sales Tracking)
  useEffect(() => {
    const fetchData = async () => {
      // Fetches aggregated data from LocalDB (and Cloud if online)
      const salesData = await OfflineDataService.getSales(storeId, dateRange.from, dateRange.to);
      setSales(salesData);
    }
  }, [mode, dateRange]);
}
```

### C. Frontend: `OfflineDataService.ts` ( The Bridge Driver)
*This service must accurately merge Local (incomplete sync) and Cloud data.*
```typescript
class OfflineDataServiceClass {
  async getSales(storeId: string, dateFrom?: Date, dateTo?: Date) {
    // 1. Get Local Sales (Dexie)
    const localSales = await LocalDatabase.getSales(storeId);
    
    // 2. Transform to UI format
    let sales = localSales.map(sale => ({ ... }));

    // 3. If Online, fetch from Supabase and MERGE?
    if (navigator.onLine) {
        // ... (Potential conflict if not de-duplicated correctly)
    }
    return sales;
  }
}
```

### D. Frontend: `SanifereGrid.tsx` (Heavy UI Component)
*Note: This component handles potentially 200+ rows and needs to be smooth on 2GB RAM.*
```typescript
export function SanifereGrid({
  items,
  selectedIndex,
  // ... callbacks
  persistenceKey,
}: SanifereGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Custom Persistence for Column Widths
  const [colWidths, setColWidths] = useState(() => {
    if (persistenceKey) {
      try {
        const saved = localStorage.getItem(`grid_widths_${persistenceKey}`);
        if (saved) return { ...INITIAL_WIDTHS, ...JSON.parse(saved) };
      } catch (e) { console.error(e); }
    }
    return INITIAL_WIDTHS;
  });

  // Resizing Logic (Potential render bottleneck?)
  const [isResizing, setIsResizing] = useState(false);
  const startResize = (colId: keyof typeof INITIAL_WIDTHS, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    // ... extensive mouse move listeners
  };
}
```

### C. Frontend: `OfflineSalesService.ts` (Sync Strategy)
```typescript
export class OfflineSalesService {
    static async createSale(payload: CreateSalePayload) {
        const saleId = crypto.randomUUID();
        // 1. Save to LocalDB immediately (Optimistic UI)
        await LocalDatabase.init();
        await LocalDatabase.saveSale(localSale);

        // 2. Try to sync if online
        if (navigator.onLine) {
            if (useLocalBridge) {
                // Sync to Local Node.js Backend
                const response = await fetch(`${localBridgeBaseUrl}/rest/v1/sales`, { ... });
                if (response.ok) {
                    await LocalDatabase.markSaleSynced(saleId);
                    return { data: { id: saleId }, error: null };
                }
            } else {
                // Direct to Supabase (Cloud)
                const { error } = await this.syncSaleToSupabase(localSale);
                // ...
            }
        }

        // 3. Queue for background sync if offline or failed
        await LocalDatabase.addToSyncQueue({
            id: crypto.randomUUID(),
            type: 'sale',
            data: localSale,
            // ...
        });
        return { data: { id: saleId, offline: true }, error: null };
    }
}
```

### D. Frontend: `StockModule.tsx` (Big Data Loading)
```typescript
export function StockModule({ storeId, mode }: StockModuleProps) {
  // Loading potentially thousands of products into React State
  const storeProducts = useMasterDataStore(state => state.products);

  // Filter mechanism
  useEffect(() => {
    const fetchData = async () => {
      // Mapping large arrays... is this performant?
      const offlineProducts = storeProducts
        .filter(p => p.store_id === storeId)
        .map(p => ({
            // ... transformation
        }));
      setProducts(offlineProducts);
    }
    fetchData();
  }, [storeId, storeProducts]);
}
```

### E. Backend: `index.ts` (LocalBridge Entry)
```typescript
async function start() {
  const app = Fastify({ logger: true });

  // Critical Routes for the Hybrid System
  await registerAuthRoutes(app);
  await registerProductRoutes(app); // Large payloads?
  await registerSalesRoutes(app);   // High volume writes
  await registerSyncRoutes(app);    // Bidirectional sync logic

  try {
    await app.listen({ port: env.port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
```

### F. Frontend: `useMasterDataStore.ts` (Big Data Cache)
*CRITICAL: This store holds the entire product database in RAM for offline search. Is this viable for 2.5GB RAM?*
```typescript
interface MasterDataState {
  products: ProductMaster[]; // Potential memory bloat
  clients: Client[];
  suppliers: Supplier[];
  // ...
  setProducts: (products: ProductMaster[]) => void;
}

export const useMasterDataStore = create<MasterDataState>()(
  persist(
    (set) => ({
      products: [],
      clients: [],
      // ...
    }),
    { name: 'master-data-storage' } // Persisted to localStorage
  )
);
```

### G. Backend: `schema.ts` (SQLite/Drizzle Definition)
```typescript
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  password_hash: text('password_hash').notNull(),
  // ...
});

export const product_families = sqliteTable('product_families', {
  id: text('id').primaryKey(),
  store_id: text('store_id').notNull(),
  name: text('name').notNull(),
  // ...
});
// Missing Indexes?
```

### H. Backend: `sync.ts` (The Synchronization Engine)
```typescript
// The "Pull" logic for syncing Cloud -> Local
app.get('/sync/pull', async (request, reply) => {
    // ...
    // Does this handle incremental updates or full downloads every time?
});

// The "Push" logic for syncing Local -> Cloud
app.post('/sync/push', async (request, reply) => {
    // ...
    let pending = db.listPendingMutations('pending');
    for (const mutation of pending) {
        // ...
        const res = await fetch(`${env.supabaseUrl}/rest/v1/${mutation.entity}`, {
            headers: { Prefer: 'resolution=merge-duplicates' }, // Upsert logic
            body: JSON.stringify(payload)
        });
        // ...
    }
});
```

## 3. Module Interactions & Data Flow (Feature Links)

Please analyze the integrity of the following data flows:

1.  **Sales -> Edition (Reporting)**
    *   **Source**: `SalesModule.tsx` (Vente au DÉTAIL / Gros) creates a `Sale` record via `OfflineSalesService`.
    *   **Storage**: Stored in `LocalDatabase` (IndexedDB) and pushed to `LocalBridge` (SQLite) or Supabase.
    *   **Sink**: `EditionModule.tsx` (Suivi des VENTES -> Ventes du jour) reads this via `OfflineDataService`.
    *   **Question**: Does `OfflineDataService.getSales()` correctly deduplicate records between LocalDB and Cloud? Does it handle "Pending Sync" items correctly in the daily total?

2.  **Sales -> Stock (Inventory)**
    *   **Source**: `SalesModule.tsx` commits a sale.
    *   **Effect**: Should decrease stock count in `StockModule.tsx`.
    *   **Mechanism**: Currently relies on `SyncService` or `LocalBridge` to update the `products` table.
    *   **Question**: Is there a race condition where `StockModule` shows old quantity while a sync is pending? How do we implement immediate local stock updates (Optimistic UI) safely?

3.  **Reception -> Stock (Purchasing)**
    *   **Source**: `ReceptionAchatsModule.tsx`.
    *   **Effect**: Increases stock.
    *   **Link**: Needs to update the same `products` table used by Sales.

## 4. Specific Tasks for DeepSearch

Based on the context above, provide a detailed report addressing the following, with a strict focus on the **Dual Core / 2.5GB RAM key constraint**:

1.  **Framework Migration (Electron -> Tauri)**:
    -   Electron is likely too heavy for this hardware. Please evaluate a migration to **Tauri v2**.
    -   How can we bundle the existing Node.js `LocalBridge` as a **Sidecar** in Tauri so we don't have to rewrite the backend in Rust?
    -   Quantify the expected RAM savings on Windows 10.

2.  **Eliminating In-Memory State Bloat**:
    -   `useMasterDataStore` (Zustand) currently loads ALL products into RAM to allow `.filter()` in `StockModule`. This will crash the app with large catalogs.
    -   Refactor this architecture: How do we move to a **Virtualized + SQLite Pagination** approach?
    -   Provide a pattern for connecting React components directly to `LocalDatabase` async queries for search, bypassing the giant Zustand array.

3.  **Low-End Hardware Optimization**:
    -   Beyond the framework switch, how can we optimize `SanifereGrid.tsx`?
    -   Are `useEffect` hooks filtering large arrays a bottleneck? Suggest an alternative (e.g., Worker threads or Database-side filtering).

4.  **Backend Logic & Calculation Centralization**:
    -   Currently, `SalesModule` and `EditionModule` handle logic in the UI. Move "Underlying Calculations" (Prices, Taxes, Daily Totals) to the Node.js LocalBridge.
    -   How should the backend verify these prices without breaking the "offline" capability?
    -   Suggest a robust synchronization strategy for `Sales` data that handles conflicts (e.g., two tellers selling the last item offline).

5.  **Implementation Strategy & Prompt Flow (PRD Generation)**:
    -   **PRDs**: Structure your response to act as a foundation for component-level PRDs.
    -   **Prompt Flow**: Provide a specific sequence of prompts to feed AI Coding Agents (Cursor/Windsurf) to execute the Tauri migration and Database refactor.
    -   **Lovable Integration**: How do we prompt Lovable.dev to build the "Responsive Functional Code" for the UI while respecting the breakdown of our Node.js sidecar logic?

6.  **Offline-First Security Audit**:
    -   Since data is stored locally (SQLite), how do we secure it against physical theft of the device?
    -   Review the `LocalBridge` API (Fastify). Is it exposed to the local network? How do we lock it down to ONLY the Tauri localhost?


Provide concrete code examples for your suggestions.
