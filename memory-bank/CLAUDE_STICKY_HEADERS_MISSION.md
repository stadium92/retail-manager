# Mission: Global UI Refinement - Sticky Table Headers

**Objective:**
Improve the user experience across the entire application by making all table headers (`<TableHeader>`) "sticky". This ensures that column titles remain visible while the user scrolls through long lists.

**Technical Requirements:**
1.  **CSS Pattern:** Use Tailwind classes to lock headers: `sticky top-0 z-10 bg-background`.
2.  **Shadow/Border:** Add a subtle border or shadow (`border-b-2 shadow-sm`) to the sticky header so it remains distinct from the data rows during scrolling.
3.  **Consistency:** Apply this pattern to every module, including:
    *   **Worker side:** Sales grid, Stock Listing, Movements, Regularization, Facturation.
    *   **Master side:** Sales dashboard, Inventory reports, Audit logs, Cash closings.
4.  **Container Check:** Ensure the parent container of the table has `overflow-auto` and a defined height (or `max-h`) for the sticky effect to trigger correctly.

**Files to prioritize:**
*   `frontend/src/components/worker/Modules/*.tsx`
*   `frontend/src/components/shared/GestionModule.tsx`
*   `frontend/src/pages/master/*.tsx`

Please provide a summary of the modules updated.
