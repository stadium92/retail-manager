# Refactoring Prompt: Deconstruct the "God Component" (GestionModule.tsx)

## Context
The file `frontend/src/components/shared/GestionModule.tsx` has grown too large (1,200+ lines). It currently handles 5 different business logic modes in a single file:
1.  `consultation-caisse` (Cash Balance & Totals)
2.  `journal-caisse` (Daily Transaction Logs)
3.  `tableau-bord` (Dashboard Overview)
4.  `statistiques` (Charts & Graphs)
5.  `sorties-pertes` (Loss & Expense Management)

## The Task
Refactor this single file into a modular, maintainable **Folder Structure**.

### 1. Target Structure
Create a new folder: `frontend/src/components/shared/Gestion/`
Inside, strictly separate the concerns:

```text
/Gestion/
├── DashboardStats.tsx       // (Mode: 'tableau-bord' & 'statistiques') - Heavy Recharts logic
├── CashConsultation.tsx     // (Mode: 'consultation-caisse') - Daily totals
├── DailyJournal.tsx         // (Mode: 'journal-caisse') - Transaction history table
├── LossManagement.tsx       // (Mode: 'sorties-pertes') - Form for adding losses
├── GestionModule.tsx        // The Main Parent Component (Controller)
└── types.ts                 // Shared interfaces (CashEntry, GestionModuleProps, etc.)
```

### 2. Implementation Steps
1.  **Extract Types**: Move `GestionModuleProps`, `CashEntry`, and other shared interfaces to `types.ts`.
2.  **Parent Controller**: Rewrite the main `GestionModule` component to act **only** as a layout manager. It should:
    - Accept the `storeId` and `mode` props.
    - Render the `Header` / `Title`.
    - conditionally render the correct sub-component based on `props.mode`.
3.  **Sub-Components**:
    - **Move Logic, Not Just JSX**: Don't just copy the HTML. Move the specific `useState`, `useEffect`, and helper functions (like `calculateTotal`) related to that specific mode into its new file.
    - **Shared State**: If they share state (like `dateRange`), keep that in the Parent and pass it down as props, OR use a small Context if complex.
4.  **Charts**: Isolate all `Recharts` imports and logic into `DashboardStats.tsx` to reduce bundle size for the other modes.

## Goal
The final `GestionModule.tsx` should be less than **200 lines**. It should be readable and clean. Ensuring existing functionality (Offline functionality, Translations `t()`, and UI components like `Card`, `Button`) remains broken.

## Action
Please start by generating the `types.ts` file, then the Parent Controller, and then the sub-components one by one.
