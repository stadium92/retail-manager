import { useState, useEffect } from 'react';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';

export function useDataCollection(storeId?: string) {
  const [daysCollected, setDaysCollected] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

  useEffect(() => {
    const checkDataCollection = async () => {
      try {
        if (isLocalFirst) {
          const headers = await OfflineAuthService.getAuthHeaders();
          if (!headers) {
            setIsLoading(false);
            return;
          }
          const params = new URLSearchParams();
          if (storeId) params.set('store_id', storeId);
          const response = await fetch(`${localBridgeBaseUrl}/rest/v1/sales?${params.toString()}`, {
            headers,
          });
          const payload = await response.json().catch(() => []);
          if (!response.ok) {
            throw new Error(payload?.message || 'LocalBridge request failed');
          }
          if (payload && payload.length > 0) {
            const uniqueDays = new Set(
              payload.map((sale: any) => new Date(sale.created_at).toDateString())
            );
            setDaysCollected(uniqueDays.size);
          }
          setIsLoading(false);
          return;
        }

        // No remote fallback available; default to 0 days collected
        setDaysCollected(0);
      } catch (error) {
        console.error('Error checking data collection:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkDataCollection();
  }, [storeId, isLocalFirst, localBridgeBaseUrl]);

  const daysRemaining = Math.max(0, 30 - daysCollected);
  const progress = Math.min(100, (daysCollected / 30) * 100);
  const aiEnabled = daysCollected >= 30;

  return {
    daysCollected,
    daysRemaining,
    progress,
    aiEnabled,
    isLoading,
  };
}
