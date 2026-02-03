# Active Context - Retail Manager

## Current Focus
The project has shifted from infrastructure migration (Tauri v2) to **v1.0 Stability and Feature Completion**. The current priority is fixing broken core logic (Stock Valuation, Invoices) and implementing the Keyboard-First POS workflow (PRD-013) and Licensing protection.

## Current Blockers
- **Stock Valuation**: Reports 0 total value despite available inventory; requires SQL/Logic fix.
- **Audit Logs Loading**: Infinite loading/hang in the Master Dashboard logs view.
- **Report Templates**: Several sub-modules in "Edition" and "Purchases" are non-functional templates.

## Recent Changes
- **i18n Completion**: 100% UI coverage for English, French, and Bamanankan across all 4 interfaces (Master, Worker, Deliverer, Customer).
- **PVG Labeling Fix**: Replaced hardcoded "PVG" with localized "Wholesale Price" strings in the Sales module.
- **Licensing Core**: Developed the CLI License Key Generator (`RM-YYYY-SSSS-HHHH-VVVV`) and implemented Rust-side hardware fingerprinting.
- **Roadmap Overhaul**: Reorganized `tasks.md` into a prioritized v1.0 roadmap (P0: Shortcuts/Licensing/BugFixes).
- **PRD Documentation**: Created PRD-012 (System Intelligence) and PRD-013 (Keyboard Shortcuts).

## Next Steps
- **Critical Fixes**: Repair Stock Valuation SQL and implement functional Invoice/Purchase reports.
- **Keyboard Engine**: Implement `ShortcutsContext` and the F1 Help Overlay.
- **Licensing UI**: Build the "Activation Required" nag dialogs.

## Technical Decisions
- **English-Only Logs**: All technical/audit logs remain in English for developer debugging, regardless of UI locale.
- **Retro DOS Aesthetic**: The Keyboard Help Overlay (F1) will mimic legacy DOS POS systems for rapid adoption in the Malian market.