import { useState, useEffect, useMemo, useRef } from 'react';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';
import { FichiersProduitsModule } from '@/components/worker/Modules/FichiersProduitsModule';
import { FichiersFamillesModule } from '@/components/worker/Modules/FichiersFamillesModule';
import { ValorisationStock } from '@/components/worker/Modules/Stock/ValorisationStock';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, ShieldCheck, Plus, X } from 'lucide-react';

export default function InventoryPage() {
  const { t } = useTranslation();
  const { selectedStoreIds, isAllStoresSelected, version } = useMasterDashboardStore();
  const { stores, setStores } = useMasterDataStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const fichiersModuleRef = useRef<any>(null);

  // Initial load
  useEffect(() => {
    const loadStores = async () => {
      try {
        const res = await OfflineStoreService.getStores({ notify: false });
        if (res.data) setStores(res.data);
      } catch (error) {
        console.error('Failed to load stores:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStores();
  }, [setStores]);

  const activeStoreIds = useMemo(() => {
    return isAllStoresSelected 
      ? (stores?.map(s => s.id) || [])
      : selectedStoreIds;
  }, [isAllStoresSelected, stores, selectedStoreIds, version]);

  if (loading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-black uppercase tracking-tighter">{t('inventory.title')}</h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-60">{t('inventory.manageInventory')}</p>
        </div>
        <div className="flex items-center gap-3">
            <Button onClick={() => setIsAddingNew(true)} className="h-11 px-8 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20">
                <Plus className="h-5 w-5 mr-2" />
                {t('inventory.addItem')}
            </Button>
        </div>
      </div>

      {isAddingNew && (
          <div className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-6 mb-6 animate-in slide-in-from-top duration-300">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                      <Plus className="h-5 w-5 text-primary" />
                      {t('inventory.addNewItem')}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingNew(false)} className="h-8 w-8 rounded-full"><X className="h-4 w-4" /></Button>
              </div>
              <p className="text-sm text-muted-foreground mb-6 uppercase font-bold tracking-widest opacity-60">{t('inventory.selectStoreToAdd')}</p>
          </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between bg-card/50 p-1 rounded-xl border border-border/50 backdrop-blur-sm shadow-sm">
            <TabsList className="bg-transparent border-none">
                <TabsTrigger value="list" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all px-6">
                    <Package className="h-3.5 w-3.5 mr-2" />
                    {t('inventory.globalInventory')}
                </TabsTrigger>
                <TabsTrigger value="valuation" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all px-6">
                    <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                    {t('inventory.valuation')}
                </TabsTrigger>
                <TabsTrigger value="families" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all px-6">
                    Familles
                </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="list" className="mt-0">
          {activeStoreIds.length > 0 ? (
            activeStoreIds.map(sid => (
              <div key={`store-inv-${sid}`} className="space-y-3 mb-10">
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                </h2>
                <FichiersProduitsModule storeId={sid} isMasterView />
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-20 bg-muted/20 rounded-3xl border-2 border-dashed border-border/50 text-muted-foreground">
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
        
        <TabsContent value="families" className="mt-0">
          {activeStoreIds.length > 0 ? (
            activeStoreIds.map(sid => (
              <div key={`fam-store-${sid}`} className="space-y-3 mb-10">
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                </h2>
                <FichiersFamillesModule storeId={sid} />
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
