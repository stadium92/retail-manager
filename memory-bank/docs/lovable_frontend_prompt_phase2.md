# Lovable.dev Frontend Generation Prompt - Phase 2: Worker, Deliverer & Customer Interfaces

## Phase Overview
**Phase 2** builds on Phase 1 by adding the Worker, Deliverer, and Customer interfaces, along with delivery logistics and offline support. This phase completes the four-sided architecture and enables the complete retail flow.

**Prerequisites**: Phase 1 must be completed (Master interface with authentication, sales, inventory, workers, deliverers, deliveries, stores).

**Deliverables:**
- Worker interface (sales entry, inventory view, delivery status)
- Deliverer interface (delivery management, GPS tracking)
- Customer interface (product browsing, ordering)
- Delivery flow integration
- Offline support for Worker and Deliverer
- Complete four-sided architecture

**NOT Included in Phase 2:**
- AI features (will be added in Phase 3)
- Advanced analytics (Phase 3)

---

## Project Overview
This is **Phase 2** of the retail management web application. Phase 1 established the Master interface. Phase 2 adds the remaining three interfaces: Worker, Deliverer, and Customer.

**Key Concept**: Complete the four-sided architecture:
1. **Master Side** (Store Owners) - ✅ Complete (Phase 1)
2. **Worker Side** (Store Employees) - 🆕 Phase 2
3. **Deliverer Side** (Delivery Personnel) - 🆕 Phase 2
4. **Customer Side** (End Users) - 🆕 Phase 2

Each interface is completely separate with distinct privileges, designs, and use cases.

---

## Application Architecture

### User Roles & Access Layers

**Phase 2 Focus**: Worker, Deliverer, and Customer interfaces.

1. **Worker Layer**: Completely separate app experience - simplified, task-focused interface for daily sales and inventory operations. Workers can view delivery status for their store but cannot manage deliverers.

2. **Deliverer Layer**: Mobile-first delivery management interface - receive assignments, update delivery status, view routes, GPS tracking. Completely separate from master/worker interfaces.

3. **Customer/User Layer**: Public-facing product browsing interface - downloadable mobile app for customers to browse menu/products, view store information, and potentially place orders.

**Critical Design Rule**: All four interfaces are architecturally separate - not just visually hidden features, but completely different applications with different routes, components, and designs.

### Privilege System & Access Control

#### Worker Privileges (Limited Access)
1. **Store Access**: Assigned store(s) ONLY; View-only store info; Cannot create/edit/delete stores; No multi-store view
2. **Sales Operations**: CREATE sales only (write-only); Cannot edit or delete ANY sales (including own); Cannot view sales list or history; Automatic worker attribution
3. **Inventory Access**: View inventory (assigned store only); Search items; Check stock levels; Update stock (if permitted); Cannot create/edit/delete items; No bulk operations
4. **Delivery Access**: View delivery status for assigned store(s) (read-only); Create delivery orders when recording sales; Contact deliverer about specific delivery; Cannot assign deliverers or manage deliverer accounts
5. **Limited Analytics**: Own sales count and total for TODAY only; No historical data; No comparisons; No store analytics; No worker rankings
6. **No AI Access**: Cannot access AI suggestions, conversational AI, or predictive analytics
7. **No Management**: Cannot manage workers/deliverers, access settings (except own profile), generate reports, or export data

#### Deliverer Privileges (Delivery-Focused)
1. **Delivery Management**: View assigned deliveries only; Update delivery status (assigned → picked up → in transit → delivered); View delivery details (customer, items, address); View delivery route/map
2. **Communication**: Contact customer (call/message); Contact store/master; Report delivery issues
3. **Location Services**: GPS tracking (shared with master/workers); Route optimization; Delivery completion confirmation
4. **Limited Access**: Cannot view sales or inventory; Cannot access analytics; Cannot manage workers or stores; Cannot see other deliverers' assignments; Cannot view customer browsing data

#### Customer/User Privileges (Public & Ordering)
1. **Product Discovery**: Browse menu/products (public access); View product details (name, price, description, image); Check product availability; Search and filter products; View store information
2. **Order Management** (If Enabled): Place orders; View own order history; Track own order delivery status; Cancel orders (within time limits)
3. **Store Information**: View store locations; Store hours and contact info; Available items per store
4. **No Access**: Cannot access sales/analytics; Cannot view inventory management; Cannot see other customers' orders; Cannot access worker/deliverer features

#### Access Control Implementation

**Frontend Access Control:**
- **Route Protection**: 
  - `/master/*` requires Master role (Phase 1)
  - `/worker/*` requires Worker role (Phase 2)
  - `/deliverer/*` requires Deliverer role (Phase 2)
  - `/customer/*` or `/` - Public access (no auth required for browsing) (Phase 2)
- **Component-Level Guards**: Conditional rendering based on role; Feature flags for privilege checks
- **Data Filtering**: 
  - Workers only see data from assigned store(s)
  - Deliverers only see assigned deliveries
  - Customers only see public menu and own orders
  - Masters see all stores they own

**Privilege Enforcement:**
```typescript
// Route Protection Example
<ProtectedRoute 
  role="worker" 
  component={WorkerDashboard} 
  redirectTo="/auth"
/>

<ProtectedRoute 
  role="deliverer" 
  component={DelivererDashboard} 
  redirectTo="/auth"
/>

// Public route (no auth required)
<Route path="/customer/*" element={<CustomerApp />} />
```

### Technical Stack
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with custom design system (shadcn/ui components)
- **State Management**: Context API or Zustand for role-based state
- **Routing**: React Router with protected routes
- **API Integration**: Supabase client for backend communication
- **Real-time**: Supabase Realtime subscriptions
- **Forms**: React Hook Form with validation
- **Charts**: Recharts or Chart.js for analytics visualization (if needed)
- **UI Components**: shadcn/ui component library
- **Icons**: Lucide React icons
- **Offline Support**: 
  - Offline queue management (localStorage-based)
  - Auto-sync when online
  - Offline indicator component
  - Background sync service
- **Mobile-First**: 
  - Mobile container with safe areas
  - Bottom navigation for mobile
  - Responsive design patterns
  - Touch-optimized interactions (min 44x44px for Worker, 48x48px for Deliverer)
- **Maps & GPS**: Map integration libraries (Mapbox, Google Maps, or Leaflet) for Deliverer interface

---

## Phase 2 Feature Requirements

### Worker - Feature Requirements

**Context**: In-store operations, mobile phone/tablet, handling customers, need speed

**Essential Features to Implement:**

1. **Sales Recording**:
   - Quick sales entry form
   - Item search and selection
   - Barcode scanning (if applicable)
   - Quantity and price entry
   - Multiple items per transaction
   - Delivery option toggle
   - Transaction summary
   - Quick item shortcuts
   - **Offline Support**: Queue sales when offline, sync when online

2. **Inventory Access**:
   - Quick inventory search
   - Stock level checking
   - Low stock indicators
   - Item availability status
   - Stock update capability (if permitted)

3. **Delivery Status Viewing**:
   - Delivery list for assigned store
   - Delivery status indicators
   - Delivery details view
   - Contact deliverer option

4. **Daily Summary**:
   - Today's sales count
   - Today's total sales amount
   - Items sold today
   - Personal performance summary

**Your Task**: Analyze these features and propose how they should be implemented. Prioritize:
- Speed of sales entry (most critical)
- Simplicity and clarity
- Minimal steps and taps
- Error prevention
- Mobile-first design
- Offline capability

### Deliverer - Feature Requirements

**Context**: On the road, mobile phone, often in vehicle, poor connectivity

**Essential Features to Implement:**

1. **Delivery Management**:
   - Today's delivery list
   - Delivery status updates (one-tap)
   - Delivery details view
   - Delivery route on map
   - Multiple delivery route planning

2. **Navigation & Maps**:
   - Map view with delivery locations
   - Route optimization
   - Turn-by-turn navigation integration
   - Distance and time estimates
   - Traffic information

3. **Communication**:
   - One-tap customer calling
   - SMS/text messaging
   - Contact store/master
   - Delivery issue reporting

4. **GPS & Location**:
   - Real-time GPS tracking
   - Location sharing with master/workers
   - Arrival notifications
   - Location-based delivery confirmation
   - Offline location tracking

5. **Performance Tracking**:
   - Delivery count (daily/weekly)
   - Delivery completion rate
   - Average delivery time
   - Earnings tracking (if applicable)

**Your Task**: Analyze these features and propose how they should be implemented. Consider:
- One-handed use
- Quick status updates
- Offline capability
- Safety considerations
- Battery optimization

### Customer/User - Feature Requirements

**Context**: Product browsing, mobile/desktop, public access, potentially ordering

**Essential Features to Implement:**

1. **Product Discovery**:
   - Product catalog browsing
   - Category navigation
   - Product search functionality
   - Product filtering (price, availability, category)
   - Product sorting options
   - Featured/popular products

2. **Product Details**:
   - Large product images
   - Product name and description
   - Price and availability
   - Product specifications
   - Store information

3. **Shopping Cart & Checkout** (If Ordering Enabled):
   - Shopping cart management
   - Cart item editing
   - Cart total calculation
   - Delivery address input/selection
   - Payment method selection
   - Order summary review
   - Order placement confirmation

4. **Order Management** (If Ordering Enabled):
   - Order history view
   - Order status tracking
   - Delivery status updates
   - Estimated delivery time
   - Order details view
   - Order cancellation (if permitted)

5. **Store Information**:
   - Store locations and map
   - Store hours
   - Contact information
   - Store description

**Your Task**: Analyze these features and propose how they should be implemented. Consider:
- E-commerce best practices
- Visual appeal and trust building
- Product discovery optimization
- Checkout simplification
- Mobile-first design

---

## Core UI Components Required - Phase 2

### Worker Interface Components

1. **Sales Entry Form**: 
   - Item selector (searchable dropdown)
   - Quantity input
   - Price display/override
   - Quick add buttons
   - Transaction summary
   - **Delivery Option**: Checkbox/option to create delivery order
   - **Automatic Worker Attribution**: Each sale automatically attributed to the logged-in worker
   - **Offline Indicator**: Show when offline, queue size

2. **Item Recording**: Ability to record/store items in the digital catalog

3. **Today's Sales Summary**: Simple card showing worker's sales count and total

4. **Inventory Quick View**: 
   - Search items
   - Check stock levels
   - Low stock indicators
   - Update item availability

5. **Delivery Status View**: 
   - View deliveries for assigned store (read-only)
   - Delivery status indicators
   - Contact deliverer option
   - Filter by status (assigned, in transit, delivered)

6. **Recent Transactions**: Worker's own sales history for the day with detailed transaction info

7. **Simple Navigation**: Minimal menu with essential actions only (Sales, Inventory, Deliveries, Profile)

8. **Offline Indicator**: Network status, queue size, manual sync button

### Deliverer Interface Components

1. **Today's Deliveries List**:
   - List of assigned deliveries
   - Delivery status indicators
   - Customer name and address
   - Items to deliver
   - Priority indicators
   - Distance/time estimates

2. **Delivery Details View**:
   - Complete delivery information
   - Customer contact details
   - Delivery address with map
   - Items list
   - Special instructions
   - Status update buttons

3. **Status Update Controls**:
   - Large, one-tap status buttons
   - Status flow: Assigned → Picked Up → In Transit → Delivered
   - Confirmation dialogs
   - Photo upload (proof of delivery)

4. **Delivery Route View**:
   - Map with delivery locations
   - Route optimization
   - Navigation integration
   - Multiple deliveries planning

5. **Delivery History**:
   - Past deliveries
   - Delivery statistics
   - Performance metrics

6. **Communication**:
   - One-tap customer calling
   - SMS/text messaging
   - Contact store/master

7. **Simple Navigation**: Bottom navigation (Deliveries, Route, History, Profile)

8. **Offline Indicator**: Network status, sync status

### Customer/User Interface Components

1. **Product/Menu Browser**:
   - Grid/list view of products
   - Category filters
   - Search functionality
   - Product cards with images
   - Price and availability display

2. **Product Detail View**: 
   - Large product image
   - Product name, description, price
   - Availability indicator
   - Add to cart button (if ordering enabled)
   - Store information

3. **Store Information**: 
   - Store locations
   - Store hours
   - Contact information
   - Available items per store

4. **Shopping Cart** (If Ordering Enabled): 
   - Cart items list
   - Total calculation
   - Checkout button
   - Delivery address input

5. **Order Tracking** (If Ordering Enabled): 
   - Order status
   - Delivery tracking
   - Order history
   - Estimated delivery time

6. **User Profile** (If Authenticated): 
   - Order history
   - Saved addresses
   - Preferences

7. **Simple Navigation**: Bottom navigation (Menu, Cart, Orders, Profile) or hamburger menu

8. **E-Commerce Style**: Familiar shopping app design, visual product focus

### Shared Components (Phase 2 Additions)

1. **Offline Support**:
   - Offline indicator component
   - Offline queue manager
   - Auto-sync service
   - Network status detection

2. **Delivery Components**:
   - Delivery status badges
   - Delivery timeline
   - Delivery map view
   - Delivery contact buttons

---

## Design Approach Brainstorming

### Worker Interface Design Brainstorming

#### Context & User Needs Analysis
**Questions to Consider:**
- Workers are in-store, handling customers, need to record sales quickly - how can speed be optimized?
- They're often using shared devices or their own phones - how should the design account for this?
- They need simple, focused tasks - how can complexity be minimized?
- They're not tech-savvy - how can the interface be made intuitive?
- They need to work fast during busy periods - how can the design support speed?
- They need to check inventory quickly - what's the fastest way to access this?
- They work offline - how should offline functionality work?

#### Layout Approach Brainstorming
**Consider These Options:**
- **Primary View**: Should sales entry be the default? Should it be a full-screen form? Should it be a modal?
- **Navigation**: Bottom nav? Top nav? Sidebar? What's most accessible during use?
- **Information Display**: How should today's summary be shown? Should it be prominent or subtle?
- **Task Flow**: What's the most efficient flow for recording a sale? How can steps be minimized?

**Your Task**: Analyze worker needs and propose the optimal layout. Consider:
- Speed of sales entry (most critical task)
- Ease of inventory checking
- Simplicity and clarity
- Mobile-first design (they use phones)
- Minimal cognitive load
- Offline capability

#### Visual Design Brainstorming
**Questions to Consider:**
- **Color Scheme**: What colors feel clean and simple? What colors reduce visual noise? How should actions be highlighted?
- **Typography**: What font sizes ensure quick reading? How should form labels be sized? What's readable in various lighting?
- **Touch Targets**: What size ensures easy tapping? How should buttons be sized? What spacing prevents errors?
- **Visual Clarity**: How can the interface be made instantly understandable? What visual cues guide users?

**Your Task**: Propose a design system that:
- Prioritizes speed and ease of use
- Reduces visual complexity
- Makes actions obvious
- Works well in various lighting conditions
- Feels completely different from master interface

#### Form Design Brainstorming
**Questions to Consider:**
- **Sales Entry Form**: How can item selection be fastest? (Search? Barcode? Recent items? Categories?)
- **Input Methods**: What's the best way to enter quantities? (Number pad? Increment buttons? Direct input?)
- **Price Display**: How should prices be shown? Should workers be able to override? How should discounts be handled?
- **Transaction Flow**: How many steps should a sale take? Can multiple items be added quickly? How should totals be calculated?

**Your Task**: Design forms that:
- Minimize taps and inputs
- Reduce errors
- Support fast data entry
- Are intuitive without training
- Work well on mobile devices
- Work offline

### Deliverer Interface Design Brainstorming

#### Context & User Needs Analysis
**Questions to Consider:**
- Deliverers are on the road, often in vehicles - how can the design support this context?
- They need to update status quickly - how can status updates be made one-tap?
- They need navigation and maps - how should maps be integrated?
- They work with poor connectivity - how should offline functionality work?
- They need to contact customers - how can communication be one-tap?
- They're often moving - how can the design be used safely?

#### Layout Approach Brainstorming
**Consider These Options:**
- **Primary View**: Should deliveries list be default? Should active delivery be prominent? Should map view be primary?
- **Status Updates**: How can status updates be fastest? (Large buttons? Swipe actions? Voice commands?)
- **Navigation**: How should navigation between deliveries work? What's the best way to see route?
- **Information Display**: What delivery info is needed at a glance? What can be hidden until needed?

**Your Task**: Analyze deliverer needs and propose the optimal layout. Consider:
- One-handed use (they're often holding phone while moving)
- Quick status updates (most frequent action)
- Map integration (critical for navigation)
- Offline capability (poor connectivity)
- Safety (minimal interaction while moving)

#### Visual Design Brainstorming
**Questions to Consider:**
- **Color Scheme**: What colors are visible in various lighting? What colors indicate status clearly? How should actions be highlighted?
- **Typography**: What font sizes are readable while moving? What fonts work in bright sunlight? How should addresses be displayed?
- **Touch Targets**: What size ensures one-handed use? How should buttons be sized for quick tapping? What spacing prevents errors?
- **Visual Feedback**: How should status updates be confirmed? Should there be audio feedback? How should errors be communicated?

**Your Task**: Propose a design system that:
- Supports one-handed use
- Works in various lighting conditions
- Makes status updates obvious and fast
- Integrates maps effectively
- Handles offline gracefully

### Customer/User Interface Design Brainstorming

#### Context & User Needs Analysis
**Questions to Consider:**
- Customers are browsing products, potentially shopping - how can discovery be optimized?
- They may be on mobile or desktop - how should responsive design work?
- They need to find products quickly - how can search and filtering be best implemented?
- They may place orders - how can checkout be simplified?
- They need to trust the store - how can trust be built through design?
- They're public users - how can the interface be welcoming and intuitive?

#### Layout Approach Brainstorming
**Consider These Options:**
- **Product Display**: Grid view? List view? Card view? What's most effective for product browsing?
- **Navigation**: Bottom nav? Top nav? Sidebar? What's familiar to users?
- **Search & Filter**: How should search be prominent? How should filters be accessible? What's the best UX?
- **Product Details**: Should details be modal? Separate page? Bottom sheet? What's most intuitive?

**Your Task**: Analyze customer needs and propose the optimal layout. Consider:
- Familiar e-commerce patterns (users expect certain conventions)
- Product discovery (how to help users find products)
- Visual appeal (how to make products attractive)
- Mobile-first design (most users on mobile)
- Trust building (how design builds confidence)

---

## Implementation Patterns & Best Practices

### Offline Support Pattern
**Reference**: Study `OfflineManager` from malitrade-assistant

**Required Implementation**:
- Offline queue management (localStorage-based)
- Auto-sync when online
- Queue size tracking
- Sync status indicators
- Manual sync capability
- Error handling for failed syncs

**Pattern to Follow**:
```typescript
export class OfflineManager {
  static addToQueue(transaction: Transaction): void
  static getQueue(): QueuedTransaction[]
  static async syncQueue(): Promise<{ success: number; failed: number }>
  static setupAutoSync(): void
}
```

**Apply to**: Worker sales entry, Deliverer status updates

### Offline Indicator Component
**Reference**: Study `OfflineIndicator` component from malitrade-assistant

**Required Features**:
- Network status display
- Queue size indicator
- Manual sync button
- Sync progress feedback
- Visual status badges

**Apply to**: Worker and Deliverer interfaces

### Mobile-First Patterns
**Reference**: Study mobile patterns from malitrade-assistant

**Required Implementation**:
- Mobile container with safe areas
- Bottom navigation for mobile
- Touch-optimized targets (min 44x44px for Worker, 48x48px for Deliverer)
- Responsive breakpoints
- Mobile-specific layouts
- Safe area insets (iOS notch, Android navigation)

### Service Layer Pattern
**Reference**: Study the service layer pattern from malitrade-assistant

**Pattern to Follow**:
```typescript
export class SalesService {
  static async createSale(sale: SaleCreate): Promise<{ data?: Sale; error?: any }> {
    // Implementation with Supabase
    // Offline support: add to queue if offline
  }
}
```

---

## Implementation Guidelines

### Component Structure
```
src/
  components/
    worker/
      Dashboard/
        WorkerDashboard.tsx
        TodaySummary.tsx
      Sales/
        SalesEntryForm.tsx
        QuickItemSelector.tsx
      Inventory/
        InventoryQuickView.tsx
        StockChecker.tsx
      Deliveries/
        DeliveryStatusView.tsx
    deliverer/
      Dashboard/
        DelivererDashboard.tsx
        TodaySummary.tsx
      Deliveries/
        DeliveryList.tsx
        DeliveryDetails.tsx
        StatusUpdateButtons.tsx
      Route/
        RouteMap.tsx
        NavigationView.tsx
      History/
        DeliveryHistory.tsx
    customer/
      Browse/
        ProductGrid.tsx
        ProductCard.tsx
        ProductDetail.tsx
        CategoryFilter.tsx
      Cart/
        ShoppingCart.tsx
        Checkout.tsx
      Orders/
        OrderTracking.tsx
        OrderHistory.tsx
    shared/
      Offline/
        OfflineIndicator.tsx
        OfflineManager.ts
      Delivery/
        DeliveryStatusBadge.tsx
        DeliveryTimeline.tsx
  services/
    SalesService.ts (with offline support)
    DeliveryService.ts
    ProductService.ts
    OrderService.ts
    OfflineManager.ts
  hooks/
    useOffline.ts
    useDeliveries.ts
    useProducts.ts
    useOrders.ts
```

### Hooks
- `useOffline.ts` - Offline status and queue management hook
- `useDeliveries.ts` - Deliveries data hook
- `useProducts.ts` - Products data hook
- `useOrders.ts` - Orders data hook

### Services
- `api/` - API service layer
  - `salesService.ts` - Sales API calls (with offline support)
  - `deliveryService.ts` - Deliveries API calls (with offline support)
  - `productService.ts` - Products API calls
  - `orderService.ts` - Orders API calls
- `offline/` - Offline support services:
  - `OfflineManager.ts` - Offline queue management (reference malitrade-assistant pattern)
  - `SyncService.ts` - Background sync service

---

## Phase 2 Success Criteria

**Phase 2 is complete when:**
- [ ] Worker can log in and access worker interface
- [ ] Worker can record sales (with offline support)
- [ ] Worker can view inventory for assigned store
- [ ] Worker can view delivery status for assigned store
- [ ] Deliverer can log in and access deliverer interface
- [ ] Deliverer can view assigned deliveries
- [ ] Deliverer can update delivery status (with offline support)
- [ ] Deliverer can view delivery routes and maps
- [ ] Customer can browse products (no auth required)
- [ ] Customer can view product details
- [ ] Customer can place orders (if enabled)
- [ ] Customer can track orders (if enabled)
- [ ] Offline support working for Worker and Deliverer
- [ ] Offline indicator component functional
- [ ] Auto-sync working when online
- [ ] All interfaces are architecturally separate
- [ ] Mobile-first design implemented
- [ ] Error handling and loading states implemented

**Next Steps**: After Phase 2 completion, proceed to Phase 3 (AI features and advanced analytics).

---

## Reference Implementation Patterns from malitrade-assistant

**CRITICAL**: Study and incorporate proven patterns from the `malitrade-assistant` project.

### Key Patterns to Study and Implement

1. **Offline Support** (`OfflineManager.ts`):
   - localStorage-based queue
   - Auto-sync on network online
   - Queue size tracking
   - Sync status events
   - Manual sync capability
   - Export/import for backup

2. **Offline Indicator** (`OfflineIndicator.tsx`):
   - Network status display
   - Queue size badge
   - Manual sync button
   - Visual feedback
   - Event-driven updates

3. **Mobile-First Design**:
   - Mobile container class
   - Safe area insets
   - Bottom navigation
   - Touch-optimized targets
   - Responsive breakpoints

**Reference Files to Study**:
- `frontend/src/services/OfflineManager.ts` - Offline support
- `frontend/src/components/OfflineIndicator.tsx` - Offline UI
- `frontend/src/components/Layout/BottomNavigation.tsx` - Mobile navigation

---

**Think deeply, research thoroughly, propose thoughtfully, implement excellently. Create the best possible Worker, Deliverer, and Customer interfaces for Phase 2.**

