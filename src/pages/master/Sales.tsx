import { useState, useEffect, useMemo } from 'react';
import { OfflineDataService, SaleWithItems } from '@/services/OfflineDataService';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { Store } from '@/types';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ShoppingCart, Search, Trash2, Coins, TrendingUp, Download, FileText, FileSpreadsheet, File, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ExportService } from '@/services/ExportService';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useFormatters } from '@/utils/formatting';
import { useSelection } from '@/hooks/useSelection';
import { cn } from '@/lib/utils';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { OfflineTeamService } from '@/services/OfflineTeamService';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CashClosingsTab } from '@/components/master/Sales/CashClosingsTab';

export default function SalesPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { formatCurrency, formatDate } = useFormatters();
  const { selectedStoreIds, isAllStoresSelected, version } = useMasterDashboardStore();
  const { setUsers } = useMasterDataStore();

  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [activeTab, setActiveTab] = useState('list');
  const [stores, setStores] = useState<Store[]>([]);
  const [workerMap, setWorkerMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    const handleDataUpdated = (e: CustomEvent) => {
      if (e.detail?.type === 'sales' || e.detail?.type === 'stores') {
        loadData();
      }
    };
    window.addEventListener('localDbDataUpdated', handleDataUpdated as EventListener);
    return () => {
      window.removeEventListener('localDbDataUpdated', handleDataUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [dateRange, selectedStoreIds, isAllStoresSelected, version]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [storesRes, workersRes] = await Promise.all([
        OfflineStoreService.getStores({ notify: false }),
        OfflineTeamService.getAllUsers()
      ]);
      
      const allStores = storesRes.data || [];
      setStores(allStores);

      const wMap: Record<string, string> = {};
      if (user?.id) wMap[user.id] = user.full_name || user.email || 'Master';

      if (workersRes.data) {
        workersRes.data.forEach(w => { if (w.id) wMap[w.id] = w.full_name || w.email || 'Unknown'; });
        setUsers(workersRes.data.map(u => ({ id: u.id, email: u.email, full_name: u.full_name || u.email })));
      }
      setWorkerMap(wMap);

      const activeStoreIds = isAllStoresSelected ? allStores.map(s => s.id) : selectedStoreIds;

      const salesPromises = activeStoreIds.map(sid => 
        OfflineDataService.getSales(sid, dateRange?.from, dateRange?.to)
      );
      
      const results = await Promise.all(salesPromises);
      const allSales: SaleWithItems[] = [];
      results.forEach(data => { if (data) allSales.push(...data); });

      setSales(allSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) {
      console.error('Failed to load sales:', error);
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSale) return;
    const { error } = await OfflineSalesService.deleteSale(selectedSale.id);
    if (error) toast({ title: t('common.error'), variant: 'destructive' });
    else {
      toast({ title: t('common.success') });
      loadData();
    }
    setDeleteDialogOpen(false);
    setSelectedSale(null);
  };

  const exportLabels = {
    date: t('sales.table.date'),
    item: t('sales.table.item'),
    quantity: t('sales.table.quantity'),
    unitPrice: t('sales.table.unitPrice'),
    total: t('sales.table.total'),
    worker: t('sales.table.worker'),
    store: t('sales.table.store'),
    customer: t('sales.table.customer'),
    invoice: t('sales.invoice_number'),
    orderRef: t('menu.program.orderRef')
  };

  const filteredSales = sales.filter((sale) => {
    // Do not include proformas in the main sales tracking
    if (sale.sale_type === 'proforma') return false;

    const totalPrice = Number(sale.total_price);
    const itemNames = sale.sale_items?.map(i => i.product_name.toLowerCase()).join(' ') || '';
    const matchesSearch = sale.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) || itemNames.includes(searchQuery.toLowerCase()) || sale.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStore = selectedStoreFilter === 'all' || sale.store_id === selectedStoreFilter;
    const matchesPayment = paymentMethodFilter === 'all' || sale.payment_method === paymentMethodFilter;
    const matchesMinPrice = minPrice === '' || totalPrice >= parseFloat(minPrice);
    const matchesMaxPrice = maxPrice === '' || totalPrice <= parseFloat(maxPrice);
    return matchesSearch && matchesStore && matchesPayment && matchesMinPrice && matchesMaxPrice;
  });

  const storeMap = useMemo(() => {
    const map: Record<string, string> = {};
    stores.forEach(s => { map[s.id] = s.name; });
    return map;
  }, [stores]);

  const selection = useSelection(filteredSales);

  const totalSales = filteredSales.reduce((sum, sale) => sum + Number(sale.total_price), 0);
  const averageSale = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

  if (loading && sales.length === 0) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border-2 shadow-xl">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{t('sales.title')}</h1>
          <p className="text-muted-foreground font-black uppercase tracking-[0.3em] text-[9px] mt-2 opacity-60">{t('sales.manageSales')} • MASTER MODE</p>
        </div>
        <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={loadData} className="h-10 w-10 border-2"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
            {activeTab === 'list' && (
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-2 font-black uppercase text-[10px] tracking-widest"><Download className="h-4 w-4 mr-2" />{t('export.title')}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { const d = ExportService.formatSalesForExport(sales as any, workerMap, storeMap, exportLabels); ExportService.exportToCSV(d, 'sales'); }}><FileText className="h-4 w-4 mr-2" />CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { const d = ExportService.formatSalesForExport(sales as any, workerMap, storeMap, exportLabels); ExportService.exportToExcel(d, 'sales', 'Sales'); }}><FileSpreadsheet className="h-4 w-4 mr-2" />EXCEL</DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const exportData = ExportService.formatSalesForExport(sales, workerMap, storeMap, exportLabels);
                      const columns = [
                        { header: exportLabels.date, dataKey: exportLabels.date },
                        { header: exportLabels.invoice, dataKey: exportLabels.invoice },
                        { header: exportLabels.item, dataKey: exportLabels.item },
                        { header: exportLabels.quantity, dataKey: exportLabels.quantity },
                        { header: exportLabels.total, dataKey: exportLabels.total },
                        { header: exportLabels.worker, dataKey: exportLabels.worker },
                        { header: exportLabels.store, dataKey: exportLabels.store },
                      ];
                      ExportService.exportToPDF(exportData, 'sales', t('sales.title'), columns);
                    }}
                  >
                    <File className="h-4 w-4 mr-2" />
                    PDF
                  </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
            )}
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/20 border-2 p-1 rounded-xl mb-6">
          <TabsTrigger value="list" className="font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-lg rounded-lg border-2 border-transparent data-[state=active]:border-border">
            <TrendingUp className="h-4 w-4 mr-2" />
            {t('sales.title')}
          </TabsTrigger>
          <TabsTrigger value="closings" className="font-black uppercase tracking-widest text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-lg rounded-lg border-2 border-transparent data-[state=active]:border-border">
            <Coins className="h-4 w-4 mr-2" />
            {t('menu.program.cashClosing')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-primary shadow-lg"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('sales.totalSales')}</CardTitle></CardHeader><CardContent><div className="text-2xl font-black tabular-nums">{formatCurrency(totalSales)}</div></CardContent></Card>
            <Card className="border-l-4 border-l-success shadow-lg"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('sales.averageSale')}</CardTitle></CardHeader><CardContent><div className="text-2xl font-black tabular-nums">{formatCurrency(averageSale)}</div></CardContent></Card>
            <Card className="border-l-4 border-l-blue-500 shadow-lg"><CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('sales.totalCount')}</CardTitle></CardHeader><CardContent><div className="text-2xl font-black tabular-nums">{filteredSales.length}</div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-2xl border-2 shadow-inner">
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase tracking-widest ml-1">{t('menu.program.date')}</Label>
              <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-black text-[10px] bg-background h-10 border-2"><ShoppingCart className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</> : format(dateRange.from, "dd/MM/yy")) : <span>Date...</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar initialFocus mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent></Popover>
            </div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase tracking-widest ml-1">{t('sidebar.stores')}</Label>
              <Select value={selectedStoreFilter} onValueChange={setSelectedStoreFilter}><SelectTrigger className="w-full h-10 bg-background border-2 font-black uppercase text-[10px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all" className="font-black uppercase text-[10px]">{t('sales.allStores')}</SelectItem>{stores.map(s => <SelectItem key={s.id} value={s.id} className="font-black uppercase text-[10px]">{s.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase tracking-widest ml-1">{t('sales.paymentMethod')}</Label>
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}><SelectTrigger className="w-full h-10 bg-background border-2 font-black uppercase text-[10px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all" className="font-black uppercase text-[10px]">{t('common.all')}</SelectItem><SelectItem value="cash" className="font-black uppercase text-[10px]">{t('common.cash')}</SelectItem><SelectItem value="credit" className="font-black uppercase text-[10px]">{t('common.credit')}</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-[9px] font-black uppercase tracking-widest ml-1">{t('common.search')}</Label><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder={t('sales.searchSales')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10 border-2 font-black uppercase tracking-tighter" /></div></div>
          </div>

          <Card className="border-2 shadow-2xl overflow-hidden rounded-2xl">
            <CardContent className="p-0 overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 border-b-2 shadow-md">
                  <TableRow className="h-14">
                    <TableHead className="font-black uppercase tracking-widest text-[9px] pl-6">{t('sales.date')}</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[9px]">Type/Table</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[9px]">{t('sales.table.store')}</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[9px]">{t('sales.table.item')}</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[9px]">{t('sales.table.customer')}</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[9px]">{t('sales.table.total')}</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[9px]">Statut Cuisine</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[9px]">{t('sales.cashier')}</TableHead>
                    <TableHead className="font-black uppercase tracking-widest text-[9px]">Serveur</TableHead>
                    <TableHead className="text-right font-black uppercase tracking-widest text-[9px] pr-6">{t('sales.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => {
                    const total = Number(sale.total_price);
                    return (
                      <TableRow key={sale.id} className="border-b-2 hover:bg-muted/30 h-16 group transition-colors">
                        <TableCell className="font-mono text-[10px] pl-6 font-black opacity-60">{formatDate(sale.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase">
                              {sale.order_type === 'dine_in' ? 'Sur place' : sale.order_type === 'takeaway' ? 'A emporter' : sale.order_type === 'delivery' ? 'Livraison' : sale.order_type || '-'}
                            </span>
                            {sale.table_number && (
                              <span className="text-[8px] font-mono opacity-60">Table {sale.table_number}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="font-black uppercase text-[9px] border-2 bg-background">{stores.find(s => s.id === sale.store_id)?.name || '?'}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase tracking-tighter truncate max-w-[200px]">{(sale.items?.length ? sale.items : sale.sale_items)?.map(i => i.product_name || i.designation || 'Unknown').join(', ') || '?'}</span>
                            <span className="text-[8px] font-mono opacity-40">#{sale.invoice_number || sale.id.slice(0, 8)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] font-black uppercase">{sale.customer_name || '-'}</TableCell>
                        <TableCell>
                            <div className="flex flex-col gap-1">
                                <span className="font-black text-xs tabular-nums">{formatCurrency(total)}</span>
                                <div className="flex gap-1">
                                  <Badge variant="outline" className={cn("text-[8px] h-4 py-0 font-black uppercase border-2", sale.payment_method === 'credit' ? "text-danger border-danger/20" : "text-success border-success/20")}>{sale.payment_method}</Badge>
                                  <Badge variant={sale.payment_status === 'paid' ? 'success' : 'warning'} className="text-[8px] h-4 py-0 font-black uppercase">
                                    {sale.payment_status}
                                  </Badge>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[8px] h-4 py-0 font-black uppercase border-2",
                              sale.order_status === 'ready' && "text-success border-success/20 bg-success/5",
                              sale.order_status === 'preparing' && "text-blue-500 border-blue-500/20 bg-blue-50",
                              sale.order_status === 'pending' && "text-warning border-warning/20 bg-warning/5",
                              sale.order_status === 'served' && "text-muted-foreground border-muted-foreground/20 bg-muted/5",
                              !sale.order_status && "text-muted-foreground border-muted-foreground/20"
                            )}
                          >
                            {sale.order_status === 'pending' ? 'En attente' : sale.order_status === 'preparing' ? 'Préparation' : sale.order_status === 'ready' ? 'Prêt' : sale.order_status === 'served' ? 'Servi' : sale.order_status || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] font-black uppercase opacity-60">{workerMap[sale.worker_id || ''] || '-'}</TableCell>
                        <TableCell className="text-[10px] font-black uppercase opacity-60">{sale.waiter_id ? (workerMap[sale.waiter_id] || sale.waiter_id) : '-'}</TableCell>
                        <TableCell className="text-right pr-6 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedSale(sale); setDeleteDialogOpen(true); }} className="h-8 w-8 text-danger border-2"><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closings">
          <CashClosingsTab />
        </TabsContent>
      </Tabs>

      <ConfirmActionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={t('sales.deleteConfirm')}
        description={t('sales.deleteConfirmDescription')}
        variant="destructive"
      />
    </div>
  );
}
