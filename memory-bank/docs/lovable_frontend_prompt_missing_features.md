# Lovable.dev Frontend Prompt: Complete Missing Master Interface Features

## Project Context

You are building on an **existing React + TypeScript + Supabase retail management application**. The following is already implemented:

### ✅ Already Built (DO NOT REBUILD)
- **Authentication System**: Complete with role-based access control (`AuthContext`, `ProtectedRoute`)
- **Routing**: React Router with protected routes (`/master/dashboard`, `/worker/dashboard`, `/deliverer/dashboard`, `/customer/browse`)
- **Basic Master Dashboard**: Dashboard with metrics, AI tabs (ChatView, SuggestionsPanel)
- **Worker Interface**: Complete with sales entry, inventory view, delivery status
- **Deliverer Interface**: Complete with delivery management
- **Customer Interface**: Basic product browsing
- **Services**: `StoreService`, `InventoryService`, `SalesService` with full CRUD methods
- **UI Components**: shadcn/ui components library installed
- **Types**: TypeScript types defined in `src/types/index.ts`
- **Access Control**: Role-based access control utilities in `src/utils/accessControl.ts`

### 🎯 What You Need to Build

**Complete the Master Interface** by adding the following missing management pages and features:

1. **Store Management UI** - Full CRUD interface for managing stores
2. **Inventory Management UI** - Full CRUD interface for managing inventory items
3. **Sales Management UI** - View, filter, edit, and delete sales
4. **Worker Management UI** - Create, edit, assign, and manage workers
5. **Deliverer Management UI** - Create, edit, assign, and manage deliverers
6. **Delivery Dashboard** - View all deliveries, assign to deliverers, track status
7. **Analytics Dashboard** - Charts, reports, worker performance metrics
8. **Navigation Structure** - Sidebar or navigation menu linking all pages

---

## Technical Stack & Architecture

### Existing Stack
- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Context API (`AuthContext`)
- **Routing**: React Router v6
- **Backend**: Supabase (PostgreSQL)
- **API Pattern**: Service classes with static methods (`StoreService`, `InventoryService`, `SalesService`)
- **UI Library**: shadcn/ui (already installed)
- **Icons**: Lucide React
- **Forms**: React Hook Form (if needed)

### File Structure (Existing)
```
src/
├── components/
│   ├── master/
│   │   ├── Dashboard/
│   │   │   ├── DashboardView.tsx (✅ exists)
│   │   │   └── MetricCard.tsx (✅ exists)
│   │   └── AI/
│   │       ├── ChatView.tsx (✅ exists)
│   │       ├── SuggestionsPanel.tsx (✅ exists)
│   │       └── DataCollectionProgress.tsx (✅ exists)
│   ├── worker/ (✅ exists)
│   ├── deliverer/ (✅ exists)
│   ├── customer/ (✅ exists)
│   └── ui/ (✅ shadcn/ui components)
├── services/
│   ├── StoreService.ts (✅ exists - has getStores, createStore, updateStore, deleteStore)
│   ├── InventoryService.ts (✅ exists - has getInventory, createItem, updateItem, deleteItem)
│   ├── SalesService.ts (✅ exists - has getSales, createSale, updateSale, deleteSale, getSalesMetrics)
│   └── OfflineManager.ts (✅ exists)
├── contexts/
│   └── AuthContext.tsx (✅ exists - provides useAuth hook)
├── pages/
│   └── master/
│       └── Dashboard.tsx (✅ exists)
├── types/
│   └── index.ts (✅ exists - has Store, InventoryItem, Sale, UserRole types)
└── utils/
    └── accessControl.ts (✅ exists)
```

### Service Methods Available

**StoreService:**
- `getStores()` - Get all stores
- `getStore(id)` - Get single store
- `createStore(store)` - Create store
- `updateStore(id, updates)` - Update store
- `deleteStore(id)` - Delete store

**InventoryService:**
- `getInventory(storeId?)` - Get inventory (optionally filtered by store)
- `getItem(id)` - Get single item
- `createItem(item)` - Create inventory item
- `updateItem(id, updates)` - Update item
- `deleteItem(id)` - Delete item
- `getLowStockItems(storeId?)` - Get low stock items

**SalesService:**
- `getSales(storeId?, limit?)` - Get sales (with details including worker, item, store)
- `getSale(id)` - Get single sale with details
- `createSale(sale)` - Create sale
- `updateSale(id, updates)` - Update sale
- `deleteSale(id)` - Delete sale
- `getSalesMetrics(storeId?)` - Get today/week/month sales totals

---

## Feature Requirements

### 1. Store Management UI

**Route**: `/master/stores`

**Requirements:**
- **List View**: Display all stores in a table/card grid
  - Store name, address, phone, status (active/inactive)
  - Actions: Edit, Delete, View Details
- **Create Store Form**: Modal or separate page
  - Fields: name, address, phone, email, description
  - Owner is automatically set to current user (from `useAuth`)
- **Edit Store Form**: Modal or separate page
  - Pre-populate with existing data
  - Same fields as create
- **Delete Confirmation**: Dialog before deletion
- **Multi-Store Selector**: If user has multiple stores, show dropdown in header to switch active store
- **Store Details View**: View store information, associated workers, deliverers, recent sales

**Design:**
- Use shadcn/ui Table component for list
- Use Dialog/Sheet for forms
- Mobile-responsive (cards on mobile, table on desktop)
- Follow existing design patterns from DashboardView

**Implementation:**
```typescript
// Use existing StoreService methods
import { StoreService } from '@/services/StoreService';
import { useAuth } from '@/contexts/AuthContext';

// Example structure:
// - StoresList component (table/cards)
// - StoreForm component (create/edit)
// - StoreDeleteDialog component
// - StoreDetailsView component (optional)
```

---

### 2. Inventory Management UI

**Route**: `/master/inventory`

**Requirements:**
- **List View**: Display all inventory items
  - Item name, category, quantity, price, low stock indicator
  - Filter by store (if multi-store)
  - Search by name
  - Sort by name, quantity, price
- **Create Item Form**: Modal or separate page
  - Fields: name, description, category, quantity, price, cost, low_stock_threshold, store_id
  - Category dropdown (fetch from categories table or use text input)
- **Edit Item Form**: Pre-populated with existing data
- **Delete Confirmation**: Dialog before deletion
- **Bulk Operations**: Select multiple items for bulk update (quantity, price)
- **Low Stock Alerts**: Highlight items with quantity <= low_stock_threshold
- **Categories Management**: Separate section or modal to manage categories

**Design:**
- Use shadcn/ui Table with sorting/filtering
- Color-code low stock items (red/yellow)
- Mobile-responsive
- Quick actions (edit, delete) in table row

**Implementation:**
```typescript
import { InventoryService } from '@/services/InventoryService';
import { StoreService } from '@/services/StoreService'; // For store filter

// Example structure:
// - InventoryList component
// - InventoryItemForm component
// - InventoryDeleteDialog component
// - CategoriesManager component (optional)
```

---

### 3. Sales Management UI

**Route**: `/master/sales`

**Requirements:**
- **List View**: Display all sales with details
  - Sale date, item name, quantity, total price, worker name, store name
  - Filter by: store, worker, date range, item
  - Search by customer name, item name
  - Sort by date, amount
- **Sales Details View**: View full sale details
  - All sale information
  - Associated worker, item, store
  - Edit and delete actions
- **Edit Sale Form**: Update sale details
  - Fields: item, quantity, price, customer_name, customer_phone, delivery_address
  - Pre-populate with existing data
- **Delete Confirmation**: Dialog before deletion
- **Export Functionality**: Export filtered sales to CSV/Excel
- **Sales Statistics**: Show summary cards (total sales, count, average)

**Design:**
- Use shadcn/ui Table with advanced filtering
- Date range picker for filtering
- Export button in header
- Statistics cards at top
- Mobile-responsive

**Implementation:**
```typescript
import { SalesService } from '@/services/SalesService';
import { StoreService } from '@/services/StoreService';
// Note: SalesService.getSales() returns SaleWithDetails[] with worker, item, store populated

// Example structure:
// - SalesList component
// - SalesFilters component (store, worker, date range)
// - SaleDetailsView component
// - SaleForm component (edit)
// - SalesExport component
```

---

### 4. Worker Management UI

**Route**: `/master/workers`

**Requirements:**
- **List View**: Display all workers
  - Worker name, email, assigned stores, status (active/inactive)
  - Worker performance metrics (sales count, total sales) - optional
  - Actions: Edit, Delete, Assign to Store
- **Create Worker Form**: 
  - Note: Workers are created via signup, but you can assign roles
  - Or: Create worker account form (email, password, name)
  - Assign to store(s) during creation
- **Edit Worker Form**: Update worker details, reassign stores
- **Assign to Store**: Modal to assign worker to one or more stores
- **Worker Performance View**: Show worker's sales statistics
  - Total sales, sales count, average transaction
  - Sales by date, by item
  - Performance comparison (optional)

**Design:**
- Use shadcn/ui Table
- Badge for active/inactive status
- Store chips showing assigned stores
- Performance metrics in expandable row or separate view

**Implementation:**
```typescript
// Note: Workers are stored in user_roles table with role='worker'
// You'll need to query:
// - profiles table for worker info
// - user_roles table for role and store assignments
// - sales table for performance metrics

// Example structure:
// - WorkersList component
// - WorkerForm component (create/edit)
// - WorkerAssignStoresDialog component
// - WorkerPerformanceView component
```

**Database Queries:**
```typescript
// Get all workers
const { data: workers } = await supabase
  .from('user_roles')
  .select('*, profiles(*), stores(*)')
  .eq('role', 'worker');

// Get worker performance
const { data: sales } = await supabase
  .from('sales')
  .select('*')
  .eq('worker_id', workerId);
```

---

### 5. Deliverer Management UI

**Route**: `/master/deliverers`

**Requirements:**
- **List View**: Display all deliverers
  - Deliverer name, email, phone, assigned stores, status (active/inactive)
  - Delivery statistics (total deliveries, completion rate) - optional
  - Actions: Edit, Delete, Assign to Store
- **Create Deliverer Form**:
  - Fields: name, email, phone, assign to store(s)
  - Note: Similar to workers - may need to create via signup or role assignment
- **Edit Deliverer Form**: Update deliverer details, reassign stores
- **Assign to Store**: Modal to assign deliverer to stores
- **Deliverer Performance View**: Show delivery statistics
  - Total deliveries, completion rate, average delivery time

**Design:**
- Similar to Worker Management UI
- Use shadcn/ui Table
- Performance metrics displayed

**Implementation:**
```typescript
// Similar to workers, deliverers are in user_roles with role='deliverer'
// Query user_roles, profiles, and deliveries tables

// Example structure:
// - DeliverersList component
// - DelivererForm component
// - DelivererAssignStoresDialog component
// - DelivererPerformanceView component
```

---

### 6. Delivery Dashboard

**Route**: `/master/deliveries`

**Requirements:**
- **List View**: Display all deliveries
  - Delivery ID, customer name, address, status, deliverer name, store name, date
  - Filter by: store, deliverer, status, date range
  - Search by customer name, address
  - Sort by date, status
- **Delivery Details View**: Full delivery information
  - Customer details, items, address, status history
  - Assign deliverer (if not assigned)
  - Update status (if master)
- **Assign Deliverer**: Modal to assign deliverer to delivery
- **Status Updates**: Update delivery status (assigned → picked up → in transit → delivered)
- **Delivery Statistics**: Summary cards (total, pending, in transit, delivered)
- **Map View** (Optional): Show delivery locations on map

**Design:**
- Use shadcn/ui Table
- Status badges (color-coded)
- Filter panel
- Statistics cards at top
- Mobile-responsive

**Implementation:**
```typescript
// Query deliveries table
// Join with sales, deliverers, stores, profiles

// Example structure:
// - DeliveriesList component
// - DeliveryDetailsView component
// - DeliveryAssignDialog component
// - DeliveryStatusUpdate component
// - DeliveryStatistics component
```

**Database Queries:**
```typescript
// Get all deliveries
const { data: deliveries } = await supabase
  .from('deliveries')
  .select('*, sales(*, items(*)), deliverers(*), stores(*)')
  .order('created_at', { ascending: false });
```

---

### 7. Analytics Dashboard

**Route**: `/master/analytics`

**Requirements:**
- **Charts & Visualizations**:
  - Sales trend chart (daily, weekly, monthly) - Line chart
  - Sales by worker - Bar chart or Pie chart
  - Sales by item - Bar chart
  - Sales by store (if multi-store) - Bar chart
  - Revenue over time - Area chart
- **Worker Performance Table**:
  - Worker name, total sales, sales count, average transaction
  - Weighted average performance (if applicable)
  - Sortable columns
  - Filter by date range
- **Reports**:
  - Daily report
  - Weekly report
  - Monthly report
  - Custom date range report
- **Export**: Export reports to PDF/CSV
- **Date Range Selector**: Filter all analytics by date range

**Design:**
- Use Recharts or Chart.js (check if installed, if not use shadcn/ui chart component)
- Grid layout with multiple chart cards
- Responsive charts
- Export buttons

**Implementation:**
```typescript
// Use SalesService.getSalesMetrics() and SalesService.getSales()
// Calculate statistics from sales data
// Use chart library for visualizations

// Example structure:
// - AnalyticsDashboard component
// - SalesTrendChart component
// - WorkerPerformanceChart component
// - SalesByItemChart component
// - WorkerPerformanceTable component
// - ReportExport component
```

**Charts to Install:**
```bash
# If not already installed
npm install recharts
# or
npm install chart.js react-chartjs-2
```

---

### 8. Navigation Structure

**Add to Master Dashboard**: Sidebar or top navigation menu

**Requirements:**
- **Navigation Menu**: Links to all master pages
  - Dashboard (overview)
  - Stores
  - Inventory
  - Sales
  - Workers
  - Deliverers
  - Deliveries
  - Analytics
  - AI Assistant (already exists in tabs)
- **Active State**: Highlight current page
- **Mobile Responsive**: 
  - Desktop: Sidebar navigation
  - Mobile: Hamburger menu or bottom navigation
- **User Info**: Display current user email, sign out button

**Design:**
- Use shadcn/ui Sidebar component (if available) or custom navigation
- Icons for each menu item (Lucide React)
- Collapsible on mobile
- Follow existing design patterns

**Implementation:**
```typescript
// Create MasterLayout component that wraps all master pages
// Add navigation to layout
// Update routes to use layout

// Example structure:
// - MasterLayout component (with navigation)
// - MasterNavigation component (sidebar/menu)
// - Update App.tsx routes to use MasterLayout
```

**Route Structure:**
```typescript
// Update App.tsx
<Route path="/master" element={<MasterLayout />}>
  <Route path="dashboard" element={<DashboardView />} />
  <Route path="stores" element={<StoresPage />} />
  <Route path="inventory" element={<InventoryPage />} />
  <Route path="sales" element={<SalesPage />} />
  <Route path="workers" element={<WorkersPage />} />
  <Route path="deliverers" element={<DeliverersPage />} />
  <Route path="deliveries" element={<DeliveriesPage />} />
  <Route path="analytics" element={<AnalyticsPage />} />
</Route>
```

---

## Design Guidelines

### Visual Design
- **Color Scheme**: Follow existing dashboard colors (check DashboardView for reference)
- **Typography**: Use existing font sizes and weights
- **Spacing**: Consistent padding and margins (use Tailwind spacing scale)
- **Components**: Use shadcn/ui components consistently
- **Icons**: Use Lucide React icons (already installed)

### Mobile-First Design
- **Responsive Tables**: Use cards on mobile, tables on desktop
- **Touch Targets**: Minimum 48px height for buttons
- **Forms**: Full-width inputs on mobile
- **Navigation**: Collapsible sidebar or bottom nav on mobile

### User Experience
- **Loading States**: Show skeleton loaders while data loads
- **Error Handling**: Display error messages with toast notifications
- **Success Feedback**: Show success toasts after actions
- **Confirmation Dialogs**: Use AlertDialog for destructive actions
- **Empty States**: Show helpful messages when no data exists

---

## Implementation Checklist

### Phase 1: Core Management Pages
- [ ] Create Store Management UI (`/master/stores`)
  - [ ] Stores list view
  - [ ] Create store form
  - [ ] Edit store form
  - [ ] Delete confirmation
  - [ ] Store details view (optional)

- [ ] Create Inventory Management UI (`/master/inventory`)
  - [ ] Inventory list view with filters
  - [ ] Create item form
  - [ ] Edit item form
  - [ ] Delete confirmation
  - [ ] Bulk operations (optional)
  - [ ] Categories management (optional)

- [ ] Create Sales Management UI (`/master/sales`)
  - [ ] Sales list view with filters
  - [ ] Sales details view
  - [ ] Edit sale form
  - [ ] Delete confirmation
  - [ ] Export functionality
  - [ ] Sales statistics cards

### Phase 2: People Management
- [ ] Create Worker Management UI (`/master/workers`)
  - [ ] Workers list view
  - [ ] Create/edit worker form
  - [ ] Assign to stores dialog
  - [ ] Worker performance view

- [ ] Create Deliverer Management UI (`/master/deliverers`)
  - [ ] Deliverers list view
  - [ ] Create/edit deliverer form
  - [ ] Assign to stores dialog
  - [ ] Deliverer performance view

### Phase 3: Delivery & Analytics
- [ ] Create Delivery Dashboard (`/master/deliveries`)
  - [ ] Deliveries list view with filters
  - [ ] Delivery details view
  - [ ] Assign deliverer dialog
  - [ ] Status update functionality
  - [ ] Delivery statistics

- [ ] Create Analytics Dashboard (`/master/analytics`)
  - [ ] Sales trend charts
  - [ ] Worker performance charts
  - [ ] Sales by item/store charts
  - [ ] Worker performance table
  - [ ] Reports and export

### Phase 4: Navigation & Polish
- [ ] Create Master Layout with Navigation
  - [ ] Sidebar navigation (desktop)
  - [ ] Mobile navigation (hamburger menu or bottom nav)
  - [ ] Active route highlighting
  - [ ] User info and sign out

- [ ] Update Routes in App.tsx
  - [ ] Wrap master routes in MasterLayout
  - [ ] Add all new routes

- [ ] Testing & Polish
  - [ ] Test all CRUD operations
  - [ ] Test filters and search
  - [ ] Test mobile responsiveness
  - [ ] Fix any bugs
  - [ ] Improve error handling

---

## Code Examples

### Example: Store List Component Structure
```typescript
// src/components/master/Stores/StoresList.tsx
import { useState, useEffect } from 'react';
import { StoreService } from '@/services/StoreService';
import { Store } from '@/types';
import { Button } from '@/components/ui/button';
import { Table } from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';

export function StoresList() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    setLoading(true);
    const { data, error } = await StoreService.getStores();
    if (error) {
      console.error('Error loading stores:', error);
    } else {
      setStores(data || []);
    }
    setLoading(false);
  };

  // ... rest of component
}
```

### Example: Using Service Methods
```typescript
// Create store
const { data, error } = await StoreService.createStore({
  name: 'Store Name',
  address: '123 Main St',
  phone: '555-1234',
  owner_id: user.id,
});

// Update store
const { data, error } = await StoreService.updateStore(storeId, {
  name: 'Updated Name',
});

// Delete store
const { error } = await StoreService.deleteStore(storeId);
```

### Example: Using Auth Context
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, roles } = useAuth();
  
  // user.id for owner_id
  // roles for role checks
}
```

---

## Important Notes

1. **Don't Rebuild Existing Features**: The dashboard, AI features, and worker/deliverer/customer interfaces are already built. Focus only on the missing master management pages.

2. **Use Existing Services**: All service methods are already implemented. Use `StoreService`, `InventoryService`, and `SalesService` methods.

3. **Follow Existing Patterns**: Look at `DashboardView.tsx` for design patterns, component structure, and styling approach.

4. **Type Safety**: Use existing TypeScript types from `src/types/index.ts`. Don't create duplicate types.

5. **Error Handling**: Always handle errors and show user-friendly messages using toast notifications.

6. **Loading States**: Show loading states (skeleton loaders) while data is being fetched.

7. **Mobile Responsive**: Ensure all pages work well on mobile devices.

8. **Access Control**: All routes should be protected with `ProtectedRoute` component requiring 'master' role.

---

## Getting Started

1. **Start with Navigation**: Create the MasterLayout and navigation structure first, so you can easily navigate between pages as you build them.

2. **Build Management Pages**: Start with Store Management, then Inventory, then Sales, then Workers/Deliverers, then Deliveries, then Analytics.

3. **Test Each Feature**: Test CRUD operations, filters, and mobile responsiveness for each page before moving to the next.

4. **Iterate and Improve**: Once all pages are built, go back and improve UX, add polish, and fix any issues.

---

## Questions to Consider

Before implementing each feature, think about:
- What information does the user need to see?
- What actions do they need to perform?
- How can the interface be optimized for speed?
- How should data be organized for quick comprehension?
- What's the mobile experience like?
- How can errors be prevented?
- What feedback should users receive?

---

Good luck building! Remember to use the existing codebase as reference and follow the established patterns.

