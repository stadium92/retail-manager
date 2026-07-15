import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WifiOff, TrendingUp, Package, Calculator } from 'lucide-react';
import { OfflineDataService } from '@/services/OfflineDataService';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { Badge } from '@/components/ui/badge';
import { MasterPasswordGate } from '@/components/shared/MasterPasswordGate';

interface ValorisationStockProps {
  storeId: string;
}

export function ValorisationStock({ storeId }: ValorisationStockProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatters();
  const [valuation, setValuation] = useState<{ 
    total_cost: number; 
    total_retail: number; 
    total_wholesale: number;
    total_resale: number;
    item_count: number 
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    console.log('[ValorisationStock] Fetching stock valuation for store:', storeId);
    try {
      const data = await OfflineDataService.getStockValuation(storeId);
      console.log('[ValorisationStock] Received data:', data);
      setValuation(data || { total_cost: 0, total_retail: 0, total_wholesale: 0, total_resale: 0, item_count: 0 });
    } catch (err) {
      console.error('[ValorisationStock] Fetch error:', err);
      setValuation({ total_cost: 0, total_retail: 0, total_wholesale: 0, total_resale: 0, item_count: 0 });
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchData();

    const handleRefresh = (e: any) => {
      if (e.detail?.type === 'inventory' || e.detail?.type === 'product' || e.detail?.type === 'sale') {
        console.log('[ValorisationStock] Refreshing due to DB update event');
        fetchData();
      }
    };

    window.addEventListener('localDbDataUpdated', handleRefresh);
    return () => window.removeEventListener('localDbDataUpdated', handleRefresh);
  }, [fetchData]);

  if (loading) return (
    <div className="p-12 flex flex-col items-center justify-center space-y-4">
      <Calculator className="h-8 w-8 animate-pulse text-muted-foreground" />
      <span className="text-muted-foreground animate-pulse">{t('common.loading')}</span>
    </div>
  );

  if (!valuation) return <div className="p-8 text-center text-red-500">{t('common.error')}</div>;

  const margin = valuation.total_retail - valuation.total_cost;
  const marginPercent = valuation.total_cost > 0 ? (margin / valuation.total_cost) * 100 : 0;

  return (
    <MasterPasswordGate moduleName={t('menu.program.stockValuation', 'Valorisation du Stock')}>
      <div className="space-y-6 p-2">
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 shadow-md">
             <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('menu.program.purchaseValue')}</p>
                  <Package className="h-4 w-4 text-blue-500 opacity-50" />
                </div>
                <p className="text-xl font-black font-mono">{formatCurrency(valuation.total_cost)}</p>
             </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary shadow-md">
             <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('menu.program.sellingValue')}</p>
                  <TrendingUp className="h-4 w-4 text-primary opacity-50" />
                </div>
                <p className="text-xl font-black font-mono text-primary">{formatCurrency(valuation.total_retail)}</p>
             </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-md">
             <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('edition.wholesaleValue')}</p>
                  <Package className="h-4 w-4 text-amber-500 opacity-50" />
                </div>
                <p className="text-xl font-black font-mono text-amber-600">{formatCurrency(valuation.total_wholesale)}</p>
             </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success bg-success/5 shadow-md">
             <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('menu.program.potentialMargin')}</p>
                  <Calculator className="h-4 w-4 text-success opacity-50" />
                </div>
                <p className="text-xl font-black font-mono text-success">
                   {formatCurrency(margin)}
                </p>
                <Badge variant="outline" className="text-[9px] font-black bg-success/10 text-success border-success/20 mt-1">
                    +{marginPercent.toFixed(1)}%
                </Badge>
             </CardContent>
          </Card>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Package className="h-3 w-3" />
                  {t('menu.program.itemRefCount')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-mono">{valuation.item_count}</div>
              </CardContent>
          </Card>

          <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-3 w-3" />
                  {t('edition.resaleValue')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black font-mono text-muted-foreground">{formatCurrency(valuation.total_resale)}</div>
              </CardContent>
          </Card>
       </div>
      </div>
    </MasterPasswordGate>
  );
}