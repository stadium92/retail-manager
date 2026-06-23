import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import logoUrl from '@/assets/logo.png';
import { WorkerMenuBar, WorkerModule } from './WorkerMenuBar';
import { WorkerStatusBar } from './WorkerStatusBar';
import { cn } from '@/lib/utils';
import { LocalDatabase } from '@/services/LocalDatabase';
import { useTranslation } from 'react-i18next';
import { Logger } from '@/utils/Logger';

// Module views
import { SalesModule } from '../Modules/SalesModule';
import { FicheCaisseModule } from '../Modules/FicheCaisseModule';
import { StockListingModule } from '../Modules/StockListingModule';
import { PlaceholderModule } from '../Modules/PlaceholderModule';
import { ReceptionAchatsModule } from '../Modules/ReceptionAchatsModule';
import { CommandeAutoModule } from '../Modules/CommandeAutoModule';
import { CommandeManuelleModule } from '../Modules/CommandeManuelleModule';
import { ReglementsFournisseursModule } from '../Modules/ReglementsFournisseursModule';
// Fichiers (Master Data) modules
import { FichiersProduitsModule } from '../Modules/FichiersProduitsModule';
import { FicheProduitsModule } from '../Modules/FicheProduitsModule';
import { FichiersClientsModule } from '../Modules/FichiersClientsModule';
import { FichiersFournisseursModule } from '../Modules/FichiersFournisseursModule';
import { FichiersFamillesModule } from '../Modules/FichiersFamillesModule';
import { FichiersServicesClientsModule } from '../Modules/FichiersServicesClientsModule';
// New modules
import { EditionModule } from '../Modules/EditionModule';
import { GestionModule } from '../../shared/GestionModule';
import { StockModule } from '../Modules/StockModule';
import { SettingsModule } from '../Modules/SettingsModule';
import { useGlobalKeyboard, useNavigationStore } from '@/navigation';
import { ReglementsBonsModule } from '../Modules/ReglementsBonsModule';
import { resetMasterPasswordGates } from '@/components/shared/MasterPasswordGate';
import { KitchenDisplay } from '../Modules/KitchenDisplay';
import { TableManagement } from '../Modules/TableManagement';
import { CashierReadyOrdersBell } from './CashierReadyOrdersBell';
import { NotificationCenter } from '@/components/shared/NotificationCenter';
import { IngredientsModule } from '../Modules/IngredientsModule';
import { useDevice } from '@/contexts/DeviceContext';
import { MobileWorkerLayout } from '@/components/mobile/MobileWorkerLayout';
import { MinWidthGate } from '@/components/shared/MinWidthGate';
import { MobileSalesModule } from '../../mobile/Sales/MobileSalesModule';
import { MobileFicheCaisse } from '../../mobile/Sales/MobileFicheCaisse';
import { MobileReceptionAchats } from '../../mobile/Purchases/MobileReceptionAchats';
import { MobileCommandeManuelle } from '../../mobile/Purchases/MobileCommandeManuelle';
import { MobileReglementsFournisseurs } from '../../mobile/Purchases/MobileReglementsFournisseurs';

interface WorkerLayoutProps {
  className?: string;
}

export function WorkerLayout({ className }: WorkerLayoutProps) {
  useGlobalKeyboard();
  const { t } = useTranslation();
  const { user, signOut, roles } = useAuth();
  
  const workerRole = roles.find(r => r.role === 'worker');
  const rawSubRole = roles.find(r => ['cook', 'cashier', 'waiter', 'waiters'].includes(r.role))?.role
    || workerRole?.sub_role
    || (user?.user_metadata?.sub_role as string | null | undefined);
  const subRole = (rawSubRole === 'waiters' ? 'waiter' : rawSubRole) as 'cook' | 'cashier' | 'waiter' | null | undefined;
  const { isDesktop } = useDevice();
  const [forceDesktopMode, setForceDesktopMode] = useState(false);



  // Apply dark class to document.documentElement dynamically for Radix Portals
  useEffect(() => {
    if (subRole === 'cashier') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, [subRole]);

  // HIERARCHY FIX: When activeCell becomes null (Escape), focus the top menu.
  const activeCell = useNavigationStore(s => s.activeCell);
  useEffect(() => {
    if (activeCell === null) {
      setTimeout(() => {
        const firstTrigger = document.getElementById('worker-menubar-trigger-0');
        if (firstTrigger) firstTrigger.focus();
      }, 50);
    }
  }, [activeCell]);

  const [activeModule, setActiveModule] = useState<WorkerModule>(() => {
    return (localStorage.getItem('worker_active_module') as WorkerModule) || 'facturation-detail';
  });

  // Allowed modules checks
  const isModuleAllowed = useCallback((module: WorkerModule, role?: 'cook' | 'cashier' | 'waiter' | null): boolean => {
    if (role === 'cook') {
      return ['kds', 'preferences', 'programmation-touches', 'mots-de-passe'].includes(module);
    }
    if (role === 'cashier') {
      return [
        'facturation-detail',
        'fermeture-caisse', 'reglements-bons',
        'preferences', 'programmation-touches', 'mots-de-passe'
      ].includes(module);
    }
    if (role === 'waiter') {
      return ['tables', 'vente-detail', 'preferences', 'fiche-produits'].includes(module);
    }
    return true;
  }, []);

  // Enforce access control
  useEffect(() => {
    if (!isModuleAllowed(activeModule, subRole)) {
      if (subRole === 'cook') {
        setActiveModule('kds');
      } else if (subRole === 'cashier') {
        setActiveModule('facturation-detail');
      } else if (subRole === 'waiter') {
        setActiveModule('tables');
      }
    }
  }, [activeModule, subRole, isModuleAllowed]);

  const [storeId, setStoreId] = useState<string>('');
  const [storeName, setStoreName] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('worker_active_module', activeModule);
    resetMasterPasswordGates(); // Reset all locked modules on navigation
    Logger.info('MODULE_ENTER', { 
      entity_affected: activeModule,
      store_id: storeId || undefined 
    });
  }, [activeModule, storeId]);

  const moduleLabels: Record<WorkerModule, string> = {
    'kds': t('menu.restaurant.kds'),
    'tables': t('menu.restaurant.tables'),
    'vente-detail': t('menu.sales.retail'),
    'facturation-detail': t('menu.sales.billingRetail'),
    'facturation-gros': t('menu.sales.billingWholesale'),
    'proforma': t('menu.sales.proforma'),
    'fermeture-caisse': t('menu.sales.closeCash'),
    'reglements-bons': t('menu.sales.settlement'),
    'reception-achats': t('menu.purchases.reception'),
    'commande-auto': t('menu.purchases.autoOrder'),
    'commande-manuelle': t('menu.purchases.manualOrder'),
    'reglement-fournisseurs': t('menu.purchases.supplierSettlement'),
    'produits': t('menu.files.products'),
    'fiche-produits': t('menu.files.menuModule'),
    'clients': t('menu.files.clients'),
    'services-clients': t('menu.files.clientServices'),
    'fournisseurs': t('menu.files.suppliers'),
    'familles': t('menu.files.families'),
    'ingredients': 'Ingrédients',
    'situation-client': t('menu.edition.clientStatus'),
    'suivi-ventes-jour': t('menu.edition.dailySales'),
    'suivi-ventes-produit': t('menu.edition.salesByProduct'),
    'suivi-ventes-factures': t('menu.edition.invoiceList'),
    'situation-fournisseur': t('menu.edition.supplierStatus'),
    'suivi-achats-famille': t('menu.edition.purchaseByFamily'),
    'suivi-achats-jour': t('menu.edition.dailyPurchases'),
    'suivi-achats-periode': t('menu.edition.periodPurchases'),
    'consultation-caisse': t('menu.management.cashConsultation'),
    'journal-caisse': t('menu.management.cashJournal'),
    'tableau-bord': t('menu.management.dashboard'),
    'statistiques': t('menu.management.statistics'),
    'sorties-pertes': t('menu.management.lossExit'),
    'fiche-stock': t('menu.stock.productSheet'),
    'mouvements-stock': t('menu.stock.movements'),
    'listing-stock': t('menu.stock.listing'),
    'regularisation-stock': t('menu.stock.regularization'),
    'valorisation-stock': t('menu.stock.valorization'),
    'inventaire-stock': t('menu.stock.inventory'),
    'preferences': t('menu.program.preferences'),
    'programmation-touches': t('menu.program.keyProgramming'),
    'mots-de-passe': t('menu.program.passwords'),
    'synchronisation': t('menu.program.syncData'),
  };

  // Fetch worker's store - works offline
  useEffect(() => {
    const fetchStore = async () => {
      if (!user) return;

      let foundStoreId = roles.find(r => r.store_id)?.store_id || user?.user_metadata?.store_id || '';
      let foundStoreName = '';

      // Try to resolve store name from local bridge or cache
      if (foundStoreId) {
        const cachedStoreName = localStorage.getItem('worker_store_name');
        if (cachedStoreName) foundStoreName = cachedStoreName;
      }

      if (!foundStoreId) {
        const cachedStoreId = localStorage.getItem('worker_store_id');
        const cachedStoreName = localStorage.getItem('worker_store_name');
        if (cachedStoreId) {
          foundStoreId = cachedStoreId;
          foundStoreName = cachedStoreName || '';
        }
      }

      if (foundStoreId && !foundStoreName) {
        const cachedStoreId = localStorage.getItem('worker_store_id');
        const cachedStoreName = localStorage.getItem('worker_store_name');
        if (cachedStoreId === foundStoreId && cachedStoreName) {
          foundStoreName = cachedStoreName;
        } else {
          try {
            const localStore = await LocalDatabase.getStore(foundStoreId);
            if (localStore) foundStoreName = localStore.name;
          } catch (e) {
            console.error('Failed to recover store name from local db', e);
          }
        }
      }

      if (!foundStoreId && !localStorage.getItem('worker_store_id')) {
        try {
          const localRoles = await LocalDatabase.getRolesByUserId(user.id);
          const workerRole = localRoles.find(r => r.store_id) || localRoles.find(r => r.role === 'worker' || r.role === 'master');
          if (workerRole?.store_id) {
            setStoreId(workerRole.store_id);
          }
        } catch (error) {
          console.log('Failed to get roles from local database');
        }
      }
      if (foundStoreId) {
        setStoreId(foundStoreId);
        setStoreName(foundStoreName);
        localStorage.setItem('worker_store_id', foundStoreId);
        if (foundStoreName) localStorage.setItem('worker_store_name', foundStoreName);
      }
    };
    fetchStore();
  }, [user]);



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        setActiveModule('fermeture-caisse');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderModule = useCallback(() => {
    // If we are on a mobile device, we intercept the complex desktop modules
    // and render their dedicated mobile equivalents instead.
    if (!isDesktop) {
      switch (activeModule) {
        case 'vente-detail':
        case 'facturation-detail':
        case 'facturation-gros':
        case 'proforma':
          return <MobileSalesModule mode={activeModule} />;
        case 'fermeture-caisse':
        case 'consultation-caisse':
          return <MobileFicheCaisse />;
        case 'reception-achats':
          return <MobileReceptionAchats />;
        case 'commande-manuelle':
        case 'commande-auto':
          return <MobileCommandeManuelle />;
        case 'reglement-fournisseurs':
          return <MobileReglementsFournisseurs />;
      }
    }

    switch (activeModule) {
      case 'kds':
        return <KitchenDisplay storeId={storeId} />;

      case 'tables':
        return <TableManagement storeId={storeId} onModuleChange={setActiveModule} />;

      case 'vente-detail':
      case 'facturation-detail':
      case 'facturation-gros':
      case 'proforma':
        return <SalesModule storeId={storeId} mode={activeModule} />;

      case 'produits':
        return <FichiersProduitsModule storeId={storeId} />;

      case 'fiche-produits':
        return <FicheProduitsModule storeId={storeId} />;

      case 'ingredients':
        return <IngredientsModule storeId={storeId} />;

      case 'clients':
        return <FichiersClientsModule storeId={storeId} />;

      case 'services-clients':
        return <FichiersServicesClientsModule storeId={storeId} />;

      case 'fournisseurs':
        return <FichiersFournisseursModule storeId={storeId} />;

      case 'familles':
        return <FichiersFamillesModule storeId={storeId} />;

      case 'fermeture-caisse':
      case 'consultation-caisse':
        return <FicheCaisseModule storeId={storeId} />;

      case 'listing-stock':
        return <StockListingModule storeId={storeId} />;

      case 'fiche-stock':
      case 'mouvements-stock':
      case 'regularisation-stock':
      case 'valorisation-stock':
      case 'inventaire-stock':
        return <StockModule storeId={storeId} mode={activeModule} />;

      case 'reception-achats':
        return <ReceptionAchatsModule storeId={storeId} />;

      case 'commande-auto':
        return <CommandeAutoModule storeId={storeId} />;

      case 'commande-manuelle':
        return <CommandeManuelleModule storeId={storeId} />;

      case 'reglement-fournisseurs':
        return <ReglementsFournisseursModule storeId={storeId} />;

      case 'reglements-bons':
        return <ReglementsBonsModule storeId={storeId} />;

      case 'situation-client':
      case 'suivi-ventes-jour':
      case 'suivi-ventes-produit':
      case 'suivi-ventes-factures':
      case 'situation-fournisseur':
      case 'suivi-achats-famille':
      case 'suivi-achats-jour':
      case 'suivi-achats-periode':
        return <EditionModule storeId={storeId} mode={activeModule} />;

      case 'journal-caisse':
      case 'tableau-bord':
      case 'statistiques':
      case 'sorties-pertes':
        return <GestionModule storeId={storeId} mode={activeModule} />;

      case 'preferences':
      case 'programmation-touches':
      case 'mots-de-passe':
      case 'synchronisation':
        return <SettingsModule storeId={storeId} mode={activeModule} />;

      default:
        return (
          <PlaceholderModule
            title={moduleLabels[activeModule]}
            description={t('common.loading')}
          />
        );
    }
  }, [activeModule, storeId, t]);

  const handleLogout = async () => {
    await signOut();
  };

  if (!isDesktop && !forceDesktopMode) {
    return <MobileWorkerLayout onOpenDesktopModule={(moduleId) => {
      setActiveModule(moduleId as any);
      setForceDesktopMode(true);
    }} />;
  }

  const layoutContent = (
    <div className={cn('h-full flex flex-col bg-background', subRole === 'cashier' && 'dark', className)}>
      <header className={cn(
        'h-10 flex items-center shrink-0 px-2',
        subRole === 'cashier'
          ? 'bg-[#0D0D0D] border-b border-[#F5C518]/20'
          : subRole === 'cook'
            ? 'bg-black border-b border-white/10'
            : 'bg-[hsl(160,70%,35%)]'
      )}>
        <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-white/10 p-0.5 mr-2">
          <img src={logoUrl} alt="Djati" className="h-full w-full object-contain" />
        </div>
        <div className={cn(
          'font-black text-xs uppercase tracking-tighter mr-4 border-r pr-4',
          subRole === 'cashier'
            ? 'text-[#F5C518] border-[#F5C518]/20'
            : 'text-white border-white/20'
        )}>
          Djati
        </div>
        <WorkerMenuBar
          activeModule={activeModule}
          onModuleChange={setActiveModule}
          subRole={subRole}
        />
        {subRole === 'cashier' && (
          <div className="flex items-center gap-2.5 ml-auto pr-1">
            <NotificationCenter className="h-8 w-8" />
            <CashierReadyOrdersBell storeId={storeId} />
          </div>
        )}
      </header>

      <main className={cn(
        'flex-1 overflow-hidden',
        subRole === 'cashier'
          ? 'bg-[#F5C518]'
          : 'bg-[hsl(50,90%,55%)] dark:bg-background'
      )}>
        <div className="h-full p-4">
          <div className={cn(
            'h-full overflow-hidden flex flex-col',
            subRole === 'cashier'
              ? 'rounded-xl border border-[#F5C518]/15 bg-[#0D0D0D] shadow-2xl shadow-black/60'
              : 'glass-card'
          )}>
            <div className={cn(
              'h-8 border-b flex items-center px-4 justify-between',
              subRole === 'cashier'
                ? 'bg-[#F5C518]/10 border-[#F5C518]/20'
                : 'bg-primary/10 border-primary/30'
            )}>
              <div className="flex items-center gap-2">
                {!isDesktop && forceDesktopMode && (
                  <button
                    onClick={() => setForceDesktopMode(false)}
                    className={cn(
                      "p-1 rounded-sm hover:bg-black/10",
                      subRole === 'cashier' ? 'text-white' : 'text-primary'
                    )}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <span className={cn(
                  'text-sm font-medium',
                  subRole === 'cashier' ? 'text-white' : 'text-primary'
                )}>
                  {moduleLabels[activeModule]}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {renderModule()}
            </div>
          </div>
        </div>
      </main>

      <WorkerStatusBar
        storeName={storeName}
        userEmail={user?.email || ''}
        activeModule={activeModule}
        onLogout={handleLogout}
        storeId={storeId}
        subRole={subRole}
      />
    </div>
  );

  if (subRole === 'waiter' || activeModule === 'tables') {
    return layoutContent;
  }

  return (
    <MinWidthGate minWidth={675}>
      {layoutContent}
    </MinWidthGate>
  );
}
