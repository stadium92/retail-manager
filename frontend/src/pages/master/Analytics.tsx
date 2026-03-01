import { useState, useEffect, useMemo } from 'react';
import { GestionModule } from '@/components/shared/GestionModule';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { useTranslation } from 'react-i18next';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';
import { OfflineStoreService } from '@/services/OfflineStoreService';

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const { stores, setStores, setUsers } = useMasterDataStore();
  const { selectedStoreIds, isAllStoresSelected, version } = useMasterDashboardStore();

  const [activeTab, setActiveTab] = useState<'tableau-bord' | 'statistiques' | 'journal-caisse'>(() => {
    return (localStorage.getItem('master_analytics_tab') as any) || 'tableau-bord';
  });

  // Fetch stores and users if not available
  useEffect(() => {
    const loadGlobalData = async () => {
      const { getDataClient } = await import('@/lib/dataClient');
      const { OfflineAuthService } = await import('@/services/OfflineAuthService');
      const dc = getDataClient();
      
      // Load Stores
      if (!stores || stores.length === 0) {
        const { data } = await OfflineStoreService.getStores();
        if (data) setStores(data);
      }

      // Load Users for name resolution
      try {
        if (dc.isLocalFirst) {
            const headers = await OfflineAuthService.getAuthHeaders();
            const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/users`, { headers });
            if (res.ok) setUsers(await res.json());
        } else {
            const { data } = await dc.supabase.from('profiles').select('*');
            if (data) setUsers(data as any);
        }
      } catch (e) {
          console.warn('Failed to load users for analytics');
      }
    };
    loadGlobalData();
  }, []);

  const activeStoreIds = useMemo(() => {
    return isAllStoresSelected 
      ? (stores?.map(s => s.id) || [])
      : selectedStoreIds;
  }, [isAllStoresSelected, stores, selectedStoreIds, version]);

  useEffect(() => {
    localStorage.setItem('master_analytics_tab', activeTab);
  }, [activeTab]);

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('analytics.title')}</h1>
          <p className="text-muted-foreground">{t('analytics.description')}</p>
        </div>

        <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-lg border ml-auto">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setActiveTab('tableau-bord')}
              className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${activeTab === 'tableau-bord' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('statistiques')}
              className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${activeTab === 'statistiques' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Stats
            </button>
            <button 
              onClick={() => setActiveTab('journal-caisse')}
              className={`px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${activeTab === 'journal-caisse' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Journal
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeStoreIds.length > 0 ? (
          <div className="h-full space-y-8 overflow-y-auto pr-2">
            {activeStoreIds.map(sid => (
              <div key={`analytics-${sid}`} className="space-y-2 border-b-2 pb-8 last:border-0">
                <h2 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2 px-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {stores?.find(s => s.id === sid)?.name || t('common.unknown')}
                </h2>
                <div className="h-[600px]">
                  <GestionModule 
                    storeId={sid} 
                    mode={activeTab === 'journal-caisse' ? 'journal-caisse' : activeTab} 
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">{t('common.selectStore')}</div>
        )}
      </div>
    </div>
  );
}
