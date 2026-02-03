# Active Context - Retail Manager

## Current Focus
The project is focused on **v1.0 Stability and Feature Completion**. Recent efforts have centered on fixing UI crashes, restoring missing state in settings, and making the POS keyboard-first workflow fully dynamic and customizable.

## Current Blockers
- **Stock Valuation**: Reports 0 total value despite available inventory; requires SQL/Logic fix.
- **Audit Logs Loading**: Infinite loading/hang in the Master Dashboard logs view.
- **Report Verification**: Functional Invoice/Purchase reports need verification with real data.

## Recent Changes
- **Dynamic Keyboard Shortcuts**: Replaced hardcoded `F2`/`F3` module navigation with dynamic actions. `SalesModule`, `FacturationModule`, and `SanifereFooter` now use mappings from `useSettingsStore`.
- **Dynamic UI Labels**: `SanifereFooter` buttons now automatically update their text based on the keyboard shortcut preferences set in the "Program" module.
- **UI Crash Fixes**: Resolved "SelectItem must have a value" errors by replacing empty strings with `'none'`.
- **State Restoration**: Fixed a crash in the Passwords submodule by restoring missing `passwordForm` and `showPasswords` state in `SettingsModule.tsx`.
- **i18n Fixes**: Added missing `common.none` and `common.print` translations across all supported languages.
- **Dependency Fixes**: Resolved "Can't find variable" errors for `useFormatters` and `useSettingsStore` by adding missing imports and fixing hook placement scoping.

## Next Steps
- **Critical Fixes**: Repair Stock Valuation SQL logic in `local-bridge/src/db.ts`.
- **Licensing UI**: Build the "Activation Required" nag dialogs.
- **Logging Fix**: Debug `AuditLogsPage.tsx` infinite loading.

## Technical Decisions
- **One Action Per Key**: Updated mapping logic to ensure an action is only assigned to one function key at a time, preventing conflicts.
- **English-Only Logs**: All technical/audit logs remain in English for developer debugging.
- **Retro DOS Aesthetic**: The Keyboard Help Overlay (F1) and physical-looking footer buttons maintain a legacy POS feel.
