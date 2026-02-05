# PRD: Consolidation, Fixes & Optimization

## 1. Overview
This PRD addresses a collection of UI/UX bugs, routing inconsistencies, localization issues, and specific module dysfunctions identified during testing. The goal is to stabilize the Master/Worker interfaces, ensure French localization is ubiquitous, and optimize performance for low-end hardware.

## 2. Localization & i18n
*   **Default Language**: Force "French" (fr) as the default language application-wide.
*   **Language Selector**: Add a language selector to the root `Index` page (Launch screen).
*   **Translation Keys**: Fix missing translation keys:
    *   `common.eneable` -> `common.enable` (Activer)
    *   `workers.accountStatus` (Statut du compte)
    *   Found in "Workers/Equipe" and "Livraison" pages.

## 3. Routing & Navigation Cleanup
*   **Duplicate Routes**:
    *   **Delete**: `/master/workers` (Redundant).
    *   **Keep**: `/master/team` (Canonical "Équipe" page).
*   **Master Dashboard**:
    *   **Inventaire**: Remove "Clé Supabase" (Supabase Key) from the UI. It's a technical detail not needed for the Master user.
    *   **Invitations**: `/master/invitations`
        *   **Action**: Mark as "In Construction" / "Offline Only".
        *   **Fix**: The "Invite Worker" button crashes with `<Select.Item />` error (empty value prop). Fix this crash even if the feature is offline-limited.

## 4. Module Fixes & Enhancements

### A. Achats (Purchasing)
*   **Worker Side**: In "Réception/Achats", supplier/commander names are missing.
    *   **Fix**: Ensure `purchase_orders` join with `suppliers` correctly displays names in the list.
*   **Master Visibility**: Master must see "Commandes" (Orders) from their dashboard.
    *   **Feature**: Add "Commandes" view or integrate into "Livraisons/Achats" in Master dashboard.
    *   **Notification**: New purchases/receptions by workers should appear in Master's "Deliveries" or a dedicated feed.

### B. Stock Module
*   **Valorisation**: The "Valorisation du stock" submodule is broken/not working.
    *   **Fix**: Wire up the UI to the existing `OfflineDataService.getStockValuation` method.
*   **Inventaire (Inventory)**: Memory optimization needed.
    *   **Problem**: Loading all products for inventory crashes low-end hardware.
    *   **Solution**: Implement "Paged Inventory" or "Category-based Inventory" to load products in chunks (Virtualization).

### C. Shortcuts
*   **Conflict**: "F2" (Aide) conflicts with "Facturation au Détail".
    *   **Fix**: Remap "Aide" to a non-conflicting key (e.g., F1 or F12) or disable global shortcuts when inside specific modules.

## 5. AI & Analytics
*   **AI Chat Crash**: The AI chat interface crashes or errors out (Screenshot: `Screenshot 2026-02-01 at 19.43.37.png`).
    *   **Task**: Debug AI service connection and error handling. Improve "Insight" quality.
*   **Master Analytics**: `/master/analytics`
    *   **Requirement**: Ensure logic is sound (Real aggregations), not just placeholder filler. Verify `getDashboardAnalytics` is being used here too.

## 6. Implementation Plan
1.  **Housekeeping**: Fix localization keys and delete duplicate routes.
2.  **UI Fixes**: Repair "Invite Worker" crash and remove Supabase Key.
3.  **Logic Repair**: Fix "Achats" display names and Master visibility.
4.  **Optimization**: Refactor "Inventaire" for pagination/virtualization.
5.  **AI/Analytics**: Debug AI chat and verify Analytics data source.
