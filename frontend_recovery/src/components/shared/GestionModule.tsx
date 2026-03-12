import { useState, useEffect, useMemo, useRef } from 'react';
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
  WifiOff, RefreshCw, Search, Calendar as CalendarIcon, Filter as FilterIcon, Plus
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { OfflineDataService, SaleWithItems } from '@/services/OfflineDataService';
import { useStockSearch } from '@/hooks/useStockSearch';
import { ProductLookupDialog } from '../worker/Sales/ProductLookupDialog';
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
  stock_health?: { ok: number; low: number; out: number };
}

export function GestionModule({ storeId, mode }: GestionModuleProps) {
  const { t, i18n } = useTranslation();
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isProductLookupOpen, setIsProductLookupOpen] = useState(false);
  
  // Petty Cash Dialog
  const [isPettyCashOpen, setIsPettyCashOpen] = useState(false);
  const [pettyCashForm, setPettyCashForm] = useState({
    amount: '',
    category: 'petty_cash',
    description: '',
  });

  // Date Range state for Dashboard
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

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
    quantity: 1 as number | string,
    reason: 'expired' as 'expired' | 'broken' | 'theft' | 'other',
    notes: '',
  });

  const lastRefresh = useRef<number>(0);

  // Listen for online/offline changes and data updates
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    const handleDataUpdated = (e: CustomEvent) => {
      // 1. Check type
      if (e.detail?.type !== 'sales' && e.detail?.type !== 'inventory') return;
      
      // 2. Check storeId (if provided in event) to only refresh what's relevant
      if (e.detail?.storeId && e.detail.storeId !== storeId) return;

      // 3. Throttle: Only allow one refresh every 2 seconds to stop jittering loops
      const now = Date.now();
      if (now - lastRefresh.current < 2000) return;
      lastRefresh.current = now;

      console.log(`[GestionModule] Throttled refresh triggered for store: ${storeId || 'ALL'}`);
      fetchData();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('localDbDataUpdated', handleDataUpdated as EventListener);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('localDbDataUpdated', handleDataUpdated as EventListener);
    };
  }, [storeId, dateRange]);

  // Fetch data - uses local sources
  const fetchData = async () => {
    // If we're in Worker mode, storeId is required. 
    // In Master mode, storeId can be empty string (All Stores).
    // We only return if storeId is strictly undefined (not yet initialized).
    if (storeId === undefined) return;
    setIsLoading(true);

    try {
      const from = dateRange?.from || startOfDay(new Date());
      const to = dateRange?.to || endOfDay(new Date());

      console.log(`[GestionModule] Fetching data for store: ${storeId || 'ALL'}`);

      const analyticsData = await OfflineDataService.getDashboardAnalytics(storeId, from, to);
      if (analyticsData) {
        setAnalytics(analyticsData);
      }

      const salesData = await OfflineDataService.getSales(storeId, from, to);
      setSales(salesData);

      const movementsData = await OfflineDataService.getStockMovements(storeId);
      setMovements(movementsData.movements || []);

      const entries: CashEntry[] = [];
      
      salesData.forEach(sale => {
        const isCredit = sale.payment_method === 'credit';
        entries.push({
          id: sale.id,
          type: isCredit ? 'out' : 'in', // Display logic for journal
          description: `${isCredit ? '[CRÉDIT] ' : ''}Vente ${sale.invoice_number || sale.id.slice(0, 8)}`,
          amount: sale.total_price,
          date: sale.created_at,
          category: isCredit ? t('menu.program.creditSale') : t('sidebar.sales'),
          isCredit,
          method: sale.payment_method
        } as any);
      });

      // Fetch Supplier Payments (Out)
      const payments = await OfflineDataService.getSupplierPayments(storeId, from);
      payments.forEach(payment => {
        if (new Date(payment.date) <= to) {
          entries.push({
            id: payment.id,
            type: 'out',
            description: `Paiement ${payment.supplier_name}`,
            amount: payment.amount,
            date: payment.date,
            category: t('menu.program.supplierPayment'),
          });
        }
      });

      // Fetch Petty Cash Transactions
      const cashTxs = await OfflineDataService.getCashTransactions(storeId, from);
      cashTxs.forEach(tx => {
        if (new Date(tx.date) <= to) {
          entries.push({
            id: tx.id,
            type: tx.type,
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
            category: tx.category,
          });
        }
      });

      // Calculate Running Balance
      // Sort ascending to calculate, then flip back for display
      const sortedAsc = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let currentBalance = 0;
      const entriesWithBalance = sortedAsc.map(e => {
        if (e.type === 'in' && !(e as any).isCredit) {
          currentBalance += e.amount;
        } else if (e.type === 'out' && !(e as any).isCredit) {
          currentBalance -= e.amount;
        }
        return { ...e, runningBalance: currentBalance };
      });

      setCashEntries(entriesWithBalance.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
    } catch (error) {
      console.error('[GestionModule] Error fetching data:', error);
      toast.error(t('common.failedToLoad'));
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [storeId, t, dateRange]);

  const handleRecordPettyCash = async () => {
    const amount = parseFloat(pettyCashForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('common.error'));
      return;
    }

    const success = await OfflineDataService.createCashTransaction({
      store_id: storeId,
      type: 'out',
      amount,
      category: pettyCashForm.category,
      description: pettyCashForm.description || t('analytics.miscellaneousExpense'),
    });

    if (success) {
      toast.success(t('common.success'));
      setIsPettyCashOpen(false);
      setPettyCashForm({ amount: '', category: 'petty_cash', description: '' });
      fetchData();
    } else {
      toast.error(t('common.error'));
    }
  };

  // Calculate KPIs
  const kpis = useMemo(() => {
    // Only count non-credit entries as "Income" for actual Cash balance
    const cashTotal = cashEntries
      .filter(e => e.type === 'in' && (e as any).method === 'cash')
      .reduce((sum, e) => sum + e.amount, 0);

    const cardTotal = cashEntries
      .filter(e => e.type === 'in' && (e as any).method === 'card')
      .reduce((sum, e) => sum + e.amount, 0);

    const mobileTotal = cashEntries
      .filter(e => e.type === 'in' && (e as any).method === 'mobile')
      .reduce((sum, e) => sum + e.amount, 0);
      
    const totalExpenses = cashEntries
      .filter(e => e.type === 'out' && !(e as any).isCredit)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalCreditSales = cashEntries
      .filter(e => (e as any).isCredit)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalRevenue = cashTotal + cardTotal + mobileTotal;
    const netCash = totalRevenue - totalExpenses;
    const orderCount = sales.length;
    
    // Profit based on price - cost
    const totalProfit = sales.reduce((sum, sale) => {
      const saleItems = sale.sale_items || [];
      // This is an estimate as sale_items might not have cost_price directly
      // In a full implementation, we'd join with products table or look up cost
      return sum + (sale.total_price * 0.25); // Default 25% margin estimate
    }, 0);

    return { 
      totalRevenue, 
      totalExpenses, 
      netCash, 
      orderCount, 
      totalProfit, 
      totalCreditSales,
      cashTotal,
      cardTotal,
      mobileTotal
    };
  }, [cashEntries, sales]);

  // Category breakdown for pie chart
  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    sales.forEach(sale => {
      (sale.sale_items || []).forEach((item) => {
        const cat = item.category_name || t('common.other');
        categories[cat] = (categories[cat] || 0) + item.total;
      });
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [sales, t]);

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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 font-mono">
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</>
                        ) : (
                          format(dateRange.from, "dd/MM/yy")
                        )
                      ) : (
                        <span>{t('menu.program.selectDate')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <Button size="sm" variant="secondary" className="h-9 gap-2" onClick={() => setIsPettyCashOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('menu.management.recordExpense')}
                </Button>
              </div>
              <OfflineIndicator />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/20">
                      <ArrowDownCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.income')}</p>
                      <p className="text-lg font-bold text-success font-mono">{formatCurrency(kpis.totalRevenue)}</p>
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
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.expenses')}</p>
                      <p className="text-lg font-bold text-danger font-mono">{formatCurrency(kpis.totalExpenses)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.creditSale')}</p>
                      <p className="text-lg font-bold font-mono">{formatCurrency(kpis.totalCreditSales)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-primary/10 border-primary">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20 text-primary">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.cashBalance')}</p>
                      <p className="text-lg font-bold font-mono">{formatCurrency(kpis.netCash)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-lg border-2 border-primary/20">
              <CardHeader className="py-3 border-b bg-muted/10">
                <CardTitle className="text-sm uppercase tracking-widest font-mono">
                  {t('menu.program.cashJournal')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.time')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('inventory.fields.description')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('inventory.fields.category')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.transaction')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.runningBalance')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashEntries.map(entry => (
                        <TableRow key={entry.id} className={cn("h-11 border-b hover:bg-muted/10 transition-colors", (entry as any).isCredit && "opacity-60 bg-muted/20 italic")}>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {format(new Date(entry.date), 'HH:mm')}
                          </TableCell>
                          <TableCell className="text-xs font-bold uppercase truncate max-w-[250px]">
                            {entry.description}
                            {(entry as any).method && (
                              <Badge variant="outline" className="ml-2 text-[8px] h-4 py-0 uppercase border-muted-foreground/30">
                                {(entry as any).method}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[10px] uppercase text-muted-foreground font-medium">
                            {entry.category}
                          </TableCell>
                          <TableCell className={cn("text-xs text-right font-bold font-mono", entry.type === 'in' ? "text-success" : "text-danger")}>
                            {entry.type === 'in' ? '+' : '-'}{formatCurrency(entry.amount)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-black font-mono text-primary bg-primary/5">
                            {formatCurrency((entry as any).runningBalance || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {cashEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-24 uppercase font-mono tracking-[0.2em] opacity-50">
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            <Dialog open={isPettyCashOpen} onOpenChange={setIsPettyCashOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="uppercase font-mono">{t('menu.management.recordExpense')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('menu.program.amount')}</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={pettyCashForm.amount}
                      onChange={e => setPettyCashForm({...pettyCashForm, amount: e.target.value})}
                      className="h-12 text-2xl font-bold font-mono border-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('menu.program.reason')}</Label>
                    <Select 
                      value={pettyCashForm.category}
                      onValueChange={v => setPettyCashForm({...pettyCashForm, category: v})}
                    >
                      <SelectTrigger className="h-11 border-2 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="petty_cash">Dépense Diverse / Petty Cash</SelectItem>
                        <SelectItem value="supplies">Fournitures / Supplies</SelectItem>
                        <SelectItem value="bills">Factures / Bills</SelectItem>
                        <SelectItem value="salaries">Avance Salaire / Salaries</SelectItem>
                        <SelectItem value="delivery">Frais Livraison / Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.description')}</Label>
                    <Textarea 
                      placeholder={t('analytics.expenseDetailPlaceholder')}
                      value={pettyCashForm.description}
                      onChange={e => setPettyCashForm({...pettyCashForm, description: e.target.value})}
                      className="border-2"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPettyCashOpen(false)}>{t('common.cancel')}</Button>
                  <Button 
                    className="bg-danger hover:bg-danger/90 text-white font-bold"
                    onClick={handleRecordPettyCash}
                  >
                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                    {t('common.confirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );

      case 'tableau-bord':
        const stockHealthData = analytics?.stock_health ? [
          { name: t('inventory.inStock'), value: analytics.stock_health.ok, color: '#00FF66' },
          { name: t('inventory.lowStock'), value: analytics.stock_health.low, color: '#FFD700' },
          { name: t('inventory.outOfStock'), value: analytics.stock_health.out, color: '#FF6B6B' },
        ].filter(d => d.value > 0) : [];

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 font-mono">
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yy")
                        )
                      ) : (
                        <span>{t('menu.program.selectDate')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] h-7 px-2 uppercase"
                    onClick={() => setDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}
                  >
                    {t('menu.program.today')}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] h-7 px-2 uppercase"
                    onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) })}
                  >
                    {t('menu.program.last7Days')}
                  </Button>
                </div>
              </div>
              <OfflineIndicator />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-primary">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('menu.program.revenue')}</p>
                      <p className="text-lg font-bold">{formatCurrency(kpis.totalRevenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-success">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/20">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('menu.program.potentialMargin')}</p>
                      <p className="text-lg font-bold text-success">+{formatCurrency(kpis.totalProfit)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-amber-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <ShoppingCart className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('sidebar.sales')}</p>
                      <p className="text-lg font-bold text-amber-600">{kpis.orderCount} {t('menu.program.bills')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-warning">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/20">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Alertes Stock</p>
                      <p className="text-lg font-bold text-warning">{lowStockQuery.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('analytics.revenueEvolution')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={weeklyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="date" className="text-[10px] font-mono" />
                      <YAxis className="text-[10px] font-mono" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('menu.management.stockStatus')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stockHealthData.length > 0 ? (
                    <div className="space-y-4">
                      <div className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stockHealthData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {stockHealthData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-1 gap-2 pt-2">
                        {stockHealthData.map((item) => (
                          <div key={item.name} className="flex items-center justify-between text-[10px] font-bold uppercase">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span>{item.name}</span>
                            </div>
                            <span className="font-mono">{item.value} {t('menu.program.productsDisplayed')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground uppercase font-mono">
                      {t('common.noData')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               <Card>
                <CardHeader className="py-3 border-b bg-muted/20">
                  <CardTitle className="text-xs uppercase">{t('analytics.topProductsVolume')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {topProducts.slice(0, 5).map((p, idx) => (
                        <TableRow key={p.name} className="h-10 border-b last:border-0">
                          <TableCell className="text-xs font-mono w-8 text-muted-foreground">0{idx+1}</TableCell>
                          <TableCell className="text-xs font-bold uppercase">{p.name}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{p.qty} {t('inventory.unitTypes.piece')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
               </Card>

               <Card>
                <CardHeader className="py-3 border-b bg-muted/20">
                  <CardTitle className="text-xs uppercase">{t('analytics.categoryDistribution')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {categoryData.map((c, idx) => (
                        <TableRow key={c.name} className="h-10 border-b last:border-0">
                          <TableCell className="text-xs font-bold uppercase">{c.name}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{formatCurrency(c.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
               </Card>
            </div>
          </div>
        );

      case 'statistiques':
        // Calculate Hourly Distribution
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}h`,
          revenue: 0,
          count: 0
        }));

        sales.forEach(sale => {
          const hour = new Date(sale.created_at).getHours();
          hourlyData[hour].revenue += sale.total_price;
          hourlyData[hour].count += 1;
        });

        const activeHours = hourlyData.filter(h => h.count > 0 || h.revenue > 0);

        // Average Basket Value
        const abv = kpis.orderCount > 0 ? kpis.totalRevenue / kpis.orderCount : 0;
        const avgItems = kpis.orderCount > 0 
          ? sales.reduce((sum, s) => sum + (s.sale_items?.length || 0), 0) / kpis.orderCount 
          : 0;

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 font-mono">
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</>
                        ) : (
                          format(dateRange.from, "dd/MM/yy")
                        )
                      ) : (
                        <span>{t('menu.program.selectDate')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <OfflineIndicator />
            </div>

            {/* Advanced KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('analytics.avgBasket')}</p>
                    <p className="text-xl font-bold font-mono">{formatCurrency(abv)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary opacity-20" />
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('analytics.itemsPerSale')}</p>
                    <p className="text-xl font-bold font-mono">{avgItems.toFixed(1)}</p>
                  </div>
                  <Package className="h-8 w-8 text-success opacity-20" />
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('analytics.creditRate')}</p>
                    <p className="text-xl font-bold font-mono">
                      {kpis.totalRevenue > 0 ? ((kpis.totalCreditSales / (kpis.totalRevenue + kpis.totalCreditSales)) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-warning opacity-20" />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hourly Peak Analysis */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('analytics.hourlyTraffic')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={activeHours}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="hour" className="text-[10px] font-mono" />
                      <YAxis yAxisId="left" className="text-[10px] font-mono" orientation="left" stroke="#888888" />
                      <YAxis yAxisId="right" className="text-[10px] font-mono" orientation="right" stroke="hsl(var(--primary))" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', fontSize: '12px' }}
                      />
                      <Bar yAxisId="left" dataKey="count" name={t('analytics.sales')} fill="#888888" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="revenue" name={t('analytics.revenue')} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Worker Performance */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('analytics.workerPerformance')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="text-[10px] uppercase">{t('common.name')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-center">{t('sidebar.sales')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">{t('analytics.revenue')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics?.top_workers?.map(worker => (
                        <TableRow key={worker.name} className="h-11">
                          <TableCell className="text-xs font-bold uppercase">{worker.name}</TableCell>
                          <TableCell className="text-xs text-center font-mono">{worker.sales_count}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-primary">
                            {formatCurrency(worker.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!analytics?.top_workers?.length && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8 uppercase">
                            {t('analytics.noPerformanceData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="py-3 border-b bg-muted/20">
                <CardTitle className="text-xs uppercase">{t('menu.program.topProducts')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase w-12">#</TableHead>
                        <TableHead className="text-[10px] uppercase">{t('inventory.table.name')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-center">{t('inventory.table.quantity')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">Chiffre d'Affaires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((product, idx) => (
                        <TableRow key={product.name} className="h-11">
                          <TableCell className="text-xs font-bold text-primary font-mono">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-bold uppercase">{product.name}</TableCell>
                          <TableCell className="text-xs text-center font-mono">{product.qty}</TableCell>
                          <TableCell className="text-xs text-right font-bold">
                            {formatCurrency(product.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'sorties-pertes':
        const lossMovements = movements.filter(m => m.type === 'out' && m.reason?.startsWith('Perte'));
        const todayLosses = lossMovements.filter(m => new Date(m.date) >= startOfDay(new Date()));

        return (
          <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
            <div className="space-y-4">
              <Card className="border-danger/30">
                <CardHeader className="py-3 bg-danger/5">
                  <CardTitle className="text-sm flex items-center gap-2 text-danger uppercase font-mono">
                    <Trash2 className="h-4 w-4" />
                    {t('menu.management.recordLoss')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('inventory.table.name')}</Label>
                    <Button 
                      variant="outline" 
                      className={cn("w-full h-11 justify-start text-left font-normal border-2", !lossForm.product && "text-muted-foreground")}
                      onClick={() => setIsProductLookupOpen(true)}
                    >
                      {lossForm.product ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-black uppercase">{lossForm.product.name}</span>
                          <span className="text-[10px] text-muted-foreground">{t('menu.management.currentStock')}: {lossForm.product.quantity} {t('inventory.unitTypes.piece')}</span>
                        </div>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          {t('common.search')}...
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('inventory.table.quantity')}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={lossForm.quantity === 0 ? '' : lossForm.quantity}
                      onChange={(e) => setLossForm(f => ({ ...f, quantity: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                      onBlur={() => { if (lossForm.quantity === '') setLossForm(f => ({ ...f, quantity: 1 })) }}
                      className="h-11 text-lg font-mono font-bold border-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('menu.program.reason')}</Label>
                    <Select 
                      value={lossForm.reason} 
                      onValueChange={(v: 'expired' | 'broken' | 'theft' | 'other') => setLossForm(f => ({ ...f, reason: v }))}
                    >
                      <SelectTrigger className="h-11 border-2 font-bold">
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
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('menu.program.notes')}</Label>
                    <Textarea
                      value={lossForm.notes}
                      onChange={(e) => setLossForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="..."
                      rows={2}
                      className="border-2"
                    />
                  </div>

                  <Button 
                    onClick={() => {
                      if (confirm(t('menu.management.confirmLoss', { qty: lossForm.quantity, name: lossForm.product?.name }))) {
                        handleRecordLoss();
                      }
                    }} 
                    disabled={!lossForm.product || lossForm.quantity <= 0}
                    className="w-full h-12 bg-danger hover:bg-danger/90 text-white font-bold uppercase tracking-widest"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {t('menu.management.validateLoss')}
                  </Button>
                </CardContent>
              </Card>

              {/* Low stock warning */}
              {lowStockQuery.total > 0 && (
                <Card className="border-warning/50">
                  <CardHeader className="py-2 bg-warning/10">
                    <CardTitle className="text-xs flex items-center gap-2 text-warning uppercase">
                      <AlertTriangle className="h-3 w-3" />
                      {t('inventory.lowStock')} ({lowStockQuery.total})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[150px]">
                      <Table>
                        <TableBody>
                          {lowStockQuery.results.map(p => (
                            <TableRow key={p.id} className="h-8 border-b">
                              <TableCell className="text-[10px] font-bold uppercase truncate max-w-[150px]">{p.name}</TableCell>
                              <TableCell className="text-[10px] text-right text-warning font-bold font-mono">
                                {p.quantity} {t('inventory.unitTypes.piece')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card className="h-full">
                <CardHeader className="py-3 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-xs uppercase font-mono tracking-widest">{t('menu.management.lossHistory')}</CardTitle>
                  <OfflineIndicator />
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.time')}</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold">{t('sidebar.inventory')}</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-center">{t('inventory.table.quantity')}</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.reason')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {todayLosses.map(mov => (
                          <TableRow key={mov.id} className="h-11 border-b">
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {format(new Date(mov.date), 'HH:mm')}
                            </TableCell>
                            <TableCell className="text-xs font-bold uppercase">{mov.product_name}</TableCell>
                            <TableCell className="text-xs text-center font-bold text-danger font-mono">-{mov.quantity}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[9px] uppercase border-danger text-danger">
                                {t(`menu.management.reasons.${mov.reason?.replace('Perte: ', '')}`) || mov.reason?.replace('Perte: ', '') || t('common.other')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {todayLosses.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-20 text-xs text-muted-foreground uppercase font-mono tracking-widest">
                              {t('menu.management.noLossToday')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            
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