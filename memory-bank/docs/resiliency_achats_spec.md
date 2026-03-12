# Resiliency & Achats Refinement Specification

## 1. LocalBridge Resiliency (The Heartbeat)
To handle unexpected shutdowns or session expirations:

### Frontend implementation
- **Hook**: `useBridgeStatus()` - Pings `GET /health` every 10s.
- **UI**: A small dot in the status bar (Green: Connected, Red: Disconnected).
- **Auto-Refresh**: In `OfflineAuthService`, the `localBridgeRequest` wrapper should catch `401` status, call `/auth/refresh`, and retry the original request once.

## 2. Achats (Purchasing) Refinement
Objective: Simplify the workflow for offline computers.

### User Flow: "Réception Express"
1.  **Selection**: Worker selects an "Ordered" purchase order.
2.  **Auto-Fill**: A button "Tout reçu" (Received All) sets all `quantity_received = quantity_ordered`.
3.  **Validation**:
    -   If a price has changed, the user updates `unit_cost`.
    -   The system flags any row where `received < ordered`.
4.  **Local Commit**:
    -   Update `purchase_orders` status to `received`.
    -   Add records to `inventory_movements` table.
    -   Increment `current_stock` in the `products` table.

### Security / Audit (Offline)
- Even if offline, the system must log *which* worker validated the reception using their local session ID.
