# RETAIL MANAGER - KEYBOARD SHORTCUTS SYSTEM
## PRD for Worker Dashboard Shortcut Overhaul

---

## PROJECT CONTEXT
**Product:** Retail Manager (Tauri + React)
**Feature:** Function Key Shortcuts for Worker Dashboard (POS)
**Reference:** Legacy DOS-style POS system (see attached image)
**Target Users:** Cashiers / Store workers in Mali

---

## PROBLEM STATEMENT

### Current State
- Worker dashboard uses module-based navigation (click icons/buttons)
- Slower workflow for experienced cashiers
- No keyboard shortcuts for common actions
- Not optimized for fast retail transactions

### Desired State
- Function key shortcuts (F1-F12) for instant actions
- Alt+F key combinations for secondary actions
- Help overlay showing all shortcuts (like the reference image)
- Fast, keyboard-driven workflow for power users

---

## REFERENCE DESIGN

Based on the attached image, the legacy DOS POS system uses:

### Single Key Shortcuts (TOUCHE SEULE)
| Key | French Label | English | Action |
|-----|-------------|---------|--------|
| F1 | Aide (cet écran) | Help (this screen) | Show/hide shortcuts help overlay |
| F2 | Valide Bordereau | Validate slip | Validate current sale/order |
| F3 | Dé/Sélection ligne | Select/Deselect line | Toggle line selection |
| F4 | Règlement FACTURE | Invoice payment | Open payment dialog |
| F5 | Fiche d'un produit | Product card | Show product details |
| F6 | Impression bordereau | Print slip | Print current slip/receipt |
| F7 | Insertion d'1 ligne | Insert line | Add new line item |
| F8 | Suppression ligne | Delete line | Remove selected line |
| F9 | Bordereau LIVRAISON | Delivery slip | Create delivery slip |
| F10 | Imprimer REÇU CAISSE | Print receipt | Print cash receipt |
| F11 | Sélection 2ème PRIX | Select 2nd price | Toggle alternate pricing |
| F12 | Ouvrir TIROIR-CAISSE | Open cash drawer | Open physical cash drawer |

### Alt + Key Shortcuts (ALT+TOUCHE)
| Key | French Label | English | Action |
|-----|-------------|---------|--------|
| Alt+F1 | Rechercher une FACTURE | Search invoice | Open invoice search |
| Alt+F2 | Remise GLOBALE en % | Global discount % | Apply percentage discount |
| Alt+F3 | Désélection toutes les lignes | Deselect all | Clear all selections |
| Alt+F4 | Résélection toutes les lignes | Reselect all | Select all lines |
| Alt+F5 | Remise GLOBALE en MONTANT | Global discount amount | Apply fixed discount |
| Alt+F6 | Paramètres d'impression | Print settings | Open print configuration |
| Alt+F7 | CONSULTATION des prix | Price lookup | Open price checker |
| Alt+F8 | À exclure | Exclude | Exclude item from sale |
| Alt+F10 | Changer le n° de facture | Change invoice # | Modify invoice number |
| Alt+F11 | NÉGOCIATION PRIX | Price negotiation | Negotiate unit price |
| Alt+F12 | NÉGOCIATION MONTANT | Amount negotiation | Negotiate total amount |

---

## REQUIREMENTS

### 1. SHORTCUT ENGINE

#### 1.1 Global Keyboard Listener
```typescript
// Listen for function keys across the app
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Prevent default browser behavior for F keys
    if (e.key.startsWith('F') && !e.ctrlKey) {
      e.preventDefault();
      handleShortcut(e.key, e.altKey, e.shiftKey);
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

#### 1.2 Shortcut Configuration
```typescript
interface Shortcut {
  key: string;           // "F1", "F2", etc.
  alt?: boolean;         // Alt modifier
  shift?: boolean;       // Shift modifier
  labelFr: string;       // French label
  labelBm: string;       // Bambara label (optional)
  labelEn: string;       // English label
  action: () => void;    // Function to execute
  context: 'pos' | 'inventory' | 'global'; // Where shortcut is active
  enabled: boolean;      // Can be disabled
}
```

### 2. HELP OVERLAY (F1)

#### 2.1 Visual Design
```
┌─────────────────────────────────────────────────────────────┐
│                         AIDE                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TOUCHE SEULE              │   ALT + TOUCHE                │
│  ─────────────             │   ────────────                │
│                            │                               │
│  F1  Aide (cet écran)      │   Alt+F1  Rechercher facture  │
│  F2  Valider vente         │   Alt+F2  Remise globale %    │
│  F3  Sélectionner ligne    │   Alt+F3  Tout désélectionner │
│  F4  Paiement              │   Alt+F4  Tout sélectionner   │
│  F5  Fiche produit         │   Alt+F5  Remise montant      │
│  F6  Imprimer bordereau    │   Alt+F6  Config impression   │
│  F7  Ajouter ligne         │   Alt+F7  Consulter prix      │
│  F8  Supprimer ligne       │   Alt+F8  Exclure article     │
│  F9  Bon de livraison      │   Alt+F10 Modifier n° facture │
│  F10 Imprimer ticket       │   Alt+F11 Négocier prix       │
│  F11 Prix alternatif       │   Alt+F12 Négocier montant    │
│  F12 Ouvrir tiroir-caisse  │                               │
│                            │                               │
│  ══════════════════════════════════════════════════════════│
│  Tab = Champ suivant    │   Entrée = Valider              │
│  Échap = Fermer         │   Home = Champ précédent        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 Overlay Behavior
- **F1 toggles** the help overlay (press to show, press again to hide)
- **Escape** also closes the overlay
- Overlay is **semi-transparent** (80% opacity black background)
- Overlay is **centered** on screen
- Overlay **auto-closes** after 10 seconds of inactivity (optional)
- Overlay **does not block** other shortcuts (can press F2 while open)

### 3. STATUS BAR

#### 3.1 Bottom Status Bar
```
┌─────────────────────────────────────────────────────────────────────────┐
│ MODE: Vente  │ VENDEUR: Chef  │ F1 Aide │ F2 Valider │ F4 Payer │ F10 Impr │
└─────────────────────────────────────────────────────────────────────────┘
```

- Shows current mode
- Shows logged-in user
- Shows **most common shortcuts** as quick reference
- Always visible at bottom of POS screen

### 4. VISUAL FEEDBACK

#### 4.1 When Shortcut is Pressed
```
User presses F4:
  ↓
Show toast notification: "💳 Paiement..." (0.5s)
  ↓
Execute action (open payment dialog)
```

#### 4.2 Invalid Shortcut
```
User presses Alt+F9 (not mapped):
  ↓
Show toast: "⚠️ Raccourci non défini" (shortcut not defined)
  ↓
No action
```

### 5. CONTEXT-AWARE SHORTCUTS

Some shortcuts only work in specific contexts:

| Context | Active Shortcuts |
|---------|-----------------|
| POS (selling) | All F1-F12 and Alt variants |
| Inventory | F1, F5, F7, F8, Alt+F7 |
| Dashboard | F1 only |
| Settings | F1 only |

### 6. ACCESSIBILITY

#### 6.1 Screen Reader Support
```html
<button 
  aria-label="Paiement (F4)"
  aria-keyshortcuts="F4"
>
  💳 Payer
</button>
```

#### 6.2 Visual Indicators
- Shortcuts shown in button labels: `[F4] Payer`
- Tooltips include shortcut key
- High contrast colors for help overlay

---

## TECHNICAL IMPLEMENTATION

### 7. FILE STRUCTURE

```
frontend/src/
├── hooks/
│   └── useKeyboardShortcuts.ts    # Global shortcut listener
│   └── useShortcutContext.ts      # Context-aware shortcuts
├── components/
│   └── shared/
│       ├── ShortcutsHelpOverlay.tsx   # F1 help dialog
│       ├── ShortcutsStatusBar.tsx     # Bottom status bar
│       └── ShortcutToast.tsx          # Feedback toast
├── config/
│   └── shortcuts.ts               # Shortcut definitions
└── contexts/
    └── ShortcutsContext.tsx       # Global shortcuts state
```

### 8. SHORTCUT REGISTRY

```typescript
// config/shortcuts.ts
export const POS_SHORTCUTS: Shortcut[] = [
  {
    key: 'F1',
    labelFr: 'Aide',
    labelEn: 'Help',
    action: 'TOGGLE_HELP',
    context: 'global',
  },
  {
    key: 'F2',
    labelFr: 'Valider vente',
    labelEn: 'Validate sale',
    action: 'VALIDATE_SALE',
    context: 'pos',
  },
  {
    key: 'F4',
    labelFr: 'Paiement',
    labelEn: 'Payment',
    action: 'OPEN_PAYMENT',
    context: 'pos',
  },
  // ... etc
];
```

### 9. HOOK IMPLEMENTATION

```typescript
// hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts(context: ShortcutContext) {
  const { shortcuts, executeShortcut } = useShortcutContext();
  
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key;
      const isAlt = e.altKey;
      const isShift = e.shiftKey;
      
      // Find matching shortcut
      const shortcut = shortcuts.find(s => 
        s.key === key && 
        s.alt === isAlt &&
        (s.context === context || s.context === 'global')
      );
      
      if (shortcut) {
        e.preventDefault();
        executeShortcut(shortcut);
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [context, shortcuts]);
}
```

---

## UI COMPONENTS

### 10. HELP OVERLAY COMPONENT

```tsx
// ShortcutsHelpOverlay.tsx
interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsHelpOverlay({ isOpen, onClose }: Props) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-green-900 border-4 border-yellow-400 p-6 max-w-4xl">
        <h2 className="text-yellow-400 text-2xl font-bold text-center mb-4">
          ═══════ AIDE ═══════
        </h2>
        
        <div className="grid grid-cols-2 gap-8 text-green-300 font-mono">
          {/* Left column: Single keys */}
          <div>
            <h3 className="text-yellow-300 mb-2">TOUCHE SEULE</h3>
            <ShortcutList shortcuts={SINGLE_KEY_SHORTCUTS} />
          </div>
          
          {/* Right column: Alt keys */}
          <div>
            <h3 className="text-yellow-300 mb-2">ALT + TOUCHE</h3>
            <ShortcutList shortcuts={ALT_KEY_SHORTCUTS} />
          </div>
        </div>
        
        <div className="border-t border-green-500 mt-4 pt-4 text-center text-green-400">
          Tab = Champ suivant | Entrée = Valider | Échap = Fermer
        </div>
      </div>
    </div>
  );
}
```

### 11. STATUS BAR COMPONENT

```tsx
// ShortcutsStatusBar.tsx
export function ShortcutsStatusBar({ mode, user }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-blue-900 text-white px-4 py-2 flex items-center gap-4 font-mono text-sm">
      <span>MODE: {mode}</span>
      <span className="border-l border-blue-500 pl-4">VENDEUR: {user}</span>
      <div className="flex-1" />
      <ShortcutHint shortcut="F1" label="Aide" />
      <ShortcutHint shortcut="F2" label="Valider" />
      <ShortcutHint shortcut="F4" label="Payer" />
      <ShortcutHint shortcut="F10" label="Impr" />
    </div>
  );
}

function ShortcutHint({ shortcut, label }: { shortcut: string; label: string }) {
  return (
    <span className="bg-blue-700 px-2 py-1 rounded">
      <span className="text-yellow-300">{shortcut}</span> {label}
    </span>
  );
}
```

---

## ACCEPTANCE CRITERIA

### Functional
- [ ] F1 toggles help overlay
- [ ] All F2-F12 shortcuts execute correct actions
- [ ] All Alt+F shortcuts execute correct actions
- [ ] Shortcuts only work in correct context (POS vs Inventory)
- [ ] Status bar shows current mode and user
- [ ] Visual feedback (toast) on shortcut execution
- [ ] Shortcuts work with French AZERTY keyboard

### Visual
- [ ] Help overlay matches retro DOS aesthetic (green/yellow on dark)
- [ ] Status bar always visible at bottom
- [ ] Shortcut hints in button labels
- [ ] High contrast for readability

### Performance
- [ ] No lag when pressing shortcuts
- [ ] Help overlay renders instantly
- [ ] No memory leaks from keyboard listeners

### i18n
- [ ] All shortcut labels in French
- [ ] Bambara translations available
- [ ] English fallback

---

## MIGRATION PLAN

### Phase 1: Core Infrastructure
1. Create `useKeyboardShortcuts` hook
2. Create `ShortcutsContext`
3. Define shortcut registry

### Phase 2: UI Components
1. Build `ShortcutsHelpOverlay` (F1)
2. Build `ShortcutsStatusBar`
3. Build `ShortcutToast`

### Phase 3: Integration
1. Integrate into Worker Dashboard
2. Connect shortcuts to existing actions
3. Add status bar to POS layout

### Phase 4: Testing
1. Test all shortcuts
2. Test AZERTY keyboard
3. User acceptance testing

---

## RISKS

| Risk | Mitigation |
|------|------------|
| Browser hijacks F keys | Prevent default on keydown |
| Alt+F4 closes window | Intercept before browser |
| Conflicts with OS shortcuts | Document known conflicts |
| AZERTY vs QWERTY | Test both layouts |

---

## DEADLINE

Implementation by: **February 15, 2026**

---

## REFERENCE IMAGE

See attached: `WhatsApp Image 2026-01-22 at 21.17.33.jpeg`

This shows the legacy DOS POS system with the exact shortcut layout to replicate.

---

[END OF PRD]
