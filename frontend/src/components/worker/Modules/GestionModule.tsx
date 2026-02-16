import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Coins, TrendingUp, Package, AlertTriangle, ShoppingCart,
  ArrowDownCircle, ArrowUpCircle, Save, Trash2, BarChart3,
  WifiOff, RefreshCw, Search
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { OfflineDataService, SaleWithItems } from '@/services/OfflineDataService';
import { useStockSearch } from '@/hooks/useStockSearch';
import { ProductLookupDialog } from '../Sales/ProductLookupDialog';
import { Product } from '@/types';
import { useTranslation } from 'react-i18next';

interface GestionModuleProps {
  storeId: string;
  mode: 'consultation-caisse' | 'journal-caisse' | 'tableau-bord' | 'statistiques' | 'sorties-pertes';
}

interface CashEntry {
  id: string;
  type: 'in' | 'out';
  description: string;
  amount: number;
  date: string;
  category: string;
}

const CHART_COLORS = ['#00D9FF', '#FF00FF', '#00FF66', '#FFD700', '#FF6B6B'];

interface DashboardAnalytics {
  daily_revenue: number;
  weekly_revenue: { date: string; revenue: number }[];
  top_products: { name: string; quantity: number; revenue: number }[];
  top_workers: { name: string; sales_count: number; revenue: number }[];
}

export function GestionModule({ storeId, mode }: GestionModuleProps) {
  const { t, i18n } = useTranslation();
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isProductLookupOpen, setIsProductLookupOpen] = useState(false);

  const getLocale = () => {
    if (i18n.language === 'fr' || i18n.language === 'bm') return fr;
    return enUS;
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' F';
  };

  const lowStockQuery = useStockSearch(storeId, mode === 'tableau-bord' || mode === 'sorties-pertes');
  
  useEffect(() => {
      lowStockQuery.setFilter('low_stock');
  }, []);

  // Loss form state
  const [lossForm, setLossForm] = useState({
    product: null as Product | null,
    quantity: 1,
    reason: 'expired' as 'expired' | 'broken' | 'theft' | 'other',
    notes: '',
  });

  // Listen for online/offline changes
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

  // Fetch data - uses local sources
  useEffect(() => {
    const fetchData = async () => {
      if (!storeId) return;
      setIsLoading(true);

      try {
        const analyticsData = await OfflineDataService.getDashboardAnalytics(storeId);
        if (analyticsData) {
          setAnalytics(analyticsData);
        }

        const today = startOfDay(new Date());
        const salesData = await OfflineDataService.getSales(storeId, today);
        setSales(salesData);

        const entries: CashEntry[] = [];
        
        salesData.forEach(sale => {
          entries.push({
            id: sale.id,
            type: 'in',
            description: `Vente ${sale.invoice_number || sale.id.slice(0, 8)}`,
            amount: sale.total_price,
            date: sale.created_at,
            category: t('sidebar.sales'),
          });
        });

        if (navigator.onLine) {
          const payments = await OfflineDataService.getSupplierPayments(storeId, today);
          payments.forEach(payment => {
            entries.push({
              id: payment.id,
              type: 'out',
              description: `Paiement ${payment.supplier_name}`,
              amount: payment.amount,
              date: payment.date,
              category: t('menu.program.supplierPayment'),
            });
          });
        }

        setCashEntries(entries.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ));
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error(t('common.failedToLoad'));
      }

      setIsLoading(false);
    };

    fetchData();
  }, [storeId, t]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalRevenue = cashEntries
      .filter(e => e.type === 'in')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = cashEntries
      .filter(e => e.type === 'out')
      .reduce((sum, e) => sum + e.amount, 0);
    const netCash = totalRevenue - totalExpenses;
    const orderCount = sales.length;
    
    const estimatedProfit = totalRevenue * 0.3;

    return { totalRevenue, totalExpenses, netCash, orderCount, estimatedProfit };
  }, [cashEntries, sales]);

  // Category breakdown for pie chart
  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    sales.forEach(sale => {
      (sale.sale_items || []).forEach((item) => {
        const cat = item.product_name?.split(' ')[0] || 'Autre';
        categories[cat] = (categories[cat] || 0) + item.total;
      });
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [sales]);

  // Weekly revenue data
  const weeklyRevenue = useMemo(() => {
    if (analytics?.weekly_revenue) {
      return analytics.weekly_revenue.map(d => ({
        date: format(new Date(d.date), 'EEE', { locale: getLocale() }),
        revenue: d.revenue
      }));
    }
    return [];
  }, [analytics, i18n.language]);

  // Top selling products
  const topProducts = useMemo(() => {
    if (analytics?.top_products) {
      return analytics.top_products.map(p => ({
        name: p.name,
        qty: p.quantity,
        revenue: p.revenue
      }));
    }
    const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales.forEach(sale => {
      (sale.sale_items || []).forEach((item) => {
        if (!productSales[item.product_name]) {
          productSales[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
        }
        productSales[item.product_name].qty += item.quantity;
        productSales[item.product_name].revenue += item.total;
      });
    });
    return Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales, analytics]);

  // Handle loss recording - works offline
  const handleRecordLoss = async () => {
    if (!lossForm.product || lossForm.quantity <= 0) {
      toast.error(t('worker.sales.addAtLeastOne'));
      return;
    }

    try {
      const newQuantity = Math.max(0, lossForm.product.quantity - lossForm.quantity);
      await OfflineDataService.updateProductStock(lossForm.product.id, newQuantity, `Perte: ${lossForm.reason}`);
      toast.success(t('common.success'));
      setLossForm({ product: null, quantity: 1, reason: 'expired', notes: '' });
      lowStockQuery.refetch();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const OfflineIndicator = () => isOffline ? (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-warning/20 text-warning text-xs">
      <WifiOff className="h-3 w-3" />
      <span>{t('common.offline')}</span>
    </div>
  ) : null;

  const renderContent = () => {
    switch (mode) {
      case 'consultation-caisse':
      case 'journal-caisse':
        return (
          <div className="space-y-4">
            <div className="flex justify-end">
              <OfflineIndicator />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/20">
                      <ArrowDownCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('menu.program.income')}</p>
                      <p className="text-lg font-bold text-success">{formatCurrency(kpis.totalRevenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-danger/20">
                      <ArrowUpCircle className="h-5 w-5 text-danger" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('menu.program.expenses')}</p>
                      <p className="text-lg font-bold text-danger">{formatCurrency(kpis.totalExpenses)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-primary/10 border-primary">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('menu.program.cashBalance')}</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(kpis.netCash)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{t('menu.program.cashJournal')} - {format(new Date(), 'dd/MM/yyyy', { locale: getLocale() })}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[350px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="text-xs">{t('menu.program.time')}</TableHead>
                        <TableHead className="text-xs">{t('inventory.fields.description')}</TableHead>
                        <TableHead className="text-xs">{t('inventory.fields.category')}</TableHead>
                        <TableHead className="text-xs text-right">{t('menu.program.income')}</TableHead>
                        <TableHead className="text-xs text-right">{t('menu.program.expenses')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashEntries.map(entry => (
                        <TableRow key={entry.id} className="h-9">
                          <TableCell className="text-xs">
                            {format(new Date(entry.date), 'HH:mm', { locale: getLocale() })}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{entry.description}</TableCell>
                          <TableCell className="text-xs">{entry.category}</TableCell>
                          <TableCell className="text-xs text-right text-success">
                            {entry.type === 'in' ? formatCurrency(entry.amount) : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right text-danger">
                            {entry.type === 'out' ? formatCurrency(entry.amount) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {cashEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'tableau-bord':
        return (
          <div className="space-y-4">
            <div className="flex justify-end">
              <OfflineIndicator />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CA Jour</p>
                      <p className="text-lg font-bold">{formatCurrency(analytics?.daily_revenue ?? kpis.totalRevenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/20">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Profit Est.</p>
                      <p className="text-lg font-bold text-success">{formatCurrency(kpis.estimatedProfit)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/20">
                      <ShoppingCart className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('sidebar.deliveries')}</p>
                      <p className="text-lg font-bold">{kpis.orderCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/20">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('inventory.lowStock')}</p>
                      <p className="text-lg font-bold text-warning">{lowStockQuery.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    CA 7 derniers jours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weeklyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))' 
                        }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Top 5 Catégories</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend 
                        formatter={(value) => <span className="text-xs">{value}</span>}
                      />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'statistiques':
        return (
          <div className="space-y-4">
            <div className="flex justify-end">
              <OfflineIndicator />
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{t('menu.program.topProducts')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                        <TableHead className="text-xs text-center">{t('inventory.table.quantity')}</TableHead>
                        <TableHead className="text-xs text-right">CA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((product, idx) => (
                        <TableRow key={product.name} className="h-10">
                          <TableCell className="text-xs font-bold text-primary">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{product.name}</TableCell>
                          <TableCell className="text-xs text-center">{product.qty}</TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            {formatCurrency(product.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {topProducts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'sorties-pertes':
        return (
          <div className="space-y-4">
            <div className="flex justify-end">
              <OfflineIndicator />
            </div>

                          <Card>
                            <CardHeader className="py-3">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Trash2 className="h-4 w-4" />
                                {t('menu.management.lossExit')}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {t('menu.management.lossExitDescription')}
                              </CardDescription>
                            </CardHeader>              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{t('inventory.table.name')}</Label>
                    <Button 
                      variant="outline" 
                      className={cn("w-full justify-start text-left font-normal", !lossForm.product && "text-muted-foreground")}
                      onClick={() => setIsProductLookupOpen(true)}
                    >
                      {lossForm.product ? (
                        <span>{lossForm.product.name} (Stock: {lossForm.product.quantity})</span>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          {t('common.search')}...
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t('inventory.table.quantity')}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={lossForm.quantity}
                      onChange={(e) => setLossForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t('menu.program.reason')}</Label>
                  <Select 
                    value={lossForm.reason} 
                    onValueChange={(v: 'expired' | 'broken' | 'theft' | 'other') => setLossForm(f => ({ ...f, reason: v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expired">{t('menu.management.reasons.expired')}</SelectItem>
                      <SelectItem value="broken">{t('menu.management.reasons.broken')}</SelectItem>
                      <SelectItem value="theft">{t('menu.management.reasons.theft')}</SelectItem>
                      <SelectItem value="other">{t('menu.management.reasons.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t('menu.program.notes')}</Label>
                  <Textarea
                    value={lossForm.notes}
                    onChange={(e) => setLossForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="..."
                    rows={3}
                  />
                </div>

                <Button onClick={handleRecordLoss} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {t('common.save')}
                </Button>
              </CardContent>
            </Card>

            {/* Low stock warning */}
            {lowStockQuery.total > 0 && (
              <Card className="border-warning">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    {t('inventory.lowStock')} ({lowStockQuery.total})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                          <TableHead className="text-xs text-right">{t('pos.grid.stock')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowStockQuery.results.map(p => (
                          <TableRow key={p.id} className="h-9">
                            <TableCell className="text-xs font-medium">{p.name}</TableCell>
                            <TableCell className="text-xs text-right text-warning font-bold">
                              {p.quantity}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
            
            <ProductLookupDialog
              open={isProductLookupOpen}
              onOpenChange={setIsProductLookupOpen}
              storeId={storeId}
              mode="retail"
              onSelect={(p) => {
                setLossForm(f => ({ ...f, product: p }));
                setIsProductLookupOpen(false);
              }}
            />
          </div>
        );

      default:
        return <div className="text-center py-8 text-muted-foreground">{t('common.error')}</div>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      {renderContent()}
    </div>
  );
}