# Interface Architecture, Privileges & Access Control

## Overview
This document defines the interface architecture, privilege system, and access control mechanisms for the Retail Manager platform. The system implements a strict role-based access control (RBAC) model with two distinct privilege tiers: **Master/Owner** and **Worker**, each with completely separate interfaces and capabilities.

---

## Core Principle: Two-Sided Architecture

The platform operates on a **two-sided architecture** where:
- **Master Side (Store Owner)**: Full administrative control, analytics, and management capabilities
- **Worker Side (Employee)**: Limited, task-focused interface for daily operations

**Critical Design Rule**: Workers should NEVER see or access master features. The interfaces are completely separate, not just visually hidden features.

---

## Privilege Levels & Access Control

### 1. Master/Owner Privileges

#### 1.1 Full System Access
- **Store Management**: Create, edit, delete stores
- **Multi-Store Access**: Manage multiple interconnected stores simultaneously
- **Store Interconnection**: Connect/disconnect stores, configure shared insights
- **Global Settings**: System-wide configuration and preferences

#### 1.2 User & Worker Management
- **Worker Account Creation**: Create worker accounts with credentials
- **Worker Assignment**: Assign workers to specific stores
- **Permission Management**: Set granular permissions per worker (if implemented)
- **Worker Deactivation**: Disable worker accounts
- **Access Revocation**: Revoke worker access to stores
- **Worker Profile Management**: View and edit worker profiles

#### 1.3 Sales & Transaction Access
- **View All Sales**: Access to all sales across all stores
- **Sales Filtering**: Filter by store, worker, date range, item, amount
- **Sales Export**: Export sales data and reports
- **Transaction Details**: View complete transaction details
- **Sales Editing**: Edit/correct sales transactions (with audit trail)
- **Sales Deletion**: Delete transactions (with authorization and audit)

#### 1.4 Analytics & Reporting
- **Complete Analytics Dashboard**: Full access to all analytics and metrics
- **Worker Performance Metrics**: View weighted average performance, individual worker stats
- **Sales Status Monitoring**: View good/bad/worse status indicators
- **Cross-Store Analytics**: Compare performance across interconnected stores
- **Custom Reports**: Generate custom reports and analytics
- **Historical Data**: Access to all historical sales and performance data

#### 1.5 Inventory Management
- **Full Inventory Control**: Create, edit, delete items
- **Bulk Operations**: Bulk import/export, bulk updates
- **Inventory Categories**: Manage categories and item classifications
- **Stock Alerts**: Configure and manage stock alerts
- **Inventory History**: View complete inventory change history
- **Item Pricing**: Set and modify item prices
- **SKU Management**: Manage SKUs and product codes

#### 1.6 AI & Intelligence Features
- **AI Suggestions**: Full access to AI-generated recommendations
- **Conversational AI**: ChatGPT-like interface for querying AI
- **AI Configuration**: Configure AI analysis parameters
- **Pattern Analysis**: View detailed sales pattern analysis
- **Predictive Analytics**: Access forecasting and predictions
- **Multi-Store AI Insights**: Cross-store AI analysis and suggestions

#### 1.7 Real-time Monitoring
- **Live Dashboard**: Real-time updates on all stores
- **Worker Activity Monitoring**: See who is selling what in real-time
- **Sales Status Alerts**: Receive alerts for sales status changes
- **Activity Feeds**: Live activity feeds across all stores

#### 1.8 Financial & Business Operations
- **Revenue Analytics**: Complete financial overview
- **Profit/Loss Analysis**: Financial performance metrics
- **Cost Management**: Track costs and expenses (if implemented)
- **Billing & Invoicing**: Manage billing (if implemented)

---

### 2. Worker Privileges

#### 2.1 Limited Store Access
- **Assigned Store Only**: Access limited to assigned store(s)
- **No Store Management**: Cannot create, edit, or delete stores
- **No Multi-Store View**: Cannot see or switch between stores
- **Store Info View**: View-only access to store information

#### 2.2 Sales Recording (Write-Only for Own Sales)
- **Create Sales**: Record new sales transactions
- **Own Sales Only**: Can only create sales, cannot edit or delete
- **Item Selection**: Select items from inventory for sale
- **Quantity Entry**: Enter quantities sold
- **Price Confirmation**: Confirm or adjust prices (within limits)
- **Transaction Completion**: Complete and submit sales transactions
- **No Sales Editing**: Cannot edit or delete any sales (including own)
- **No Sales Viewing**: Cannot view sales list or history (master only)

#### 2.3 Inventory Access (Limited)
- **View Inventory**: View items and stock levels
- **Item Search**: Search for items in inventory
- **Stock Level Check**: Check current stock levels
- **Low Stock Visibility**: See low stock indicators
- **Update Stock (If Permitted)**: Some workers may update stock levels
- **No Item Creation**: Cannot create new items
- **No Item Editing**: Cannot edit item details (name, price, description)
- **No Item Deletion**: Cannot delete items
- **No Bulk Operations**: Cannot perform bulk inventory operations

#### 2.4 Limited Analytics (Optional - Task-Focused Only)
- **Own Performance**: View own sales count and total for the day
- **Today's Summary**: See personal sales summary for current day
- **No Historical Data**: Cannot view historical performance beyond today
- **No Comparisons**: Cannot compare with other workers
- **No Store Analytics**: Cannot view store-wide analytics
- **No Worker Rankings**: Cannot see other workers' performance

#### 2.5 No AI Access
- **No AI Suggestions**: Cannot access AI recommendations
- **No Conversational AI**: Cannot query AI assistant
- **No Predictive Analytics**: Cannot view forecasts or predictions

#### 2.6 No Management Features
- **No User Management**: Cannot manage other workers
- **No Settings Access**: Cannot access system settings
- **No Reports**: Cannot generate or view reports
- **No Export**: Cannot export any data

---

## Interface Architecture

### Master/Owner Interface Architecture

#### Design Philosophy
- **Comprehensive Dashboard**: Information-dense, multi-column layout
- **Data-Driven**: Analytics and metrics prominently displayed
- **Mobile-Optimized**: Fully functional on phone for remote monitoring
- **Multi-Store Navigation**: Easy switching between stores
- **Professional & Analytical**: Business intelligence focus

#### Layout Structure
```
┌─────────────────────────────────────────────────┐
│  Header: Logo | Store Selector | Notifications  │
├──────────┬──────────────────────────────────────┤
│          │  Dashboard Overview                  │
│          │  ┌─────────┐ ┌─────────┐ ┌─────────┐│
│ Sidebar  │  │ Sales   │ │ Workers │ │ Status  ││
│          │  └─────────┘ └─────────┘ └─────────┘│
│ - Home   │                                      │
│ - Sales  │  Analytics Charts & Graphs           │
│ - Workers│  ┌─────────────────────────────────┐│
│ - Stores │  │     Sales Trend Chart            ││
│ - AI     │  └─────────────────────────────────┘│
│ - Reports│                                      │
│ - Settings│  Recent Sales Feed                  │
│          │  Worker Performance Table            │
│          │  AI Suggestions Panel                 │
└──────────┴──────────────────────────────────────┘
```

#### Key Components
1. **Multi-Store Selector**: Dropdown/switcher in header
2. **Sales Status Cards**: Large, color-coded cards (Good/Bad/Worse)
3. **Analytics Dashboard**: Charts, graphs, metrics
4. **Worker Performance Table**: Detailed table with weighted averages
5. **Recent Sales Feed**: Real-time feed with worker attribution
6. **AI Assistant Panel**: Conversational AI interface
7. **Navigation Sidebar**: Full navigation menu
8. **Quick Actions**: Common actions accessible from anywhere

#### Visual Design Characteristics
- **Color Palette**: Professional blues, grays, with status colors (green/yellow/red)
- **Typography**: Multiple font sizes for hierarchy, readable data tables
- **Cards**: Elevated cards with shadows for metrics
- **Charts**: Modern, interactive charts with tooltips
- **Density**: Information-dense but organized
- **Mobile Layout**: Collapsible sidebar, stacked cards on mobile

---

### Worker Interface Architecture

#### Design Philosophy
- **Task-Focused**: Simple, focused on daily tasks
- **Minimal Navigation**: Only essential actions
- **Large Touch Targets**: Easy to use on mobile devices
- **Quick Actions**: Fast sales entry and inventory checks
- **Separate App Feel**: Completely different from master interface

#### Layout Structure
```
┌─────────────────────────────────────┐
│  Header: Store Name | Worker Name    │
├─────────────────────────────────────┤
│                                      │
│      [Today's Sales Summary]         │
│      ┌─────────────────────────┐    │
│      │  Sales Count: 15         │    │
│      │  Total: $450.00          │    │
│      └─────────────────────────┘    │
│                                      │
│      [Sales Entry Form]               │
│      ┌─────────────────────────┐    │
│      │  Item: [Search...]       │    │
│      │  Quantity: [  ]          │    │
│      │  Price: $XX.XX          │    │
│      │  [Add to Sale]          │    │
│      └─────────────────────────┘    │
│                                      │
│      [Quick Actions]                 │
│      [Check Inventory] [View Today]  │
│                                      │
└─────────────────────────────────────┘
      Bottom Nav: Sales | Inventory | Profile
```

#### Key Components
1. **Sales Entry Form**: Large, prominent form for quick entry
2. **Today's Summary Card**: Simple card showing personal stats
3. **Item Search**: Quick search for items
4. **Inventory Quick View**: Simple list of items with stock
5. **Bottom Navigation**: Minimal navigation (3-4 items max)
6. **Simple Header**: Store name and worker name only

#### Visual Design Characteristics
- **Color Palette**: Clean whites, light grays, accent colors for actions
- **Typography**: Large, readable fonts for quick reading
- **Forms**: Large input fields, clear labels
- **Buttons**: Large touch targets (minimum 44x44px)
- **Simplicity**: Minimal visual elements, focus on content
- **Mobile-First**: Optimized for mobile devices

---

## Access Control Implementation

### Frontend Access Control

#### Route Protection
```typescript
// Protected Routes
- /master/* → Requires Master role
- /worker/* → Requires Worker role
- /login → Public
- Redirect based on role after login
```

#### Component-Level Access Control
```typescript
// Conditional Rendering
{user.role === 'master' && <MasterDashboard />}
{user.role === 'worker' && <WorkerDashboard />}

// Component Guards
<ProtectedRoute role="master" component={Analytics} />
<ProtectedRoute role="worker" component={SalesEntry} />
```

#### Feature Flags
```typescript
const canViewAnalytics = user.role === 'master';
const canManageWorkers = user.role === 'master';
const canEditSales = user.role === 'master';
const canViewAllSales = user.role === 'master';
```

### Backend Access Control

#### API Endpoint Protection
```typescript
// Middleware for role checking
app.get('/api/sales', authenticate, requireRole('master'), getSales);
app.post('/api/sales', authenticate, requireRole(['master', 'worker']), createSale);
app.get('/api/workers', authenticate, requireRole('master'), getWorkers);
app.get('/api/analytics', authenticate, requireRole('master'), getAnalytics);
```

#### Database Row-Level Security (Supabase RLS)
```sql
-- Workers can only see their own sales
CREATE POLICY "Workers can view own sales"
ON sales FOR SELECT
USING (auth.uid() = worker_id);

-- Masters can see all sales
CREATE POLICY "Masters can view all sales"
ON sales FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM stores
    WHERE stores.id = sales.store_id
    AND stores.owner_id = auth.uid()
  )
);

-- Workers can only create sales, not update/delete
CREATE POLICY "Workers can create sales"
ON sales FOR INSERT
WITH CHECK (
  auth.uid() = worker_id
  AND EXISTS (
    SELECT 1 FROM store_workers
    WHERE store_workers.worker_id = auth.uid()
    AND store_workers.store_id = sales.store_id
  )
);
```

---

## Privilege Management System

### Permission Matrix

| Feature | Master | Worker |
|---------|--------|--------|
| **Store Management** |
| Create Store | ✅ | ❌ |
| Edit Store | ✅ | ❌ |
| Delete Store | ✅ | ❌ |
| View Stores | ✅ (All) | ✅ (Assigned Only) |
| **Worker Management** |
| Create Worker | ✅ | ❌ |
| Edit Worker | ✅ | ❌ |
| Delete Worker | ✅ | ❌ |
| Assign Workers | ✅ | ❌ |
| View Workers | ✅ (All) | ❌ |
| **Sales Operations** |
| Create Sale | ✅ | ✅ |
| View Sales | ✅ (All) | ❌ |
| Edit Sale | ✅ | ❌ |
| Delete Sale | ✅ | ❌ |
| Export Sales | ✅ | ❌ |
| **Inventory Management** |
| Create Item | ✅ | ❌ |
| Edit Item | ✅ | ❌ (Limited) |
| Delete Item | ✅ | ❌ |
| View Inventory | ✅ (All Stores) | ✅ (Assigned Store) |
| Update Stock | ✅ | ⚠️ (If Permitted) |
| **Analytics** |
| View Analytics | ✅ | ❌ |
| View Reports | ✅ | ❌ |
| Worker Performance | ✅ | ⚠️ (Own Only) |
| **AI Features** |
| AI Suggestions | ✅ | ❌ |
| Conversational AI | ✅ | ❌ |
| Predictive Analytics | ✅ | ❌ |
| **Settings** |
| System Settings | ✅ | ❌ |
| Store Settings | ✅ | ❌ |
| Profile Settings | ✅ | ✅ (Own Only) |

### Granular Permissions (Future Enhancement)

For more advanced scenarios, implement granular permissions:

```typescript
interface WorkerPermissions {
  // Sales Permissions
  canCreateSales: boolean;
  canViewOwnSales: boolean;
  canEditOwnSales: boolean;
  
  // Inventory Permissions
  canViewInventory: boolean;
  canUpdateStock: boolean;
  canCreateItems: boolean;
  canEditItems: boolean;
  
  // Store Permissions
  canViewStoreInfo: boolean;
  canViewStoreAnalytics: boolean; // Limited analytics
  
  // Special Permissions
  canProcessReturns: boolean;
  canApplyDiscounts: boolean;
  discountLimit: number; // Maximum discount percentage
}
```

---

## Design Differences Summary

### Master Interface Design
- **Information Density**: High - lots of data and metrics
- **Navigation Complexity**: Multi-level navigation with many sections
- **Visual Hierarchy**: Complex with multiple levels
- **Color Usage**: Rich, status-based colors
- **Interactivity**: Many interactive elements (charts, filters, etc.)
- **Screen Real Estate**: Uses full screen efficiently
- **Mobile Adaptation**: Collapsible menus, stacked layouts

### Worker Interface Design
- **Information Density**: Low - only essential information
- **Navigation Complexity**: Simple, minimal navigation
- **Visual Hierarchy**: Simple, clear hierarchy
- **Color Usage**: Minimal, clean colors
- **Interactivity**: Focused interactions (forms, buttons)
- **Screen Real Estate**: Generous spacing, large targets
- **Mobile Adaptation**: Native mobile-first design

---

## Security Considerations

### Data Isolation
- Workers can only access data from their assigned store(s)
- Master can access all stores they own
- Cross-store data requires explicit master permission

### Audit Trail
- All actions logged with user ID and timestamp
- Master actions logged separately from worker actions
- Sales modifications tracked with before/after values

### Session Management
- Separate session handling for master vs worker
- Different session timeouts (master: longer, worker: shorter)
- Role-based session validation

### API Security
- Role-based API access control
- Store-level data filtering in queries
- Rate limiting per role

---

## Implementation Guidelines

### Component Separation
```
src/
  interfaces/
    master/
      components/
      pages/
      hooks/
      utils/
    worker/
      components/
      pages/
      hooks/
      utils/
  shared/
    auth/
    types/
    utils/
```

### State Management
- Separate state stores for master and worker
- Shared authentication state
- Role-based state initialization

### Testing
- Test role-based access control
- Test UI differences between roles
- Test privilege enforcement at API level
- Test data isolation between stores

---

## Future Enhancements

1. **Granular Permissions**: More fine-grained control per worker
2. **Role Templates**: Pre-defined permission sets
3. **Temporary Access**: Time-limited elevated permissions
4. **Audit Dashboard**: Master view of all system actions
5. **Permission Delegation**: Masters can delegate specific permissions
6. **Multi-Role Support**: Users with multiple roles (future)

---

This architecture ensures complete separation between master and worker interfaces while maintaining security, usability, and scalability.


