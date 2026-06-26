import { useState, useEffect, useCallback } from 'react';
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
import { CashierCreditsModule } from '../Modules/CashierCreditsModule';
import { useDevice } from '@/contexts/DeviceContext';
import { MobileWorkerLayout } from '@/components/mobile/MobileWorkerLayout';
import { MinWidthGate } from '@/components/shared/MinWidthGate';

interface WorkerLayoutProps {
  className?: string;
}

export function WorkerLayout({ className }: WorkerLayoutProps) {
  const { isDesktop } = useDevice();

  if (!isDesktop) {
    return <MobileWorkerLayout />;
  }

  useGlobalKeyboard();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
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
    'vente-detail': t('menu.sales.retail'),
    'facturation-detail': t('menu.sales.billingRetail'),
    'facturation-gros': t('menu.sales.billingWholesale'),
    'proforma': t('menu.sales.proforma'),
    'fermeture-caisse': t('menu.sales.closeCash'),
    'reglements-bons': t('menu.sales.settlement'),
    'credits-caisse': t('menu.sales.cashierCredits'),
    'reception-achats': t('menu.purchases.reception'),
    'commande-auto': t('menu.purchases.autoOrder'),
    'commande-manuelle': t('menu.purchases.manualOrder'),
    'reglement-fournisseurs': t('menu.purchases.supplierSettlement'),
    'produits': t('menu.files.products'),
    'clients': t('menu.files.clients'),
    'services-clients': t('menu.files.clientServices'),
    'fournisseurs': t('menu.files.suppliers'),
    'familles': t('menu.files.families'),
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

      let foundStoreId = user?.user_metadata?.store_id || '';
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
          const workerRole = localRoles.find(r => r.role === 'worker' || r.role === 'master');
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
    switch (activeModule) {
      case 'vente-detail':
      case 'facturation-detail':
      case 'facturation-gros':
      case 'proforma':
        return <SalesModule storeId={storeId} mode={activeModule} />;

      case 'produits':
        return <FichiersProduitsModule storeId={storeId} />;

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

      case 'credits-caisse':
        return <CashierCreditsModule storeId={storeId} />;

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

  const layoutContent = (
    <div className={cn('h-full flex flex-col bg-background', className)}>
      <header className="h-10 bg-[hsl(160,70%,35%)] flex items-center shrink-0 px-2">
        <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-white/10 p-0.5 mr-2">
          <img src={logoUrl} alt="Djati" className="h-full w-full object-contain" />
        </div>
        <div className="text-white font-black text-xs uppercase tracking-tighter mr-4 border-r border-white/20 pr-4">
          Djati
        </div>
        <WorkerMenuBar
          activeModule={activeModule}
          onModuleChange={setActiveModule}
        />
      </header>

      <main className="flex-1 overflow-hidden bg-[hsl(50,90%,55%)] dark:bg-background">
        <div className="h-full p-4">
          <div className="h-full glass-card overflow-hidden flex flex-col">
            <div className="h-8 bg-primary/10 border-b border-primary/30 flex items-center px-4">
              <span className="text-sm font-medium text-primary">
                {moduleLabels[activeModule]}
              </span>
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
      />
    </div>
  );

  return (
    <MinWidthGate minWidth={675}>
      {layoutContent}
    </MinWidthGate>
  );
}