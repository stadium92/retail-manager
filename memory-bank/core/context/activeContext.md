# Active Context - Retail Manager

## Current Focus
The project is focused on **v1.0 Stability and Feature Completion**. The current priority is fixing broken core logic (Stock Valuation, Invoices), implementing the Keyboard-First POS workflow (PRD-013), and finalizing the Licensing protection system.

## Current Blockers
- **Stock Valuation**: Reports 0 total value despite available inventory; requires SQL/Logic fix.
- **Audit Logs Loading**: Infinite loading/hang in the Master Dashboard logs view.
- **Report Verification**: Functional Invoice/Purchase reports need verification with real data.

## Recent Changes
- **macOS Build Fix (Sidecar)**: Resolved the `SyntaxError: Cannot use import statement outside a module` crash by switching the `local-bridge` backend compilation to CommonJS. This ensures compatibility with the `pkg` packaging tool. Validated with a fully functional `.dmg` build.
- **Windows Build Preparation**: Created `scripts/build-sidecar.ps1` and configured 32-bit (i686) build targets for maximum compatibility with low-end hardware via Parallels VM.
- **Dynamic Keyboard Shortcuts**: Replaced hardcoded `F2`/`F3` module navigation with dynamic actions. `SalesModule`, `FacturationModule`, and `SanifereFooter` now use mappings from `useSettingsStore`.
- **Dynamic UI Labels**: `SanifereFooter` buttons now automatically update their text based on the keyboard shortcut preferences set in the "Program" module.
- **i18n Completion**: 100% UI coverage for English, French, and Bamanankan across all 4 interfaces.
- **Help Center Depth**: Enhanced the Help module with verified documentation on Offline-First logic, physical shortcuts, and specific submodule guidance.
- **Licensing Core**: Developed the CLI License Key Generator and implemented Rust-side hardware fingerprinting.

## Next Steps
- **Critical Fixes**: Repair Stock Valuation SQL logic in `local-bridge/src/db.ts`.
- **Licensing UI**: Build the "Activation Required" nag dialogs.
- **Logging Fix**: Debug `AuditLogsPage.tsx` infinite loading.
- **Windows Build**: Perform first verification build inside Parallels VM.

## Technical Decisions
- **One Action Per Key**: Updated mapping logic to ensure an action is only assigned to one function key at a time, preventing conflicts.
- **English-Only Logs**: All technical/audit logs remain in English for developer debugging.
- **CommonJS for Backend**: The `local-bridge` backend MUST use CommonJS to remain compatible with the `pkg` packager.
- **Retro DOS Aesthetic**: The Keyboard Help Overlay (F1) and physical-looking footer buttons maintain a legacy POS feel.