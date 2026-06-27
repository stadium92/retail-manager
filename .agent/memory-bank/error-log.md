# Error Log and Session Memory

This file serves as the persistent memory across agent sessions to document errors, bug fixes, and learnings.

---

### [2026-06-16] GestionModule Refactoring
- Symptom: Massive React component `GestionModule.tsx` (>1200 lines) causing high cognitive load, and difficulty for agents to maintain/debug.
- Files involved: `frontend/src/components/shared/GestionModule.tsx`
- Root cause: Switch statement inline rendering of four major sub-views (Dashboard, Statistics, CashJournal, Losses).
- Fix applied: Extracted these views into separate component files (`DashboardView.tsx`, `StatisticsView.tsx`, `CashJournalView.tsx`, `LossesView.tsx`) under `frontend/src/components/shared/Gestion/`.
- Verification: Clean typecheck using `npx tsc --noEmit`.
- Status: FIXED
- Tags: #refactor #react #clean-code

### [2026-06-23] Mobile Retail App Build Refactoring
- Symptom: Vite build failure due to missing `RecipeBuilder` component imported by the ported `MobileFicheProduits.tsx`.
- Files involved: `frontend/src/components/mobile/Fichiers/MobileFicheProduits.tsx`, `frontend/src/components/mobile/MobileWorkerLayout.tsx`, `frontend/src/components/mobile/MobileMenuScreen.tsx`, `frontend/src/components/mobile/Dashboard/MobileDashboard.tsx`
- Root cause: Porting mobile components from a restaurant app clone introduced restaurant-specific logic (dishes, recipes, cooking, table plans) and dependencies (like `RecipeBuilder`) that are absent and unnecessary in the base retail manager project.
- Fix applied: Systematically stripped out all dish (plat), cooking, ingredients, and dining table plan views, filters, and dynamic recipe calculators from the mobile screens. Adapted the form schema to only handle standard Products and Packs. Renamed `MobileRestaurants.tsx` to `MobileBoutiques.tsx` and updated references to use "Boutique" instead of "Restaurant".
- Verification: Successful local compilation and packaging check with `npm run build --prefix frontend`, and successful prebuilt production deploy on Vercel.
- Status: FIXED
- Tags: #mobile #build-fix #refactor #restaurant-cleanup

### [2026-06-26] Direct Cloud Auth and Login Blocker (Email Confirmation)
- Symptom: User sign-up succeeds but immediate sign-in fails with status 400 (Email not confirmed) on the deployed Vercel application. The auth form additionally shows a confusing "Mode Hors-ligne" (Offline Mode) warning in direct cloud deployment.
- Files involved: `frontend/src/contexts/AuthContext.tsx`, `frontend/src/components/auth/AuthPage.tsx`
- Root cause:
  1. The user's Supabase dashboard has "Confirm email" enabled for the Email provider under Auth Providers, blocking immediate sign-in of unverified accounts.
  2. The "Mode Hors-ligne" alert was showing because `isBootstrapped` defaults to true and is not conditionalized on `isLocalFirst` (direct cloud mode) in the template layout.
- Fix applied:
  1. Restored the direct online `signUp` block calling `supabase.auth.signUp` in `AuthContext.tsx`.
  2. Updated `AuthPage.tsx` to conditionalize the offline system state alert box on `isLocalFirst`, hiding the confusing alert in direct cloud environments.
  3. Formulated instructions for the user to disable email confirmation in the Supabase Dashboard.
- Verification: Tested direct signup/signin calls via the Supabase Node SDK (identifying the specific `email_not_confirmed` error code) and successfully ran local Vercel builds and production deploys to `https://retail-manager-mobile.vercel.app`.
- Status: FIXED
- Tags: #auth #supabase #vercel #ui #conditional-alert

