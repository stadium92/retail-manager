# Product Requirements Document (PRD)
# Djati Restaurant Manager — Frontend Web Application

## 1. Product Overview

**Product Name:** Djati Restaurant Manager  
**Version:** 0.5.5  
**Type:** Progressive Web Application (PWA) — Offline-first, Multi-role Restaurant Management System

Djati is a full-stack restaurant management platform designed for restaurant owners and their staff. It supports offline operation via IndexedDB caching with cloud sync to Supabase when online. It serves four distinct user roles: **Master** (owner), **Cashier**, **Cook**, and **Waiter**, each with dedicated UI modules.

---

## 2. User Roles

| Role | Access Level | Default Route |
|------|-------------|---------------|
| master | Full access to all modules | /master/dashboard |
| worker | Full worker module access | /worker/dashboard |
| cashier | Commandes + Programme only | /worker/dashboard |
| cook | KDS + Programme only | /worker/dashboard |
| waiter | Tables / Plan de salle only | /worker/dashboard |
| deliverer | Delivery dashboard | /deliverer/dashboard |
| customer | Public catalog browsing | /customer/browse |

---

## 3. Authentication & Session Management

### 3.1 Cloud Login (First-Time Bootstrap)
- User navigates to `/auth`
- Enters email and password
- System authenticates against Supabase Auth
- System queries `user_roles` table to determine role and store association
- Roles are selected by priority: master (4) > worker/cashier/cook/waiter (3) > deliverer (2) > customer (1)
- Session is saved to IndexedDB for offline use
- User is redirected to role-appropriate dashboard

### 3.2 Offline Login
- User enters credentials on `/auth`
- System attempts cloud login; falls back to IndexedDB session if offline
- Role and store_id are resolved from cached local roles

### 3.3 Role-Based Redirect
- After login, users are redirected based on primary role:
  - `master` → `/master/dashboard`
  - `cashier`, `cook`, `waiter`, `worker` → `/worker/dashboard`
  - `deliverer` → `/deliverer/dashboard`
  - `customer` → `/customer/browse`

---

## 4. Cashier Module

### 4.1 Desktop (Laptop)
Visible menu sections:
- **Commandes:**
  - Ticket commande (`facturation-detail`) — Main POS screen
  - Fermeture Caisse (`fermeture-caisse`) — Cash closing (F12 shortcut)
  - Règlement de bons (`reglements-bons`) — Invoice settlement
- **Programme:**
  - Préférences
  - Programmation touches
  - Mots de passe

### 4.2 Mobile
- Bottom tab bar: **Caisse** (POS) + **Menu**
- Menu screen shows:
  - **Commandes:** Ticket commande, Fermeture Caisse
  - **Programme:** Préférences, Programmation touches, Mots de passe

### 4.3 Key Behaviors
- Layout uses dark gold (`#F5C518`) theme
- `CashierReadyOrdersBell` notification bell in header
- `NotificationCenter` icon in header
- Default module on login: `facturation-detail`

---

## 5. Cook (Cuisine) Module

### 5.1 Desktop (Laptop)
Visible menu sections:
- **Restaurant:**
  - KDS — Kitchen Display System
- **Programme:**
  - Préférences
  - Programmation touches
  - Mots de passe

### 5.2 Mobile
- Single-screen KDS view (no bottom tab bar needed for cook-only)
- Menu screen shows **Programme** section only

### 5.3 Key Behaviors
- Default module on login: `kds`
- Layout uses dark black theme
- Real-time order subscription via Supabase Realtime

---

## 6. Waiter Module

### 6.1 Desktop & Mobile
- Only accessible module: **Plan de salle / Tables** (`tables`)
- No minimum width gate (waiter layout works on small screens)

### 6.2 Mobile
- Menu tab → "Plan de salle / Tables" option
- No bottom tab bar for POS or KDS

---

## 7. Master (Owner) Dashboard

### 7.1 Features
- Full sales reporting and edition modules
- Team management (add/remove workers)
- Stock and inventory management
- Purchase management (reception, orders, supplier settlement)
- Cash journal and dashboard analytics
- Invitations and audit logs

---

## 8. Technical Constraints

### 8.1 Offline-First Architecture
- All data reads prefer IndexedDB first
- Supabase sync via `sync_outbox` table
- Roles and sessions cached in LocalDatabase (IndexedDB)

### 8.2 Minimum Width Gate
- Most worker desktop modules require minimum 675px width
- Waiter (`tables` module) bypasses this gate to support narrow screens

### 8.3 Direct Role Support
- Database `user_roles.role` can be `cashier`, `cook`, `waiter`, `waiters` directly (not just `worker`)
- `waiters` is normalized to `waiter` in the frontend
- Role priority ensures highest-privilege role is selected when multiple rows exist

---

## 9. Non-Functional Requirements

- App must load and be interactive within 3 seconds on broadband
- Authentication must complete within 5 seconds (with 5s timeout fallback)
- Mobile layout must be fully functional on screens ≥ 320px wide
- All role-restricted modules must be inaccessible even via direct URL manipulation
