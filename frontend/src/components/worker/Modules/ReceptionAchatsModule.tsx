import React, { useState, useEffect } from 'react';
import { usePurchasingStore, PurchaseItem, Supplier } from '@/stores/usePurchasingStore';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { LocalDatabase } from '@/services/LocalDatabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Package, Check, Search, RefreshCw, Trash2 } from 'lucide-react';
import { ProductLookupDialog } from '../Sales/ProductLookupDialog';
import { Product } from '@/types';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface ReceptionAchatsModuleProps {
  storeId: string;
}

interface ReceiptItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  unit_type?: string;
  isBox?: boolean;
  packSize?: number;
}

export function ReceptionAchatsModule({ storeId }: ReceptionAchatsModuleProps) {
  const { t, i18n } = useTranslation();
  const { storeSuppliers, storeOrders, orderItems, loadingItems, fetchSuppliers, fetchOrders, fetchOrderItems, receiveOrder, deleteOrder, createOrder } = usePurchasingStore();
  const suppliers = storeSuppliers[storeId] || [];
  const orders = storeOrders[storeId] || [];
  
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [isAdHoc, setIsAdHoc] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [isProductLookupOpen, setIsProductLookupOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { formatCurrency } = useFormatters();

  const handleDeleteOrder = async () => {
    if (!selectedOrderId) return;
    if (!confirm(t('inventory.deleteConfirm') || "Supprimer cette commande ?")) return;
    
    try {
      setLoading(true);
      await deleteOrder(selectedOrderId);
      setSelectedOrderId('');
      setReceiptItems([]);
      toast.success(t('common.success'));
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const isGroupingUnit = (unit?: string) => {
    const u = (unit || '').toLowerCase();
    return ['carton', 'box', 'pack', 'paquet', 'sac'].includes(u);
  };

  useEffect(() => {
    if (storeId) {
      fetchSuppliers(storeId);
      fetchOrders(storeId, 'ordered');
    }
  }, [storeId]);

  useEffect(() => {
    if (selectedOrderId && !isAdHoc) {
      fetchOrderItems(selectedOrderId);
    }
  }, [selectedOrderId, isAdHoc]);

  useEffect(() => {
    if (!isAdHoc && orderItems.length > 0 && selectedOrderId) {
      // Only set items if they belong to the selected order
      const items = orderItems.map(item => {
        const pkgStr = item.product?.packaging || '1';
        const match = pkgStr.match(/(\d+)/);
        const packSize = match ? parseInt(match[1], 10) : 1;
        const isBox = isGroupingUnit(item.product?.unit_type) && packSize > 1;

        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.product?.name || '',
          quantity_ordered: isBox ? (item.quantity_ordered / packSize) : item.quantity_ordered,
          quantity_received: isBox ? (item.quantity_ordered / packSize) : item.quantity_ordered,
          unit_cost: item.unit_cost, 
          unit_type: item.product?.unit_type,
          isBox,
          packSize
        };
      });
      setReceiptItems(items);
    } else if (!selectedOrderId && !isAdHoc) {
      setReceiptItems([]);
    }
  }, [orderItems, selectedOrderId, isAdHoc]);

  const handleQuantityChange = (id: string, value: number) => {
    setReceiptItems(items => items.map(item => item.id === id ? { ...item, quantity_received: value } : item));
  };

  const handleCostChange = (id: string, value: number) => {
    setReceiptItems(items => items.map(item => item.id === id ? { ...item, unit_cost: value } : item));
  };

  const handleToggleUnit = (id: string) => {
    setReceiptItems(items => items.map(item => {
        if (item.id !== id) return item;
        if (!item.packSize || item.packSize <= 1) {
          toast.warning(t('inventory.packaging') + ': 1');
          return item;
        }
        
        const newIsBox = !item.isBox;
        let newQtyOrdered = item.quantity_ordered;
        let newQtyReceived = item.quantity_received;
        
        if (newIsBox) {
          newQtyOrdered = newQtyOrdered / item.packSize;
          newQtyReceived = newQtyReceived / item.packSize;
        } else {
          newQtyOrdered = newQtyOrdered * item.packSize;
          newQtyReceived = newQtyReceived * item.packSize;
        }

        return { ...item, isBox: newIsBox, quantity_ordered: newQtyOrdered, quantity_received: newQtyReceived };
      })
    );
  };

  const addAdHocItem = (product: Product) => {
    const existingItem = receiptItems.find(i => i.product_id === product.id);
    if (existingItem) return toast.error(t('worker.sales.itemAlreadyAdded'));

    const packSize = parseInt(product.packaging?.match(/(\d+)/)?.[1] || '1', 10);
    const isBox = isGroupingUnit(product.unit_type) || packSize > 1;

    setReceiptItems([...receiptItems, {
      id: crypto.randomUUID(),
      product_id: product.id,
      product_name: product.name,
      quantity_ordered: 0,
      quantity_received: 1,
      unit_cost: product.cost_price || 0,
      unit_type: product.unit_type,
      isBox,
      packSize
    }]);
  };

  const validateReceipt = async () => {
    if (receiptItems.length === 0) return toast.error(t('worker.sales.addAtLeastOne'));
    setLoading(true);
    try {
      const normalizedItems = receiptItems.map(item => ({
        id: item.id,
        product_id: item.product_id,
        quantity_received: item.isBox ? (item.quantity_received * (item.packSize || 1)) : item.quantity_received,
        unit_cost: item.unit_cost
      }));

      if (!isAdHoc) {
        await receiveOrder(selectedOrderId, normalizedItems.map(item => ({
          id: item.id,
          quantity_received: item.quantity_received,
          unit_cost: item.unit_cost,
        })));
      } else {
        if (!selectedSupplierId) return toast.error(t('invitations.form.selectStore')); 
        
        const totalAmount = receiptItems.reduce((sum, item) => {
            const ps = item.packSize || 1;
            return sum + (item.quantity_received * (item.isBox ? (item.unit_cost * ps) : item.unit_cost));
        }, 0);

        // Record as a direct received order
        const orderId = crypto.randomUUID();
        await createOrder({
            id: orderId,
            store_id: storeId,
            supplier_id: selectedSupplierId,
            status: 'received',
            total_amount: totalAmount,
            notes: "Achat Direct"
        }, normalizedItems.map(i => ({
            product_id: i.product_id,
            quantity_ordered: i.quantity_received,
            quantity_received: i.quantity_received,
            unit_cost: i.unit_cost
        })));
      }

      toast.success(t('common.success'));
      setReceiptItems([]);
      setSelectedOrderId('');
      setIsAdHoc(false);
      // Fetch 'all' to ensure history is updated and 'ordered' dropdown is cleaned
      fetchOrders(storeId, 'all');
      fetchSuppliers(storeId);
      
      // CRITICAL FIX: Trigger global inventory refresh
      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
    } catch (error) {
      console.error(error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const totalAmountCalculated = receiptItems.reduce((sum, item) => {
    const packSize = item.packSize || 1;
    const lineTotal = item.quantity_received * (item.isBox ? (item.unit_cost * packSize) : item.unit_cost);
    return sum + lineTotal;
  }, 0);

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('menu.program.receptionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-black uppercase tracking-widest mb-1 block">{t('menu.program.mode')}</label>
              <Select value={isAdHoc ? 'adhoc' : 'order'} onValueChange={(v) => { 
                const adhoc = v === 'adhoc';
                setIsAdHoc(adhoc); 
                setReceiptItems([]); 
                setSelectedOrderId(''); 
                if (adhoc && suppliers.length === 0) fetchSuppliers(storeId);
              }}>
                <SelectTrigger className="h-10 border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">{t('menu.program.existingOrder')}</SelectItem>
                  <SelectItem value="adhoc">{t('menu.program.directPurchase')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isAdHoc ? (
              <div className="flex-1">
                <label className="text-xs font-black uppercase tracking-widest mb-1 block">{t('menu.program.supplier')}</label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="h-10 border-2">
                    <SelectValue placeholder={suppliers.length > 0 ? t('common.filter') : t('common.loading')} />
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
            ) : (
              <div className="flex-1 flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs font-black uppercase tracking-widest mb-1 block">{t('menu.program.order')}</label>
                  <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                    <SelectTrigger className="h-10 border-2">
                      <SelectValue placeholder={t('common.filter')} />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.filter(o => o.status === 'ordered').map(o => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.supplier?.name} - {new Date(o.created_at).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1">
                  <Button variant="secondary" size="icon" onClick={() => fetchOrders(storeId, 'ordered')} className="h-10 w-10"><RefreshCw className="h-4 w-4" /></Button>
                  {selectedOrderId && (
                    <Button variant="destructive" size="icon" onClick={handleDeleteOrder} className="h-10 w-10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {isAdHoc && selectedSupplierId && (
            <Button variant="outline" className="w-full justify-start text-muted-foreground border-2 border-dashed h-12" onClick={() => setIsProductLookupOpen(true)}>
              <Search className="h-4 w-4 mr-2" />
              {t('menu.program.searchProductToAdd')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden border-2 shadow-xl">
        <CardContent className="p-0 h-full">
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10 shadow-sm border-b-2">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">{t('inventory.table.name')}</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest w-24 text-center">{t('menu.program.ordered')}</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest w-28 text-center">{t('menu.program.received')}</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest w-32 text-right">{t('menu.program.unitCost')} ({t('inventory.unitPiece')})</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest w-28 text-right">{t('common.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiptItems.map(item => {
                  const isDiscrepancy = !isAdHoc && item.quantity_received !== item.quantity_ordered;
                  const packSize = item.packSize || 1;
                  const displayCost = item.isBox ? (item.unit_cost * packSize) : item.unit_cost;
                  
                  return (
                    <TableRow key={item.id} className={cn("h-12 border-b", isDiscrepancy && "bg-warning/10")}>
                      <TableCell className="font-bold">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={cn("h-7 px-2 font-black text-[10px]", item.isBox && "bg-primary text-white border-primary")}
                            onClick={() => handleToggleUnit(item.id)}
                          >
                            {item.isBox ? item.unit_type?.toUpperCase() || 'BOX' : t('inventory.unitPiece')}
                          </Button>
                          <div className="flex flex-col">
                            <span>{item.product_name}</span>
                            {isDiscrepancy && (
                              <span className="text-[9px] text-warning font-black uppercase tracking-tighter">
                                DIFF: {(item.quantity_received - item.quantity_ordered).toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">{item.quantity_ordered}</TableCell>
                      <TableCell className="p-1">
                        <Input type="number" value={item.quantity_received} onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))} className="h-9 text-center font-bold" />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input type="number" value={displayCost} onChange={(e) => handleCostChange(item.id, item.isBox ? Number(e.target.value) / packSize : Number(e.target.value))} className="h-9 text-right font-mono text-xs" />
                      </TableCell>
                      <TableCell className="text-right font-black text-primary">
                        {formatCurrency(item.quantity_received * (item.isBox ? (item.unit_cost * packSize) : item.unit_cost))}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {loadingItems ? (
                    <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground uppercase font-mono tracking-widest opacity-50">
                            {t('common.loading')}
                        </TableCell>
                    </TableRow>
                ) : receiptItems.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground uppercase font-mono tracking-widest opacity-50">
                            {selectedOrderId || isAdHoc ? t('common.noData') : t('menu.purchases.selectOrderPrompt')}
                        </TableCell>
                    </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between bg-card border-2 rounded-xl p-4 shadow-lg">
        <div className="text-2xl font-black text-primary">
          {t('common.total')}: {formatCurrency(totalAmountCalculated)}
        </div>
        <Button onClick={validateReceipt} disabled={loading || receiptItems.length === 0} className="px-10 font-black uppercase tracking-widest text-xs h-12 shadow-lg shadow-primary/20">
          <Check className="h-4 w-4 mr-2" />
          {t('menu.program.validateReceipt')}
        </Button>
      </div>

      <ProductLookupDialog 
        open={isProductLookupOpen} 
        onOpenChange={setIsProductLookupOpen} 
        storeId={storeId} 
        title="Recherche d'Articles (Global)"
        standalone
        mode="wholesale" 
        onSelect={addAdHocItem} 
      />
    </div>
  );
}
