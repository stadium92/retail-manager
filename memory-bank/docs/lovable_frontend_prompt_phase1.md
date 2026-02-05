# Lovable.dev Frontend Generation Prompt - Phase 1: Core Foundation & Master Interface

## Phase Overview
**Phase 1** focuses on building the core foundation and the Master (Store Owner) interface with essential business management features. This phase establishes the architecture, authentication, basic data management, and the Master dashboard without AI features.

**Deliverables:**
- Complete authentication system
- Master interface with dashboard
- Sales management and viewing
- Inventory management
- Worker management
- Deliverer management (Master can create/manage deliverers)
- Delivery dashboard (Master can view/assign deliveries)
- Basic analytics (charts, tables, metrics)
- Store management
- Multi-store support

**NOT Included in Phase 1:**
- AI features (will be added in Phase 3)
- Worker interface (where workers log in - Phase 2)
- Deliverer interface (where deliverers log in - Phase 2)
- Customer interface (Phase 2)
- Note: Master can manage deliverers and view deliveries in Phase 1, but deliverers cannot log in until Phase 2

---

## Project Overview
Build a comprehensive retail management web application with **FOUR distinct user interfaces** for Store Owners (Masters), Workers, Deliverers, and Customers. This is NOT a simple boilerplate - it requires multiple user role layers, complex data relationships, role-specific UI/UX implementations, and delivery logistics integration.

**Key Concept**: This is a "ChatGPT for retail managers" - an intelligent, conversational AI-powered retail management platform with complete delivery logistics. The system operates on a **four-sided architecture**:
1. **Master Side** (Store Owners) - Complete business management
2. **Worker Side** (Store Employees) - In-store operations
3. **Deliverer Side** (Delivery Personnel) - Delivery logistics
4. **Customer Side** (End Users) - Product browsing and ordering

Each interface is completely separate with distinct privileges, designs, and use cases.

**Phase 1 Focus**: Master interface only - complete business management dashboard.

---

## Application Architecture

### User Roles & Access Layers (Four-Sided Architecture)

1. **Master/Store Owner Layer**: Full-featured dashboard with analytics, multi-store management, worker/deliverer oversight, delivery tracking. Optimized for phone access - store owners monitor via phone from anywhere (including home).

**Phase 1**: Only Master interface will be implemented.

### Privilege System & Access Control

#### Master/Owner Privileges (Full System Access)
1. **Store Management**: Create, edit, delete stores; Multi-store access; Store interconnection management
2. **Worker Management**: Create worker accounts; Assign workers to stores; View/edit worker profiles; Deactivate workers
3. **Sales & Transactions**: View ALL sales across all stores; Filter by store/worker/date/item; Edit/delete sales; Export sales data
4. **Analytics & Reporting**: Complete analytics dashboard; Worker performance metrics (weighted averages); Sales status monitoring (good/bad/worse); Cross-store analytics; Custom reports; Historical data
5. **Inventory Management**: Full CRUD operations; Bulk operations; Categories management; Stock alerts; Inventory history; Pricing control
6. **Deliverer & Delivery Management**: Create/edit/assign deliverers; View deliverer performance; Delivery dashboard; Assign deliveries; Real-time delivery tracking; Delivery analytics
7. **Real-time Monitoring**: Live dashboard; Worker activity monitoring; Sales status alerts; Activity feeds
8. **Settings**: System settings; Store settings; Global configuration

**Note**: AI features will be added in Phase 3.

#### Access Control Implementation

**Frontend Access Control:**
- **Route Protection**: 
  - `/master/*` requires Master role
  - Redirect to `/auth` if not authenticated
- **Component-Level Guards**: Conditional rendering based on role
- **Data Filtering**: 
  - Masters see all stores they own

**Privilege Enforcement:**
```typescript
// Route Protection Example
<ProtectedRoute 
  role="master" 
  component={AnalyticsDashboard} 
  redirectTo="/auth"
/>

// Component-Level Access Control
{user.role === 'master' && <MasterFeatures />}

// Feature Flags
const canViewAnalytics = user.role === 'master';
const canEditSales = user.role === 'master';
const canViewAllSales = user.role === 'master';
const canManageWorkers = user.role === 'master';
```

**Design Philosophy:**
- **Master Interface**: Information-dense, analytical, multi-featured dashboard
- **Mobile-First for Master**: Optimized for phone access - store owners monitor via phone from anywhere (including home)

### Technical Stack
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with custom design system (shadcn/ui components)
- **State Management**: Context API or Zustand for role-based state
- **Routing**: React Router with protected routes
- **API Integration**: Supabase client for backend communication
- **Real-time**: Supabase Realtime subscriptions
- **Forms**: React Hook Form with validation
- **Charts**: Recharts or Chart.js for analytics visualization
- **UI Components**: shadcn/ui component library (accordion, alert, badge, button, card, chart, dialog, form, input, select, table, toast, etc.)
- **Icons**: Lucide React icons
- **Mobile-First**: 
  - Mobile container with safe areas
  - Responsive design patterns
  - Touch-optimized interactions

---

## Phase 1 Feature Requirements

### Master/Store Owner - Phase 1 Features

**Context**: Remote business management, primarily mobile phone, monitoring from home/anywhere

**Essential Features to Implement:**

1. **Business Intelligence**:
   - Real-time sales dashboard with key metrics
   - Sales trend analysis (daily, weekly, monthly)
   - Profit margin analysis
   - Worker performance comparison
   - Store performance comparison (multi-store)
   - Revenue vs expenses breakdown
   - Top-selling items analysis
   - Slow-moving inventory identification

2. **Store & Inventory Management**:
   - Multi-store inventory overview
   - Low stock alerts and recommendations
   - Inventory turnover analysis
   - Reorder suggestions (basic)
   - Bulk inventory operations
   - Price management

3. **Worker Management**:
   - Worker performance dashboard
   - Sales attribution ("who sold what")
   - Weighted average performance metrics
   - Worker comparison and rankings
   - Worker assignment to stores
   - Performance alerts (basic)

4. **Deliverer & Delivery Management**:
   - Deliverer management (create, assign, view performance)
   - Delivery dashboard (view all deliveries, assign to deliverers)
   - Delivery tracking and analytics
   - Note: Deliverer interface (where deliverers log in) will be added in Phase 2

5. **Sales Management**:
   - Complete sales history and filtering
   - Sales by worker, item, store, date range
   - Sales editing and corrections
   - Sales export and reporting
   - Sales pattern analysis (basic)

6. **Store Management**:
   - Create, edit, delete stores
   - Multi-store navigation
   - Store settings
   - Store interconnection setup

**Your Task**: Analyze these features and propose how they should be implemented. Consider:
- What's most important for quick decision-making?
- How should information be organized?
- What's the optimal workflow?
- How can data be presented for quick comprehension?

---

## Core UI Components Required - Phase 1

### Master Dashboard Components

1. **Multi-Store Selector**: Dropdown/switcher to select active store (if multiple stores)

2. **Sales Overview Cards**: 
   - Total sales today/week/month
   - Active workers count
   - Stores status indicators
   - **Sales Status Indicators**: Three-tier system showing if sales are going:
     - **Good** (green/positive indicator)
     - **Bad** (yellow/warning indicator)
     - **Worse** (red/negative indicator)
   - Sales trend indicators (up/down/stable)

3. **Sales Analytics Charts**:
   - Daily sales line chart
   - Weekly/monthly bar charts
   - Sales by worker pie chart
   - Sales by item/product breakdown

4. **Worker Performance Table**: 
   - Worker name, sales count, total revenue, average transaction
   - **Weighted Average Performance**: Display weighted average (not simple average) for each worker
   - **Worker Attribution**: Show "who is selling what" - detailed attribution per sale
   - Sortable columns
   - Filter by date range

5. **Recent Sales Feed**: Real-time list of recent transactions with detailed worker attribution ("who is selling what")

6. **Multi-Store Interconnection View**: Show interconnected stores and cross-store analytics

7. **Store Management**: CRUD interface for managing stores

8. **Worker Management**: Add/edit/assign workers to stores

9. **Deliverer Management**: Add/edit/assign deliverers to stores; View deliverer performance (Note: Deliverer interface where deliverers log in will be added in Phase 2)

10. **Delivery Dashboard**: View all deliveries across stores; Assign deliveries to deliverers; Real-time delivery tracking with GPS; Delivery analytics and reports (Note: Deliverer interface where deliverers log in will be added in Phase 2)

11. **Inventory Management**: 
   - Full CRUD for items
   - Categories management
   - Stock levels
   - Price management
   - Bulk operations

12. **Sales Management**:
    - Sales list with filtering
    - Sales editing
    - Sales export
    - Sales details view

### Shared Components

1. **Authentication**: 
   - Login page with role-based redirect
   - Auth context provider (`useAuth` hook)
   - Session management with Supabase
   - Protected route wrapper

2. **Header/Navbar**: Master navigation

3. **Loading States**: 
   - Skeleton loaders for content
   - Spinners for actions
   - Progressive loading patterns

4. **Error Boundaries**: 
   - Graceful error handling
   - Error fallback UI
   - Error recovery mechanisms

5. **Toast Notifications**: 
   - Success/error feedback
   - Toast provider and hook (`useToast`)
   - Toast variants (default, success, error, warning)

6. **Modals**: 
   - Dialog component for confirmations
   - Sheet component for mobile drawers
   - Form modals
   - Detail view modals

7. **Service Layer Pattern**:
   - Service classes for API calls (SalesService, InventoryService, WorkerService, etc.)
   - Static methods for service operations
   - Error handling in services
   - Type-safe service interfaces

---

## Design Approach Brainstorming & Decision Framework

**CRITICAL**: Do NOT implement a prescriptive design. Instead, you must **brainstorm, analyze, and propose** the best design approach for the Master interface. Consider the user context, needs, and modern design patterns to create an optimal experience.

### Design Thinking Process

Before implementing any design, you MUST:

1. **User Context Analysis**: 
   - Where is the user? (home, store, on the road, browsing)
   - What device are they using? (phone, tablet, desktop)
   - What's their mental state? (rushed, relaxed, focused, distracted)
   - What's their technical comfort level?
   - What's their environment? (bright light, dark, noisy, quiet)

2. **Task Analysis**:
   - What is the primary task for this user?
   - What are secondary tasks?
   - What information is needed to complete tasks?
   - What actions are most frequent?
   - What's the typical workflow?
   - What errors are common?

3. **Design Pattern Research**:
   - Research modern design patterns for similar use cases
   - Study successful applications in similar domains
   - Consider modern frameworks and libraries
   - Review accessibility best practices
   - Analyze performance requirements
   - Look at mobile-first design patterns
   - Consider progressive web app (PWA) patterns

4. **Modern Design Approaches to Consider**:
   - **Dashboard Design**: Study modern dashboard patterns (Stripe Dashboard, Vercel Analytics, Linear, Notion)
   - **Mobile-First**: Research mobile-first design best practices
   - **Data Visualization**: Research modern chart and visualization libraries
   - **Component Libraries**: Consider modern UI libraries (shadcn/ui, Radix UI, Headless UI, etc.)
   - **Design Systems**: Study modern design systems (Material Design, Ant Design, etc.)

5. **Propose & Justify**:
   - Propose your design approach with clear reasoning
   - Justify why this approach is best for this user type
   - Consider alternatives and explain trade-offs
   - Explain how it serves the user's specific needs
   - Reference modern design patterns you're following
   - Explain accessibility considerations
   - Justify performance optimizations

### Master Dashboard Design Brainstorming

#### Context & User Needs Analysis
**Questions to Consider:**
- Store owners need to monitor business from anywhere (often home) - how can the design support this?
- They need quick access to key metrics - what's the best way to surface this?
- They need to make data-driven decisions - how can data be presented for quick comprehension?
- They use phones primarily - how should mobile-first design be implemented?
- They manage multiple stores - how can multi-store navigation be intuitive?

#### Layout Approach Brainstorming
**Consider These Options:**
- **Dashboard Layout**: Multi-column grid? Single column with cards? Tabbed interface? Sidebar navigation? Bottom navigation?
- **Information Architecture**: What's the hierarchy? What's most important? How should sections be organized?
- **Navigation Pattern**: Sidebar? Top nav? Bottom nav? Hamburger menu? Tab navigation? What works best for mobile?
- **Content Density**: How much information per screen? Should it be dense or sparse? How to balance?

**Your Task**: Analyze the master user's needs and propose the optimal layout approach. Justify your choice based on:
- User context (remote monitoring, phone usage)
- Information needs (analytics, management)
- Task frequency (what do they do most?)
- Modern design best practices

#### Visual Design Brainstorming
**Questions to Consider:**
- **Color Scheme**: What colors convey professionalism? What colors work for data visualization? How should status indicators be colored?
- **Typography**: What font sizes ensure readability on mobile? How should hierarchy be established? What fonts are modern yet readable?
- **Spacing & Layout**: How much whitespace is needed? How should cards/sections be spaced? What's the optimal content width?
- **Visual Hierarchy**: What should draw attention first? How should important information be emphasized? How should secondary information be de-emphasized?

**Your Task**: Propose a color scheme, typography system, and visual hierarchy that:
- Supports quick information scanning
- Works well on mobile devices
- Maintains professional appearance
- Enhances data comprehension

#### Component Design Brainstorming
**Questions to Consider:**
- **Charts & Analytics**: What chart types are most effective? How should data be visualized? What interactivity is needed?
- **Tables & Lists**: How should data tables be designed? What's the best way to show worker performance? How should sales lists be displayed?
- **Cards & Metrics**: How should metric cards be designed? What information should be prominent? How should status indicators work?
- **Forms & Inputs**: How should filters be designed? What's the best way to handle date ranges? How should search work?

**Your Task**: Design components that:
- Are intuitive and easy to use
- Work well on mobile
- Support the user's tasks effectively
- Follow modern UI/UX patterns

---

## Implementation Patterns & Best Practices

### Service Layer Pattern
**Reference**: Study the service layer pattern from malitrade-assistant (`TransactionService`, `AlertService`)

**Pattern to Follow**:
```typescript
// Service class with static methods
export class SalesService {
  static async createSale(sale: SaleCreate): Promise<{ data?: Sale; error?: any }> {
    // Implementation with Supabase
  }
  
  static async getSales(limit?: number): Promise<{ data?: Sale[]; error?: any }> {
    // Implementation with error handling
  }
}
```

**Benefits**:
- Clean separation of concerns
- Reusable across components
- Centralized error handling
- Type-safe interfaces

### Auth Hook Pattern
**Reference**: Study `useAuth` hook from malitrade-assistant

**Required Implementation**:
- Auth context provider
- `useAuth` hook for components
- Session management
- Role-based access
- Protected routes
- Sign in/out functionality

### Dashboard Pattern
**Reference**: Study `EnhancedDashboardView` from malitrade-assistant

**Required Features**:
- Loading states with skeletons
- Error handling with fallbacks
- Stats cards with metrics
- Recent activity feed
- Responsive grid layout
- Progressive data loading

### Mobile-First Patterns
**Reference**: Study mobile patterns from malitrade-assistant

**Required Implementation**:
- Mobile container with safe areas
- Touch-optimized targets (min 44x44px)
- Responsive breakpoints
- Mobile-specific layouts
- Safe area insets (iOS notch, Android navigation)

### Error Handling Pattern
**Reference**: Study error handling from malitrade-assistant

**Required Implementation**:
- Try-catch in services
- Error fallbacks in components
- User-friendly error messages
- Retry mechanisms
- Error boundaries
- Graceful degradation

### Loading States Pattern
**Reference**: Study loading patterns from malitrade-assistant

**Required Implementation**:
- Skeleton loaders for content
- Spinners for actions
- Progressive loading
- Optimistic updates
- Loading indicators in buttons

---

## Implementation Guidelines

### Component Structure
```
src/
  components/
    master/
      Dashboard/
        DashboardView.tsx
        MetricCard.tsx
        SalesChart.tsx
        WorkerPerformanceTable.tsx
      Sales/
        SalesList.tsx
        SalesForm.tsx
        SalesFilter.tsx
      Inventory/
        InventoryList.tsx
        InventoryForm.tsx
        CategoryManager.tsx
      Workers/
        WorkerList.tsx
        WorkerForm.tsx
        WorkerPerformance.tsx
      Deliverers/
        DelivererList.tsx
        DelivererForm.tsx
        DelivererPerformance.tsx
      Deliveries/
        DeliveryDashboard.tsx
        DeliveryList.tsx
        DeliveryDetails.tsx
        DeliveryAssign.tsx
      Stores/
        StoreList.tsx
        StoreForm.tsx
        StoreSelector.tsx
    shared/
      Auth/
        AuthPage.tsx
        ProtectedRoute.tsx
      Layout/
        Header.tsx
        Navigation.tsx
      ui/
        [shadcn/ui components]
  services/
    SalesService.ts
    InventoryService.ts
    WorkerService.ts
    DelivererService.ts
    DeliveryService.ts
    StoreService.ts
  hooks/
    useAuth.ts
    useSales.ts
    useInventory.ts
    useWorkers.ts
    useStores.ts
  types/
    index.ts
```

### Hooks
- `useAuth.ts` - Authentication hook (reference malitrade-assistant pattern)
- `useSales.ts` - Sales data hook
- `useWorkers.ts` - Workers data hook
- `useDeliverers.ts` - Deliverers data hook
- `useDeliveries.ts` - Deliveries data hook
- `useInventory.ts` - Inventory data hook
- `useStores.ts` - Stores data hook
- `useToast.ts` - Toast notification hook (from shadcn/ui)
- `use-mobile.tsx` - Mobile detection hook

### Services
- `api/` - API service layer (follow service class pattern from malitrade-assistant)
  - `salesService.ts` - Sales API calls (static methods, error handling)
  - `workerService.ts` - Workers API calls
  - `delivererService.ts` - Deliverers API calls
  - `deliveryService.ts` - Deliveries API calls
  - `inventoryService.ts` - Inventory API calls
  - `storeService.ts` - Stores API calls

### Key Implementation Notes

**Reference malitrade-assistant patterns for:**
1. **Service Layer**: Use static class methods for services (TransactionService pattern)
2. **Auth Pattern**: Use Auth context provider with useAuth hook
3. **Error Handling**: Graceful error handling with fallbacks in all services
4. **Loading States**: Skeleton loaders and progressive loading
5. **Mobile-First**: Mobile container, safe areas
6. **Dashboard Pattern**: Stats cards, recent activity
7. **Toast Notifications**: Toast provider for user feedback

**Critical Patterns to Implement:**
- Service classes with static methods for API calls
- Error boundaries and graceful error handling
- Loading states with skeletons
- Mobile-first responsive design
- Type-safe interfaces throughout
- Supabase client integration patterns

---

## Phase 1 Success Criteria

**Phase 1 is complete when:**
- [ ] Authentication system fully functional
- [ ] Master can log in and access dashboard
- [ ] Master can view sales with filtering and analytics
- [ ] Master can manage inventory (CRUD operations)
- [ ] Master can manage workers (create, assign, view performance)
- [ ] Master can manage deliverers (create, assign, view performance)
- [ ] Master can view and manage deliveries (delivery dashboard)
- [ ] Master can manage stores (create, edit, multi-store navigation)
- [ ] Sales analytics charts working (daily, weekly, monthly)
- [ ] Worker performance table with weighted averages
- [ ] Sales status indicators (good/bad/worse) working
- [ ] Mobile-responsive design
- [ ] Error handling and loading states implemented
- [ ] All services follow the service layer pattern
- [ ] Type-safe interfaces throughout

**Next Steps**: After Phase 1 completion, proceed to Phase 2 (Worker, Deliverer, Customer interfaces).

---

## Reference Implementation Patterns from malitrade-assistant

**CRITICAL**: Study and incorporate proven patterns from the `malitrade-assistant` project.

### Key Patterns to Study and Implement

1. **Service Layer Pattern** (`TransactionService.ts`, `AlertService.ts`):
   - Static class methods for API calls
   - Type-safe interfaces
   - Error handling with fallbacks
   - Supabase client integration
   - Return pattern: `{ data?, error? }`

2. **Auth Pattern** (`useAuth.tsx`):
   - Context provider pattern
   - Custom hook for components
   - Session management
   - Auth state listeners
   - Toast notifications for auth events

3. **Dashboard Pattern** (`EnhancedDashboardView.tsx`):
   - Loading skeletons
   - Error handling with fallbacks
   - Stats cards
   - Recent activity feed
   - Progressive data loading

4. **Mobile-First Design**:
   - Mobile container class
   - Safe area insets
   - Touch-optimized targets
   - Responsive breakpoints

**Reference Files to Study**:
- `frontend/src/services/TransactionService.ts` - Service pattern
- `frontend/src/hooks/useAuth.tsx` - Auth pattern
- `frontend/src/components/Dashboard/EnhancedDashboardView.tsx` - Dashboard pattern

---

**Think deeply, research thoroughly, propose thoughtfully, implement excellently. Create the best possible Master interface for Phase 1.**

