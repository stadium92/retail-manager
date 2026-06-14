// src/components/mobile/MobileWorkerLayout.tsx
//
// ──────────────────────────────────────────────────────────────────────────────
// Mobile Worker Layout — Bottom Tab Bar + Module Orchestrator
//
// This component is the mobile equivalent of WorkerLayout.tsx. It:
//   1. Reads the worker's sub-role to build the visible tab list.
//   2. Manages activeTab state (persisted to localStorage).
//   3. Renders the correct mobile module (MobilePOS / MobileKDS / MobileDashboard).
//   4. Renders a Material Design 3–style Bottom Tab Bar (fixed, 64 px tall).
//
// The 64 px bar height intentionally matches the pb-[64px] padding that each
// mobile component already sets on its outermost container, so content is
// never hidden behind the nav.
//
// Sub-role → visible tabs:
//   cook     → KDS only      (bar hidden — single-screen experience)
//   cashier  → POS + KDS
//   waiter / manager / null → POS + KDS + Dashboard
// ──────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MobilePOS } from './POS/MobilePOS';
import { MobileKDS } from './KDS/MobileKDS';
import { MobileDashboard } from './Dashboard/MobileDashboard';
import { MobileMenuScreen } from './MobileMenuScreen';

export interface MobileWorkerLayoutProps {
  onOpenDesktopModule?: (moduleId: string) => void;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type MobileTab = 'pos' | 'kds' | 'dashboard';

interface TabConfig {
  id: MobileTab;
  /** Label shown below the icon */
  label: string;
  /** Material Symbols icon name */
  icon: string;
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const ALL_TABS: TabConfig[] = [
  { id: 'pos',       label: 'Caisse',  icon: 'point_of_sale' },
  { id: 'kds',       label: 'Cuisine', icon: 'restaurant'    },
  { id: 'dashboard', label: 'Tableau', icon: 'bar_chart'     },
  { id: 'menu',      label: 'Menu',    icon: 'menu'          },
];

const STORAGE_KEY = 'worker_mobile_active_tab';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getVisibleTabs(subRole: string | null | undefined): TabConfig[] {
  if (subRole === 'cook')    return ALL_TABS.filter(t => t.id === 'kds');
  if (subRole === 'cashier') return ALL_TABS.filter(t => t.id !== 'dashboard');
  return ALL_TABS; // waiter / manager / null → all
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MobileWorkerLayout({ onOpenDesktopModule }: MobileWorkerLayoutProps) {
  const { roles, user } = useAuth();

  // Resolve sub-role the same way WorkerLayout.tsx does
  const workerRole = roles.find(r => r.role === 'worker');
  const subRole = (
    workerRole?.sub_role ??
    (user?.user_metadata?.sub_role as 'cook' | 'cashier' | 'waiter' | null | undefined)
  );

  const visibleTabs = getVisibleTabs(subRole);
  const defaultTab: MobileTab = visibleTabs[0]?.id ?? 'kds';

  // Restore the last-used tab if it is still accessible for this role
  const [activeTab, setActiveTab] = useState<MobileTab>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as MobileTab | null;
    return (saved && visibleTabs.some(t => t.id === saved)) ? saved : defaultTab;
  });

  // Persist active tab so the user returns to the same screen after a reload
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  // If the role changes after login (rare but possible) and the current tab is
  // no longer accessible, reset to the first permitted tab.
  useEffect(() => {
    if (!visibleTabs.some(t => t.id === activeTab)) {
      setActiveTab(defaultTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subRole]);

  // ── Module rendering ─────────────────────────────────────────────────────

  const renderContent = () => {
    switch (activeTab) {
      case 'pos':       return <MobilePOS />;
      case 'kds':       return <MobileKDS />;
      case 'dashboard': return <MobileDashboard />;
      case 'menu':      return <MobileMenuScreen onSelect={onOpenDesktopModule || (() => {})} />;
      default:          return <MobileKDS />;
    }
  };

  // Cooks land on a single screen — no navigation bar needed
  const showTabBar = visibleTabs.length > 1;

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Active module ─────────────────────────────────────────────── */}
      {renderContent()}

      {/* ── Bottom Navigation Bar (Material Design 3) ─────────────────── */}
      {showTabBar && (
        <nav
          className={[
            'fixed bottom-0 left-0 right-0 z-50',
            'h-[64px]',
            'bg-rs-surface border-t border-rs-outline',
            'flex items-stretch',
          ].join(' ')}
          aria-label="Navigation principale"
        >
          {visibleTabs.map(tab => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'flex-1 flex flex-col items-center justify-center gap-0.5',
                  'transition-colors duration-150 active:scale-95 select-none',
                  isActive
                    ? 'text-rs-primary'
                    : 'text-rs-on-surface-variant hover:text-rs-on-surface',
                ].join(' ')}
              >
                {/*
                 * MD3 Navigation Bar spec: a 56×32 indicator pill appears behind
                 * the icon of the active destination.
                 */}
                <div
                  className={[
                    'w-14 h-8 rounded-full flex items-center justify-center',
                    'transition-colors duration-150',
                    isActive ? 'bg-rs-secondary-container' : 'bg-transparent',
                  ].join(' ')}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 24,
                      // FILL 1 = filled icon when active; FILL 0 = outlined otherwise
                      fontVariationSettings: isActive
                        ? "'FILL' 1, 'wght' 400"
                        : "'FILL' 0, 'wght' 400",
                    }}
                  >
                    {tab.icon}
                  </span>
                </div>

                <span className="text-[10px] font-medium leading-none tracking-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}
