import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

import { CashJournalView } from './Gestion/CashJournalView';
import { DashboardView } from './Gestion/DashboardView';
import { StatisticsView } from './Gestion/StatisticsView';
import { LossesView } from './Gestion/LossesView';

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
  // Real profit computed by the backend (sale_items joined to product cost).
  // Optional: an older backend that predates the field simply omits it.
  total_profit?: number;
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
if (e.detail?.type !== 'sales' && e.detail?.type !== 'sale' && e.detail?.type !== 'inventory' && e.detail?.type !== 'product') return;
      
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
  const fetchData = useCallback(async () => {
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
        // Rows carry created_at, not .date - the old comparison was always
        // against Invalid Date, always false, so every supplier payment was
        // silently missing from the journal.
        const paidAt = payment.created_at ?? payment.date;
        if (paidAt && new Date(paidAt) <= to) {
          entries.push({
            id: payment.id,
            type: 'out',
            description: `Paiement ${payment.supplier_name}`,
            amount: payment.amount,
            date: paidAt,
            category: t('menu.program.supplierPayment'),
          });
        }
      });

      // Fetch Petty Cash Transactions
      const cashTxs = await OfflineDataService.getCashTransactions(storeId, from);
      cashTxs.forEach(tx => {
        // Same dead .date read as supplier payments above - petty cash never
        // appeared in the journal either.
        const txAt = tx.created_at ?? tx.date;
        if (txAt && new Date(txAt) <= to) {
          entries.push({
            id: tx.id,
            type: tx.type,
            description: tx.description,
            amount: tx.amount,
            date: txAt,
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
  }, [storeId, t, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    
    // Real profit comes from the backend: sale_items joined to product cost,
    // proformas and deleted rows excluded. The previous figure here was
    // total_price * 0.25 - a hardcoded 25% with no relationship to cost that
    // could never show a loss, on the tile an owner judges the business by.
    // null (not 0) when the backend doesn't provide it, so the UI can say
    // "unknown" instead of quietly rendering a wrong zero.
    const totalProfit =
      typeof analytics?.total_profit === 'number' ? analytics.total_profit : null;

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
const items = (sale.items?.length ? sale.items : (sale.sale_items?.length ? sale.sale_items : []));
            items.forEach((item: any) => {
              const cat = item.category_name || item.category || t('common.other');
              categories[cat] = (categories[cat] || 0) + (item.total || item.lineTotal || 0);
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
    if (analytics?.top_products?.length) {
      return analytics.top_products.map(p => ({
        name: p.name,
        qty: p.quantity,
        revenue: p.revenue
      }));
    }
    const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales.forEach(sale => {
const items = (sale.items?.length ? sale.items : sale.sale_items) || [];
            items.forEach((item: any) => {
              const name = item.product_name || item.productName || item.designation || 'Unknown';
              if (!productSales[name]) {
                productSales[name] = { name, qty: 0, revenue: 0 };
        }
        productSales[name].qty += Number(item.quantity || 0);
        productSales[name].revenue += Number(item.total || item.lineTotal || 0);
      });
    });
    return Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales, analytics]);

          const stockHealthData = useMemo(() => {
          if (analytics?.stock_health) {
            return [
              { name: t('inventory.inStock'), value: analytics.stock_health.ok, color: '#00FF66' },
              { name: t('inventory.lowStock'), value: analytics.stock_health.low, color: '#FFD700' },
              { name: t('inventory.outOfStock'), value: analytics.stock_health.out, color: '#FF6B6B' },
            ].filter(d => d.value > 0);
          }
          // Fallback to computing from current view if analytics missing
          return [];
        }, [analytics, t]);

  // Handle loss recording - works offline
  const handleRecordLoss = async () => {
    if (!lossForm.product || Number(lossForm.quantity) <= 0) {
      toast.error(t('worker.sales.addAtLeastOne'));
      return;
    }

    try {
      const newQuantity = Math.max(0, lossForm.product.quantity - Number(lossForm.quantity));
      await OfflineDataService.updateProductStock(storeId, lossForm.product.id, newQuantity, `Perte: ${lossForm.reason}`);
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

  const renderContent = () => {switch (mode) {
      case 'consultation-caisse':
      case 'journal-caisse':
        return <CashJournalView 
          dateRange={dateRange} setDateRange={setDateRange}
          isPettyCashOpen={isPettyCashOpen} setIsPettyCashOpen={setIsPettyCashOpen}
          pettyCashForm={pettyCashForm} setPettyCashForm={setPettyCashForm}
          handleRecordPettyCash={handleRecordPettyCash} kpis={kpis} cashEntries={cashEntries}
          formatCurrency={formatCurrency} OfflineIndicator={OfflineIndicator} t={t}
        />;
      case 'tableau-bord':
        return <DashboardView 
          dateRange={dateRange} setDateRange={setDateRange}
          kpis={kpis} lowStockQuery={lowStockQuery}
          weeklyRevenue={weeklyRevenue} stockHealthData={stockHealthData}
          topProducts={topProducts} categoryData={categoryData}
          formatCurrency={formatCurrency} OfflineIndicator={OfflineIndicator} t={t}
        />;
      case 'statistiques':
        return <StatisticsView 
          dateRange={dateRange} setDateRange={setDateRange}
          sales={sales} kpis={kpis} analytics={analytics} topProducts={topProducts}
          formatCurrency={formatCurrency} OfflineIndicator={OfflineIndicator} t={t}
        />;
      case 'sorties-pertes':
        return <LossesView 
          movements={movements} lossForm={lossForm} setLossForm={setLossForm}
          handleRecordLoss={handleRecordLoss}
          isProductLookupOpen={isProductLookupOpen} setIsProductLookupOpen={setIsProductLookupOpen}
          lowStockQuery={lowStockQuery} storeId={storeId}
          OfflineIndicator={OfflineIndicator} t={t}
        />;
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