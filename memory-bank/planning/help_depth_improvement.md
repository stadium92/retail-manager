# Planning: Help Module Depth & Accuracy Improvement

## Objective
Enhance the Help Center to provide deep, accurate, and professional documentation based on the actual application code. Ensure no misleading information exists and improve the UI/UX for better accessibility.

## Phase 1: Deep Code Audit (Accuracy Verification)
- [ ] **Data Flow Audit**: Verify "Offline-First" explanation.
    - Confirm LocalBridge (SQLite) role vs. Supabase (Cloud).
    - Document exact sync triggers (auto-sync on connection).
- [ ] **Module Logic Audit**:
    - **Sales**: Document differences between "Vente Détail", "Facturation", and "Proforma".
    - **Stock**: Document how "Régularisation" works vs. "Inventaire". Explain the "Threshold" (Seuil) logic.
    - **Edition**: Explain calculation methods for "Valorisation" and "Marge Potentielle".
- [ ] **Interaction Audit**:
    - List all hardcoded and configurable keyboard shortcuts (F1-F12).
    - Document ESC/Enter behavior in POS grid.

## Phase 2: Content Expansion (Increasing Depth)
- [ ] **Advanced Guides**:
    - Create a "Troubleshooting Sync" guide.
    - Create a "Managing Suppliers & Debt" guide.
    - Add "Daily Closing Procedure" (Fermeture Caisse) documentation.
- [ ] **Multi-language Depth**:
    - Ensure all new deep content is available in French, English, and Bambara.
    - Use the actual UI labels (e.g., "Qté Commandée" instead of "Quantity").

## Phase 3: UI/UX Refinement
- [ ] **Structural Improvements**:
    - Implement a searchable knowledge base.
    - Add "Quick Tips" for the most common tasks.
- [ ] **Visual Polish**:
    - Use consistent iconography for different help categories.
    - Improve Markdown rendering style (prose improvements).

## Phase 4: Verification & Feedback
- [ ] **Cross-reference**: Final check of documentation against latest bug fixes (e.g., CommonJS sidecar fix, Stock Valuation SQL fix).
- [ ] **User Validation**: Ensure the " Whisperer" errors are resolved in help text.

## Links
- Root Tasks: `core/tasks.md`
- Latest Incident: `core/context/incident_build_macos.md`
