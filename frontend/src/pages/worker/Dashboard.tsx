// src/pages/worker/Dashboard.tsx
//
// ──────────────────────────────────────────────────────────────────────────────
// Worker Dashboard — Adaptive Layout Entry Point
//
// This is the ONLY file in the old desktop codebase that needs to change.
// WorkerLayout.tsx is completely untouched.
//
// Device routing table (reduced by 25% per user request):
// ┌──────────────────────────────────────────────────────────┐
// │ Device           │ Width       │ Layout rendered          │
// ├──────────────────────────────────────────────────────────┤
// │ Mobile phone     │ < 576 px    │ MobileWorkerLayout ✦     │
// │ Tablet / iPad    │ 576–767 px  │ WorkerLayout (desktop)   │
// │ Laptop / Monitor │ ≥ 768 px    │ WorkerLayout (desktop)   │
// │ Tauri kiosk      │ any         │ WorkerLayout (desktop)   │
// └──────────────────────────────────────────────────────────┘
//
// ✦ See src/components/mobile/MobileWorkerLayout.tsx
//
// <DeviceProvider> is already mounted in App.tsx — no changes needed there.
// ──────────────────────────────────────────────────────────────────────────────

import { useDevice } from '@/contexts/DeviceContext';
import { WorkerLayout } from '@/components/worker/Layout/WorkerLayout';
import { MobileWorkerLayout } from '@/components/mobile/MobileWorkerLayout';

export default function WorkerDashboardPage() {
  const device = useDevice();
  
  return (
    <>
      {!device.isDesktop ? <MobileWorkerLayout /> : <WorkerLayout />}
    </>
  );
}
