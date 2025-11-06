# Lovable.dev Frontend Generation Prompt

## Project Overview
Build a comprehensive retail management web application with **FOUR distinct user interfaces** for Store Owners (Masters), Workers, Deliverers, and Customers. This is NOT a simple boilerplate - it requires multiple user role layers, complex data relationships, role-specific UI/UX implementations, and delivery logistics integration.

**Key Concept**: This is a "ChatGPT for retail managers" - an intelligent, conversational AI-powered retail management platform with complete delivery logistics. The system operates on a **four-sided architecture**:
1. **Master Side** (Store Owners) - Complete business management
2. **Worker Side** (Store Employees) - In-store operations
3. **Deliverer Side** (Delivery Personnel) - Delivery logistics
4. **Customer Side** (End Users) - Product browsing and ordering

Each interface is completely separate with distinct privileges, designs, and use cases.

## Application Architecture

### User Roles & Access Layers (Four-Sided Architecture)

1. **Master/Store Owner Layer**: Full-featured dashboard with analytics, multi-store management, worker/deliverer oversight, delivery tracking. Optimized for phone access - store owners monitor via phone from anywhere (including home).

2. **Worker Layer**: Completely separate app experience - simplified, task-focused interface for daily sales and inventory operations. Workers can view delivery status for their store but cannot manage deliverers.

3. **Deliverer Layer**: Mobile-first delivery management interface - receive assignments, update delivery status, view routes, GPS tracking. Completely separate from master/worker interfaces.

4. **Customer/User Layer**: Public-facing product browsing interface - downloadable mobile app for customers to browse menu/products, view store information, and potentially place orders.

**Critical Design Rule**: All four interfaces are architecturally separate - not just visually hidden features, but completely different applications with different routes, components, and designs.

### Privilege System & Access Control

#### Core Principle: Two-Sided Architecture
The platform operates on a **two-sided architecture** where Master and Worker interfaces are completely separate. Workers should NEVER see or access master features - these are not just hidden, but completely different interfaces.

#### Master/Owner Privileges (Full System Access)
1. **Store Management**: Create, edit, delete stores; Multi-store access; Store interconnection management
2. **Worker Management**: Create worker accounts; Assign workers to stores; View/edit worker profiles; Deactivate workers
3. **Sales & Transactions**: View ALL sales across all stores; Filter by store/worker/date/item; Edit/delete sales; Export sales data
4. **Analytics & Reporting**: Complete analytics dashboard; Worker performance metrics (weighted averages); Sales status monitoring (good/bad/worse); Cross-store analytics; Custom reports; Historical data
5. **Inventory Management**: Full CRUD operations; Bulk operations; Categories management; Stock alerts; Inventory history; Pricing control
6. **AI Features**: AI suggestions; Conversational AI (ChatGPT-like); AI configuration; Pattern analysis; Predictive analytics; Multi-store AI insights
7. **Real-time Monitoring**: Live dashboard; Worker activity monitoring; Sales status alerts; Activity feeds
8. **Settings**: System settings; Store settings; Global configuration

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
  - `/master/*` requires Master role
  - `/worker/*` requires Worker role
  - `/deliverer/*` requires Deliverer role
  - `/customer/*` or `/` - Public access (no auth required for browsing)
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
  role="master" 
  component={AnalyticsDashboard} 
  redirectTo="/worker/dashboard"
/>

// Component-Level Access Control
{user.role === 'master' && <MasterFeatures />}
{user.role === 'worker' && <WorkerFeatures />}

// Feature Flags
const canViewAnalytics = user.role === 'master';
const canEditSales = user.role === 'master';
const canViewAllSales = user.role === 'master';
const canManageWorkers = user.role === 'master';
```

**Design Philosophy:**
- **Master Interface**: Information-dense, analytical, multi-featured dashboard
- **Worker Interface**: Minimal, task-focused, mobile-first with large touch targets
- **Deliverer Interface**: Mobile-first, status-focused, GPS-integrated, offline-capable
- **Customer Interface**: E-commerce style, visual product browsing, familiar shopping experience
- **Visual Separation**: Completely different layouts, color schemes, navigation complexity for each interface

### Technical Stack
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with custom design system (shadcn/ui components)
- **State Management**: Context API or Zustand for role-based state
- **Routing**: React Router with protected routes
- **API Integration**: Supabase client for backend communication
- **Real-time**: Supabase Realtime subscriptions
- **Forms**: React Hook Form with validation
- **Charts**: Recharts or Chart.js for analytics visualization
- **AI Integration**: 
  - API calls to AI endpoints (`/api/ai/chat`, `/api/ai/suggestions`, etc.)
  - WebSocket or polling for real-time AI insights
  - Conversation state management
  - Alert service integration
- **Offline Support**: 
  - Offline queue management (localStorage-based)
  - Auto-sync when online
  - Offline indicator component
  - Background sync service
- **UI Components**: shadcn/ui component library (accordion, alert, badge, button, card, chart, dialog, form, input, select, table, toast, etc.)
- **Icons**: Lucide React icons
- **Mobile-First**: 
  - Mobile container with safe areas
  - Bottom navigation for mobile
  - Responsive design patterns
  - Touch-optimized interactions

## Feature Requirements & Brainstorming

**CRITICAL**: Before implementing components, deeply analyze what each user type actually needs. Use the feature brainstorming framework below to identify the right features for each interface.

### Feature Brainstorming Framework

For each user type (Master, Worker, Deliverer, Customer), consider:

1. **Core Use Cases**: What are the primary tasks this user needs to accomplish?
2. **Context Analysis**: Where are they? What device? What's their mental state?
3. **Task Frequency**: What do they do most often? What's occasional?
4. **Information Needs**: What information is critical? What's nice-to-have?
5. **Action Requirements**: What actions are essential? What can be secondary?
6. **Workflow Optimization**: How can workflows be streamlined?
7. **Error Prevention**: How can errors be prevented?
8. **Performance Requirements**: What speed/responsiveness is needed?

### Master Features Brainstorming

**Core Use Cases to Consider:**
- Monitor business performance remotely
- Make data-driven decisions quickly
- Manage multiple stores efficiently
- Optimize operations with AI insights
- Track worker and deliverer performance
- Manage inventory across stores
- Handle delivery logistics

**Questions to Brainstorm:**
- What metrics matter most for quick decision-making?
- How can data be presented for quick comprehension?
- What AI insights are most valuable?
- How should multi-store management work?
- What alerts are most critical?
- How can the interface support remote management?

**Your Task**: Identify the essential features for Master users and propose how they should be implemented. Consider modern dashboard patterns, data visualization best practices, and mobile-first design.

### Worker Features Brainstorming

**Core Use Cases to Consider:**
- Record sales quickly and accurately
- Check inventory levels
- View delivery status
- Complete daily tasks efficiently

**Questions to Brainstorm:**
- How can sales entry be fastest?
- What's the minimum information needed for a sale?
- How can inventory checking be quick?
- What delivery information is needed?
- How can errors be minimized?
- What feedback motivates workers?

**Your Task**: Identify the essential features for Worker users and propose how they should be implemented. Prioritize speed, simplicity, and ease of use.

### Deliverer Features Brainstorming

**Core Use Cases to Consider:**
- View delivery assignments
- Update delivery status quickly
- Navigate to delivery locations
- Communicate with customers and store

**Questions to Brainstorm:**
- How can status updates be one-tap?
- What delivery information is needed at a glance?
- How should maps and navigation be integrated?
- How can communication be fastest?
- How should offline functionality work?
- What information is needed while on the road?

**Your Task**: Identify the essential features for Deliverer users and propose how they should be implemented. Consider one-handed use, offline capability, and safety.

### Customer Features Brainstorming

**Core Use Cases to Consider:**
- Browse products easily
- Find specific products quickly
- View product details
- Place orders (if enabled)
- Track orders

**Questions to Brainstorm:**
- How can product discovery be optimized?
- What product information drives purchases?
- How can search and filtering be most effective?
- How can checkout be simplified?
- What builds trust and confidence?
- How should ordering work?

**Your Task**: Identify the essential features for Customer users and propose how they should be implemented. Consider e-commerce best practices, visual appeal, and user trust.

## Comprehensive Feature Requirements by User Type

**CRITICAL**: Use the feature brainstorming framework above to identify the right features for each user type. Consider their context, needs, and goals deeply before implementing.

### Master/Store Owner - Feature Requirements

**Context**: Remote business management, primarily mobile phone, monitoring from home/anywhere

**Essential Features to Consider:**
1. **Business Intelligence**:
   - Real-time sales dashboard with key metrics
   - Sales trend analysis (daily, weekly, monthly)
   - Profit margin analysis
   - Worker performance comparison
   - Store performance comparison (multi-store)
   - Sales forecasting
   - Revenue vs expenses breakdown
   - Top-selling items analysis
   - Slow-moving inventory identification

2. **AI-Powered Features**:
   - Conversational AI chat for business queries
   - AI-generated business recommendations
   - Predictive alerts (low stock, sales anomalies)
   - Pattern recognition and insights
   - Automated reports and summaries
   - Optimization suggestions

3. **Store & Inventory Management**:
   - Multi-store inventory overview
   - Low stock alerts and recommendations
   - Inventory turnover analysis
   - Reorder suggestions
   - Bulk inventory operations
   - Price management

4. **Worker Management**:
   - Worker performance dashboard
   - Sales attribution ("who sold what")
   - Weighted average performance metrics
   - Worker comparison and rankings
   - Worker assignment to stores
   - Performance alerts

5. **Delivery Management**:
   - Delivery dashboard with all deliveries
   - Real-time GPS tracking
   - Delivery assignment interface
   - Delivery performance analytics
   - Deliverer management

6. **Sales Management**:
   - Complete sales history and filtering
   - Sales by worker, item, store, date range
   - Sales editing and corrections
   - Sales export and reporting
   - Sales pattern analysis

**Your Task**: Analyze these features and propose how they should be implemented. Consider:
- What's most important for quick decision-making?
- How should information be organized?
- What's the optimal workflow?
- How can AI enhance the experience?

### Worker - Feature Requirements

**Context**: In-store operations, mobile phone/tablet, handling customers, need speed

**Essential Features to Consider:**
1. **Sales Recording**:
   - Quick sales entry form
   - Item search and selection
   - Barcode scanning (if applicable)
   - Quantity and price entry
   - Multiple items per transaction
   - Delivery option toggle
   - Transaction summary
   - Quick item shortcuts

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

### Deliverer - Feature Requirements

**Context**: On the road, mobile phone, often in vehicle, poor connectivity

**Essential Features to Consider:**
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

**Essential Features to Consider:**
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

## Core UI Components Required

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
6. **AI Suggestions Panel**: 
   - Display AI-generated recommendations and insights
   - Show note that AI requires one month of data before activation
   - Display edge AI insights analyzing both sales patterns AND inventory items
   - Suggestion categories (inventory, sales, worker performance, operations)
   - Confidence scores and priority rankings
   - Action buttons to implement suggestions
7. **Conversational AI Interface (ChatGPT-like)**:
   - Chat interface with message history
   - Natural language input for business queries
   - Real-time AI responses based on sales data
   - Context-aware conversations
   - Example queries:
     - "How are my sales today?"
     - "Which worker is performing best?"
     - "What items should I restock?"
     - "Show me sales trends for this week"
   - Loading states and typing indicators
   - Conversation history sidebar
8. **AI Alerts & Notifications**:
   - Smart alerts for low stock, sales anomalies, performance issues
   - Alert badges and notification center
   - Configurable alert preferences
   - Anomaly detection notifications
8. **Multi-Store Interconnection View**: Show interconnected stores and cross-store analytics
9. **Store Management**: CRUD interface for managing stores
10. **Worker Management**: Add/edit/assign workers to stores
11. **Deliverer Management**: Add/edit/assign deliverers to stores; View deliverer performance
12. **Delivery Dashboard**: View all deliveries across stores; Assign deliveries to deliverers; Real-time delivery tracking with GPS; Delivery analytics and reports

### Worker Interface Components
1. **Sales Entry Form**: 
   - Item selector (searchable dropdown)
   - Quantity input
   - Price display/override
   - Quick add buttons
   - Transaction summary
   - **Delivery Option**: Checkbox/option to create delivery order
   - **Automatic Worker Attribution**: Each sale automatically attributed to the logged-in worker
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
8. **Worker-Specific Design**: Ensure this feels like a completely separate app, not just a restricted view of master features

### Deliverer Interface Components
1. **Today's Deliveries List**: 
   - List of assigned deliveries for today
   - Delivery status badges
   - Customer name and address preview
   - Delivery time/priority indicators
2. **Delivery Details View**: 
   - Full customer information
   - Items to deliver (list)
   - Delivery address with map
   - Contact customer button (call/message)
   - Delivery instructions/notes
3. **Status Update Controls**: 
   - Large status buttons (Picked Up, In Transit, Delivered)
   - GPS location capture
   - Photo confirmation (optional)
   - Delivery notes/comments
4. **Delivery Route View**: 
   - Map with delivery locations
   - Route optimization
   - Navigation integration
   - Multiple delivery route view
5. **Delivery History**: 
   - Past deliveries
   - Delivery statistics (completed, failed, etc.)
   - Earnings/tips (if applicable)
6. **Communication**: 
   - Contact store/master
   - Contact customer
   - Report issues
7. **Simple Navigation**: Minimal navigation (Deliveries, Route, History, Profile)
8. **Mobile-First Design**: Optimized for on-the-road use, offline capable

### Customer/User Interface Components
1. **Product/Menu Browser**: 
   - Grid/list view of products
   - Product cards with images, name, price
   - Product categories/filters
   - Search functionality
2. **Product Detail View**: 
   - Large product image
   - Product name, description, price
   - Availability indicator
   - Add to cart button (if ordering enabled)
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

### Shared Components
1. **Authentication**: 
   - Login page with role-based redirect
   - Auth context provider (`useAuth` hook)
   - Session management with Supabase
   - Protected route wrapper
2. **Header/Navbar**: Role-aware navigation (different for Master vs Worker vs Deliverer vs Customer)
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
7. **Offline Support**:
   - Offline indicator component
   - Offline queue manager
   - Auto-sync service
   - Network status detection
8. **Service Layer Pattern**:
   - Service classes for API calls (TransactionService, AlertService, etc.)
   - Static methods for service operations
   - Error handling in services
   - Type-safe service interfaces

## Design Approach Brainstorming & Decision Framework

**CRITICAL**: Do NOT implement a prescriptive design. Instead, you must **brainstorm, analyze, and propose** the best design approach for each interface. Consider the user context, needs, and modern design patterns to create an optimal experience.

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
   - **Dashboard Design**: Study modern dashboard patterns (Stripe Dashboard, Vercel Dashboard, Linear, etc.)
   - **Mobile-First**: Research mobile-first design best practices
   - **E-Commerce**: Study successful e-commerce patterns (Amazon, Shopify, etc.)
   - **Delivery Apps**: Look at delivery app patterns (Uber Eats, DoorDash, etc.)
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
- They need AI insights - how should AI features be integrated without overwhelming?

#### Layout Approach Brainstorming
**Consider These Options:**
- **Dashboard Layout**: Multi-column grid? Single column with cards? Tabbed interface? Sidebar navigation? Bottom navigation?
- **Information Architecture**: What's the hierarchy? What's most important? How should sections be organized?
- **Navigation Pattern**: Sidebar? Top nav? Bottom nav? Hamburger menu? Tab navigation? What works best for mobile?
- **Content Density**: How much information per screen? Should it be dense or sparse? How to balance?

**Your Task**: Analyze the master user's needs and propose the optimal layout approach. Justify your choice based on:
- User context (remote monitoring, phone usage)
- Information needs (analytics, management, AI)
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

#### AI Integration Design Brainstorming
**Questions to Consider:**
- How should the AI chat interface be integrated? (Floating button? Dedicated page? Sidebar?)
- How should AI suggestions be presented? (Panel? Cards? Notifications?)
- How should AI alerts be displayed? (Notification center? Badges? Pop-ups?)
- How can AI features be discoverable without being intrusive?

**Your Task**: Design AI integration that:
- Feels natural and integrated
- Doesn't overwhelm the interface
- Makes AI features discoverable
- Provides clear value to users

### Worker Interface Design Brainstorming

#### Context & User Needs Analysis
**Questions to Consider:**
- Workers are in-store, handling customers, need to record sales quickly - how can speed be optimized?
- They're often using shared devices or their own phones - how should the design account for this?
- They need simple, focused tasks - how can complexity be minimized?
- They're not tech-savvy - how can the interface be made intuitive?
- They need to work fast during busy periods - how can the design support speed?
- They need to check inventory quickly - what's the fastest way to access this?

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

#### Feature Prioritization Brainstorming
**Questions to Consider:**
- What features are absolutely essential for workers?
- What features can be hidden or secondary?
- How should delivery options be presented?
- How should inventory checking be accessed?
- What information should workers see about their performance?

**Your Task**: Prioritize features based on:
- Task frequency (what do they do most?)
- Task criticality (what's most important?)
- User needs (what helps them most?)
- Simplicity (what keeps the interface simple?)

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

#### Status Update Design Brainstorming
**Questions to Consider:**
- **Status Buttons**: How large should they be? Should they be full-width? Should they be color-coded?
- **Status Flow**: How should the status progression work? (Assigned → Picked Up → In Transit → Delivered)
- **Confirmation**: How should status updates be confirmed? Should there be confirmation dialogs?
- **Error Handling**: What if status update fails? How should retry work? How should offline updates be handled?

**Your Task**: Design status updates that:
- Are one-tap actions
- Are impossible to miss
- Work offline
- Provide clear feedback
- Support the delivery workflow

#### Map & Navigation Design Brainstorming
**Questions to Consider:**
- **Map Integration**: Should map be primary view? Should it be overlay? Should it be separate page?
- **Route Display**: How should multiple deliveries be shown on map? How should route be optimized?
- **Navigation**: Should navigation open external app? Should it be in-app? How should directions be shown?
- **Location Sharing**: How should GPS tracking be indicated? Should deliverers see their location?

**Your Task**: Design map integration that:
- Shows delivery locations clearly
- Supports route optimization
- Integrates with navigation
- Works offline
- Doesn't drain battery excessively

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

#### Visual Design Brainstorming
**Questions to Consider:**
- **Color Scheme**: What colors feel inviting and trustworthy? What colors work for retail? How should CTAs be highlighted?
- **Typography**: What fonts feel modern and readable? How should product names be displayed? How should prices be emphasized?
- **Images**: How should product images be displayed? What size and aspect ratio? How should image loading be handled?
- **Visual Hierarchy**: What should draw attention first? (Products? Search? Cart?) How should information be prioritized?

**Your Task**: Propose a design system that:
- Feels modern and inviting
- Builds trust and confidence
- Makes products attractive
- Follows e-commerce best practices
- Works across devices

#### Product Discovery Design Brainstorming
**Questions to Consider:**
- **Search**: How should search work? (Auto-complete? Suggestions? Recent searches?) Where should it be placed?
- **Categories**: How should categories be displayed? (Tabs? Sidebar? Dropdown?) How should navigation work?
- **Filtering**: What filters are most useful? (Price? Availability? Category?) How should filters be presented?
- **Sorting**: What sort options are needed? (Price? Popularity? Newest?) How should sorting be accessible?

**Your Task**: Design product discovery that:
- Makes finding products easy
- Supports various browsing patterns
- Provides helpful filters and sorting
- Works well on mobile
- Follows e-commerce conventions

#### Shopping Cart & Checkout Design Brainstorming
**Questions to Consider:**
- **Cart Display**: How should cart be shown? (Sidebar? Bottom sheet? Full page?) How should items be displayed?
- **Checkout Flow**: How many steps should checkout take? What information is required? How can it be simplified?
- **Payment**: How should payment methods be selected? What payment options should be supported?
- **Order Confirmation**: How should order confirmation be displayed? What information should be shown?

**Your Task**: Design checkout that:
- Minimizes steps and friction
- Builds trust and confidence
- Handles errors gracefully
- Works well on mobile
- Follows e-commerce best practices

## Key Features to Implement

### Authentication & Authorization
- Login page with email/password
- Role detection (Master/Worker)
- Protected routes based on role - complete route separation
- **Route Structure**:
  - `/master/*` → Requires Master role, redirects workers
  - `/worker/*` → Requires Worker role, redirects masters
  - `/login` → Public
- **Component-Level Access Control**: Conditional rendering based on role
- **Feature Flags**: Check user role before rendering features
- Session management with role-based timeout
- Logout functionality
- **Access Enforcement**: Workers redirected if trying to access master routes, and vice versa

### Master Features
- View all interconnected stores (if multiple)
- Switch between stores
- View all sales across stores or filtered by store
- View worker performance metrics with **weighted average** calculations
- See "who is selling what" - detailed worker attribution per sale
- Add/edit workers and deliverers
- Assign workers/deliverers to stores
- **Delivery Management**: Assign deliveries to deliverers; View all deliveries; Real-time GPS tracking; Delivery analytics
- **AI-Powered Features**:
  - **Conversational AI Chat**: ChatGPT-like interface to query AI about business insights
    - Natural language queries about sales, inventory, workers
    - Context-aware responses
    - Conversation history
  - **AI Suggestions**: View AI-generated recommendations
    - Inventory optimization suggestions
    - Sales strategy recommendations
    - Worker performance insights
    - Store operations optimization
  - **AI Alerts**: Smart alerts for low stock, anomalies, performance issues
  - **Predictive Analytics**: Sales forecasts, price predictions, demand forecasting
  - **Pattern Analysis**: Sales patterns, trends, insights
- View analytics and charts
- **Sales Status Monitoring**: See if sales are going good/bad/worse for each store
- **Multi-Store Interconnection**: View cross-store analytics and comparisons
- Monitor from phone/anywhere (home-based management)
- Export reports (future-ready UI)

### Worker Features (Limited Privileges)
- **Sales Operations**:
  - Record sales transactions (automatically attributed to worker)
  - View own sales summary for today only (count and total)
  - Cannot view sales list or history
  - Cannot edit or delete any sales (including own)
- **Inventory Operations**:
  - Record/store items in digital catalog (if permitted)
  - Select items from inventory for sale
  - View inventory items and stock levels
  - Check inventory status
  - Update item availability (if permitted)
  - Cannot create, edit, or delete items
  - Cannot perform bulk operations
- **Limited Access**:
  - Access limited to assigned store(s) only
  - Cannot see other stores or switch stores
  - Cannot view other workers or their performance
  - No analytics, charts, or reports
  - No AI features or suggestions
  - No management features
  - No settings access (except own profile)
- **Interface**: Simple, task-focused interface - completely separate from master, no analytics or master features visible

## Data Flow & State Management

### State Structure
```typescript
{
  auth: {
    user: User | null,
    role: 'master' | 'worker' | null,
    loading: boolean
  },
  stores: {
    currentStore: Store | null,
    allStores: Store[],
    loading: boolean
  },
  sales: {
    recentSales: Sale[],
    filteredSales: Sale[],
    loading: boolean,
    filters: { dateRange, worker, store }
  },
  workers: {
    list: Worker[],
    performance: WorkerPerformance[],
    loading: boolean
  },
  inventory: {
    items: Item[],
    categories: Category[],
    loading: boolean
  },
  ai: {
    suggestions: AISuggestion[],
    loading: boolean,
    conversationHistory: Message[],
    dataCollectionDays: number // Track days until one month threshold
  },
  stores: {
    interconnections: StoreConnection[],
    crossStoreAnalytics: CrossStoreAnalytics
  },
  salesStatus: {
    currentStatus: 'good' | 'bad' | 'worse',
    stores: StoreStatus[]
  }
}
```

### Real-time Updates
- Subscribe to sales updates for current store
- Update dashboard in real-time when new sales occur
- Show live indicators for active workers
- Real-time inventory updates

## API Integration Points

### Supabase Queries Needed
- User authentication (Supabase Auth) with role detection
- Fetch stores for master (including interconnections)
- Fetch sales with filters and worker attribution
- Fetch workers and performance (with weighted average calculations)
- Fetch inventory items
- Create sales transactions (with automatic worker attribution)
- Update inventory
- Fetch sales status (good/bad/worse) for stores
- Real-time subscriptions for sales, inventory, sales status
- Cross-store analytics queries

### AI API Integration Points
- **Chat Endpoint**: `POST /api/ai/chat`
  - Send message to AI assistant
  - Receive context-aware responses
  - Maintain conversation history
- **Suggestions Endpoint**: `GET /api/ai/suggestions`
  - Fetch AI-generated recommendations
  - Filter by category (inventory, sales, performance)
  - Get confidence scores
- **Predictions Endpoint**: `POST /api/ai/predict`
  - Get sales forecasts
  - Price predictions
  - Demand forecasting
- **Alerts Endpoint**: `GET /api/ai/alerts`
  - Fetch AI-generated alerts
  - Real-time alert notifications
  - Alert status management
- **Analysis Endpoint**: `POST /api/ai/analyze`
  - Pattern analysis requests
  - Trend analysis
  - Custom analysis queries

## User Experience Flow

### Master Flow
1. Login → Redirect to Master Dashboard (phone-optimized)
2. Dashboard shows overview of all interconnected stores (or default store)
3. See sales status indicators (good/bad/worse) for each store
4. Can navigate to: Sales View, Workers, Deliverers, Deliveries, Analytics, Stores, AI Suggestions, Conversational AI
5. Can switch between interconnected stores
6. View "who is selling what" - detailed worker attribution
7. Assign deliveries to deliverers and track in real-time with GPS
8. Query AI assistant (ChatGPT-like) for business insights
9. Real-time updates visible throughout (accessible from home/anywhere)

### Worker Flow
1. Login → Redirect to Worker Dashboard (separate app experience)
2. Default view: Sales Entry Form
3. Can navigate to: Today's Sales, Inventory Check, Deliveries, Item Recording
4. Simple, focused interface - no master features visible
5. Quick actions for common tasks
6. Each sale automatically attributed to worker
7. Can create delivery orders when recording sales (if delivery needed)
8. Can view delivery status for assigned store (read-only)
9. Can record items in digital catalog

### Deliverer Flow
1. Login → Redirect to Deliverer Dashboard (mobile app)
2. View today's assigned deliveries list
3. Select delivery → View details (customer, items, address, map)
4. Start delivery → Update status to "Picked Up"
5. In transit → Update status to "In Transit" (GPS tracking active)
6. Arrive at location → Update status to "Delivered" (with confirmation)
7. View delivery history and statistics
8. Contact customer or store if needed

### Customer Flow
1. Download App or Access Web → Browse Products (no login required for browsing)
2. View Product Details → Check Availability & Price
3. Add to Cart (if ordering enabled) → Place Order
4. Track Order → View Delivery Status (if order placed)
5. View Order History → Past purchases
6. Search/Browse → Find products by category or search

## Implementation Guidelines

### Component Structure
```
src/
  components/
    master/
      Dashboard/
      SalesAnalytics/
      WorkerManagement/
      DelivererManagement/
      DeliveryDashboard/
      StoreManagement/
      AI/
        AISuggestions/
        ConversationalAI/
        AIAlerts/
        Predictions/
      SalesStatus/
      MultiStoreAnalytics/
    worker/
      SalesEntry/
      SalesHistory/
      InventoryView/
      ItemRecording/
      DeliveryStatus/
    deliverer/
      DeliveriesList/
      DeliveryDetails/
      StatusUpdate/
      RouteView/
      DeliveryHistory/
      Communication/
    customer/
      ProductBrowser/
      ProductDetail/
      ShoppingCart/
      OrderTracking/
      StoreInfo/
      OrderHistory/
    shared/
      Auth/
      Layout/
      UI/
  pages/
    MasterDashboard.tsx
    WorkerDashboard.tsx
    DelivererDashboard.tsx
    CustomerApp.tsx
    Login.tsx
  hooks/
    useAuth.ts
    useSales.ts
    useStores.ts
    useWorkers.ts
    useDeliverers.ts
    useDeliveries.ts
    useProducts.ts
    useOrders.ts
    useAI/
      useAIChat.ts
      useAISuggestions.ts
      useAIAlerts.ts
      useAIPredictions.ts
  services/
    supabase.ts
    api.ts
    gps.ts
    ai/
      chatService.ts
      suggestionService.ts
      alertService.ts
      predictionService.ts
  context/
    AuthContext.tsx
    StoreContext.tsx
    DeliveryContext.tsx
  types/
    index.ts
```

### Key Implementation Notes
- Use React Context for global state (auth, current store)
- Implement custom hooks for data fetching
- Use React Query or SWR for server state management
- Implement proper error boundaries
- Add loading states for all async operations
- Validate forms on frontend before submission
- Implement optimistic updates for better UX
- Use Supabase Realtime for live data
- Implement proper TypeScript types for all data models
- **AI Integration**:
  - Implement AI service layer for API calls
  - Use React Query for AI conversation state
  - Handle AI loading states and errors gracefully
  - Implement conversation history management
  - Add typing indicators for AI responses
  - Cache AI suggestions and predictions
  - Implement real-time alert notifications

## Styling Approach
- Use Tailwind CSS utility classes
- Create reusable component variants
- Implement a design system with consistent spacing, colors, typography
- Use CSS variables for theming
- Ensure accessibility (ARIA labels, keyboard navigation)
- Mobile-responsive breakpoints

## Testing Considerations (Structure Only)
- Component structure should allow for easy testing
- Separate business logic from UI components
- Use custom hooks for reusable logic

## Priority Features for MVP

### Phase 1: Authentication & Access Control (CRITICAL)
1. **Multi-Role Authentication**:
   - Login with role detection (Master/Worker/Deliverer/Customer)
   - Complete route separation:
     - `/master/*` → Master role
     - `/worker/*` → Worker role
     - `/deliverer/*` → Deliverer role
     - `/customer/*` or `/` → Public/Customer
   - Role-based redirects
   - Protected routes enforcement

### Phase 2: Master Dashboard (phone-optimized)
- Sales overview with status indicators (good/bad/worse)
- Worker performance with weighted averages
- Sales list with worker attribution ("who is selling what")
- **Delivery Dashboard**: Assign deliveries, track with GPS, view all deliveries
- **Deliverer Management**: Add/edit/assign deliverers
- **AI Features**:
  - Conversational AI chat interface
  - AI suggestions panel
  - AI alerts and notifications
  - Data collection progress indicator (showing days until AI activation)
- Multi-store switching (if multiple stores)
- Real-time updates

### Phase 3: Worker Interface (separate app experience)
- Sales entry form (primary focus)
- **Delivery Option**: Create delivery orders when recording sales
- Today's sales summary (own only)
- **Delivery Status View**: View deliveries for assigned store (read-only)
- Inventory quick view
- Item recording (if permitted)
- No analytics, no master features visible

### Phase 4: Deliverer Interface (mobile-first)
- Today's deliveries list
- Delivery details view with map
- Status update controls (large buttons)
- GPS location sharing
- Route view with navigation
- Offline capability
- No business features (sales/inventory/analytics)

### Phase 5: Customer Interface (public app)
- Product/menu browser (public access)
- Product detail view
- Search and filter functionality
- Shopping cart (if ordering enabled)
- Order tracking (if ordering enabled)
- Store information
- Downloadable mobile app

### Phase 6: Privilege Enforcement
- Frontend route protection for all 4 interfaces
- Component-level access control
- Data isolation:
  - Workers see only assigned store
  - Deliverers see only assigned deliveries
  - Customers see only public menu and own orders
  - Masters see all stores
- Backend API protection (future)
- GPS location privacy (only shared with master/workers)

### Phase 7: Design Differentiation
- **Master**: Information-dense, analytical, multi-featured
- **Worker**: Minimal, task-focused, mobile-first, large touch targets
- **Deliverer**: Mobile-first, status-focused, GPS-integrated, offline-capable
- **Customer**: E-commerce style, visual product browsing, familiar shopping experience

## Additional Implementation Details

### Sales Status Calculation
- Implement three-tier status system: Good, Bad, Worse
- Compare current period sales to previous period
- Visual indicators with color coding
- Only visible to Master role

### Weighted Average Calculation
- Calculate weighted average worker performance (not simple average)
- Weight by sales volume, transaction value, or time period
- Display prominently in worker performance metrics
- Master-only feature

### One Month Data Requirement
- Show data collection progress indicator (Master only)
  - Progress bar showing days collected (e.g., "15/30 days")
  - Countdown to AI activation
  - Visual indicator when AI is ready
- Display "AI features activate after 30 days" message
- Track days of data collection for each store
- Workers should not see this information
- Show placeholder/disabled state for AI features until data threshold is met

### Worker Attribution
- Every sale must show which worker made it
- "Who is selling what" display in master dashboard
- Workers can only see their own sales summary for today
- Automatic attribution on sale creation (cannot be changed by worker)

### Store Interconnection
- Visual representation of interconnected stores (Master only)
- Cross-store comparison views (Master only)
- Shared insights between stores (Master only)
- Workers cannot see or access multi-store features

### Privilege Enforcement Checklist

**Critical Implementation Requirements:**
1. ✅ **Complete Route Separation**: All four interfaces must be completely separate:
   - `/master/*` → Master only
   - `/worker/*` → Worker only
   - `/deliverer/*` → Deliverer only
   - `/customer/*` or `/` → Public/Customer
2. ✅ **Role-Based Redirects**: Wrong role attempts should redirect to correct interface
3. ✅ **Component Guards**: All components should check role before rendering
4. ✅ **Data Filtering**: 
   - Workers only see assigned store data
   - Deliverers only see assigned deliveries
   - Customers only see public menu and own orders
   - Masters see all stores
5. ✅ **Feature Separation**: Each interface should NEVER see features from other interfaces (not hidden, but absent)
6. ✅ **Visual Differentiation**: All four interfaces must look completely different
7. ✅ **Navigation Separation**: Different navigation structures for each role
8. ✅ **API Protection**: Frontend should not attempt to call APIs outside user's privilege level
9. ✅ **GPS Privacy**: Deliverer location only shared with master/workers, not public
10. ✅ **Public Access**: Customer interface should work without authentication for browsing

**What Workers CANNOT Do:**
- ❌ View sales list or history (only today's summary)
- ❌ Edit or delete any sales
- ❌ View analytics, charts, or reports
- ❌ Access AI features
- ❌ Manage workers, deliverers, or stores
- ❌ Assign deliveries to deliverers
- ❌ Access settings (except own profile)
- ❌ Switch between stores
- ❌ Export data
- ❌ View other workers' performance

**What Deliverers CANNOT Do:**
- ❌ View sales or inventory
- ❌ Access analytics or reports
- ❌ Manage workers, stores, or other deliverers
- ❌ View other deliverers' assignments
- ❌ See customer browsing data
- ❌ Access AI features
- ❌ Only delivery-focused features allowed

**What Customers CANNOT Do:**
- ❌ Access sales, analytics, or inventory management
- ❌ View other customers' orders
- ❌ Access worker/deliverer features
- ❌ See business data or reports
- ❌ Only product browsing and own orders (if ordering enabled)

**What Masters CAN Do:**
- ✅ Everything - full system access
- ✅ View all sales across all stores
- ✅ Edit/delete sales
- ✅ Complete analytics and AI features
- ✅ Manage workers, deliverers, and stores
- ✅ Assign deliveries to deliverers
- ✅ Real-time GPS tracking of deliverers
- ✅ Generate reports and exports
- ✅ Multi-store management
- ✅ View all delivery statuses and analytics

## Implementation Priority

### Phase 1: Authentication & Access Control (CRITICAL)
1. Implement role-based authentication
2. Create separate route structures (`/master/*` vs `/worker/*`)
3. Add route protection middleware
4. Implement role-based redirects
5. Add component-level access guards

### Phase 2: Master Interface
1. Build information-dense dashboard
2. Implement all master features
3. Add analytics and charts
4. Create worker management interface
5. Add AI features (with one-month notice)

### Phase 3: Worker Interface
1. Build completely separate worker interface
2. Implement sales entry form (primary focus)
3. Add today's summary (own sales only)
4. Create inventory quick view
5. Ensure NO master features are visible

### Phase 4: Privilege Enforcement
1. Add data filtering (store-level isolation)
2. Implement API protection
3. Add privilege checks to all components
4. Test access control thoroughly
5. Ensure visual separation is complete

Generate a complete, production-ready frontend that implements all these layers and components. Do not create a simple boilerplate - build the full application structure with role-based interfaces, proper state management, and all the components described above. 

**CRITICAL INSTRUCTIONS FOR DESIGN & IMPLEMENTATION**:

## Your Mission: Create the Best Possible Website

This is a **"ChatGPT for retail managers"** with **FOUR completely separate interfaces** - Master, Worker, Deliverer, and Customer. The application is **AI-powered** with conversational AI, intelligent suggestions, predictive analytics, and automated alerts.

### Design Philosophy: Brainstorm First, Implement Best

**DO NOT** implement a prescriptive design. Instead:

1. **Analyze Deeply**: 
   - Understand each user type's context, needs, and goals
   - Research modern design patterns for similar use cases
   - Consider accessibility, performance, and user experience

2. **Brainstorm Options**:
   - Consider multiple design approaches
   - Evaluate trade-offs
   - Think about user workflows and task flows
   - Consider modern frameworks and libraries

3. **Propose & Justify**:
   - Propose your design approach
   - Justify why it's the best choice
   - Explain how it serves user needs
   - Consider alternatives

4. **Implement Excellence**:
   - Build the best possible implementation
   - Follow modern best practices
   - Ensure accessibility
   - Optimize for performance
   - Create a delightful user experience

### Design Requirements

**For Each Interface, You Must:**

1. **Analyze User Context**:
   - Where are they? (home, store, on road, browsing)
   - What device? (phone, tablet, desktop)
   - What's their mental state? (rushed, relaxed, focused)
   - What's their technical comfort?

2. **Identify Core Tasks**:
   - What do they do most often?
   - What's the primary workflow?
   - What information is critical?
   - What actions are essential?

3. **Research Design Patterns**:
   - What patterns work for similar use cases?
   - What modern frameworks are best suited?
   - What accessibility considerations are needed?
   - What performance requirements exist?

4. **Propose Optimal Design**:
   - Layout approach (justify your choice)
   - Navigation pattern (explain why)
   - Visual design system (rationale)
   - Component design (reasoning)
   - Interaction patterns (justification)

5. **Implement with Excellence**:
   - Modern, clean, professional design
   - Intuitive user experience
   - Excellent performance
   - Accessibility compliance
   - Responsive across devices
   - Delightful interactions

### Interface Separation Requirements

Each interface must be architecturally different, not just visually hidden:
- **Master**: Business management from anywhere (home/office) with full AI access
- **Worker**: In-store daily operations (no AI access) - completely separate app
- **Deliverer**: On-the-road delivery logistics (no AI access) - completely separate app
- **Customer**: Product discovery and ordering (no AI access) - completely separate app

### AI Integration

The AI features are central to the Master experience:
- Conversational AI Assistant (ChatGPT-like)
- AI-Powered Suggestions
- Predictive Analytics
- Automated Alerts
- Pattern Analysis

AI requires one month (30 days) of sales data before activation.

### Quality Standards

**You must deliver:**
- Modern, professional design
- Intuitive user experience
- Excellent performance
- Accessibility compliance
- Responsive design
- Clean, maintainable code
- Best practices implementation

**Think deeply, propose thoughtfully, implement excellently. Create the best possible website for each user type.**

## Design Research & Modern Patterns

**CRITICAL**: Before implementing, research and consider modern design approaches. Do not use outdated patterns or generic templates.

### Research Modern Design Patterns

**For Master Dashboard:**
- Study modern business dashboards (Stripe Dashboard, Vercel Analytics, Linear, Notion)
- Research data visualization best practices
- Consider modern chart libraries and patterns
- Look at mobile-first dashboard designs
- Study AI integration patterns in dashboards

**For Worker Interface:**
- Research point-of-sale (POS) system designs
- Study mobile-first form design patterns
- Look at task-focused mobile app designs
- Consider offline-first patterns
- Research fast data entry interfaces

**For Deliverer Interface:**
- Study delivery app designs (Uber Eats driver app, DoorDash driver app)
- Research map integration patterns
- Look at one-handed mobile app designs
- Consider offline-capable patterns
- Study status update interfaces

**For Customer Interface:**
- Study modern e-commerce designs (Amazon, Shopify, Etsy)
- Research product browsing patterns
- Look at mobile shopping app designs
- Consider progressive web app (PWA) patterns
- Study checkout flow best practices

### Modern Framework Considerations

**Consider These Modern Approaches:**
- **Component Libraries**: shadcn/ui, Radix UI, Headless UI, Chakra UI
- **Design Systems**: Material Design, Ant Design, Tailwind UI
- **State Management**: Zustand, Jotai, React Query, SWR
- **Form Libraries**: React Hook Form, Formik
- **Chart Libraries**: Recharts, Chart.js, Victory, Nivo
- **Map Libraries**: Mapbox, Google Maps, Leaflet
- **Animation**: Framer Motion, React Spring
- **Accessibility**: ARIA patterns, keyboard navigation, screen reader support

**Your Task**: Research and select the best modern frameworks and libraries for each interface. Justify your choices based on:
- User needs and context
- Performance requirements
- Accessibility needs
- Modern best practices
- Community support and maintenance

### Design Quality Standards

**You must deliver:**
- **Modern Design**: Following 2024+ design trends and best practices
- **Accessibility**: WCAG 2.1 AA compliance minimum
- **Performance**: Fast loading, smooth interactions, optimized rendering
- **Responsive**: Works perfectly on mobile, tablet, and desktop
- **User Experience**: Intuitive, delightful, efficient
- **Code Quality**: Clean, maintainable, well-structured code
- **Best Practices**: Following React, TypeScript, and modern web best practices

**Think deeply, research thoroughly, propose thoughtfully, implement excellently. Create the best possible website for each user type.**

