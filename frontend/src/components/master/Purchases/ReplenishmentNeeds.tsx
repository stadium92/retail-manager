import { useState, useEffect } from 'react';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ShoppingCart, AlertTriangle, User, Zap, RefreshCw, FileText, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { ProductLookupDialog } from '@/components/worker/Sales/ProductLookupDialog';
import { Product } from '@/types';
import { cn } from '@/lib/utils';

interface ReplenishmentNeed {
  product_id: string;
  product_name: string;
  sku?: string;
  current_stock: number;
  min_stock: number;
  source: 'low_stock' | 'worker_request';
  suggested_qty: number;
  requester_name?: string;
  request_reason?: string;
  selected?: boolean;
  order_qty?: number;
  unit_cost?: number;
  packaging?: string;
  unit_type?: string;
  unit_price?: number;
  isBox?: boolean;
  packSize?: number;
}

interface Props {
  storeId: string;
}

export function ReplenishmentNeeds({ storeId }: Props) {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatters();
  const { suppliers, fetchSuppliers, createOrder } = usePurchasingStore();
  const [needs, setNeeds] = useState<ReplenishmentNeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<ReplenishmentNeed[]>([]);

  useEffect(() => {
    if (storeId) {
      // Bypassing global store for direct fetch to ensure supplier access
      fetchSuppliers(storeId);
      loadNeeds();
    }
  }, [storeId]);

  const parsePackSize = (pkg?: string | number) => {
    if (!pkg) return 1;
    const match = String(pkg).match(/(\d+)/);
    return match ? parseInt(match[1]) : 1;
  };

  const isGroupingUnit = (unit?: string) => {
    const u = (unit || '').toLowerCase();
    return ['carton', 'box', 'pack', 'paquet', 'sac'].includes(u);
  };

  const handleProductSelected = (product: Product) => {
    const existing = needs.find(n => n.product_id === product.id);
    if (existing) {
        toast.info(t('common.alreadyAdded'));
    } else {
        const packSize = parsePackSize(product.packaging);
        const newNeed: ReplenishmentNeed = {
            product_id: product.id,
            product_name: product.name,
            sku: product.sku || '',
            current_stock: product.quantity || 0,
            min_stock: product.min_quantity || 10,
            source: 'worker_request',
            suggested_qty: 1,
            selected: true,
            order_qty: 1,
            unit_cost: product.cost_price || product.unit_price || 0,
            packSize: packSize,
            isBox: false,
            unit_type: product.unit_type || 'Piece',
            packaging: product.packaging || '1'
        };
        setNeeds(prev => [newNeed, ...prev]);
        toast.success(t('common.added'));
    }
    setIsLookupOpen(false);
  };

  const loadNeeds = async () => {
    setLoading(true);
    try {
      const { localBridgeBaseUrl, isLocalFirst } = getDataClient();
      const headers = await OfflineAuthService.getAuthHeaders();
      
      let data = [];
      if (isLocalFirst && headers) {
        const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/purchasing/needs?store_id=${storeId}`, { headers });
        if (res.ok) {
           try {
             data = await res.json();
           } catch(e) {
             console.error('[loadNeeds] JSON parse error:', e);
             data = [];
           }
        } else {
           console.error('[loadNeeds] Fetch returned:', res.status, res.statusText);
        }
      } else {
        // Master view fallback or online mode
        const { supabase } = getDataClient();
        const { data: remoteData, error } = await (supabase as any).from('products')
            .select('*')
            .eq('store_id', storeId)
            .lt('quantity', 10); // Simple logic for needs if endpoint unavailable
            
        if (error) {
           console.error('[loadNeeds] Supabase fetch error:', error);
           throw error;
        }
            
        data = (remoteData || []).map((p: any) => ({
            product_id: p.id,
            product_name: p.name,
            sku: p.sku,
            current_stock: p.quantity,
            min_stock: p.min_quantity,
            suggested_qty: Math.max(0, (p.reorder_quantity || 20) - p.quantity),
            source: 'low_stock',
            unit_type: p.unit_type,
            packaging: p.packaging
        }));
      }

      const needsData = data.map((item: any) => {
        const packSize = parsePackSize(item.packaging);
        const isBox = isGroupingUnit(item.unit_type);
        
        let qty = item.suggested_qty;
        let cost = item.cost_price || item.cost || item.unit_price || item.price || 0;

        if (isBox && packSize > 1) {
            qty = qty / packSize;
        }

        return {
          ...item,
          selected: true,
          order_qty: qty,
          unit_cost: cost,
          packSize: packSize,
          isBox: isBox
        };
      });
      setNeeds(needsData);
    } catch (err: any) {
      console.error('[loadNeeds] Critical error:', err);
      toast.error(`${t('common.error')}: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderUnit = (productId: string) => {
    setOrderItems(items => items.map(item => {
      if (item.product_id !== productId) return item;
      if (!item.packSize || item.packSize <= 1) return item;

      const newIsBox = !item.isBox;
      let newQty = item.order_qty || 0;
      let newCost = item.unit_cost || 0;

      const formatValue = (num: number) => Number(Number(num).toFixed(4));

      if (newIsBox) {
        newQty = formatValue(newQty / item.packSize);
        newCost = formatValue(newCost * item.packSize);
      } else {
        newQty = formatValue(newQty * item.packSize);
        newCost = formatValue(newCost / item.packSize);
      }
      
      return { ...item, isBox: newIsBox, order_qty: newQty, unit_cost: newCost };
    }));
  };

  const handleExecuteOrder = async () => {
    if (!selectedSupplierId) {
      toast.error(t('menu.program.assignSuppliersPrompt'));
      return;
    }

    setLoading(true);
    try {
      const totalAmount = orderItems.reduce((sum, item) => {
        const lineTotal = (item.order_qty || 0) * (item.unit_cost || 0);
        return sum + lineTotal;
      }, 0);

      await createOrder({
        store_id: storeId,
        supplier_id: selectedSupplierId,
        status: 'ordered',
        total_amount: totalAmount
      }, orderItems.map(i => {
        const qtyInPieces = (i.order_qty || 0) * (i.isBox ? (i.packSize || 1) : 1);
        return {
          product_id: i.product_id,
          quantity_ordered: qtyInPieces,
          quantity_received: 0,
          unit_cost: i.unit_cost || 0
        };
      }));

      toast.success(t('menu.purchases.ordersCreated'));
      setIsDialogOpen(false);
      loadNeeds(); 
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center bg-card p-3 rounded-xl border-2 shadow-lg">
        <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
          <Zap className="h-6 w-6 text-yellow-500" />
          {t('menu.purchases.needsAlerts')}
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setIsLookupOpen(true)} disabled={loading} className="font-black uppercase tracking-widest text-[10px] border-2">
            <Search className="h-4 w-4 mr-2" />
            {t('common.search')}
          </Button>
          <Button variant="outline" onClick={loadNeeds} disabled={loading} className="font-black uppercase tracking-widest text-[10px] border-2">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
          <Button onClick={() => {
            const selected = needs.filter(n => n.selected);
            if (selected.length === 0) return toast.error(t('menu.purchases.selectItemsPrompt'));
            setOrderItems(selected.map(item => ({ ...item })));
            setIsDialogOpen(true);
          }} disabled={loading} className="font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
            <ShoppingCart className="h-4 w-4 mr-2" />
            {t('menu.program.generateOrders')}
          </Button>
        </div>
      </div>

      <Card className="border-2 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-card border-b-2">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox 
                      checked={needs.length > 0 && needs.every(n => n.selected)}
                      onCheckedChange={(c) => setNeeds(needs.map(n => ({ ...n, selected: !!c })))}
                  />
                </TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[9px]">{t('menu.stock.trigger')}</TableHead>                <TableHead className="text-center font-black uppercase tracking-widest text-[9px]">{t('menu.program.currentStock')}</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[9px]">{t('menu.purchases.source')}</TableHead>
                <TableHead className="w-24 font-black uppercase tracking-widest text-[9px]">{t('menu.purchases.suggestedQtyShort')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {needs.map(item => (
                <TableRow key={item.product_id} className="border-b">
                  <TableCell>
                    <Checkbox checked={item.selected} onCheckedChange={(c) => setNeeds(needs.map(n => n.product_id === item.product_id ? { ...n, selected: !!c } : n))} />
                  </TableCell>
                  <TableCell>
                    <div className="font-black uppercase text-primary tracking-tighter">{item.product_name}</div>
                    <div className="text-[10px] font-mono opacity-50">{item.sku}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className={cn("font-black font-mono", item.current_stock <= item.min_stock ? "text-danger" : "")}>{item.current_stock}</div>
                    <div className="text-[9px] font-black uppercase tracking-widest opacity-40">MIN: {item.min_stock}</div>
                  </TableCell>
                  <TableCell>
                    {item.source === 'low_stock' ? (
                      <Badge className="bg-danger text-white border-none font-black text-[8px] tracking-widest">STOCK FAIBLE</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 font-black text-[8px] tracking-widest uppercase"><User className="h-3 w-3"/> {item.requester_name}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={item.order_qty} onChange={(e) => setNeeds(needs.map(n => n.product_id === item.product_id ? { ...n, order_qty: parseInt(e.target.value) || 0 } : n))} className="h-9 w-24 font-black border-2" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl border-4 border-primary/20">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter text-2xl">{t('menu.program.generateOrders')}</DialogTitle>
            <DialogDescription className="font-bold uppercase tracking-widest text-[10px] opacity-60">{t('menu.purchases.selectSupplierAndConfirm')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary">{t('menu.program.supplier')}</label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger className="h-12 border-2 border-primary/20">
                  <SelectValue placeholder={suppliers.length > 0 ? t('menu.purchases.selectSupplier') : t('common.loading')} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.length > 0 ? (
                    suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                  ) : (
                    <SelectItem value="none" disabled>{t('common.noData')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="border-2 rounded-xl max-h-[400px] overflow-auto shadow-inner bg-muted/5">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 shadow-md border-b-2">
                  <TableRow>
                    <TableHead className="font-black uppercase tracking-widest text-[9px]">{t('inventory.table.name')}</TableHead>
                    <TableHead className="w-20 text-center font-black uppercase tracking-widest text-[9px]">{t('inventory.fields.packaging')}</TableHead>
                    <TableHead className="w-24 text-center font-black uppercase tracking-widest text-[9px]">{t('menu.program.unit')}</TableHead>
                    <TableHead className="w-24 font-black uppercase tracking-widest text-[9px]">{t('inventory.table.quantity')}</TableHead>
                    <TableHead className="w-32 font-black uppercase tracking-widest text-[9px]">{t('inventory.price')}</TableHead>
                    <TableHead className="w-32 text-right font-black uppercase tracking-widest text-[9px]">TOTAL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderItems.map(item => (
                    <TableRow key={item.product_id} className="border-b">
                      <TableCell className="font-black uppercase text-sm tracking-tighter">{item.product_name}</TableCell>
                      <TableCell className="text-center font-mono text-[10px] font-black opacity-50">{item.packaging || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!item.packSize || item.packSize <= 1}
                            className={cn("h-7 px-3 font-black text-[9px] tracking-widest border-2", item.isBox && "bg-primary text-white border-primary shadow-lg shadow-primary/20", (!item.packSize || item.packSize <= 1) && "opacity-50 cursor-not-allowed")}
                            onClick={() => toggleOrderUnit(item.product_id)}
                        >
                          {item.isBox ? item.unit_type?.toUpperCase() || 'UNIT' : t('inventory.unitPiece')}
                        </Button>
                      </TableCell>                      <TableCell>
                        <Input type="number" value={item.order_qty} onChange={(e) => setOrderItems(orderItems.map(oi => oi.product_id === item.product_id ? { ...oi, order_qty: parseInt(e.target.value) || 0 } : oi))} className="h-9 font-black border-2" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.unit_cost} onChange={(e) => setOrderItems(orderItems.map(oi => oi.product_id === item.product_id ? { ...oi, unit_cost: parseFloat(e.target.value) || 0 } : oi))} className="h-9 font-mono text-xs border-2 bg-muted/20" />
                      </TableCell>
                      <TableCell className="text-right font-black text-primary text-sm">
                        {formatCurrency((item.order_qty || 0) * (item.unit_cost || 0) * (item.isBox ? (item.packSize || 1) : 1))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-end text-3xl font-black text-primary tracking-tighter">
              TOTAL: {formatCurrency(orderItems.reduce((sum, item) => sum + ((item.order_qty || 0) * (item.unit_cost || 0) * (item.isBox ? (item.packSize || 1) : 1)), 0))}
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="font-black uppercase tracking-widest text-[10px] h-12 px-8 border-2">{t('common.cancel')}</Button>
            <Button onClick={handleExecuteOrder} disabled={!selectedSupplierId || loading} className="px-12 font-black uppercase tracking-widest text-[10px] h-12 shadow-xl shadow-primary/30">
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t('menu.program.order')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ProductLookupDialog 
        open={isLookupOpen} 
        onOpenChange={setIsLookupOpen} 
        storeId={storeId} 
        title="Recherche d'Articles (Global)"
        standalone
        mode="wholesale" 
        onSelect={handleProductSelected} 
      />
    </div>
  );
}
