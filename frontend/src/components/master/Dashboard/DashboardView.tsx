import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { Coins, Store as StoreIcon, Package, TrendingUp, Bot, Sparkles } from 'lucide-react';
import { MetricCard } from './MetricCard';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SalesStatus } from '@/types';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore'; // <--- Import this
import { DataCollectionProgress } from '../AI/DataCollectionProgress';
import { ChatView } from '../AI/ChatView';
import { SuggestionsPanel } from '../AI/SuggestionsPanel';

export function DashboardView() {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatters();
  const [loading, setLoading] = useState(true);
  const { selectedStoreIds, isAllStoresSelected, version } = useMasterDashboardStore();

  const [metrics, setMetrics] = useState({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
    totalStores: 0,
    lowStockItems: 0,
    stockValuation: 0,
  });
  const [salesStatus, setSalesStatus] = useState<SalesStatus>('good');

  useEffect(() => {
    loadDashboardData();
  }, [version, selectedStoreIds, isAllStoresSelected]);

  const loadDashboardData = async () => {
    setLoading(true);

    try {
      // 1. Fetch stores to know total count and valid IDs
      const { data: allStores } = await OfflineStoreService.getStores();
      const activeStoreIds = isAllStoresSelected 
        ? (allStores?.map(s => s.id) || [])
        : selectedStoreIds;

      // 2. Fetch metrics for each store and aggregate
      // Note: We'll aggregate manually here for robustness, 
      // but ideally we'd pass an array to the service.
      
      let combinedToday = 0;
      let combinedWeek = 0;
      let combinedMonth = 0;
      let combinedLowStock = 0;
      let combinedValuation = 0;

      await Promise.all(activeStoreIds.map(async (sid) => {
        const [salesRes, stockRes, valRes] = await Promise.all([
          OfflineSalesService.getSaleMetrics(sid),
          OfflineInventoryService.getLowStockItems(10, sid),
          OfflineInventoryService.getStockValuation(sid)
        ]);
        combinedToday += salesRes.todaySales || 0;
        combinedWeek += salesRes.weekSales || 0;
        combinedMonth += salesRes.monthSales || 0;
        combinedLowStock += stockRes.data?.length || 0;
        combinedValuation += valRes.total_retail || 0;
      }));

      // Calculate sales status based on aggregate
      let status: SalesStatus = 'good';
      if (combinedToday === 0) {
        status = 'worse';
      } else if (combinedToday < combinedWeek / 7) {
        status = 'bad';
      }

      setMetrics({
        todaySales: combinedToday,
        weekSales: combinedWeek,
        monthSales: combinedMonth,
        totalStores: activeStoreIds.length,
        lowStockItems: combinedLowStock,
        stockValuation: combinedValuation,
      });
      setSalesStatus(status);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSalesStatusBadge = () => {
    const statusConfig = {
      good: { label: t('dashboard.status.good'), className: 'status-good' },
      bad: { label: t('dashboard.status.bad'), className: 'status-bad' },
      worse: { label: t('dashboard.status.worse'), className: 'status-worse' },
    };

    const config = statusConfig[salesStatus];

    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mobile-container py-4 px-4 lg:px-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground">{t('dashboard.salesStatus')}:</p>
          {getSalesStatusBadge()}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">{t('dashboard.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="ai-assistant">
            <Bot className="h-4 w-4 mr-2" />
            {t('dashboard.tabs.aiAssistant')}
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Sparkles className="h-4 w-4 mr-2" />
            {t('dashboard.tabs.aiInsights')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title={t('dashboard.todaySales')}
          value={formatCurrency(metrics.todaySales)}
          icon={Coins}
          trend={salesStatus === 'good' ? 'up' : salesStatus === 'bad' ? 'down' : 'stable'}
          trendValue={t('dashboard.trendValue', { percent: metrics.weekSales > 0 ? ((metrics.todaySales / metrics.weekSales) * 100).toFixed(1) : '0' })}
        />
        <MetricCard
          title={t('dashboard.weekSales')}
          value={formatCurrency(metrics.weekSales)}
          icon={TrendingUp}
        />
        <MetricCard
          title={t('dashboard.metrics.inventoryValue')}
          value={formatCurrency(metrics.stockValuation)}
          icon={Package}
        />
        <MetricCard
          title={t('dashboard.totalStores')}
          value={metrics.totalStores}
          icon={StoreIcon}
        />
        <MetricCard
          title={t('dashboard.lowStockItems')}
          value={metrics.lowStockItems}
          icon={Package}
          className={metrics.lowStockItems > 0 ? 'border-warning' : ''}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.welcome.title')}</CardTitle>
          <CardDescription>
            {t('dashboard.welcome.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold">{t('dashboard.welcome.quickActions')}</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>{t('dashboard.welcome.action1')}</li>
                <li>{t('dashboard.welcome.action2')}</li>
                <li>{t('dashboard.welcome.action3')}</li>
                <li>{t('dashboard.welcome.action4')}</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">{t('dashboard.welcome.currentStatus')}</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>{t('dashboard.welcome.status1', { amount: formatCurrency(metrics.monthSales) })}</li>
                <li>{t('dashboard.welcome.status2', { count: metrics.totalStores })}</li>
                <li>{t('dashboard.welcome.status3', { count: metrics.lowStockItems })}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="ai-assistant" className="space-y-6">
          <DataCollectionProgress />
          <ChatView 
            contextData={{
              todaySales: metrics.todaySales,
              weekSales: metrics.weekSales,
              totalStores: metrics.totalStores,
              lowStockItems: metrics.lowStockItems,
            }}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <DataCollectionProgress />
          <SuggestionsPanel 
            salesData={{
              today: metrics.todaySales,
              week: metrics.weekSales,
              status: salesStatus,
            }}
            inventoryData={{
              lowStock: metrics.lowStockItems,
            }}
            storeId=""
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
