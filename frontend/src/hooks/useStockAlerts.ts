import { useState, useEffect } from 'react';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { StockDashboard } from '@/types/ingredients';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';

export function useStockAlerts() {
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const { user } = useAuth();
  
  // Master selection or fallback to user's assigned store
  const { selectedStoreIds } = useMasterDashboardStore();

  useEffect(() => {
    let active = true;

    const fetchAlerts = async () => {
      // Determine store ID
      let storeId = '';
      if (user?.role === 'master') {
        storeId = selectedStoreIds[0] || '';
      } else if (user) {
        // Worker has store_id directly or on user
        storeId = (user as any).store_id || (user as any).storeId || '';
      }

      if (!storeId) return;

      try {
        const dashboard = await OfflineAuthService.localBridgeRequest<StockDashboard>(
          `/rest/v1/stock/dashboard?store_id=${storeId}`,
          { method: 'GET' }
        );

        if (active && dashboard) {
          setLowStockCount(dashboard.low_stock?.length ?? 0);
          setExpiringCount(dashboard.expiring_soon?.length ?? 0);
        }
      } catch (err) {
        console.error('[useStockAlerts] Error fetching alerts:', err);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // 60s poll

    // Listen to localDbDataUpdated to react immediately to sales/restocks
    const handleUpdate = (e: any) => {
      if (e.detail?.type === 'sale' || e.detail?.type === 'product' || e.detail?.type === 'ingredient') {
        fetchAlerts();
      }
    };

    window.addEventListener('localDbDataUpdated', handleUpdate);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('localDbDataUpdated', handleUpdate);
    };
  }, [user, selectedStoreIds]);

  return { lowStockCount, expiringCount };
}
