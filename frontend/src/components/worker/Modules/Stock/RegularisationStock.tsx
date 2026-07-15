import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Save, RotateCcw, WifiOff, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { OfflineDataService } from '@/services/OfflineDataService';
import { OfflineAuthService } from '@/services/OfflineAuthService';
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
  const [history, setHistory] = useState<any[]>([]);
  
  // Regularisation state
  const [regProduct, setRegProduct] = useState<Product | null>(null);
  const [regAdjustmentType, setRegAdjustmentType] = useState<'real' | 'delta'>('real');
  const [regQuantity, setRegQuantity] = useState<number>(0);
  const [regReason, setRegReason] = useState<string>('');
  const [regSearchCode, setRegSearchCode] = useState('');
  const [isBox, setIsBox] = useState(false);

  const fetchHistory = async () => {
    try {
      const data = await OfflineAuthService.localBridgeRequest<any[]>(
        `/rest/v1/stock_adjustments?store_id=${storeId}`,
        { method: 'GET' }
      );
      setHistory(data || []);
    } catch (e) {
      console.error('Failed to fetch reg history:', e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [storeId]);

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
      const packaging = parseInt(regProduct.packaging || '1') || 1;
      let finalQtyInPieces = regQuantity;
      
      // If adjusting in boxes, scale the input to pieces
      if (isBox && packaging > 1) {
        finalQtyInPieces = regQuantity * packaging;
      }

      let delta = 0;
      let newQuantity = 0;
      if (regAdjustmentType === 'real') {
         newQuantity = Math.max(0, finalQtyInPieces);
         delta = newQuantity - regProduct.quantity;
      } else {
         delta = finalQtyInPieces;
         newQuantity = regProduct.quantity + delta; 
      }

      let adjType: 'loss' | 'damage' | 'inventory_count' | 'other' = 'other';
      if (regReason === 'Trouvé' || regReason === 'Erreur de comptage' || regReason === 'Correction inventaire') {
        adjType = 'inventory_count';
      } else if (regReason === 'Don / Cadeau') {
        adjType = 'other';
      } else {
        adjType = 'loss';
      }

      await OfflineAuthService.localBridgeRequest('/rest/v1/stock_adjustments', {
        method: 'POST',
        body: JSON.stringify({
          store_id: storeId,
          product_id: regProduct.id,
          adjustment_type: adjType,
          quantity_adjusted: delta,
          reason: regReason,
        })
      });
      
      toast.success(`${t('common.success')}: ${regProduct.name} → ${newQuantity} ${t('inventory.unitPiece')}`);
      
      setRegProduct({ ...regProduct, quantity: newQuantity });
      setRegQuantity(0);
      setRegReason('');
      fetchHistory(); // Refresh table
    } catch (error) {
      console.error('[Regularisation] Critical error:', error);
      toast.error(`${t('common.error')}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    <div className="grid grid-cols-1 lg:grid-cols-[450px_1fr] gap-6 p-4 h-full overflow-hidden">
      <div className="space-y-4 overflow-y-auto pr-2">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold uppercase tracking-widest flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            {t('menu.program.stockRegularization')}
          </h2>
          <OfflineIndicator />
        </div>

        <Card className="border-2 shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                      placeholder={t('pos.grid.scanPrompt')} 
                      value={regSearchCode} 
                      onChange={e => setRegSearchCode(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRegScan()}
                      className="pl-9 h-10 border-2"
                  />
                </div>
                <Button onClick={handleRegScan} disabled={isScanning} className="h-10 px-4">
                    {isScanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : t('common.search')}
                </Button>
            </div>

            {regProduct ? (
               <div className="space-y-6">
                  <div className="p-3 bg-primary/5 border-l-4 border-primary rounded">
                    <div className="text-sm font-black uppercase text-primary">{regProduct.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-1">SKU: {regProduct.sku || 'N/A'}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('menu.program.currentStock')}</Label>
                      <div className="h-10 flex items-center px-3 bg-muted rounded font-mono font-bold border-2">
                        {regProduct.quantity} {t('inventory.unitPiece')}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('menu.program.unit')}</Label>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsBox(!isBox)}
                        disabled={!regProduct.packaging || parseInt(regProduct.packaging) <= 1}
                        className={cn("w-full h-10 border-2 font-bold uppercase", isBox && "bg-primary text-white border-primary")}
                      >
                        {isBox ? `BOX (${regProduct.packaging})` : `PIECE (${t('inventory.unitPiece')})`}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('common.type')}</Label>
                    <RadioGroup 
                      value={regAdjustmentType} 
                      onValueChange={(v: 'real' | 'delta') => {
                         setRegAdjustmentType(v as any);
                         setRegQuantity(0);
                      }}
                      className="flex gap-6 p-2 bg-muted/30 rounded-lg border"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="real" id="real" />
                        <Label htmlFor="real" className="text-xs font-bold uppercase cursor-pointer">
                          {t('menu.program.realStock')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="delta" id="delta" />
                        <Label htmlFor="delta" className="text-xs font-bold uppercase cursor-pointer">
                          {t('menu.program.deltaAdjustment')}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                         {regAdjustmentType === 'real' ? t('menu.program.countedQty') : t('menu.program.adjustQty')}
                      </Label>
                      <NumericInput
                        min={0}
                        value={regQuantity}
                        onValueChange={(v) => setRegQuantity(v)}
                        integer
                        className="h-11 text-lg font-black font-mono border-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('menu.program.diffResult')}</Label>
                      <div className={cn(
                         "h-11 flex items-center justify-center px-3 rounded text-sm font-black border-2 font-mono",
                         regAdjustmentType === 'real' 
                            ? (regQuantity - (isBox ? (regProduct.quantity / (parseInt(regProduct.packaging || '1'))) : regProduct.quantity) !== 0 ? 'bg-warning/10 border-warning text-warning' : 'bg-muted')
                            : 'bg-muted'
                      )}>
                         {regAdjustmentType === 'real' 
                            ? `${regQuantity - (isBox ? (regProduct.quantity / (parseInt(regProduct.packaging || '1'))) : regProduct.quantity) > 0 ? '+' : ''}${regQuantity - (isBox ? (regProduct.quantity / (parseInt(regProduct.packaging || '1'))) : regProduct.quantity)} ${isBox ? 'BOX' : t('inventory.unitPiece')}`
                            : `→ ${regProduct.quantity + (regQuantity * (isBox ? parseInt(regProduct.packaging || '1') : 1))} ${t('inventory.unitPiece')}`
                         }
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">{t('menu.program.reason')}</Label>
                    <Select value={regReason} onValueChange={setRegReason}>
                      <SelectTrigger className="h-10 border-2 font-bold uppercase">
                        <SelectValue placeholder={t('common.filter')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Trouvé" className="uppercase font-bold text-success">{t('common.success')}</SelectItem>
                        <SelectItem value="Don / Cadeau" className="uppercase font-bold">{t('menu.program.reasonGiftDonation')}</SelectItem>
                        <SelectItem value="Erreur de comptage" className="uppercase font-bold">{t('menu.program.reasonCountingError')}</SelectItem>
                        <SelectItem value="Retour client" className="uppercase font-bold">{t('menu.program.reasonCustomerReturn')}</SelectItem>
                        <SelectItem value="Correction inventaire" className="uppercase font-bold">{t('menu.program.reasonInventoryCorrection')}</SelectItem>
                        <SelectItem value="Autre" className="uppercase font-bold">{t('common.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <Button variant="ghost" className="flex-1 h-11 uppercase font-bold text-muted-foreground" onClick={() => setRegProduct(null)}>
                       {t('common.cancel')}
                    </Button>
                    <Button 
                      onClick={handleRegularisation} 
                      disabled={isSaving || (regAdjustmentType === 'delta' && regQuantity === 0) || !regReason}
                      className="flex-[2] h-11 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest"
                    >
                      {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      {t('menu.program.applyRegularization')}
                    </Button>
                  </div>
               </div>
            ) : (
               <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl opacity-50">
                  <div className="p-4 bg-muted rounded-full mb-4">
                    <RotateCcw className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('menu.program.scanToStart')}
                  </p>
               </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="overflow-hidden flex flex-col space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          {t('menu.program.history')}
        </h3>
        <Card className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                <TableRow className="bg-muted/50 border-b-2">
                  <TableHead className="text-[10px] uppercase font-bold w-20">Heure</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Produit</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-center">Quantité</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-right">Raison</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(m => (
                  <TableRow key={m.id} className="h-11 border-b hover:bg-muted/5 transition-colors">
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {format(new Date(m.created_at || new Date()), 'dd/MM HH:mm')}
                    </TableCell>
                    <TableCell className="text-xs font-black uppercase truncate max-w-[200px]">
                      {m.product_name || 'N/A'}
                    </TableCell>
                    <TableCell className={cn(
                      "text-xs text-center font-black font-mono",
                      m.quantity_adjusted >= 0 ? "text-success" : "text-danger"
                    )}>
                      {m.quantity_adjusted > 0 ? `+${m.quantity_adjusted}` : m.quantity_adjusted}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <Badge variant="outline" className="text-[8px] uppercase border-muted-foreground/30 font-bold px-1 h-4">
                          {m.adjustment_type || 'autre'}
                        </Badge>
                        {m.reason && (
                          <span className="text-[9px] text-muted-foreground max-w-[120px] truncate">
                            {m.reason}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-24 uppercase font-mono tracking-widest opacity-30">
                      {t('common.noData')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}