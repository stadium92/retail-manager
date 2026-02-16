import { useState, useEffect } from 'react';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { StoreService } from '@/services/StoreService';
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
import { ShoppingBag, Search, Filter, RefreshCw, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { Skeleton } from '@/components/ui/skeleton';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReplenishmentNeeds } from '@/components/master/Purchases/ReplenishmentNeeds';

export default function PurchasesPage() {
  const { t } = useTranslation();
  const { formatDate, formatCurrency } = useFormatters();
  const { orders, fetchOrders, loading } = usePurchasingStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('orders');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const loadStores = async () => {
      const { data } = await StoreService.getStores();
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

  useEffect(() => {
    if (stores.length > 0 && activeTab === 'orders') {
        const storeIdToFetch = selectedStore === 'all' ? stores[0].id : selectedStore;
        fetchOrders(storeIdToFetch);
    }
  }, [selectedStore, stores, activeTab]);

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
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('sidebar.stores')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('inventory.allStores')}</SelectItem>
            {stores.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="needs">{t('purchases.needs')}</TabsTrigger>
          <TabsTrigger value="orders">{t('purchases.history')}</TabsTrigger>
        </TabsList>

        <TabsContent value="needs" className="space-y-4">
           {currentStoreId ? (
             <ReplenishmentNeeds storeId={currentStoreId} />
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
                    <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    <SelectItem value="ordered">{t('menu.program.ordered')}</SelectItem>
                    <SelectItem value="received">{t('menu.program.received')}</SelectItem>
                    <SelectItem value="draft">{t('menu.program.draft')}</SelectItem>
                </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => stores.length > 0 && fetchOrders(currentStoreId)}>
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
                        <TableHead>{t('menu.program.date')}</TableHead>
                        <TableHead>{t('menu.program.supplier')}</TableHead>
                        <TableHead>{t('menu.program.amount')}</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>{t('sidebar.stores')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>{formatDate(order.created_at)}</TableCell>
                          <TableCell className="font-medium">{order.supplier?.name || t('common.unknown')}</TableCell>
                          <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            {stores.find(s => s.id === order.store_id)?.name || t('common.unknown')}
                          </TableCell>
                        </TableRow>
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