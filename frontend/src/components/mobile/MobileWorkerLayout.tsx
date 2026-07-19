// src/components/mobile/MobileWorkerLayout.tsx
//
// ──────────────────────────────────────────────────────────────────────────────
// Mobile Worker Layout — Bottom Tab Bar + Module Orchestrator
//
// This component is the mobile equivalent of WorkerLayout.tsx. It:
//   1. Manages activeTab state (persisted to localStorage).
//   2. Renders the correct mobile module (MobilePOS / MobileDashboard).
//   3. Renders a Material Design 3–style Bottom Tab Bar (fixed, 64 px tall).
//
// The 64 px bar height intentionally matches the pb-[64px] padding that each
// mobile component already sets on its outermost container, so content is
// never hidden behind the nav.
// ──────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { MobilePOS } from './POS/MobilePOS';
import { MobileDashboard } from './Dashboard/MobileDashboard';
import { MobileMenuScreen } from './MobileMenuScreen';

// Mobile modules
import { MobileFicheCaisse } from './Sales/MobileFicheCaisse';
import { MobileSuiviVentesJour } from './Sales/MobileSuiviVentesJour';
import { MobileFicheProduits } from './Fichiers/MobileFicheProduits';
import { MobileClients } from './Fichiers/MobileClients';
import { MobileFournisseurs } from './Fichiers/MobileFournisseurs';
import { MobileBoutiques } from './Fichiers/MobileBoutiques';
import { MobileInventaireStock } from './Stock/MobileInventaireStock';
import { MobileReceptionAchats } from './Purchases/MobileReceptionAchats';
import { MobileCommandeManuelle } from './Purchases/MobileCommandeManuelle';
import { MobileReglementsFournisseurs } from './Purchases/MobileReglementsFournisseurs';
import { MobileSalesModule } from './Sales/MobileSalesModule';
import { MobileHistoriqueAchats } from './Purchases/MobileHistoriqueAchats';
import { ReplenishmentNeeds } from '@/components/master/Purchases/ReplenishmentNeeds';

// Shared / Desktop wrapper modules for mobile
import { EditionModule } from '@/components/worker/Modules/EditionModule';
import { SettingsModule } from '@/components/worker/Modules/SettingsModule';
import InvitationsPage from '@/pages/master/Invitations';
import AuditLogsPage from '@/pages/master/AuditLogs';
import TeamPage from '@/pages/master/Team';
import { MasterPasswordGate } from '@/components/shared/MasterPasswordGate';

export interface MobileWorkerLayoutProps {
  onOpenDesktopModule?: (moduleId: string) => void;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type MobileTab = 'pos' | 'dashboard' | 'menu';

export interface TabConfig {
  id: MobileTab;
  /** Label shown below the icon */
  label: string;
  /** Material Symbols icon name */
  icon: string;
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const ALL_TABS: TabConfig[] = [
  { id: 'pos',       label: 'Caisse',  icon: 'point_of_sale' },
  { id: 'dashboard', label: 'Tableau', icon: 'bar_chart'     },
  { id: 'menu',      label: 'Menu',    icon: 'menu'          },
];

const STORAGE_KEY = 'worker_mobile_active_tab';

// ─── Shared tab-row content ──────────────────────────────────────────────────
//
// Just the row of tab buttons, no positioning of its own. Callers decide how
// to place it:
//   - MobileWorkerLayout wraps it in a `fixed bottom-0` <nav> for every screen
//     that doesn't have its own bottom panel to coordinate with.
//   - Screens with their own fixed-bottom panel (currently MobilePOS) instead
//     render this as the last flex child of that SAME panel, so the panel and
//     the tab row are literally one continuous box with no separate
//     positioning to keep in sync - there is no gap to open because there is
//     no seam between two independently-positioned elements anymore.
export function MobileBottomTabRow({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: TabConfig[];
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}) {
  return (
    <div
      className="h-[var(--mobile-tabbar-h)] bg-rs-surface border-t border-rs-outline flex items-stretch"
      role="navigation"
      aria-label="Navigation principale"
    >
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
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
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MobileWorkerLayout({ onOpenDesktopModule }: MobileWorkerLayoutProps) {
  const [activeMobileModule, setActiveMobileModule] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string>('');

  const visibleTabs = ALL_TABS;
  const defaultTab: MobileTab = visibleTabs[0]?.id ?? 'pos';

  // Restore the last-used tab if it is still accessible
  const [activeTab, setActiveTab] = useState<MobileTab>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as MobileTab | null;
    return (saved && visibleTabs.some(t => t.id === saved)) ? saved : defaultTab;
  });

  // Fetch storeId for offline wrappers
  useEffect(() => {
    const fetchStore = async () => {
      const { OfflineAuthService } = await import('@/services/OfflineAuthService');
      const offlineSession = await OfflineAuthService.getOfflineSession();
      const resolvedStoreId = offlineSession?.roles?.find(r => r.store_id)?.store_id || offlineSession?.user?.user_metadata?.store_id;
      if (resolvedStoreId) {
        setStoreId(resolvedStoreId);
      }
    };
    fetchStore();
  }, []);

  // Persist active tab so the user returns to the same screen after a reload
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  // Intercept selection in Hamburger Menu to handle routing internally
  const handleSelectModule = (moduleId: string) => {
    if (moduleId === 'tableau-bord') {
      setActiveTab('dashboard');
      setActiveMobileModule(null);
    } else if (moduleId === 'vente-detail') {
      setActiveTab('pos');
      setActiveMobileModule(null);
    } else {
      const mobileSupportedModules = [
        'fermeture-caisse', 'suivi-ventes-jour', 'fiche-produits', 'clients',
        'fournisseurs', 'boutiques', 'inventaire-stock',
        'reception-achats', 'commande-manuelle', 'reglement-fournisseurs',
        'besoins-achats', 'historique-achats', 'situation-client',
        'situation-fournisseur', 'audit-logs', 'invitations', 'team',
        'mots-de-passe'
      ];
      
      // Programme and settings modules open via desktop overlay
      const desktopOnlyModules = [
        'preferences', 'programmation-touches',
        'facturation-detail', 'reglements-bons',
      ];
      
      if (desktopOnlyModules.includes(moduleId) && onOpenDesktopModule) {
        onOpenDesktopModule(moduleId);
      } else if (!mobileSupportedModules.includes(moduleId) && onOpenDesktopModule) {
        onOpenDesktopModule(moduleId);
      } else {
        setActiveMobileModule(moduleId);
      }
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

  // Wrapper for settings modules (like mots de passe)
  const renderSettingsWrapper = (title: string, mode: 'preferences' | 'programmation-touches' | 'mots-de-passe' | 'synchronisation') => {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] md:pb-0 font-sans text-white">
        <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-3 sticky top-0 z-10 flex items-center gap-2">
          <button onClick={() => setActiveMobileModule(null)} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-white uppercase tracking-wider">{title}</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 bg-[#0a0a0a] dark">
          <SettingsModule storeId={storeId} mode={mode} />
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
        case 'boutiques':
          return <MobileBoutiques onBack={() => setActiveMobileModule(null)} />;
        case 'inventaire-stock':
          return (
            <MasterPasswordGate moduleName="Inventaire Stock" onCancel={() => setActiveMobileModule(null)}>
              <MobileInventaireStock onBack={() => setActiveMobileModule(null)} />
            </MasterPasswordGate>
          );
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
        case 'team':
          return renderMasterPageWrapper('Gestion Équipe', TeamPage);
        case 'mots-de-passe':
          return renderSettingsWrapper('Mots de Passe', 'mots-de-passe');
        default:
          break;
      }
    }

    switch (activeTab) {
      case 'pos':
        return (
          <MobilePOS
            onBack={() => {
              setActiveTab('dashboard');
            }}
            tabBar={fusedTabBar}
          />
        );
      case 'dashboard':
        return (
          <MobileDashboard
            onNavigate={(target) => {
              if (target === 'pos' || target === 'menu' || target === 'dashboard') {
                setActiveTab(target as any);
                setActiveMobileModule(null);
              } else {
                setActiveMobileModule(target);
              }
            }}
          />
        );
      case 'menu':      return <MobileMenuScreen onSelect={handleSelectModule} />;
      default:          return <MobilePOS onBack={() => setActiveTab('dashboard')} tabBar={fusedTabBar} />;
    }
  };

  // Cooks land on a single screen — no navigation bar needed
  const showTabBar = visibleTabs.length > 1 && !activeMobileModule;

  const handleTabChange = (tab: MobileTab) => {
    setActiveTab(tab);
    setActiveMobileModule(null);
  };

  // MobilePOS has its own fixed-bottom checkout panel; rather than also
  // rendering a SEPARATE fixed-bottom nav below it (two independently
  // positioned elements that have to happen to land flush against each
  // other), MobilePOS fuses this same tab row directly into its own panel as
  // one continuous box. Every other screen still gets the standalone,
  // independently-fixed nav below.
  const fusedTabBar = showTabBar
    ? <MobileBottomTabRow tabs={visibleTabs} activeTab={activeTab} onTabChange={handleTabChange} />
    : undefined;

  // ── JSX ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Active module ─────────────────────────────────────────────── */}
      {renderContent()}

      {/* ── Bottom Navigation Bar (Material Design 3) ─────────────────── */}
      {/* Suppressed for 'pos': MobilePOS renders fusedTabBar itself, fused to its own panel. */}
      {showTabBar && activeTab !== 'pos' && (
        <nav className="fixed bottom-0 left-0 right-0 z-50">
          <MobileBottomTabRow tabs={visibleTabs} activeTab={activeTab} onTabChange={handleTabChange} />
        </nav>
      )}
    </>
  );
}
