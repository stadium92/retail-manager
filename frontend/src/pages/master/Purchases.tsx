import React, { useState, useEffect } from 'react';
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
import { ShoppingBag, Search, Filter, RefreshCw, WifiOff, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReplenishmentNeeds } from '@/components/master/Purchases/ReplenishmentNeeds';
import { ReceptionAchatsModule } from '@/components/worker/Modules/ReceptionAchatsModule';
import { ReglementsFournisseursModule } from '@/components/worker/Modules/ReglementsFournisseursModule';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';

export default function PurchasesPage() {
  const { t } = useTranslation();
  const { formatDate, formatCurrency } = useFormatters();
  const { storeOrders, fetchOrders, fetchOrderItems, orderItems, updateOrderStatus, loading, loadingItems } = usePurchasingStore();
  const { selectedStoreIds, isAllStoresSelected, version } = useMasterDashboardStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [activeTab, setActiveTab] = useState('needs');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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

  const allOrders = activeStoreIds.length > 0 
    ? activeStoreIds.flatMap(sid => storeOrders[sid] || [])
    : Object.values(storeOrders).flat();

  useEffect(() => {
    if (stores.length > 0 && activeTab === 'orders') {
        activeStoreIds.forEach(sid => fetchOrders(sid, statusFilter));
    }
  }, [version, stores.length, activeTab, selectedStoreIds.length, isAllStoresSelected, statusFilter]);

  const toggleOrder = (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      fetchOrderItems(orderId);
    }
  };

  const filteredOrders = allOrders.filter(order => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch = order.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (order.notes && order.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received': return <Badge className="bg-green-500 font-black uppercase text-[9px] tracking-widest">{t('menu.program.received')}</Badge>;
      case 'ordered': return <Badge className="bg-blue-500 font-black uppercase text-[9px] tracking-widest">{t('menu.program.ordered')}</Badge>;
      case 'draft': return <Badge variant="secondary" className="font-black uppercase text-[9px] tracking-widest">{t('menu.program.draft')}</Badge>;
      case 'partial': return <Badge variant="outline" className="border-orange-500 text-orange-500 font-black uppercase text-[9px] tracking-widest">{t('menu.program.partial')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
        {isOffline && (
            <div className="flex items-center gap-2 p-3 bg-amber-100 text-amber-800 rounded-lg">
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-bold">{t('common.offline')}</span>
            </div>
        )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black uppercase tracking-tighter">{t('menu.purchases.trigger')} & {t('menu.stock.inventory')}</h1>
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs opacity-70">{t('purchases.subtitle')}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1 border-2">
          <TabsTrigger value="needs" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">{t('purchases.needs')}</TabsTrigger>
          <TabsTrigger value="reception" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">{t('menu.program.receptionTitle')}</TabsTrigger>
          <TabsTrigger value="settlements" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">{t('menu.program.supplierSettlement')}</TabsTrigger>
          <TabsTrigger value="orders" className="font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">{t('purchases.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="needs" className="space-y-4">
           {activeStoreIds.length > 0 ? (
             activeStoreIds.map(sid => (
               <div key={`needs-${sid}`} className="space-y-2">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-2 bg-primary/5 py-2 rounded-lg border-l-4 border-primary">
                   <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                   {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                 </h2>
                 <ReplenishmentNeeds storeId={sid} />
               </div>
             ))
           ) : (
             <div className="p-8 text-center text-muted-foreground font-black uppercase tracking-widest opacity-50">{t('common.loading')}</div>
           )}
        </TabsContent>

        <TabsContent value="reception" className="space-y-4">
           {activeStoreIds.length > 0 ? (
             activeStoreIds.map(sid => (
               <div key={`reception-${sid}`} className="space-y-2">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-2 bg-primary/5 py-2 rounded-lg border-l-4 border-primary">
                   <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                   {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                 </h2>
                 <ReceptionAchatsModule storeId={sid} />
               </div>
             ))
           ) : (
             <div className="p-8 text-center text-muted-foreground font-black uppercase tracking-widest opacity-50">{t('common.loading')}</div>
           )}
        </TabsContent>

        <TabsContent value="settlements" className="space-y-4">
           {activeStoreIds.length > 0 ? (
             activeStoreIds.map(sid => (
               <div key={`settlements-${sid}`} className="space-y-2">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-2 bg-primary/5 py-2 rounded-lg border-l-4 border-primary">
                   <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                   {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                 </h2>
                 <div className="h-[650px] border-2 rounded-xl overflow-hidden shadow-lg bg-card/50 backdrop-blur-sm">
                    <ReglementsFournisseursModule storeId={sid} isMasterView />
                 </div>
               </div>
             ))
           ) : (
             <div className="p-8 text-center text-muted-foreground font-black uppercase tracking-widest opacity-50">{t('common.loading')}</div>
           )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between bg-card p-4 rounded-xl border-2 shadow-lg">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('purchases.searchSuppliers')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 border-2 font-bold"
              />
            </div>
            <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-10 border-2 font-black uppercase text-[10px] tracking-widest">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={t('purchases.status')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all" className="font-bold uppercase text-[10px]">{t('common.all')}</SelectItem>
                    <SelectItem value="ordered" className="font-bold uppercase text-[10px]">{t('menu.program.ordered')}</SelectItem>
                    <SelectItem value="received" className="font-bold uppercase text-[10px]">{t('menu.program.received')}</SelectItem>
                    <SelectItem value="draft" className="font-bold uppercase text-[10px]">{t('menu.program.draft')}</SelectItem>
                </SelectContent>
                </Select>
                <Button variant="secondary" className="h-10 border-2 font-black uppercase text-[10px] tracking-widest px-6" onClick={() => activeStoreIds.forEach(sid => fetchOrders(sid, statusFilter))}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    {t('common.refresh')}
                </Button>
            </div>
          </div>

          <Card className="border-2 shadow-2xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 font-black uppercase tracking-tighter text-xl text-primary">
                  <ShoppingBag className="h-6 w-6" />
                  {t('purchases.history')}
                </CardTitle>
                <Badge variant="outline" className="h-6 font-mono font-black border-2 border-primary/20">
                    {t('common.transactions', { count: filteredOrders.length })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading && allOrders.length === 0 ? (
                <div className="p-8 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-24 text-muted-foreground font-black uppercase tracking-[0.2em] opacity-30 italic">
                  {t('purchases.noOrdersFound')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/5 sticky top-0 z-10 shadow-sm border-b-2">
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="font-black uppercase tracking-widest text-[10px]">{t('menu.program.date')}</TableHead>
                        <TableHead className="font-black uppercase tracking-widest text-[10px]">{t('menu.program.supplier')}</TableHead>
                        <TableHead className="font-black uppercase tracking-widest text-[10px]">{t('menu.program.amount')}</TableHead>
                        <TableHead className="font-black uppercase tracking-widest text-[10px] text-center">{t('purchases.status')}</TableHead>
                        <TableHead className="font-black uppercase tracking-widest text-[10px]">{t('sidebar.stores')}</TableHead>
                        <TableHead className="text-right font-black uppercase tracking-widest text-[10px]">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <React.Fragment key={order.id}>
                        <TableRow className={cn("cursor-pointer border-b transition-colors", expandedOrder === order.id ? "bg-primary/5" : "hover:bg-muted/20")} onClick={() => toggleOrder(order.id)}>
                          <TableCell>
                            {expandedOrder === order.id ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                                <span className="font-black text-xs">{formatDate(order.created_at)}</span>
                                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> {format(new Date(order.created_at), 'HH:mm:ss')}
                                </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-black uppercase text-sm tracking-tighter text-primary">{order.supplier?.name || t('common.unknown')}</TableCell>
                          <TableCell className="font-mono font-black text-xs text-primary">{formatCurrency(order.total_amount)}</TableCell>
                          <TableCell className="text-center">{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-2 font-bold text-[9px] uppercase tracking-tighter">
                                {stores.find(s => s.id === order.store_id)?.name || t('common.unknown')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {order.status === 'draft' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 border-2 font-black uppercase text-[9px] tracking-widest shadow-sm hover:bg-primary hover:text-white transition-all"
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
                          <TableRow className="bg-muted/10 border-b">
                            <TableCell colSpan={7} className="p-6">
                              <div className="space-y-4">
                                <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    {t('inventory.title')}
                                </h4>
                                <div className="border-2 rounded-xl overflow-hidden shadow-md bg-background">
                                    <Table>
                                    <TableHeader className="bg-muted/5 border-b-2">
                                        <TableRow className="h-9 hover:bg-transparent">
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest">{t('inventory.table.name')}</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-center">{t('inventory.table.quantity')}</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">PRIX PIECE</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-right">TOTAL</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orderItems.map(item => {
                                        const packSize = parseInt(item.product?.packaging?.match(/\d+/)?.[0] || '1') || 1;
                                        const pieceCost = item.unit_cost; 
                                        return (
                                            <TableRow key={item.id} className="h-10 border-b">
                                            <TableCell className="text-xs font-black uppercase tracking-tighter">
                                                {item.product?.name || t('inventory.unknownProduct')}
                                                {packSize > 1 && <Badge variant="secondary" className="ml-2 text-[8px] h-4 font-mono font-black border uppercase">X{packSize} {item.product?.packaging}</Badge>}
                                            </TableCell>
                                            <TableCell className="text-xs text-center font-mono font-bold">
                                                {item.quantity_received !== item.quantity_ordered ? (
                                                    <span className="flex flex-col">
                                                        <span>{item.quantity_received}</span>
                                                        <span className="text-[9px] text-muted-foreground line-through">Cmd: {item.quantity_ordered}</span>
                                                    </span>
                                                ) : (
                                                    item.quantity_ordered
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-right font-mono font-black text-muted-foreground">{formatCurrency(pieceCost)}</TableCell>
                                            <TableCell className="text-xs text-right font-black text-primary bg-primary/5">{formatCurrency(item.quantity_received * item.unit_cost)}</TableCell>
                                            </TableRow>
                                        );
                                        })}
                                        {loadingItems ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 italic">{t('common.loading')}</TableCell>
                                        </TableRow>
                                        ) : orderItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 italic">{t('common.noData')}</TableCell>
                                        </TableRow>
                                        ) : null}
                                    </TableBody>
                                    </Table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        </React.Fragment>
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
