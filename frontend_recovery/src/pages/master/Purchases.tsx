import { useState, useEffect } from 'react';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { Store } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingBag, Search, Filter, RefreshCw, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { Skeleton } from '@/components/ui/skeleton';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReplenishmentNeeds } from '@/components/master/Purchases/ReplenishmentNeeds';
import { ReceptionAchatsModule } from '@/components/worker/Modules/ReceptionAchatsModule';
import { ReglementsFournisseursModule } from '@/components/worker/Modules/ReglementsFournisseursModule';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';

export default function PurchasesPage() {
  const { t } = useTranslation();
  const { formatDate, formatCurrency } = useFormatters();
  const { orders, orderItems, fetchOrders, fetchOrderItems, updateOrderStatus, loading } = usePurchasingStore();
  const { selectedStoreIds, isAllStoresSelected, version } = useMasterDashboardStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [activeTab, setActiveTab] = useState('needs');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  // ...
  useEffect(() => {
    const loadStores = async () => {
      const { data } = await OfflineStoreService.getStores();
      setStores(data || []);
    };
    loadStores();

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activeStoreIds = isAllStoresSelected 
    ? stores.map(s => s.id)
    : selectedStoreIds;

  useEffect(() => {
    if (stores.length > 0 && activeTab === 'orders') {
        // For history, we fetch all active stores or iterate
        activeStoreIds.forEach(sid => fetchOrders(sid));
    }
  }, [version, stores, activeTab]);

  const toggleOrder = (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      fetchOrderItems(orderId);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch = order.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          order.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received': return <Badge className="bg-green-500">{t('menu.program.received')}</Badge>;
      case 'ordered': return <Badge className="bg-blue-500">{t('menu.program.ordered')}</Badge>;
      case 'draft': return <Badge variant="secondary">{t('menu.program.draft')}</Badge>;
      case 'partial': return <Badge variant="outline" className="border-orange-500 text-orange-500">{t('menu.program.partial')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const currentStoreId = selectedStore === 'all' ? stores[0]?.id : selectedStore;

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
        {isOffline && (
            <div className="flex items-center gap-2 p-3 bg-amber-100 text-amber-800 rounded-lg">
            <WifiOff className="h-4 w-4" />
            <span className="text-sm">{t('common.offline')}</span>
            </div>
        )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('menu.purchases.trigger')} & {t('menu.stock.inventory')}</h1>
          <p className="text-muted-foreground">{t('purchases.subtitle')}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="needs">{t('purchases.needs')}</TabsTrigger>
          <TabsTrigger value="reception">{t('menu.program.receptionTitle')}</TabsTrigger>
          <TabsTrigger value="settlements">{t('menu.program.supplierSettlement')}</TabsTrigger>
          <TabsTrigger value="orders">{t('purchases.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="needs" className="space-y-4">
           {activeStoreIds.length > 0 ? (
             activeStoreIds.map(sid => (
               <div key={`needs-${sid}`} className="space-y-2">
                 <h2 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2 px-2">
                   <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                   {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                 </h2>
                 <ReplenishmentNeeds storeId={sid} />
               </div>
             ))
           ) : (
             <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
           )}
        </TabsContent>

        <TabsContent value="reception" className="space-y-4">
           {activeStoreIds.length > 0 ? (
             activeStoreIds.map(sid => (
               <div key={`reception-${sid}`} className="space-y-2">
                 <h2 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2 px-2">
                   <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                   {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                 </h2>
                 <ReceptionAchatsModule storeId={sid} />
               </div>
             ))
           ) : (
             <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
           )}
        </TabsContent>

        <TabsContent value="settlements" className="space-y-4">
           {activeStoreIds.length > 0 ? (
             activeStoreIds.map(sid => (
               <div key={`settlements-${sid}`} className="space-y-2">
                 <h2 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2 px-2">
                   <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                   {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                 </h2>
                 <div className="h-[650px] border-2 rounded-xl overflow-hidden shadow-lg bg-card/50 backdrop-blur-sm">
                    <ReglementsFournisseursModule storeId={sid} isMasterView />
                 </div>
               </div>
             ))
           ) : (
             <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
           )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('purchases.searchSuppliers')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={t('purchases.status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="ordered">{t('menu.program.ordered')}</SelectItem>
                    <SelectItem value="received">{t('menu.program.received')}</SelectItem>
                    <SelectItem value="draft">{t('menu.program.draft')}</SelectItem>
                </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => activeStoreIds.forEach(sid => fetchOrders(sid))}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('common.refresh')}
                </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                {t('purchases.history')}
              </CardTitle>
              <CardDescription>{t('common.transactions', { count: filteredOrders.length })}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {t('purchases.noOrdersFound')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>{t('menu.program.date')}</TableHead>
                        <TableHead>{t('menu.program.supplier')}</TableHead>
                        <TableHead>{t('menu.program.amount')}</TableHead>
                        <TableHead>{t('purchases.status')}</TableHead>
                        <TableHead>{t('sidebar.stores')}</TableHead>
                        <TableHead className="text-right">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <>
                        <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleOrder(order.id)}>
                          <TableCell>
                            {expandedOrder === order.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                          <TableCell>{formatDate(order.created_at)}</TableCell>
                          <TableCell className="font-medium">{order.supplier?.name || t('common.unknown')}</TableCell>
                          <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            {stores.find(s => s.id === order.store_id)?.name || t('common.unknown')}
                          </TableCell>
                          <TableCell className="text-right">
                            {order.status === 'draft' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await updateOrderStatus(order.id, 'ordered');
                                    toast.success(t('common.success'));
                                  } catch (err) {
                                    toast.error(t('common.error'));
                                  }
                                }}
                              >
                                {t('common.confirm')}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedOrder === order.id && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={7}>
                              <div className="p-4 space-y-2">
                                <h4 className="font-bold text-sm uppercase tracking-wider">{t('inventory.title')}</h4>
                                <Table className="bg-background border rounded-md">
                                  <TableHeader>
                                    <TableRow className="h-8">
                                      <TableHead className="text-[10px] uppercase">{t('inventory.table.name')}</TableHead>
                                      <TableHead className="text-[10px] uppercase text-center">{t('inventory.table.quantity')}</TableHead>
                                      <TableHead className="text-[10px] uppercase text-right">Prix Unit.</TableHead>
                                      <TableHead className="text-[10px] uppercase text-right">Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {orderItems.map(item => {
                                      const packSize = parseInt(item.product?.packaging?.match(/\d+/)?.[0] || '1') || 1;
                                      // If the stored cost is a box cost, we show the piece cost for clarity
                                      const pieceCost = item.unit_cost / packSize;
                                      return (
                                        <TableRow key={item.id} className="h-8">
                                          <TableCell className="text-xs font-medium">
                                            {item.product?.name || t('inventory.unknownProduct')}
                                            {packSize > 1 && <span className="ml-1 text-[10px] text-muted-foreground">(x{packSize})</span>}
                                          </TableCell>
                                          <TableCell className="text-xs text-center">{item.quantity_ordered}</TableCell>
                                          <TableCell className="text-xs text-right font-mono">{formatCurrency(pieceCost)}</TableCell>
                                          <TableCell className="text-xs text-right font-bold">{formatCurrency(item.quantity_ordered * item.unit_cost)}</TableCell>
                                        </TableRow>
                                      );
                                    })}
                                    {orderItems.length === 0 && (
                                      <TableRow>
                                        <TableCell colSpan={4} className="text-center py-4 text-xs italic text-muted-foreground">{t('common.loading')}</TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}