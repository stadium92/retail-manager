import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WifiOff, TrendingUp, Package, Calculator } from 'lucide-react';
import { OfflineDataService } from '@/services/OfflineDataService';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { Badge } from '@/components/ui/badge';

interface ValorisationStockProps {
  storeId: string;
}

export function ValorisationStock({ storeId }: ValorisationStockProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatters();
  const [valuation, setValuation] = useState<{ total_cost: number; total_retail: number; item_count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchValuation = async () => {
      setLoading(true);
      try {
        const data = await OfflineDataService.getStockValuation(storeId);
        setValuation(data || { total_cost: 0, total_retail: 0, item_count: 0 });
      } catch (err) {
        console.error('Valuation fetch failed:', err);
        setValuation({ total_cost: 0, total_retail: 0, item_count: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchValuation();
  }, [storeId]);

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
    <div className="space-y-6 p-2">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
             <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('menu.program.purchaseValue')}</p>
                  <Package className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(valuation.total_cost)}</p>
             </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary">
             <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('menu.program.sellingValue')}</p>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold text-primary">{formatCurrency(valuation.total_retail)}</p>
             </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success bg-success/5">
             <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('menu.program.potentialMargin')}</p>
                  <Calculator className="h-4 w-4 text-success" />
                </div>
                <p className="text-2xl font-bold text-success">
                   {formatCurrency(margin)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">
                    +{marginPercent.toFixed(1)}%
                  </Badge>
                </div>
             </CardContent>
          </Card>
       </div>

       <Card>
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium flex items-center gap-2">
               <Package className="h-4 w-4" />
               {t('menu.program.itemRefCount')}
             </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-3xl font-bold">{valuation.item_count}</div>
             <p className="text-xs text-muted-foreground mt-1">
               {storeId ? t('inventory.manageInventory') : t('inventory.allStores')}
             </p>
          </CardContent>
       </Card>
    </div>
  );
}