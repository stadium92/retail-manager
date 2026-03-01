import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Coins, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';

export function TodaySummary() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [salesCount, setSalesCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

  useEffect(() => {
    fetchTodaySummary();
  }, [user, isLocalFirst, localBridgeBaseUrl]);

  const fetchTodaySummary = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      if (isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          setLoading(false);
          return;
        }
        const params = new URLSearchParams();
        if (user.user_metadata?.store_id) {
          params.set('store_id', String(user.user_metadata.store_id));
        }
        const response = await fetch(`${localBridgeBaseUrl}/rest/v1/sales?${params.toString()}`, {
          headers,
        });
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          console.error('Error fetching today summary:', payload);
          setLoading(false);
          return;
        }
        const sales = (payload || []) as Array<{ total_price?: number; worker_id?: string; created_at?: string }>;
        const filtered = sales.filter((sale) => {
          if (sale.worker_id && sale.worker_id !== user.id) return false;
          if (!sale.created_at) return false;
          return new Date(sale.created_at) >= today;
        });
        setSalesCount(filtered.length);
        setTotalRevenue(filtered.reduce((sum, sale) => sum + Number(sale.total_price || 0), 0));
        setLoading(false);
        return;
      }

      // Get today's sales for this worker only
      const { data, error } = await supabase
        .from('sales')
        .select('total_price')
        .eq('worker_id', user.id)
        .gte('created_at', today.toISOString());

      if (error) {
        console.error('Error fetching today summary:', error);
        setLoading(false);
        return;
      }

      if (data) {
      setSalesCount(data.length);
        setTotalRevenue(data.reduce((sum, sale) => sum + Number(sale.total_price || 0), 0));
    }
    } catch (error) {
      console.error('Unexpected error fetching today summary:', error);
    } finally {
    setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('worker.dashboard.summary.todaySales')}</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold animate-pulse">...</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('worker.dashboard.summary.totalRevenue')}</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold animate-pulse">...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('worker.dashboard.summary.todaySales')}</CardTitle>
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{salesCount}</div>
          <p className="text-xs text-muted-foreground">
            {t('worker.dashboard.summary.transactionsCompleted')}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('worker.dashboard.summary.totalRevenue')}</CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalRevenue.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language)} XAF</div>
          <p className="text-xs text-muted-foreground">
            {t('worker.dashboard.summary.fromSales', { count: salesCount })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
