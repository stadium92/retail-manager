# PRD-013: Keyboard Shortcuts System (Worker Dashboard)

## 1. Executive Summary
To optimize the speed of retail transactions and provide a familiar workflow for cashiers accustomed to legacy systems, Retail Manager v1.0 will implement a comprehensive keyboard shortcut system (F1-F12 and Alt+F combinations). This will allow for a fully keyboard-driven experience, mimicking legacy DOS-style POS systems.

## 2. Problem Statement
- **Efficiency:** Clicking through UI modules is slower than keyboard shortcuts for power users.
- **User Familiarity:** Many cashiers in the target market (Mali) are used to legacy systems where F-keys are standard.
- **Navigation:** Switching between POS, Inventory, and Payment screens currently requires multiple mouse interactions.

## 3. Reference Design (Legacy POS)
The system will replicate the shortcut mapping from legacy retail software:
- **F1:** Help Overlay (Toggle).
- **F2:** Validate Slip/Sale.
- **F4:** Invoice Payment.
- **F10:** Print Receipt.
- **Alt+F2:** Global Discount %.
- **Alt+F11/F12:** Price/Amount Negotiation.

## 4. Technical Requirements

### A. Shortcut Engine
- **Global Listener:** A React hook (`useKeyboardShortcuts`) to intercept F-keys and prevent browser defaults.
- **Context-Awareness:** Shortcuts should be enabled/disabled based on the active module (e.g., F2 validates a sale in POS but might save a form in Inventory).

### B. UI Components
- **Help Overlay (F1):** A retro-style modal (Green/Yellow on Dark) showing all available shortcuts.
- **Status Bar:** A persistent bottom bar showing the current mode, user, and common shortcut hints (F1 Aide, F2 Valider, etc.).
- **Visual Feedback:** Short-lived toast notifications (0.5s) to confirm shortcut execution (e.g., "💳 Payment...").

### C. Technical Implementation
- **File Structure:**
    - `frontend/src/hooks/useKeyboardShortcuts.ts`
    - `frontend/src/components/shared/ShortcutsHelpOverlay.tsx`
    - `frontend/src/components/shared/ShortcutsStatusBar.tsx`
    - `frontend/src/contexts/ShortcutsContext.tsx`

## 5. Success Metrics
- 100% of core POS operations (Scan -> Discount -> Pay -> Print) can be completed without a mouse.
- Average transaction time reduced for experienced users.
- Visual consistency with legacy POS reference for "instant" user onboarding.
