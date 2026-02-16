import { useState, useEffect } from 'react';
import { usePurchasingStore, PurchaseItem } from '@/stores/usePurchasingStore';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { OfflineDataService } from '@/services/OfflineDataService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Package, Check, Search } from 'lucide-react';
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
}

export function ReceptionAchatsModule({ storeId }: ReceptionAchatsModuleProps) {
  const { t, i18n } = useTranslation();
  const { suppliers, orders, orderItems, fetchSuppliers, fetchOrders, fetchOrderItems } = usePurchasingStore();
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [isAdHoc, setIsAdHoc] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [isProductLookupOpen, setIsProductLookupOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { supabase, isLocalFirst, localBridgeBaseUrl } = getDataClient();

  const useLocalBridge = isLocalFirst;

  const localBridgeRequest = async <T,>(path: string, init: RequestInit = {}) => {
    if (!useLocalBridge) {
      throw new Error('LocalBridge mode is not enabled.');
    }
    const headers = await OfflineAuthService.getAuthHeaders();
    if (!headers) {
      throw new Error('LocalBridge session expired. Please sign in again.');
    }
    const response = await fetch(`${localBridgeBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...headers,
      },
    });
    let payload: any = null;
    if (response.status !== 204) {
      try {
        payload = await response.json();
      } catch (error) {
        // ignore
      }
    }
    if (!response.ok) {
      const message = payload?.message || 'LocalBridge request failed';
      throw new Error(message);
    }
    return payload as T;
  };

  useEffect(() => {
    if (storeId) {
      fetchSuppliers(storeId);
      fetchOrders(storeId, 'ordered');
    }
  }, [storeId, useLocalBridge]);

  useEffect(() => {
    if (selectedOrderId && !isAdHoc) {
      fetchOrderItems(selectedOrderId);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    if (orderItems.length > 0 && !isAdHoc) {
      setReceiptItems(orderItems.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product?.name || '',
        quantity_ordered: item.quantity_ordered,
        quantity_received: item.quantity_ordered, // Default to ordered qty
        unit_cost: item.unit_cost
      })));
    }
  }, [orderItems]);

  const handleQuantityChange = (id: string, value: number) => {
    setReceiptItems(items => 
      items.map(item => item.id === id ? { ...item, quantity_received: value } : item)
    );
  };

  const handleCostChange = (id: string, value: number) => {
    setReceiptItems(items => 
      items.map(item => item.id === id ? { ...item, unit_cost: value } : item)
    );
  };

  const addAdHocItem = (product: Product) => {
    const existingItem = receiptItems.find(i => i.product_id === product.id);
    if (existingItem) {
      toast.error(t('worker.sales.itemAlreadyAdded'));
      return;
    }

    setReceiptItems([...receiptItems, {
      id: crypto.randomUUID(),
      product_id: product.id,
      product_name: product.name,
      quantity_ordered: 0,
      quantity_received: 1,
      unit_cost: product.cost_price || 0
    }]);
  };

  const validateReceipt = async () => {
    if (receiptItems.length === 0) {
      toast.error(t('worker.sales.addAtLeastOne'));
      return;
    }

    setLoading(true);
    try {
      if (useLocalBridge && !isAdHoc) {
        await localBridgeRequest(`/rest/v1/purchase_orders/${selectedOrderId}/receive`, {
          method: 'POST',
          body: JSON.stringify(
            receiptItems.map(item => ({
              id: item.id,
              quantity_received: item.quantity_received,
              unit_cost: item.unit_cost,
            }))
          ),
        });
      } else if (useLocalBridge && isAdHoc) {
        const totalAmount = receiptItems.reduce((sum, item) => sum + (item.quantity_received * item.unit_cost), 0);
        if (!selectedSupplierId) {
          toast.error(t('invitations.form.selectStore')); // Assuming similar key or add specific
          setLoading(false);
          return;
        }
        const orderData = await localBridgeRequest<any>(`/rest/v1/purchase_orders`, {
          method: 'POST',
          body: JSON.stringify({
            store_id: storeId,
            supplier_id: selectedSupplierId,
            status: 'received',
            total_amount: totalAmount,
          }),
        });

        if (orderData) {
          for (const item of receiptItems) {
            await localBridgeRequest(`/rest/v1/purchase_items`, {
              method: 'POST',
              body: JSON.stringify({
                order_id: orderData.id,
                product_id: item.product_id,
                quantity_ordered: item.quantity_received,
                quantity_received: item.quantity_received,
                unit_cost: item.unit_cost,
              }),
            });
          }

          const createdItems = await localBridgeRequest<PurchaseItem[]>(
            `/rest/v1/purchase_items?${new URLSearchParams({ order_id: orderData.id }).toString()}`
          );
          await localBridgeRequest(`/rest/v1/purchase_orders/${orderData.id}/receive`, {
            method: 'POST',
            body: JSON.stringify(
              (createdItems || []).map(item => ({
                id: item.id,
                quantity_received: item.quantity_received,
                unit_cost: item.unit_cost,
              }))
            ),
          });
        }
      } else if (isAdHoc) {
        const totalAmount = receiptItems.reduce((sum, item) => sum + (item.quantity_received * item.unit_cost), 0);
        
        const { data: orderData } = await (supabase as any)
          .from('purchase_orders')
          .insert({
            store_id: storeId,
            supplier_id: selectedSupplierId,
            status: 'received',
            total_amount: totalAmount
          })
          .select()
          .single();

        if (orderData) {
          await (supabase as any).from('purchase_items').insert(
            receiptItems.map(item => ({
              order_id: orderData.id,
              product_id: item.product_id,
              quantity_ordered: item.quantity_received,
              quantity_received: item.quantity_received,
              unit_cost: item.unit_cost
            }))
          );

          for (const item of receiptItems) {
            const { data: product } = await supabase
              .from('products')
              .select('quantity')
              .eq('id', item.product_id)
              .single();
            
            if (product) {
              const newQuantity = product.quantity + item.quantity_received;
              await OfflineDataService.updateProductStock(
                item.product_id, 
                newQuantity, 
                `Achat direct: ${orderData.id.slice(0, 8)}`
              );
              
              await supabase
                .from('products')
                .update({ cost_price: item.unit_cost })
                .eq('id', item.product_id);
            }
          }

          const { data: supplierData } = await (supabase as any)
            .from('suppliers')
            .select('balance')
            .eq('id', selectedSupplierId)
            .single();
          
          if (supplierData) {
            await (supabase as any)
              .from('suppliers')
              .update({ balance: (supplierData.balance || 0) + totalAmount })
              .eq('id', selectedSupplierId);
          }
        }
      } else {
        for (const item of receiptItems) {
          await (supabase as any)
            .from('purchase_items')
            .update({ quantity_received: item.quantity_received, unit_cost: item.unit_cost })
            .eq('id', item.id);

          const orderItem = orderItems.find(oi => oi.id === item.id);
          if (orderItem?.product) {
            const newQuantity = orderItem.product.quantity + item.quantity_received;
            await OfflineDataService.updateProductStock(
              item.product_id,
              newQuantity,
              `Réception commande: ${selectedOrderId.slice(0, 8)}`
            );

            await supabase
              .from('products')
              .update({ cost_price: item.unit_cost })
              .eq('id', item.product_id);
          }
        }

        const allReceived = receiptItems.every(item => item.quantity_received >= item.quantity_ordered);
        await (supabase as any)
          .from('purchase_orders')
          .update({ status: allReceived ? 'received' : 'partial' })
          .eq('id', selectedOrderId);
      }

      toast.success(t('common.success'));
      setReceiptItems([]);
      setSelectedOrderId('');
      setIsAdHoc(false);
      fetchOrders(storeId, 'ordered');
    } catch (error) {
      console.error(error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = receiptItems.reduce((sum, item) => sum + (item.quantity_received * item.unit_cost), 0);

  const handleReceiveAll = () => {
    setReceiptItems(items => 
      items.map(item => ({
        ...item,
        quantity_received: item.quantity_ordered
      }))
    );
    toast.success(t('menu.program.autoFillSuccess'));
  };

  const { formatCurrency } = useFormatters();

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
              <label className="text-xs font-medium mb-1 block">{t('menu.program.mode')}</label>
              <Select value={isAdHoc ? 'adhoc' : 'order'} onValueChange={(v) => {
                setIsAdHoc(v === 'adhoc');
                setReceiptItems([]);
                setSelectedOrderId('');
              }}>
                <SelectTrigger className="h-8">
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
                <label className="text-xs font-medium mb-1 block">{t('menu.program.supplier')}</label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={t('common.filter')} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex-1 flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1 block">{t('menu.program.order')}</label>
                  <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t('common.filter')} />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.filter(o => o.status === 'ordered').map(o => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.supplier?.name} - {new Date(o.created_at).toLocaleDateString(i18n.language === 'bm' ? 'fr-ML' : i18n.language)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="secondary" size="sm" onClick={handleReceiveAll} disabled={!selectedOrderId || receiptItems.length === 0}>
                  <Check className="h-3 w-3 mr-1" />
                  {t('menu.program.receiveAll')}
                </Button>
              </div>
            )}
          </div>

          {isAdHoc && selectedSupplierId && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="w-full justify-start text-muted-foreground"
                onClick={() => setIsProductLookupOpen(true)}
              >
                <Search className="h-4 w-4 mr-2" />
                {t('menu.program.searchProductToAdd')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full">
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                  <TableHead className="text-xs w-24 text-center">{t('menu.program.ordered')}</TableHead>
                  <TableHead className="text-xs w-28 text-center">{t('menu.program.received')}</TableHead>
                  <TableHead className="text-xs w-32 text-right">{t('menu.program.unitCost')}</TableHead>
                  <TableHead className="text-xs w-28 text-right">{t('common.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receiptItems.map(item => {
                  const isDiscrepancy = !isAdHoc && item.quantity_received !== item.quantity_ordered;
                  return (
                    <TableRow key={item.id} className={cn("h-10", isDiscrepancy && "bg-warning/10")}>
                      <TableCell className="text-sm font-medium">
                        {item.product_name}
                        {isDiscrepancy && (
                          <span className="ml-2 text-xs text-warning font-normal">({t('menu.program.discrepancy')}: {item.quantity_received - item.quantity_ordered})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{item.quantity_ordered}</TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min={0}
                          value={item.quantity_received}
                          onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                          className={cn("h-8 text-center", isDiscrepancy && "border-warning text-warning font-bold")}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unit_cost}
                          onChange={(e) => handleCostChange(item.id, parseFloat(e.target.value) || 0)}
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(item.quantity_received * item.unit_cost)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {receiptItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {isAdHoc ? t('menu.program.searchProductToAdd') : t('common.filter')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
        <div className="text-lg font-bold">
          {t('common.total')}: {formatCurrency(totalAmount)}
        </div>
        <Button 
          onClick={validateReceipt} 
          disabled={loading || receiptItems.length === 0}
          className="gap-2"
        >
          <Check className="h-4 w-4" />
          {t('menu.program.validateReceipt')}
        </Button>
      </div>

      <ProductLookupDialog
        open={isProductLookupOpen}
        onOpenChange={setIsProductLookupOpen}
        storeId={storeId}
        mode="wholesale" // Using wholesale price as proxy for cost/purchasing view
        onSelect={addAdHocItem}
      />
    </div>
  );
}