import { useState, useEffect, useMemo, useRef } from 'react';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { Store } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';
import { FichiersProduitsModule } from '@/components/worker/Modules/FichiersProduitsModule';
import { ValorisationStock } from '@/components/worker/Modules/Stock/ValorisationStock';
import { RefreshCw, Package, Database, ShieldCheck } from 'lucide-react';

export default function InventoryPage() {
  const { t } = useTranslation();
  const { selectedStoreIds, isAllStoresSelected, version } = useMasterDashboardStore();
  const { stores, setStores } = useMasterDataStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');

  // Initial store load
  useEffect(() => {
    const initStores = async () => {
      const res = await OfflineStoreService.getStores({ notify: false });
      if (res.data) setStores(res.data);
      setLoading(false);
    };
    initStores();

    const handleDbUpdate = (e: any) => {
      if (e.detail?.type === 'inventory') {
        // Increment version to force re-render/re-memoization of activeStoreIds if needed
        // but the children modules (FichiersProduitsModule) have their own listeners now too.
        // We trigger a store list reload just in case
        initStores();
      }
      setLoading(false);
    };
    window.addEventListener('localDbDataUpdated', handleDbUpdate);
    return () => window.removeEventListener('localDbDataUpdated', handleDbUpdate);
  }, []);

  const activeStoreIds = useMemo(() => {
    return isAllStoresSelected 
      ? (stores?.map(s => s.id) || [])
      : selectedStoreIds;
  }, [isAllStoresSelected, stores, selectedStoreIds, version]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            {t('inventory.title')}
          </h1>
          <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">
            {t('inventory.manageInventory')} • {activeStoreIds.length} {t('sidebar.stores')}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between bg-card/50 p-1 rounded-xl border-2 border-border/50 backdrop-blur-sm shadow-sm">
            <TabsList className="bg-transparent border-none">
                <TabsTrigger value="list" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-lg transition-all px-6">
                    <Package className="h-3.5 w-3.5 mr-2" />
                    INVENTAIRE GLOBAL
                </TabsTrigger>
                <TabsTrigger value="valuation" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-lg transition-all px-6">
                    <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                    VALORISATION
                </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="list" className="space-y-8 mt-0 focus-visible:ring-0">
          {activeStoreIds.length > 0 ? (
            activeStoreIds.map(sid => (
              <div key={`inventory-store-${sid}`} className="space-y-3">
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                </h2>
                <div className="h-[700px] border-4 rounded-3xl overflow-hidden shadow-2xl bg-card">
                    <FichiersProduitsModule storeId={sid} isMasterView />
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-20 bg-muted/20 rounded-3xl border-4 border-dashed border-border/50 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-black uppercase tracking-widest text-xs">{t('common.selectStore')}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="valuation" className="mt-0">
          {activeStoreIds.length > 0 ? (
            activeStoreIds.map(sid => (
              <div key={`val-store-${sid}`} className="space-y-3 mb-10">
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                </h2>
                <ValorisationStock storeId={sid} />
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground font-black uppercase tracking-widest text-xs">{t('common.selectStore')}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
