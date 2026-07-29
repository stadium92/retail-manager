import { useState, useEffect, useMemo, useCallback } from 'react';
import { resolveFamilyName } from '@/lib/familyName';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Package, Search, Download, Filter, CheckCircle, 
  AlertTriangle, XCircle, History, Save, Plus,
  WifiOff, RefreshCw, ChevronLeft, ChevronRight, Barcode, ScanBarcode, ChevronDown, ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { OfflineDataService } from '@/services/OfflineDataService';
import { useStockSearch, StockFilter } from '@/hooks/useStockSearch';
import { useProductScanner } from '@/hooks/useProductScanner';
import { Product, StockMovement } from '@/types';
import { ValorisationStock } from './Stock/ValorisationStock';
import { RegularisationStock } from './Stock/RegularisationStock';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { BarcodeScanner } from '@/components/shared/BarcodeScanner';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { LocalProductFamily } from '@/services/LocalDatabase';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface StockModuleProps {
  storeId: string;
  mode: 'fiche-stock' | 'mouvements-stock' | 'listing-stock' | 'regularisation-stock' | 
        'valorisation-stock' | 'inventaire-stock';
}

export function StockModule({ storeId, mode }: StockModuleProps) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useFormatters();
  const { 
    search, setSearch, 
    filter, setFilter, 
    results: products, 
    total, 
    page, setPage, 
    limit, 
    isLoading: isSearchLoading,
    refetch: refetchStock 
  } = useStockSearch(storeId, mode === 'fiche-stock' || mode === 'listing-stock' || mode === 'inventaire-stock');

  const { scanProduct } = useProductScanner(storeId);
  const { fetchSuppliers } = usePurchasingStore();

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [movementsMessage, setMovementsMessage] = useState<string | null>(null);
  const [families, setFamilies] = useState<LocalProductFamily[]>([]);
  const [inventoryChanges, setInventoryChanges] = useState<Record<string, number>>({});
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [formOpen, setFormOpen] = useState(false);
  const [isScanningForSku, setIsScanningForSku] = useState(false);
  const [showBatches, setShowBatches] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    price: '',
    selling_price_2: '',
    selling_price_3: '',
    selling_price_4: '',
    wholesale_price: '',
    wholesale_price_ht: '',
    wholesale_price_ttc: '',
    cost: '',
    quantity: '',
    low_stock_threshold: '10',
    store_id: storeId,
    image_url: '',
    category_id: '',
    aisle: '',
    brand: '',
    unit_type: 'Pièce',
    packaging: '',
    expiry_date: '',
    reorder_quantity: '',
  });

  // Auto-scale quantity and prices when unit type changes
  const fetchModuleData = useCallback(async () => {
    if (!storeId) return;
    console.log('[StockModule] Fetching module data for mode:', mode);
    try {
      if (mode === 'listing-stock') {
         const familiesRes = await OfflineInventoryService.getProductFamilies(storeId);
         if (familiesRes.data) setFamilies(familiesRes.data);
         fetchSuppliers(storeId);
      }
      if (mode === 'mouvements-stock') {
        const { movements: movData, offlineMessage } = await OfflineDataService.getStockMovements(storeId);
        setMovements(movData);
        if (offlineMessage) setMovementsMessage(offlineMessage);
      }
    } catch (error) {
      console.error('[StockModule] Fetch error:', error);
    }
  }, [storeId, mode, fetchSuppliers]);

  const fetchBatches = useCallback(async () => {
    if (selectedProductId && storeId) {
      const { data } = await OfflineInventoryService.getProductBatches(storeId, selectedProductId);
      if (data) setBatches(data);
      else setBatches([]);
    }
  }, [selectedProductId, storeId]);

  useEffect(() => {
    fetchModuleData();
  }, [fetchModuleData]);

  // Real-time reactivity: listen for DB update events (sale, inventory)
  useEffect(() => {
    const handleDbUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'sale' || detail?.type === 'inventory' || detail?.type === 'product') {
        console.log('[StockModule] Refreshing data due to DB update event:', detail?.type);
        refetchStock();
        fetchModuleData();
      }
    };

    window.addEventListener('localDbDataUpdated', handleDbUpdate);
    return () => window.removeEventListener('localDbDataUpdated', handleDbUpdate);
  }, [refetchStock, fetchModuleData]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const getLocale = () => (i18n.language === 'fr' || i18n.language === 'bm') ? fr : enUS;

  const handleOpenForm = () => {
    setFormData({
      name: '', description: '', sku: '', barcode: '', price: '', 
      selling_price_2: '', selling_price_3: '', selling_price_4: '',
      wholesale_price: '',
      wholesale_price_ht: '', wholesale_price_ttc: '', cost: '', quantity: '',
      low_stock_threshold: '10', store_id: storeId, image_url: '', category_id: '',
      aisle: '', brand: '', unit_type: 'Pièce', packaging: '', expiry_date: '', reorder_quantity: '',
    });
    setFormOpen(true);
  };

  // Global scanner interceptor
  useEffect(() => {
    const handleScannerInput = (e: any) => {
      const code = e.detail?.code;
      if (code && formOpen) {
        setFormData(prev => ({ ...prev, sku: code }));
        toast.success(t('scanner.codeScanned') || 'Code scanned');
      }
    };
    window.addEventListener('scanner-input', handleScannerInput);
    return () => window.removeEventListener('scanner-input', handleScannerInput);
  }, [formOpen, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    let finalQuantity = parseFloat(formData.quantity) || 0;
    let price = parseFloat(formData.price);
    let selling_price_2 = formData.selling_price_2 ? parseFloat(formData.selling_price_2) : undefined;
    let selling_price_3 = formData.selling_price_3 ? parseFloat(formData.selling_price_3) : undefined;
    let selling_price_4 = formData.selling_price_4 ? parseFloat(formData.selling_price_4) : undefined;
    let wholesale_price_ttc = formData.wholesale_price_ttc ? parseFloat(formData.wholesale_price_ttc) : undefined;
    let wholesale_price_ht = formData.wholesale_price_ht ? parseFloat(formData.wholesale_price_ht) : undefined;
    let cost = formData.cost ? parseFloat(formData.cost) : undefined;

    const packaging = parseInt(formData.packaging) || 1;
    const isPack = ['Carton', 'Box', 'Pack'].includes(formData.unit_type);
    
    if (isPack && packaging > 1) {
      finalQuantity = finalQuantity * packaging;
      
      // Convert prices to per-piece for DB storage
      if (price > 0) price = price / packaging;
      if (selling_price_2 && selling_price_2 > 0) selling_price_2 = selling_price_2 / packaging;
      if (selling_price_3 && selling_price_3 > 0) selling_price_3 = selling_price_3 / packaging;
      if (selling_price_4 && selling_price_4 > 0) selling_price_4 = selling_price_4 / packaging;
      if (wholesale_price_ttc && wholesale_price_ttc > 0) wholesale_price_ttc = wholesale_price_ttc / packaging;
      if (wholesale_price_ht && wholesale_price_ht > 0) wholesale_price_ht = wholesale_price_ht / packaging;
      if (cost && cost > 0) cost = cost / packaging;
    }

    try {
      const { error } = await OfflineInventoryService.createItem({
        name: formData.name,
        description: formData.description || undefined,
        sku: formData.sku || undefined,
        price: price,
        selling_price_2: selling_price_2,
        selling_price_3: selling_price_3,
        selling_price_4: selling_price_4,
        wholesale_price: wholesale_price_ttc,
        wholesale_price_ht: wholesale_price_ht,
        wholesale_price_ttc: wholesale_price_ttc,
        cost: cost,
        quantity: finalQuantity,
        low_stock_threshold: parseInt(formData.low_stock_threshold),
        store_id: storeId,
        image_url: formData.image_url || undefined,
        category_id: formData.category_id || undefined,
        aisle: formData.aisle || undefined,
        brand: formData.brand || undefined,
        unit_type: formData.unit_type || undefined,
        packaging: formData.packaging || undefined,
        expiry_date: formData.expiry_date || undefined,
        reorder_quantity: formData.reorder_quantity ? parseInt(formData.reorder_quantity) : undefined,
      });

      if (error) toast.error(t('common.error'));
      else {
        toast.success(t('common.success'));
        window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
        setFormOpen(false);
        refetchStock();
      }
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);
  const productMovements = useMemo(() => selectedProduct ? [{ date: t('dashboard.todaySales'), type: t('sidebar.sales'), qty: -3, balance: selectedProduct.quantity }] : [], [selectedProduct, t]);

  const updatePhysicalStock = (productId: string, value: number) => setInventoryChanges(prev => ({ ...prev, [productId]: value }));

  const handleValidateInventory = async () => {
    const changeIds = Object.keys(inventoryChanges);
    if (changeIds.length === 0) return toast.info(t('common.noData'));
    setIsSaving(true);
    try {
      for (const [id, qty] of Object.entries(inventoryChanges)) await OfflineDataService.updateProductStock(storeId, id, qty, 'Inventaire');
      toast.success(t('common.success'));
      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
      refetchStock();
      setInventoryChanges({});
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const marginPercent = Number(formData.price) > 0 && Number(formData.cost) > 0 
    ? (((Number(formData.price) - Number(formData.cost)) / Number(formData.cost)) * 100).toFixed(1) 
    : '0';

  const OfflineIndicator = () => isOffline ? (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-warning/20 text-warning text-xs">
      <WifiOff className="h-3 w-3" />
      <span>{t('common.offline')}</span>
    </div>
  ) : null;

  const renderContent = () => {
    switch (mode) {
      case 'listing-stock':
        return (
          <>
          <Card className="h-full flex flex-col">
            <CardHeader className="py-3 border-b">
              <div className="flex items-center gap-4">
                <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 h-8" />
                <Select value={filter} onValueChange={(v) => setFilter(v as StockFilter)}>
                  <SelectTrigger className="w-40 h-8"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="in_stock">{t('inventory.inStock')}</SelectItem>
                    <SelectItem value="out_of_stock">{t('inventory.outOfStock')}</SelectItem>
                    <SelectItem value="low_stock">{t('inventory.lowStock')}</SelectItem>
                  </SelectContent>
                </Select>
                <OfflineIndicator />
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />{t('export.title')}</Button>
                  <Button size="sm" onClick={handleOpenForm}><Plus className="h-4 w-4 mr-2" />{t('common.create')}</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                    <TableRow>
                      <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs">{t('menu.program.unit')}</TableHead>
                      <TableHead className="text-xs text-center">Cndt.</TableHead>
                      <TableHead className="text-xs">{t('inventory.fields.category')}</TableHead>
                      <TableHead className="text-xs text-center">{t('pos.grid.stock')}</TableHead>
                      <TableHead className="text-xs text-right">{t('inventory.fields.price')}</TableHead>
                      <TableHead className="text-xs text-right">{t('inventory.fields.wholesalePriceShort')}</TableHead>
                      <TableHead className="text-xs text-right">{t('menu.program.value')}</TableHead>
                      <TableHead className="text-xs text-center">{t('purchases.status')}</TableHead>
                      <TableHead className="text-xs text-right">{t('inventory.margin')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(p => {
                      const unitPrice = p.unit_price || (p as any).price || 0;
                      const costPrice = p.cost_price || (p as any).cost || 0;
                      const value = p.quantity * unitPrice;
                      const margin = unitPrice > 0 && costPrice 
                        ? (((unitPrice - costPrice) / unitPrice) * 100).toFixed(1) 
                        : '0';
                      
                      return (
                        <TableRow key={p.id} className="h-10">
                          <TableCell className="text-xs font-medium">{p.name}</TableCell>
                          <TableCell className="text-xs font-mono">{p.sku || '—'}</TableCell>
                          <TableCell className="text-xs text-center">{p.unit_type || 'Pc'}</TableCell>
                          <TableCell className="text-xs text-center">{p.packaging || '1'}</TableCell>
                          <TableCell className="text-xs">{resolveFamilyName(p as any, families)}</TableCell>
                          <TableCell className={cn("text-xs text-center font-bold", p.quantity <= 0 ? 'text-danger' : p.quantity <= (p.min_quantity || 10) ? 'text-warning' : '')}>{p.quantity}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(unitPrice)}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(p.wholesale_price_ttc || 0)}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{formatCurrency(value)}</TableCell>
                          <TableCell className="text-center">{p.quantity <= 0 ? <XCircle className="h-4 w-4 text-danger inline" /> : p.quantity <= (p.min_quantity || 10) ? <AlertTriangle className="h-4 w-4 text-warning inline" /> : <CheckCircle className="h-4 w-4 text-success inline" />}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-success">{margin}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              <div className="p-2 border-t flex justify-between items-center text-xs text-muted-foreground">
                 <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-3 w-3" /></Button>
                 <span>Page {page} ({total} {t('menu.program.productsDisplayed')})</span>
                 <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={products.length < limit}><ChevronRight className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>

          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogContent className="max-w-full w-full h-[95vh] p-0 flex flex-col gap-0 rounded-none sm:rounded-lg sm:max-w-6xl sm:h-auto sm:max-h-[90vh]">
              <DialogHeader className="px-6 py-4 border-b">
                <DialogTitle className="flex items-center gap-2 text-xl"><Package className="h-6 w-6" /> {t('inventory.addItem')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold border-b pb-2">{t('inventory.generalInfo')}</h3>
                      <div className="space-y-4">
                        <div className="space-y-2"><Label>{t('inventory.fields.name')} *</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="h-12 text-lg" /></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>{t('inventory.fields.barcodeOrSku')}</Label>
                            <div className="flex gap-2">
                              <Input 
                                value={formData.sku} 
                                onChange={e => setFormData({...formData, sku: e.target.value})} 
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault(); // Prevent scanner from submitting the whole form
                                  }
                                }}
                              />
                              <Button type="button" variant="outline" size="icon" onClick={() => setIsScanningForSku(true)}><Barcode className="h-4 w-4" /></Button>
                            </div>
                          </div>
                          <div className="space-y-2"><Label>{t('inventory.fields.familyOrCategory')}</Label>
                            <Select value={formData.category_id} onValueChange={v => setFormData({...formData, category_id: v})}>
                              <SelectTrigger><SelectValue placeholder={t('common.search')} /></SelectTrigger>
                              <SelectContent>{families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2"><Label>{t('inventory.fields.brand')}</Label><Input value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} /></div>
                        <div className="space-y-2"><Label>{t('inventory.fields.aisle')}</Label><Input value={formData.aisle} onChange={e => setFormData({...formData, aisle: e.target.value})} /></div>
                        <div className="space-y-2"><Label>{t('inventory.description')}</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} /></div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold border-b pb-2">{t('inventory.pricesAndMargins')}</h3>
                      <div className="space-y-4">
                        <div className="space-y-2"><Label className="text-primary font-bold">{t('inventory.fields.retailPrice')} *</Label><Input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required className="h-12 text-lg font-bold border-primary/50" /></div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2"><Label className="text-xs">{t('inventory.fields.price2')}</Label><Input type="number" value={formData.selling_price_2} onChange={e => setFormData({...formData, selling_price_2: e.target.value})} /></div>
                          <div className="space-y-2"><Label className="text-xs">{t('inventory.fields.price3')}</Label><Input type="number" value={formData.selling_price_3} onChange={e => setFormData({...formData, selling_price_3: e.target.value})} /></div>
                          <div className="space-y-2"><Label className="text-xs">{t('inventory.fields.price4')}</Label><Input type="number" value={formData.selling_price_4} onChange={e => setFormData({...formData, selling_price_4: e.target.value})} /></div>
                        </div>
                        <div className="space-y-2"><Label>{t('inventory.fields.purchasePrice')}</Label><Input type="number" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>{t('inventory.fields.wholesalePriceHT')}</Label><Input type="number" value={formData.wholesale_price_ht} onChange={e => setFormData({...formData, wholesale_price_ht: e.target.value})} /></div>
                          <div className="space-y-2"><Label>{t('inventory.fields.wholesalePriceTTC')}</Label><Input type="number" value={formData.wholesale_price_ttc} onChange={e => setFormData({...formData, wholesale_price_ttc: e.target.value})} /></div>
                        </div>
                        <Card className="bg-muted/50 border-none mt-4"><CardContent className="p-4"><div className="flex justify-between items-center"><span className="text-muted-foreground">{t('inventory.calculatedMargin')}</span><span className="text-xl font-bold text-primary">{marginPercent}%</span></div></CardContent></Card>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold border-b pb-2">{t('inventory.stockAndPackaging')}</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>{t('inventory.fields.unitType')}</Label>
                            <Select value={formData.unit_type} onValueChange={v => setFormData({...formData, unit_type: v})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="Pièce">{t('inventory.unitTypes.piece')}</SelectItem><SelectItem value="Kg">{t('inventory.unitTypes.kg')}</SelectItem><SelectItem value="L">{t('inventory.unitTypes.litre')}</SelectItem><SelectItem value="Carton">{t('inventory.unitTypes.carton')}</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2"><Label>{t('inventory.fields.packaging')}</Label><Input value={formData.packaging} onChange={e => setFormData({...formData, packaging: e.target.value})} placeholder={t('inventory.fields.packagingPlaceholder')} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>{t('inventory.fields.quantity')} *</Label><Input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} required /></div>
                          <div className="space-y-2"><Label>{t('inventory.fields.lowStockThreshold')}</Label><Input type="number" value={formData.low_stock_threshold} onChange={e => setFormData({...formData, low_stock_threshold: e.target.value})} /></div>
                        </div>
                        <div className="space-y-2"><Label>{t('inventory.fields.reorderQuantity')}</Label><Input type="number" value={formData.reorder_quantity} onChange={e => setFormData({...formData, reorder_quantity: e.target.value})} /></div>
                        <div className="space-y-2"><Label>{t('inventory.fields.expiryDate')}</Label><Input type="date" value={formData.expiry_date} onChange={e => setFormData({...formData, expiry_date: e.target.value})} /></div>
                        <div className="space-y-2"><Label>{t('inventory.image')}</Label><ImageUpload currentImageUrl={formData.image_url} onImageUploaded={url => setFormData({...formData, image_url: url})} onImageRemoved={() => setFormData({...formData, image_url: ''})} folder="inventory" /></div>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="p-6 border-t bg-muted/10"><Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="h-10 px-6">{t('common.cancel')}</Button><Button type="submit" disabled={isSaving} className="h-10 px-6">{t('common.save')}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <BarcodeScanner isScanning={isScanningForSku} onResult={(code) => { setFormData(prev => ({ ...prev, sku: code })); setIsScanningForSku(false); }} onClose={() => setIsScanningForSku(false)} />
          </>
        );
      case 'fiche-stock':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 h-full">
            <Card className="h-full flex flex-col">
              <CardHeader className="py-3"><div className="flex items-center gap-2"><Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 flex-1" /><OfflineIndicator /></div></CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  {products.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => setSelectedProductId(p.id)} 
                      className={cn(
                        'px-4 py-3 cursor-pointer border-b border-border/30 transition-colors', 
                        'hover:bg-primary/5', 
                        selectedProductId === p.id && 'bg-primary/10 border-l-4 border-l-primary'
                      )}
                    >
                      <div className="text-sm font-bold uppercase truncate tracking-tight">{p.name || (p as any).product_name || t('common.unknown')}</div>
                      <div className="flex items-center justify-between mt-1 text-xs">
                        <span className="text-muted-foreground font-medium">{t('pos.grid.stock')}: {p.quantity}</span>
                        <span className="font-mono font-bold text-primary">{formatCurrency(p.unit_price)}</span>
                      </div>
                    </div>
                  ))}
                  {products.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      {isSearchLoading ? t('common.loading') : t('inventory.noItemsFound')}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
              <div className="p-2 border-t flex justify-between items-center text-xs text-muted-foreground"><Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-3 w-3" /></Button><span>Page {page}</span><Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={products.length < limit}><ChevronRight className="h-3 w-3" /></Button></div>
            </Card>
            <Card className="h-full flex flex-col">{selectedProduct ? (
              <>
                <CardHeader className="py-3 border-b"><div className="flex items-center justify-between"><div><CardTitle className="text-lg">{selectedProduct.name}</CardTitle><p className="text-xs text-muted-foreground mt-1">SKU: {selectedProduct.sku || '—'} | {t('inventory.fields.category')}: {families.find(f => f.id === selectedProduct.category)?.name || '—'}</p></div><div className="text-right"><div className="text-2xl font-bold text-primary">{selectedProduct.quantity}</div><div className="text-xs text-muted-foreground">{t('inventory.statusIn')}</div></div></div></CardHeader>
                <CardContent className="flex-1 p-4 overflow-auto">
                  <div className="grid grid-cols-3 gap-4 mb-6"><div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t('inventory.fields.price')}</p><p className="text-lg font-bold">{formatCurrency(selectedProduct.unit_price)}</p></div><div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t('inventory.fields.cost')}</p><p className="text-lg font-bold">{formatCurrency(selectedProduct.cost_price || 0)}</p></div><div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">{t('menu.program.value')}</p><p className="text-lg font-bold">{formatCurrency(selectedProduct.quantity * (selectedProduct.cost_price || selectedProduct.unit_price))}</p></div></div>
                  
                  {/* Batch Accordion */}
                  <div className="mb-6">
                    <div 
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50"
                      onClick={() => setShowBatches(!showBatches)}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Lots d'achat ({batches.length})</span>
                      </div>
                      {showBatches ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    {showBatches && (
                      <div className="mt-2 border rounded-lg overflow-auto max-h-48">
                        <Table>
                          <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                            <TableRow>
                              <TableHead className="h-8 text-xs">Date</TableHead>
                              <TableHead className="h-8 text-xs text-center">Reçu</TableHead>
                              <TableHead className="h-8 text-xs text-center">Restant</TableHead>
                              <TableHead className="h-8 text-xs text-right">P.Achat</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batches.map(batch => (
                              <TableRow key={batch.id} className="h-8">
                                <TableCell className="text-xs text-muted-foreground">
                                  {format(new Date(batch.received_at || new Date()), 'dd/MM/yy')}
                                </TableCell>
                                <TableCell className="text-xs text-center">{batch.quantity_received}</TableCell>
                                <TableCell className="text-xs text-center font-bold text-primary">{batch.quantity_remaining}</TableCell>
                                <TableCell className="text-xs text-right">{formatCurrency(batch.purchase_price)}</TableCell>
                              </TableRow>
                            ))}
                            {batches.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">{t('menu.program.noBatchesRecorded')}</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-3"><History className="h-4 w-4" /><span className="text-sm font-medium">{t('menu.program.lastMovements')}</span></div><Table><TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm"><TableRow><TableHead className="text-xs">{t('storeDetails.sales.table.date')}</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs text-center">{t('menu.program.stockMovements')}</TableHead><TableHead className="text-xs text-right">{t('menu.program.balance')}</TableHead></TableRow></TableHeader><TableBody>{productMovements.map((mov, idx) => (<TableRow key={idx} className="h-8"><TableCell className="text-xs">{mov.date}</TableCell><TableCell className="text-xs">{mov.type}</TableCell><TableCell className={cn("text-xs text-center", mov.qty > 0 ? "text-success" : "text-danger")}>{mov.qty > 0 ? '+' : ''}{mov.qty}</TableCell><TableCell className="text-xs text-right font-medium">{mov.balance}</TableCell></TableRow>))}</TableBody></Table></CardContent></>
            ) : (<div className="flex items-center justify-center h-full text-muted-foreground">{t('inventory.selectItemDetails')}</div>)}</Card>
          </div>
        );
      case 'mouvements-stock':
        return (<Card className="h-full flex flex-col"><CardHeader className="py-3 border-b"><div className="flex items-center gap-4 flex-wrap"><div className="flex items-center gap-2"><Input type="date" className="w-auto h-8" /><span className="text-muted-foreground">-</span><Input type="date" className="w-auto h-8" /></div><Input placeholder={t('common.filter')} className="w-48 h-8" /><Button variant="outline" size="sm" className="ml-auto"><Download className="h-4 w-4 mr-2" />{t('export.title')}</Button><OfflineIndicator /></div></CardHeader><CardContent className="flex-1 p-0 overflow-hidden">{movementsMessage && (<div className="p-4 bg-warning/10 border-b border-warning/20 text-warning text-sm">{movementsMessage}</div>)}<ScrollArea className="h-full"><Table><TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm"><TableRow><TableHead className="text-xs">{t('storeDetails.sales.table.date')}</TableHead><TableHead className="text-xs">{t('inventory.table.name')}</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs text-center">{t('inventory.table.quantity')}</TableHead><TableHead className="text-xs">{t('menu.program.reason')}</TableHead></TableRow></TableHeader><TableBody>{movements.map(mov => (<TableRow key={mov.id} className="h-10"><TableCell className="text-xs">{format(new Date(mov.created_at || mov.date || new Date()), 'dd/MM/yyyy HH:mm', { locale: getLocale() })}</TableCell><TableCell className="text-xs font-medium">{mov.product_name}</TableCell><TableCell><Badge variant={(mov.movement_type || mov.type) === 'in' ? 'default' : (mov.movement_type || mov.type) === 'out' ? 'destructive' : 'secondary'} className="text-xs">{(mov.movement_type || mov.type) === 'in' ? t('menu.program.income') : (mov.movement_type || mov.type) === 'out' ? t('menu.program.expenses') : 'Ajust.'}</Badge></TableCell><TableCell className={cn("text-xs text-center font-medium", (mov.movement_type || mov.type) === 'in' ? 'text-success' : (mov.movement_type || mov.type) === 'out' ? 'text-danger' : 'text-warning')}>{(mov.movement_type || mov.type) === 'in' ? '+' : '-'}{mov.quantity}</TableCell><TableCell className="text-xs">{mov.reason}</TableCell></TableRow>))}</TableBody></Table></ScrollArea></CardContent></Card>);
      case 'regularisation-stock': return <RegularisationStock storeId={storeId} />;
      case 'valorisation-stock': return <ValorisationStock storeId={storeId} />;
      case 'inventaire-stock':
        const changesCount = Object.keys(inventoryChanges).length;
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Input 
                  placeholder={t('common.search')} 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className="w-64 h-8" 
                />
                <OfflineIndicator />
              </div>
              <div className="flex items-center gap-4">
                {changesCount > 0 && (
                  <span className="text-sm text-warning">{changesCount} {t('common.itemsSelected')}</span>
                )}
                <Button 
                  type="button"
                  onClick={handleValidateInventory} 
                  disabled={isSaving || changesCount === 0}
                >
                  {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  {t('menu.program.stockInventory')} ({changesCount})
                </Button>
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="h-[500px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow>
                        <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                        <TableHead className="text-xs text-center">{t('menu.program.unit')}</TableHead>
                        <TableHead className="text-xs text-center">Cndt.</TableHead>
                        <TableHead className="text-xs text-center">{t('inventory.table.quantity')} (Sys)</TableHead>
                        <TableHead className="text-xs text-center w-32">{t('inventory.table.quantity')} (Phy)</TableHead>
                        <TableHead className="text-xs text-center">{t('menu.program.deficit')}</TableHead>
                        <TableHead className="text-xs text-right">{t('menu.program.value')} (Phy)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map(p => {
                        const physical = inventoryChanges[p.id] ?? p.quantity;
                        const difference = physical - p.quantity;
                        const physicalValue = physical * p.unit_price;
                        return (
                          <TableRow key={p.id} className="h-12">
                            <TableCell className="text-xs font-medium">
                              <div>{p.name || (p as any).product_name || t('common.unknown')}</div>
                              <div className="text-[10px] text-muted-foreground">{p.sku}</div>
                            </TableCell>
                            <TableCell className="text-xs text-center">{p.unit_type || 'Pc'}</TableCell>
                            <TableCell className="text-xs text-center">{p.packaging || '1'}</TableCell>
                            <TableCell className="text-xs text-center">{p.quantity}</TableCell>
                            <TableCell className="text-center">
                              <NumericInput 
                                min={0} 
                                value={physical} 
                                onValueChange={(v) => updatePhysicalStock(p.id, v)}
                                integer
                                className={cn(
                                  "h-8 w-20 text-center mx-auto",
                                  inventoryChanges[p.id] !== undefined && "border-primary bg-primary/5 font-bold"
                                )}
                              />
                            </TableCell>
                            <TableCell className={cn(
                              "text-xs text-center font-bold",
                              difference > 0 ? 'text-success' : difference < 0 ? 'text-danger' : 'text-muted-foreground'
                            )}>
                              {difference > 0 ? '+' : ''}{difference !== 0 ? difference : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-right font-medium">
                              {formatCurrency(physicalValue)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {products.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            {t('inventory.noItemsFound')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-2 border-t flex justify-between items-center text-xs text-muted-foreground">
                  <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span>Page {page} ({total} {t('menu.program.productsDisplayed')})</span>
                  <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)} disabled={products.length < limit}>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      default: return <div className="text-center py-8 text-muted-foreground">{t('common.error')}</div>;
    }
  };

  if (isSearchLoading && products.length === 0) return (<div className="flex items-center justify-center h-full"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>);
  return (<div className="h-full overflow-auto p-4">{renderContent()}</div>);
}