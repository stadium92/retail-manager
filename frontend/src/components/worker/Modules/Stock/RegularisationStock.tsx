import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Search, Save, RotateCcw, WifiOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { OfflineDataService } from '@/services/OfflineDataService';
import { useProductScanner } from '@/hooks/useProductScanner';
import { Product } from '@/types';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface RegularisationStockProps {
  storeId: string;
}

export function RegularisationStock({ storeId }: RegularisationStockProps) {
  const { t } = useTranslation();
  const { scanProduct, isScanning } = useProductScanner(storeId);
  const [isSaving, setIsSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Regularisation state
  const [regProduct, setRegProduct] = useState<Product | null>(null);
  const [regAdjustmentType, setRegAdjustmentType] = useState<'real' | 'delta'>('real');
  const [regQuantity, setRegQuantity] = useState<number>(0);
  const [regReason, setRegReason] = useState<string>('');
  const [regSearchCode, setRegSearchCode] = useState('');

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

  // Handle regularisation scan
  const handleRegScan = async () => {
     if (!regSearchCode) return;
     const product = await scanProduct(regSearchCode);
     if (product) {
        setRegProduct(product);
        setRegSearchCode(''); 
     } else {
        toast.error(t('worker.sales.itemNotFound'));
     }
  };

  // Handle regularisation - works offline
  const handleRegularisation = async () => {
    if (!regProduct || !regReason.trim()) {
      toast.error(t('common.error'));
      return;
    }

    if (regAdjustmentType === 'delta' && regQuantity === 0) {
       toast.error(t('common.error'));
       return;
    }

    setIsSaving(true);
    try {
      let newQuantity = 0;
      
      if (regAdjustmentType === 'real') {
         newQuantity = Math.max(0, regQuantity);
      } else {
         newQuantity = regProduct.quantity + regQuantity; 
      }

      await OfflineDataService.updateProductStock(regProduct.id, newQuantity, regReason);
      
      toast.success(`${t('common.success')}: ${regProduct.name} → ${newQuantity}`);
      
      setRegProduct({ ...regProduct, quantity: newQuantity });
      setRegQuantity(0);
      setRegReason('');
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

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

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            {t('menu.program.stockRegularization')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
              <Input 
                  placeholder={t('pos.grid.scanPrompt')} 
                  value={regSearchCode} 
                  onChange={e => setRegSearchCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRegScan()}
              />
              <Button onClick={handleRegScan} disabled={isScanning}>
                  <Search className="h-4 w-4" />
              </Button>
          </div>

          {regProduct ? (
             <div className="p-4 border rounded bg-muted/20">
                <div className="font-bold mb-2">{regProduct.name}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{t('menu.program.currentStock')}</Label>
                    <Input 
                      value={regProduct.quantity} 
                      disabled 
                      className="h-9 bg-muted"
                    />
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <Label className="text-xs">{t('common.filter')}</Label>
                  <RadioGroup 
                    value={regAdjustmentType} 
                    onValueChange={(v: 'real' | 'delta') => {
                       setRegAdjustmentType(v as any);
                       setRegQuantity(0);
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="real" id="real" />
                      <Label htmlFor="real" className="text-sm font-normal cursor-pointer">
                        {t('menu.program.realStock')}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="delta" id="delta" />
                      <Label htmlFor="delta" className="text-sm font-normal cursor-pointer">
                        {t('menu.program.deltaAdjustment')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label className="text-xs">
                       {regAdjustmentType === 'real' ? t('menu.program.countedQty') : t('menu.program.adjustQty')}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={regQuantity}
                      onChange={(e) => setRegQuantity(parseInt(e.target.value) || 0)}
                      className="h-9 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('menu.program.diffResult')}</Label>
                    <div className={cn(
                       "h-9 flex items-center px-3 rounded text-sm font-bold border",
                       regAdjustmentType === 'real' 
                          ? (regQuantity - regProduct.quantity !== 0 ? 'bg-warning/10 border-warning text-warning' : 'bg-muted')
                          : 'bg-muted'
                    )}>
                       {regAdjustmentType === 'real' 
                          ? `${regQuantity - regProduct.quantity > 0 ? '+' : ''}${regQuantity - regProduct.quantity}`
                          : `${t('common.unknown')}: ${regProduct.quantity + regQuantity}`
                       }
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <Label className="text-xs">{t('menu.management.lossExit')}</Label>
                  <Select value={regReason} onValueChange={setRegReason}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t('common.filter')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Trouvé">{t('common.success')}</SelectItem>
                      <SelectItem value="Don / Cadeau">Don / Cadeau</SelectItem>
                      <SelectItem value="Erreur de comptage">Erreur de comptage</SelectItem>
                      <SelectItem value="Retour client">Retour client</SelectItem>
                      <SelectItem value="Correction inventaire">Correction inventaire</SelectItem>
                      <SelectItem value="Autre">{t('common.unknown')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleRegularisation} 
                  disabled={isSaving || (regAdjustmentType === 'delta' && regQuantity === 0) || !regReason}
                  className="w-full mt-4"
                >
                  {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {t('menu.program.applyRegularization')}
                </Button>
                <Button variant="ghost" className="w-full mt-2" onClick={() => setRegProduct(null)}>
                   {t('common.cancel')}
                </Button>
             </div>
          ) : (
             <div className="text-center text-muted-foreground py-8">
                {t('menu.program.scanToStart')}
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}