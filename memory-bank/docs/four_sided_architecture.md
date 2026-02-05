# Four-Sided Architecture: Master, Worker, Deliverer, Customer

## Overview
The Retail Manager platform operates on a **four-sided architecture** with distinct interfaces for:
1. **Master/Owner** - Store owners and administrators
2. **Worker** - Store employees and sales associates
3. **Deliverer** - Delivery personnel
4. **Customer/User** - End customers browsing menu/products

Each interface serves unique purposes and has specific privileges, while being interconnected to support the complete retail logistics flow.

---

## Interface Roles & Purposes

### 1. Master/Owner Interface
**Purpose**: Complete business management and oversight
- Store management and operations
- Sales analytics and insights
- Worker and deliverer management
- Inventory control
- AI-powered recommendations
- Delivery oversight and tracking

### 2. Worker Interface
**Purpose**: In-store daily operations
- Sales recording
- Inventory updates
- Customer service support
- View delivery status (read-only)
- Basic store operations

### 3. Deliverer Interface
**Purpose**: Delivery operations and logistics
- Receive delivery assignments
- Update delivery status
- View delivery routes and customer details
- Communicate with store/master
- Track deliveries in real-time

### 4. Customer/User Interface
**Purpose**: Product discovery and menu browsing
- Browse store menu/products
- View product details, prices, availability
- Check store information
- Possibly place orders (if enabled)
- Download as mobile app

---

## Data Flow & Interactions

### Delivery Flow
```
Customer → Places Order (via Customer App or in-store)
    ↓
Worker → Records Sale & Creates Delivery Order
    ↓
Master → Assigns Deliverer to Order
    ↓
Deliverer → Receives Assignment & Updates Status
    ↓
Deliverer → Picks Up → In Transit → Delivered
    ↓
Master/Worker → Track Delivery Status (Real-time)
```

### Visibility Matrix

| Action | Master | Worker | Deliverer | Customer |
|--------|--------|--------|-----------|----------|
| View Products/Menu | ✅ (All) | ✅ (Assigned Store) | ❌ | ✅ (Public) |
| Create Sales | ✅ | ✅ | ❌ | ❌ |
| Assign Deliveries | ✅ | ⚠️ (If Permitted) | ❌ | ❌ |
| View Delivery Status | ✅ (All) | ✅ (Assigned Store) | ✅ (Own Only) | ✅ (Own Orders) |
| Update Delivery Status | ✅ | ❌ | ✅ (Own Only) | ❌ |
| View Analytics | ✅ | ❌ | ❌ | ❌ |
| Manage Workers/Deliverers | ✅ | ❌ | ❌ | ❌ |

---

## Deliverer Interface Specifications

### Deliverer Privileges
1. **Delivery Management**:
   - View assigned deliveries only
   - Update delivery status (assigned → picked up → in transit → delivered)
   - View delivery details (customer info, items, address)
   - View delivery route/map

2. **Communication**:
   - Contact customer (call/message)
   - Contact store/master
   - Report delivery issues

3. **Location Services**:
   - GPS tracking (for master/worker visibility)
   - Route optimization
   - Delivery completion confirmation

4. **Limited Access**:
   - Cannot view sales or inventory
   - Cannot access analytics
   - Cannot manage workers or stores
   - Cannot see other deliverers' assignments

### Deliverer Interface Design
- **Layout**: Mobile-first, delivery-focused
- **Primary View**: Today's deliveries list
- **Status Updates**: Large, easy-to-tap status buttons
- **Navigation**: Simple (Deliveries, Profile, Help)
- **Real-time**: GPS location sharing with master/workers
- **Offline Capable**: Can update status even with poor connectivity

### Deliverer User Flow
1. Login → View assigned deliveries for today
2. Select delivery → View details (customer, items, address)
3. Start delivery → Update status to "Picked Up"
4. In transit → Update status to "In Transit" (with GPS tracking)
5. Arrive → Update status to "Delivered" (with confirmation)
6. View delivery history → Past deliveries and statistics

---

## Customer/User Interface Specifications

### Customer Privileges
1. **Product Discovery**:
   - Browse menu/products (public access)
   - View product details (name, price, description, image)
   - Check product availability
   - Search and filter products
   - View store information

2. **Order Management** (If Enabled):
   - Place orders (if order system is enabled)
   - View own order history
   - Track own order delivery status
   - Cancel orders (within time limits)

3. **Store Information**:
   - View store locations
   - Store hours and contact info
   - Available items per store

4. **No Access**:
   - Cannot access sales/analytics
   - Cannot view inventory management
   - Cannot see other customers' orders
   - Cannot access worker/deliverer features

### Customer Interface Design
- **Layout**: Clean, e-commerce style product browsing
- **Mobile App**: Downloadable native or PWA
- **Product Display**: Grid/list view with images
- **Search & Filter**: Easy product discovery
- **Cart System**: If ordering enabled
- **Navigation**: Simple (Menu, Cart, Orders, Profile)

### Customer User Flow
1. Download App → Browse or Search Products
2. View Product Details → Check Availability & Price
3. Add to Cart (if ordering enabled) → Place Order
4. Track Order → View Delivery Status
5. View Order History → Past purchases

---

## Master & Worker Access to Deliverer Interface

### What Master Can See/Do
- **Full Delivery Dashboard**: View all deliveries across all stores
- **Assign Deliverers**: Assign deliveries to available deliverers
- **Real-time Tracking**: See deliverer location and status in real-time
- **Delivery Analytics**: View delivery performance metrics
- **Manage Deliverers**: Create/edit deliverer accounts, assign to stores
- **Delivery Reports**: Generate delivery reports and statistics

### What Worker Can See/Do
- **Assigned Store Deliveries**: View deliveries for their assigned store(s)
- **Delivery Status**: Check status of deliveries (read-only)
- **Create Delivery Orders**: Create delivery assignments when recording sales
- **Contact Deliverer**: Communicate with deliverer about specific delivery
- **Cannot**: Assign deliverers, view analytics, manage deliverer accounts

---

## Database Schema Additions

### Deliverers Table
```sql
deliverers (
  id, user_id, name, phone, vehicle_type, 
  is_active, assigned_stores[], created_at
)
```

### Deliveries Table
```sql
deliveries (
  id, sale_id, store_id, deliverer_id, customer_info,
  delivery_address, status, assigned_at, picked_up_at,
  in_transit_at, delivered_at, gps_location, notes
)
```

### Delivery Status Enum
- `assigned` - Delivery assigned to deliverer
- `picked_up` - Items picked up from store
- `in_transit` - On the way to customer
- `delivered` - Successfully delivered
- `failed` - Delivery failed/returned

### Customer Orders Table (If Enabled)
```sql
customer_orders (
  id, customer_id, store_id, items[], total_amount,
  status, placed_at, delivery_id, delivery_address
)
```

---

## Integration Points

### Between Master and Deliverer
- Master assigns deliveries → Deliverer receives notification
- Deliverer updates status → Master sees real-time updates
- Master can reassign deliveries if needed
- GPS tracking shared with master

### Between Worker and Deliverer
- Worker creates sale with delivery → Delivery order created
- Worker can view delivery status for store's deliveries
- Worker can contact deliverer about specific delivery
- Worker cannot assign or manage deliverers

### Between Customer and System
- Customer browses menu → Views store inventory (public)
- Customer places order → Order flows to store
- Customer tracks order → Sees delivery status
- Customer receives delivery → Delivery marked complete

---

## Security & Access Control

### Deliverer Access
- Can only see assigned deliveries
- Cannot access sales or inventory data
- Cannot view other deliverers' assignments
- GPS location shared only with master/workers (not public)

### Customer Access
- Public menu browsing (no authentication required)
- Order placement may require authentication
- Can only view own orders and delivery status
- Cannot access any backend/management features

---

## Design Principles

### Deliverer Interface
- **Mobile-First**: Optimized for mobile devices (they're on the road)
- **Status-Focused**: Large, clear status update buttons
- **Offline Capable**: Works with poor connectivity
- **GPS Integration**: Location services for tracking
- **Simple Navigation**: Minimal, task-focused

### Customer Interface
- **E-Commerce Style**: Familiar shopping experience
- **Visual Product Display**: Images, prices, details
- **Easy Discovery**: Search, filter, categories
- **Mobile App**: Downloadable, native feel
- **Public-Friendly**: No complex features

---

This four-sided architecture creates a complete retail ecosystem where each user type has appropriate tools and access levels while maintaining security and operational efficiency.


