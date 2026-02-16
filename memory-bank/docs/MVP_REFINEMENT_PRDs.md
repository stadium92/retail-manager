# 📋 MVP Refinement PRDs (v1.0 Preparation)

This document outlines the requirements for essential features needed before shipping the Retail Manager v1.0.

---

## 🛡️ PRD-005: Audit Log System
**Objective:** Track system actions for accountability and troubleshooting.

### **Requirements:**
- **Local Storage:** Store audit logs in the local SQLite database via LocalBridge.
- **Capture Points:**
  - Successful/Failed Logins.
  - Product Price changes.
  - Inventory manual adjustments (Régularisation).
  - Deletion of Sales records.
- **Fields:** Timestamp, User ID, Action Type, Entity Affected, Old Value, New Value, IP/Device (optional).
- **UI:** A "System Logs" view in the Master Dashboard to view/filter these actions.

---

## 📖 PRD-006: Help & Documentation
**Objective:** Reduce support tickets by providing built-in guidance.

### **Requirements:**
- **Contextual Tooltips:** Use "info" icons next to complex fields (e.g., "Moyenne Pondérée").
- **Quick-Start Guide:** A "Help" section in the sidebar with short, searchable articles on:
  - How to perform a sale.
  - How to receive purchases.
  - How to sync data.
- **Offline Access:** Documentation must be bundled with the app (Markdown or JSON).

---

## ✨ PRD-007: UX Standardisation (Errors, Loading, Confirmations)
**Objective:** Provide a professional and predictable user experience.

### **Requirements:**
- **Standardized Errors:**
  - Use a global toast system with clear categories (Success, Warning, Error).
  - Replace generic "Error" with actionable messages (e.g., "Cannot save: Stock would go negative").
- **Consistent Loading:**
  - Use Skeleton screens for table loading.
  - Implement full-button loading states (spinners) to prevent double-submissions.
- **Safety Confirmations:**
  - Required for: Deleting a sale, Resetting inventory, Changing user roles, Logging out (optional).

---

## 🔍 PRD-008: Data Navigation (Search & Filters)
**Objective:** Allow users to handle thousands of records efficiently.

### **Requirements:**
- **Global Table Search:** Debounced search field on every list view.
- **Date Range Filters:** Essential for Sales and Purchase tracking.
- **Category/Store Filters:** Multi-select filters for inventory views.
- **Persistence:** (Optional) Remember the last used filters during the session.

---

## 🔐 PRD-009: Security & Access Control
**Objective:** Protect business data and ensure correct user permissions.

### **Requirements:**
- **Password Enforcement:** 
  - Minimum 8 characters.
  - Requirement for at least one number/special character.
- **Role Auditing:**
  - **Admin (Master):** Full access to all stores, analytics, and settings.
  - **Cashier (Worker):** Access only to POS, their store's inventory, and their own sales.
  - **Deliverer:** Access only to assigned deliveries and map.
- **Data Security - Encryption:** Investigate SQLite encryption (SQLCipher) for sensitive local tables.

---

## ⚡ PRD-010: Performance & QA
**Objective:** Ensure reliability on target hardware (Dual Core, 2.5GB RAM).

### **Requirements:**
- **Performance:**
  - App startup time < 5s.
  - Module transition < 500ms.
  - Search results appearing in < 200ms using SQLite FTS5.
- **Testing Flow:**
  - Verify offline sales record -> sync to cloud -> verify on Master dashboard.
  - Verify low stock alert -> create order -> receive order -> verify stock increase.
