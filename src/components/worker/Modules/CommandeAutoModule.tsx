import { useState, useEffect } from 'react';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Zap, ShoppingCart, AlertTriangle, Calendar, Plus, Trash2, Clock, Search } from 'lucide-react';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

interface CommandeAutoModuleProps {
  storeId: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  min_quantity: number;
  cost_price: number | null;
  supplier_id?: string;
  suggested_qty: number;
  selected: boolean;
}

interface ScheduledOrder {
  id: string;
  name: string;
  recurrence_type: 'daily' | 'weekly' | 'monthly';
  recurrence_value: string;
  next_run_date: string;
  is_active: boolean;
  items?: { product_id: string; quantity: number }[];
}

export function CommandeAutoModule({ storeId }: CommandeAutoModuleProps) {
  const { t } = useTranslation();
  const { suppliers, fetchSuppliers, createOrder } = usePurchasingStore();
  const [products, setProducts] = useState<LowStockProduct[]>([]);
  const [scheduledOrders, setScheduledOrders] = useState<ScheduledOrder[]>([]);
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

  // Schedule Dialog State
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    recurrence_type: 'weekly' as 'weekly' | 'monthly' | 'daily',
    recurrence_value: '1', // Monday
    products: [] as string[],
    quantities: {} as Record<string, number>
  });

  const useLocalBridge = true;

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
          ...headers,
          ...(init.headers || {}),
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
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
      fetchLowStockProducts();
      fetchFamilies();
      fetchScheduledOrders();
    }
  }, [storeId, useLocalBridge]);

  const fetchFamilies = async () => {
    const { data } = await OfflineInventoryService.getProductFamilies(storeId);
    if (data) {
      setCategories(data.map(f => ({ id: f.id, name: f.name })));
    }
  };

  const fetchScheduledOrders = async () => {
    if (!useLocalBridge) return;
    try {
      const data = await localBridgeRequest<ScheduledOrder[]>(
        `/rest/v1/scheduled_orders?store_id=${storeId}`
      );
      setScheduledOrders(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLowStockProducts = async () => {
    setLoading(true);
    try {
      if (useLocalBridge) {
        const data = await localBridgeRequest<any[]>(
          `/rest/v1/products?${new URLSearchParams({ store_id: storeId }).toString()}`
        );
        const lowStock = (data || [])
          //.filter(p => (p.quantity || 0) <= (p.min_quantity || 0)) // Show all for scheduling selection? No, Keep Low Stock logic here.
          .map(p => ({
            id: p.id,
            name: p.name,
            category: (p as any).category ?? null,
            quantity: p.quantity || 0,
            min_quantity: p.min_quantity || 0,
            cost_price: (p as any).cost_price ?? null,
            suggested_qty: Math.max(10, (p.min_quantity || 10) * 2 - (p.quantity || 0)),
            selected: true,
          }));
        setProducts(lowStock);
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const createSchedule = async () => {
    if (!newSchedule.name || newSchedule.products.length === 0) {
      toast.error(t('menu.program.fillNameAndSelectProducts'));
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        store_id: storeId,
        name: newSchedule.name,
        recurrence_type: newSchedule.recurrence_type,
        recurrence_value: newSchedule.recurrence_value,
        is_active: true,
        products: newSchedule.products.map(pid => ({
          product_id: pid,
          quantity: newSchedule.quantities[pid] || 10
        }))
      };

      await localBridgeRequest('/rest/v1/scheduled_orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      toast.success(t('common.success'));
      setIsScheduleOpen(false);
      fetchScheduledOrders();
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm(t('common.confirm'))) return;
    try {
      await localBridgeRequest(`/rest/v1/scheduled_orders/${id}`, { method: 'DELETE',  });
      fetchScheduledOrders();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const toggleProduct = (productId: string) => {
    setProducts(products.map(p => 
      p.id === productId ? { ...p, selected: !p.selected } : p
    ));
  };

  const toggleAll = (checked: boolean) => {
    setProducts(products.map(p => ({ ...p, selected: checked })));
  };

  const updateQuantity = (productId: string, qty: number) => {
    setProducts(products.map(p => 
      p.id === productId ? { ...p, suggested_qty: qty } : p
    ));
  };

  const assignSupplier = (productId: string, supplierId: string) => {
    setProducts(products.map(p => 
      p.id === productId ? { ...p, supplier_id: supplierId } : p
    ));
  };

  const filteredProducts = products.filter(p => {
    if (filterSupplier !== 'all' && p.supplier_id !== filterSupplier) return false;
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    return true;
  });
  
  const lowStockOnly = filteredProducts.filter(p => p.quantity <= p.min_quantity); // For the Alert tab

  const selectedProducts = lowStockOnly.filter(p => p.selected && p.supplier_id);

  const generateOrders = async () => {
    if (selectedProducts.length === 0) {
      toast.error(t('menu.program.assignSuppliersPrompt'));
      return;
    }

    setLoading(true);
    try {
      const bySupplier = selectedProducts.reduce((acc, p) => {
        if (!p.supplier_id) return acc;
        if (!acc[p.supplier_id]) acc[p.supplier_id] = [];
        acc[p.supplier_id].push(p);
        return acc;
      }, {} as Record<string, LowStockProduct[]>);

      let ordersCreated = 0;
      for (const [supplierId, items] of Object.entries(bySupplier)) {
        const totalAmount = items.reduce((sum, p) => sum + (p.suggested_qty * (p.cost_price || 0)), 0);
        
        const order = await createOrder(
          {
            store_id: storeId,
            supplier_id: supplierId,
            status: 'draft',
            total_amount: totalAmount
          },
          items.map(p => ({
            order_id: '',
            product_id: p.id,
            quantity_ordered: p.suggested_qty,
            quantity_received: 0,
            unit_cost: p.cost_price || 0
          }))
        );
        
        if (order) ordersCreated++;
      }

      toast.success(t('common.success'));
      fetchLowStockProducts();
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const allSelected = lowStockOnly.length > 0 && lowStockOnly.every(p => p.selected);

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <Tabs defaultValue="alerts" className="h-full flex flex-col">
        <TabsList>
          <TabsTrigger value="alerts" className="gap-2"><AlertTriangle className="h-4 w-4"/> {t('menu.purchases.needsAlerts')}</TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2"><Calendar className="h-4 w-4"/> Scheduled Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="flex-1 flex flex-col gap-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                {t('menu.program.autoOrderTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1 block">{t('menu.program.filterBySupplier')}</label>
                  <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('inventory.allStores')}</SelectItem>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1 block">{t('menu.program.filterByCategory')}</label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')}</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={fetchLowStockProducts} variant="outline" size="sm" disabled={loading}>
                    {t('common.refresh')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-0 h-full">
              <div className="h-full overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox 
                          checked={allSelected}
                          onCheckedChange={(checked) => toggleAll(!!checked)}
                        />
                      </TableHead>
                      <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                      <TableHead className="text-xs w-20 text-center">{t('inventory.quantity')}</TableHead>
                      <TableHead className="text-xs w-20 text-center">Min</TableHead>
                      <TableHead className="text-xs w-28">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          {t('menu.program.deficit')}
                        </span>
                      </TableHead>
                      <TableHead className="text-xs w-28">{t('menu.program.suggestedQty')}</TableHead>
                      <TableHead className="text-xs w-40">{t('menu.program.supplier')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockOnly.map(product => {
                      const categoryName = categories.find(c => c.id === product.category || c.name === product.category)?.name || product.category;
                      return (
                      <TableRow key={product.id} className="h-10">
                        <TableCell className="p-2">
                          <Checkbox 
                            checked={product.selected}
                            onCheckedChange={() => toggleProduct(product.id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {product.name}
                          {categoryName && (
                            <span className="text-xs text-muted-foreground ml-2">({categoryName})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-medium ${product.quantity <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                            {product.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm">{product.min_quantity}</TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-red-600">
                            -{Math.max(0, product.min_quantity - product.quantity)}
                          </span>
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            min={1}
                            value={product.suggested_qty}
                            onChange={(e) => updateQuantity(product.id, parseInt(e.target.value) || 1)}
                            className="h-8 text-center"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Select 
                            value={product.supplier_id || ''} 
                            onValueChange={(v) => assignSupplier(product.id, v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder={t('common.search')} />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                    {lowStockOnly.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {loading ? t('common.loading') : t('inventory.noItemsFound')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">
              {selectedProducts.length} {t('common.itemsSelected')}
            </div>
            <Button 
              onClick={generateOrders} 
              disabled={loading || selectedProducts.length === 0}
              className="gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              {t('menu.program.generateOrders')}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="flex-1 flex flex-col gap-4">
          <div className="flex justify-end">
            <Button onClick={() => setIsScheduleOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Schedule
            </Button>
          </div>

          <Card className="flex-1">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                  <TableRow>
                    <TableHead>{t('menu.program.scheduleName')}</TableHead>
                    <TableHead>{t('menu.program.recurrence')}</TableHead>
                    <TableHead>{t('menu.program.nextRun')}</TableHead>
                    <TableHead>{t('purchases.status')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledOrders.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {order.recurrence_type}
                        </Badge>
                        <span className="ml-2 text-sm text-muted-foreground">
                          (Val: {order.recurrence_value})
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {new Date(order.next_run_date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.is_active ? 'default' : 'secondary'}>
                          {order.is_active ? t('menu.program.statusActive') : t('menu.program.statusPaused')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => deleteSchedule(order.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {scheduledOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No scheduled orders found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('menu.program.createScheduledOrder')}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('menu.program.scheduleName')}</label>
                <Input 
                  value={newSchedule.name} 
                  onChange={e => setNewSchedule({...newSchedule, name: e.target.value})}
                  placeholder="e.g. Weekly Milk" 
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('menu.program.recurrence')}</label>
                <div className="flex gap-2">
                  <Select 
                    value={newSchedule.recurrence_type} 
                    onValueChange={(v: any) => setNewSchedule({...newSchedule, recurrence_type: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('menu.program.recurrenceDaily')}</SelectItem>
                      <SelectItem value="weekly">{t('menu.program.recurrenceWeekly')}</SelectItem>
                      <SelectItem value="monthly">{t('menu.program.recurrenceMonthly')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    value={newSchedule.recurrence_value} 
                    onChange={e => setNewSchedule({...newSchedule, recurrence_value: e.target.value})}
                    placeholder={t('menu.program.scheduleDayPlaceholder')}
                    className="w-20"
                  />
                </div>
              </div>
            </div>

            <div className="border rounded-md max-h-[300px] overflow-auto p-2">
              <label className="text-sm font-medium mb-2 block">{t('menu.program.selectProducts')}</label>
              <div className="relative mb-4">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={t('common.search')} 
                  onChange={(e) => {
                    const term = e.target.value.toLowerCase();
                    // Basic local search filtering
                    setProducts(prev => prev.map(p => ({
                      ...p,
                      hidden: term && !p.name.toLowerCase().includes(term)
                    })));
                  }}
                  className="pl-8" 
                />
              </div>
              {products.filter(p => !(p as any).hidden).map(p => (
                <div key={p.id} className="flex items-center gap-2 py-1 border-b last:border-0 hover:bg-muted/30 px-2">
                  <Checkbox 
                    checked={newSchedule.products.includes(p.id)}
                    onCheckedChange={(c) => {
                      if (c) {
                        setNewSchedule({
                          ...newSchedule, 
                          products: [...newSchedule.products, p.id],
                          quantities: { ...newSchedule.quantities, [p.id]: 10 }
                        });
                      } else {
                        setNewSchedule({
                          ...newSchedule, 
                          products: newSchedule.products.filter(id => id !== p.id)
                        });
                      }
                    }}
                  />
                  <div className="flex-1 text-sm">{p.name} <span className="text-[10px] text-muted-foreground">(Stock: {p.quantity})</span></div>
                  {newSchedule.products.includes(p.id) && (
                    <NumericInput 
                      value={newSchedule.quantities[p.id]} 
                      onValueChange={v => setNewSchedule({
                        ...newSchedule, 
                        quantities: { ...newSchedule.quantities, [p.id]: v }
                      })}
                      integer
                      className="h-7 w-20 text-center"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={createSchedule}>{t('menu.program.createScheduleBtn')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}