import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WifiOff } from 'lucide-react';
import { OfflineDataService } from '@/services/OfflineDataService';
import { useTranslation } from 'react-i18next';

interface ValorisationStockProps {
  storeId: string;
}

export function ValorisationStock({ storeId }: ValorisationStockProps) {
  const { t, i18n } = useTranslation();
  const [valuation, setValuation] = useState<{ total_cost: number; total_retail: number; item_count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' XAF';
  };

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
    setLoading(true);
    OfflineDataService.getStockValuation(storeId)
      .then((data) => {
        setValuation(data || { total_cost: 0, total_retail: 0, item_count: 0 });
      })
      .catch(() => {
        setValuation({ total_cost: 0, total_retail: 0, item_count: 0 });
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!valuation) return <div className="p-8 text-center text-red-500">{t('common.error')}</div>;

  const OfflineIndicator = () => isOffline ? (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-warning/20 text-warning text-xs">
      <WifiOff className="h-3 w-3" />
      <span>{t('common.offline')}</span>
    </div>
  ) : null;

  return (
    <div className="space-y-4 p-4">
       <div className="flex justify-end">
          <OfflineIndicator />
       </div>
       
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
             <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-1">{t('menu.program.purchaseValue')}</p>
                <p className="text-2xl font-bold">{formatCurrency(valuation.total_cost)}</p>
             </CardContent>
          </Card>
          <Card>
             <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-1">{t('menu.program.sellingValue')}</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(valuation.total_retail)}</p>
             </CardContent>
          </Card>
          <Card className="bg-success/10 border-success/20">
             <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-1">{t('menu.program.potentialMargin')}</p>
                <p className="text-2xl font-bold text-success">
                   {formatCurrency(valuation.total_retail - valuation.total_cost)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                   {valuation.total_cost > 0 
                      ? `+${((valuation.total_retail - valuation.total_cost) / valuation.total_cost * 100).toFixed(1)}%` 
                      : 'N/A'}
                </p>
             </CardContent>
          </Card>
       </div>

       <Card>
          <CardHeader>
             <CardTitle className="text-sm">{t('menu.program.itemRefCount')}</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex justify-between items-center p-4 bg-muted/20 rounded">
                <span>{t('menu.program.itemRefCount')}</span>
                <span className="font-bold">{valuation.item_count}</span>
             </div>
          </CardContent>
       </Card>
    </div>
  );
}