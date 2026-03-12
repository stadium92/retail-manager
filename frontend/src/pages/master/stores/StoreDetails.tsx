import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { Store, InventoryItem, SaleWithDetails, Profile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Store as StoreIcon,
  ArrowLeft,
  Users,
  Package,
  ShoppingCart,
  Truck,
  MapPin,
  Phone,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface StoreDetailsData {
  store: Store;
  workers: Array<{ profile: Profile; role: string }>;
  inventory: InventoryItem[];
  recentSales: SaleWithDetails[];
  metrics: {
    todaySales: number;
    weekSales: number;
    lowStockCount: number;
    totalInventoryValue: number;
  };
}

export default function StoreDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatCurrency, formatDate } = useFormatters();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StoreDetailsData | null>(null);

  useEffect(() => {
    if (id) {
      loadStoreDetails(id);
    }
  }, [id]);

  const loadStoreDetails = async (storeId: string) => {
    setLoading(true);
    try {
      // Fetch store
      const { data: store, error: storeError } = await OfflineStoreService.getStore(storeId);
      if (storeError || !store) {
        toast({
          title: t('common.error'),
          description: t('storeDetails.errors.notFound'),
          variant: 'destructive',
        });
        navigate('/master/stores');
        return;
      }

      // Workers: not available without supabase, return empty
      const workers: Array<{ profile: Profile; role: string }> = [];

      // Fetch inventory
      const { data: inventory } = await OfflineInventoryService.getInventory(storeId);

      // Fetch recent sales
      const sales = await OfflineSalesService.getSales(storeId);
      const recentSales = sales.slice(0, 10);

      // Calculate metrics
      const metrics = await OfflineSalesService.getSalesMetrics(storeId);
      const lowStockCount = inventory?.filter(item => 
        item.quantity <= (item.low_stock_threshold || 10)
      ).length || 0;
      const totalInventoryValue = inventory?.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0
      ) || 0;

      setData({
        store,
        workers: workers.filter(w => w.profile.id),
        inventory: inventory || [],
        recentSales: recentSales || [],
        metrics: {
          ...metrics,
          lowStockCount,
          totalInventoryValue,
        },
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('storeDetails.errors.loadDetails'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mobile-container py-4 px-4 lg:px-6">
        <Card>
          <CardContent className="py-12 text-center">
            <StoreIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('storeDetails.errors.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { store, workers, inventory, recentSales, metrics } = data;

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/master/stores')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('storeDetails.backToStores')}
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <StoreIcon className="h-8 w-8" />
              {store.name}
            </h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              {store.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {store.address}
                </span>
              )}
              {store.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {store.phone}
                </span>
              )}
            </div>
          </div>
          <Button onClick={() => navigate(`/master/stores`)}>
            {t('storeDetails.editStore')}
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('storeDetails.metrics.todaySales')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.todaySales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('storeDetails.metrics.weekSales')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.weekSales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('storeDetails.metrics.inventoryValue')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalInventoryValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('storeDetails.metrics.lowStockItems')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.lowStockCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">{t('storeDetails.tabs.inventory', { count: inventory.length })}</TabsTrigger>
          <TabsTrigger value="sales">{t('storeDetails.tabs.sales', { count: recentSales.length })}</TabsTrigger>
          <TabsTrigger value="workers">{t('storeDetails.tabs.workers', { count: workers.length })}</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('storeDetails.inventory.title')}</CardTitle>
              <CardDescription>{t('storeDetails.inventory.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {inventory.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('storeDetails.inventory.empty')}</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow>
                        <TableHead>{t('storeDetails.inventory.table.name')}</TableHead>
                        <TableHead>{t('storeDetails.inventory.table.sku')}</TableHead>
                        <TableHead>{t('storeDetails.inventory.table.quantity')}</TableHead>
                        <TableHead>{t('storeDetails.inventory.table.price')}</TableHead>
                        <TableHead>{t('storeDetails.inventory.table.value')}</TableHead>
                        <TableHead>{t('storeDetails.inventory.table.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.sku || '-'}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(item.price)}</TableCell>
                          <TableCell>{formatCurrency(item.price * item.quantity)}</TableCell>
                          <TableCell>
                            {item.quantity <= (item.low_stock_threshold || 10) ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {t('inventory.status.lowStock')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">{t('inventory.status.inStock')}</Badge>
                            )}
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

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('storeDetails.sales.title')}</CardTitle>
              <CardDescription>{t('storeDetails.sales.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('storeDetails.sales.empty')}</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow>
                        <TableHead>{t('storeDetails.sales.table.date')}</TableHead>
                        <TableHead>{t('storeDetails.sales.table.item')}</TableHead>
                        <TableHead>{t('storeDetails.sales.table.customer')}</TableHead>
                        <TableHead>{t('storeDetails.sales.table.quantity')}</TableHead>
                        <TableHead>{t('storeDetails.sales.table.total')}</TableHead>
                        <TableHead>{t('storeDetails.sales.table.worker')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            {formatDate(sale.created_at)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {sale.items?.map(i => i.product_name).join(', ') || t('common.unknown')}
                          </TableCell>
                          <TableCell>{sale.customer_name || '-'}</TableCell>
                          <TableCell>{sale.items?.reduce((sum, i) => sum + i.quantity, 0) || 0}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {formatCurrency(Number(sale.total_price))}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sale.worker?.full_name || sale.worker?.email || '-'}
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

        <TabsContent value="workers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('storeDetails.workers.title')}</CardTitle>
              <CardDescription>{t('storeDetails.workers.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {workers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('storeDetails.workers.empty')}</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow>
                        <TableHead>{t('storeDetails.workers.table.name')}</TableHead>
                        <TableHead>{t('storeDetails.workers.table.email')}</TableHead>
                        <TableHead>{t('storeDetails.workers.table.phone')}</TableHead>
                        <TableHead>{t('storeDetails.workers.table.role')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workers.map((worker) => (
                        <TableRow key={worker.profile.id}>
                          <TableCell className="font-medium">
                            {worker.profile.full_name || t('common.unknown')}
                          </TableCell>
                          <TableCell>{worker.profile.email || '-'}</TableCell>
                          <TableCell>{worker.profile.phone || '-'}</TableCell>
                          <TableCell>
                            <Badge>{worker.role}</Badge>
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
