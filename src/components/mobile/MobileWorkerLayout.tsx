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

// Mobile modules
import { MobileFicheCaisse } from './Sales/MobileFicheCaisse';
import { MobileSuiviVentesJour } from './Sales/MobileSuiviVentesJour';
import { MobileFicheProduits } from './Fichiers/MobileFicheProduits';
import { MobileClients } from './Fichiers/MobileClients';
import { MobileFournisseurs } from './Fichiers/MobileFournisseurs';
import { MobileRestaurants } from './Fichiers/MobileRestaurants';
import { MobileInventaireStock } from './Stock/MobileInventaireStock';
import { MobileIngredients } from './Stock/MobileIngredients';
import { MobileReceptionAchats } from './Purchases/MobileReceptionAchats';
import { MobileCommandeManuelle } from './Purchases/MobileCommandeManuelle';
import { MobileReglementsFournisseurs } from './Purchases/MobileReglementsFournisseurs';
import { MobileSalesModule } from './Sales/MobileSalesModule';
import { MobileHistoriqueAchats } from './Purchases/MobileHistoriqueAchats';
import { ReplenishmentNeeds } from '@/components/master/Purchases/ReplenishmentNeeds';

// Shared / Desktop wrapper modules for mobile
import { EditionModule } from '@/components/worker/Modules/EditionModule';
import InvitationsPage from '@/pages/master/Invitations';
import AuditLogsPage from '@/pages/master/AuditLogs';

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
  const [activeMobileModule, setActiveMobileModule] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string>('');

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

  // Fetch storeId for offline wrappers
  useEffect(() => {
    const fetchStore = async () => {
      const { OfflineAuthService } = await import('@/services/OfflineAuthService');
      const offlineSession = await OfflineAuthService.getOfflineSession();
      if (offlineSession?.user?.user_metadata?.store_id) {
        setStoreId(offlineSession.user.user_metadata.store_id);
      }
    };
    fetchStore();
  }, []);

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

  // Intercept selection in Hamburger Menu to handle routing internally
  const handleSelectModule = (moduleId: string) => {
    if (moduleId === 'tableau-bord') {
      setActiveTab('dashboard');
      setActiveMobileModule(null);
    } else if (moduleId === 'vente-detail') {
      setActiveTab('pos');
      setActiveMobileModule(null);
    } else {
      setActiveMobileModule(moduleId);
    }
  };

  // Wrapper for desktop edition modules
  const renderEditionWrapper = (title: string, mode: 'situation-client' | 'situation-fournisseur') => {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] md:pb-0 font-sans text-white">
        <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-3 sticky top-0 z-10 flex items-center gap-2">
          <button onClick={() => setActiveMobileModule(null)} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-white uppercase tracking-wider">{title}</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 bg-background">
          <EditionModule storeId={storeId} mode={mode} />
        </div>
      </div>
    );
  };

  // Wrapper for ReplenishmentNeeds
  const renderBesoinsWrapper = () => {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] md:pb-0 font-sans text-white">
        <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-3 sticky top-0 z-10 flex items-center gap-2">
          <button onClick={() => setActiveMobileModule(null)} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-white uppercase tracking-wider">Besoins réappro.</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 bg-[#0a0a0a] dark">
          <ReplenishmentNeeds storeId={storeId} />
        </div>
      </div>
    );
  };

  // Wrapper for audit logs / invitations master pages
  const renderMasterPageWrapper = (title: string, PageComponent: React.ComponentType) => {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] md:pb-0 font-sans text-white">
        <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-3 sticky top-0 z-10 flex items-center gap-2">
          <button onClick={() => setActiveMobileModule(null)} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-white uppercase tracking-wider">{title}</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 bg-background dark">
          <PageComponent />
        </div>
      </div>
    );
  };

  // ── Module rendering ─────────────────────────────────────────────────────

  const renderContent = () => {
    if (activeMobileModule) {
      switch (activeMobileModule) {
        case 'fermeture-caisse':
          return <MobileFicheCaisse onBack={() => setActiveMobileModule(null)} />;
        case 'suivi-ventes-jour':
          return <MobileSuiviVentesJour onBack={() => setActiveMobileModule(null)} />;
        case 'fiche-produits':
          return <MobileFicheProduits onBack={() => setActiveMobileModule(null)} />;
        case 'clients':
          return <MobileClients onBack={() => setActiveMobileModule(null)} />;
        case 'fournisseurs':
          return <MobileFournisseurs onBack={() => setActiveMobileModule(null)} />;
        case 'restaurants':
          return <MobileRestaurants onBack={() => setActiveMobileModule(null)} />;
        case 'inventaire-stock':
          return <MobileInventaireStock onBack={() => setActiveMobileModule(null)} />;
        case 'ingredients':
          return <MobileIngredients onBack={() => setActiveMobileModule(null)} />;
        case 'reception-achats':
          return <MobileReceptionAchats onBack={() => setActiveMobileModule(null)} />;
        case 'commande-manuelle':
          return <MobileCommandeManuelle onBack={() => setActiveMobileModule(null)} />;
        case 'reglement-fournisseurs':
          return <MobileReglementsFournisseurs onBack={() => setActiveMobileModule(null)} />;
        case 'besoins-achats':
          return renderBesoinsWrapper();
        case 'historique-achats':
          return <MobileHistoriqueAchats onBack={() => setActiveMobileModule(null)} />;
        case 'situation-client':
          return renderEditionWrapper('Situation Client', 'situation-client');
        case 'situation-fournisseur':
          return renderEditionWrapper('Situation Fournisseur', 'situation-fournisseur');
        case 'audit-logs':
          return renderMasterPageWrapper('Logs Système', AuditLogsPage);
        case 'invitations':
          return renderMasterPageWrapper('Invitations', InvitationsPage);
        default:
          break;
      }
    }

    switch (activeTab) {
      case 'pos':       return <MobilePOS />;
      case 'kds':       return <MobileKDS />;
      case 'dashboard': return <MobileDashboard />;
      case 'menu':      return <MobileMenuScreen onSelect={handleSelectModule} />;
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
                onClick={() => {
                  setActiveTab(tab.id);
                  setActiveMobileModule(null);
                }}
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
