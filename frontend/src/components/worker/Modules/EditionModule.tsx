import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Search, CalendarIcon, FileText, Users, 
  ShoppingBag, Eye, WifiOff, RefreshCw, Printer
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { OfflineDataService, SaleWithItems } from '@/services/OfflineDataService';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { InvoiceDetailsDialog } from './InvoiceDetailsDialog';

interface EditionModuleProps {
  storeId: string;
  mode: 'situation-client' | 'suivi-ventes-jour' | 'suivi-ventes-produit' | 
        'suivi-ventes-factures' | 'situation-fournisseur' | 'suivi-achats-famille' | 
        'suivi-achats-jour' | 'suivi-achats-periode';
}

interface ProductFamily {
  family_name: string;
  total_quantity: number;
  total_amount: number;
}

interface Supplier {
  id: string;
  name: string;
  balance: number;
  phone: string | null;
}

interface PurchaseOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  supplier?: { name: string };
}

export function EditionModule({ storeId, mode }: EditionModuleProps) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useFormatters();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [purchasesByFamily, setPurchasesByFamily] = useState<ProductFamily[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

      const getLocale = () => {
        if (i18n.language === 'fr' || i18n.language === 'bm') return fr;
        return enUS;
      };
  
      const storeSuppliers = useMasterDataStore(state => state.suppliers);
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

  useEffect(() => {
    const fetchData = async () => {
      if (!storeId) return;
      setIsLoading(true);

      try {
        switch (mode) {
          case 'suivi-ventes-jour':
          case 'suivi-ventes-produit':
          case 'suivi-ventes-factures':
          case 'situation-client':
            const salesData = await OfflineDataService.getSales(storeId, dateRange.from, dateRange.to);
            setSales(salesData);
            break;

          case 'situation-fournisseur':
            const offlineSuppliers = storeSuppliers
              .filter(s => s.store_id === storeId)
              .map(s => ({
                id: s.id,
                name: s.name,
                balance: s.balance,
                phone: s.phone || null,
              }));
            setSuppliers(offlineSuppliers);
            break;

          case 'suivi-achats-jour':
          case 'suivi-achats-periode':
            if (!navigator.onLine) {
              setPurchases([]);
            } else {
              const { supabase } = await import('@/integrations/supabase/client');
              const { data: purchaseData } = await (supabase as any)
                .from('purchase_orders')
                .select('*, supplier:suppliers(name)')
                .eq('store_id', storeId)
                .gte('created_at', dateRange.from.toISOString())
                .lte('created_at', dateRange.to.toISOString())
                .order('created_at', { ascending: false });
              setPurchases((purchaseData as any[]) || []);
            }
            break;

          case 'suivi-achats-famille':
            if (!navigator.onLine) {
              setPurchasesByFamily([]);
            } else {
              const { supabase } = await import('@/integrations/supabase/client');
              const { data: poItems } = await (supabase as any)
                .from('purchase_items')
                .select(`quantity_ordered, unit_cost, order_id, product:products(category)`);

              const { data: ordersForFamily } = await (supabase as any)
                .from('purchase_orders')
                .select('id')
                .eq('store_id', storeId)
                .gte('created_at', dateRange.from.toISOString())
                .lte('created_at', dateRange.to.toISOString());

              const validOrderIds = new Set((ordersForFamily || []).map(o => o.id));

              const familyMap: Record<string, { total_quantity: number; total_amount: number }> = {};
              ((poItems as any[]) || []).forEach((item: any) => {
                if (!validOrderIds.has(item.order_id)) return;
                
                const family = item.product?.category || 'Non classé';
                if (!familyMap[family]) {
                  familyMap[family] = { total_quantity: 0, total_amount: 0 };
                }
                familyMap[family].total_quantity += item.quantity_ordered || 0;
                familyMap[family].total_amount += (item.quantity_ordered * item.unit_cost) || 0;
              });

              const familyData: ProductFamily[] = Object.entries(familyMap)
                .map(([family_name, data]) => ({
                  family_name,
                  total_quantity: data.total_quantity,
                  total_amount: data.total_amount,
                }))
                .sort((a, b) => b.total_amount - a.total_amount);

              setPurchasesByFamily(familyData);
            }
            break;
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error(t('common.failedToLoad'));
      }

      setIsLoading(false);
    };

    fetchData();
  }, [storeId, mode, dateRange, storeSuppliers, t]);

  const salesByProduct = useMemo(() => {
    const aggregated: Record<string, { name: string; quantity: number; total: number }> = {};
    sales.forEach(sale => {
      (sale.sale_items || []).forEach(item => {
        if (!aggregated[item.product_name]) {
          aggregated[item.product_name] = { name: item.product_name, quantity: 0, total: 0 };
        }
        aggregated[item.product_name].quantity += item.quantity;
        aggregated[item.product_name].total += item.total;
      });
    });
    return Object.values(aggregated).sort((a, b) => b.total - a.total);
  }, [sales]);

  const filteredSales = useMemo(() => 
    sales.filter(s => 
      !searchQuery || 
      s.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
    ), [sales, searchQuery]);

  const filteredSuppliers = useMemo(() =>
    suppliers.filter(s => 
      !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [suppliers, searchQuery]);

  const totalSales = useMemo(() => 
    filteredSales.reduce((sum, s) => sum + s.total_price, 0), [filteredSales]);

  const totalPurchases = useMemo(() =>
    purchases.reduce((sum, p) => sum + p.total_amount, 0), [purchases]);

  const OfflineIndicator = () => isOffline ? (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-warning/20 text-warning text-xs">
      <WifiOff className="h-3 w-3" />
      <span>{t('common.offline')}</span>
    </div>
  ) : null;

  const renderContent = () => {
    switch (mode) {
      case 'situation-client':
        return (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder={t('common.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9"
                />
              </div>
              <OfflineIndicator />
              <Button variant="outline" size="sm">
                <Search className="h-4 w-4 mr-2" />
                {t('common.search')}
              </Button>
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('menu.program.lastMovements')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t('storeDetails.sales.table.date')}</TableHead>
                        <TableHead className="text-xs">{t('pos.totals.customer')}</TableHead>
                        <TableHead className="text-xs">{t('sales.invoice_number') || 'N° Facture'}</TableHead>
                        <TableHead className="text-xs text-right">{t('inventory.fields.retailPrice')}</TableHead>
                        <TableHead className="text-xs text-center">{t('menu.management.status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.filter(s => s.customer_name).map(sale => (
                        <TableRow key={sale.id} className="h-10">
                          <TableCell className="text-xs">
                            {format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: getLocale() })}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{sale.customer_name}</TableCell>
                          <TableCell className="text-xs font-mono">{sale.invoice_number || '—'}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(sale.total_price)}</TableCell>
                          <TableCell className="text-center">
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs',
                              sale.payment_status === 'paid' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                            )}>
                              {sale.payment_status === 'paid' ? t('common.success') : t('common.credit')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSales.filter(s => s.customer_name).length === 0 && (
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

      case 'suivi-ventes-jour':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="h-4 w-4" />
                <span className="font-medium">
                  {format(dateRange.from, 'dd/MM/yyyy', { locale: getLocale() })}
                </span>
                <OfflineIndicator />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-primary">
                  {t('common.total')}: {formatCurrency(totalSales)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {filteredSales.length} {t('common.transactions')}
                </span>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="text-xs">{t('menu.program.time')}</TableHead>
                        <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                        <TableHead className="text-xs text-center">Qté</TableHead>
                        <TableHead className="text-xs text-right">P.U.</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.flatMap(sale => 
                        (sale.sale_items || []).map(item => (
                          <TableRow key={item.id} className="h-9">
                            <TableCell className="text-xs">
                              {format(new Date(sale.created_at), 'HH:mm', { locale: getLocale() })}
                            </TableCell>
                            <TableCell className="text-xs font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-xs text-center">{item.quantity}</TableCell>
                            <TableCell className="text-xs text-right">{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatCurrency(item.total)}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {filteredSales.length === 0 && (
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

      case 'suivi-ventes-factures':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                      }
                    }}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-64"
              />
              <OfflineIndicator />
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t('menu.edition.invoiceList')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t('storeDetails.sales.table.date')}</TableHead>
                        <TableHead className="text-xs">{t('sales.invoice_number') || 'N° Facture'}</TableHead>
                        <TableHead className="text-xs">{t('pos.totals.customer')}</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.map(sale => (
                        <TableRow key={sale.id} className="h-10">
                          <TableCell className="text-xs">
                            {format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: getLocale() })}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{sale.invoice_number || sale.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs font-medium">{sale.customer_name || 'Client Comptoir'}</TableCell>
                          <TableCell className="text-xs text-right font-bold">{formatCurrency(sale.total_price)}</TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedSale(sale)}>
                              <Eye className="h-4 w-4 text-primary" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSales.length === 0 && (
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

      case 'suivi-ventes-produit':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                      }
                    }}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <OfflineIndicator />
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  {t('menu.program.topProducts')} ({salesByProduct.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                        <TableHead className="text-xs text-center">{t('inventory.table.quantity')}</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesByProduct.map((item, idx) => (
                        <TableRow key={item.name} className="h-9">
                          <TableCell className="text-xs font-medium">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{item.name}</TableCell>
                          <TableCell className="text-xs text-center">{item.quantity}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{formatCurrency(item.total)}</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground">
                            {totalSales > 0 ? ((item.total / totalSales) * 100).toFixed(1) : 0}%
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

      case 'suivi-achats-jour':
      case 'suivi-achats-periode':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                      }
                    }}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2 ml-auto">
                <span className="font-bold text-primary">Total: {formatCurrency(totalPurchases)}</span>
                <OfflineIndicator />
              </div>
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  {mode === 'suivi-achats-jour' ? t('menu.edition.dailyPurchases') : t('menu.edition.periodPurchases')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t('storeDetails.sales.table.date')}</TableHead>
                        <TableHead className="text-xs">{t('menu.program.supplier')}</TableHead>
                        <TableHead className="text-xs text-center">{t('menu.management.status')}</TableHead>
                        <TableHead className="text-xs text-right">{t('common.total')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map(order => (
                        <TableRow key={order.id} className="h-10">
                          <TableCell className="text-xs">
                            {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: getLocale() })}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{order.supplier?.name || t('common.unknown')}</TableCell>
                          <TableCell className="text-center">
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs',
                              order.status === 'received' ? 'bg-success/20 text-success' : 'bg-blue-500/20 text-blue-500'
                            )}>
                              {order.status === 'received' ? t('menu.program.received') : t('menu.program.ordered')}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold">{formatCurrency(order.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                      {purchases.length === 0 && (
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

      case 'suivi-achats-famille':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(dateRange.from, 'dd/MM/yyyy')} - {format(dateRange.to, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                      }
                    }}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <OfflineIndicator />
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  {t('menu.edition.purchaseByFamily')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t('inventory.fields.family')}</TableHead>
                        <TableHead className="text-xs text-center">{t('menu.management.quantityOrdered')}</TableHead>
                        <TableHead className="text-xs text-right">{t('menu.management.totalAmount')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchasesByFamily.map((fam) => (
                        <TableRow key={fam.family_name} className="h-10">
                          <TableCell className="text-xs font-medium">{fam.family_name}</TableCell>
                          <TableCell className="text-xs text-center">{fam.total_quantity}</TableCell>
                          <TableCell className="text-xs text-right font-bold">{formatCurrency(fam.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                      {purchasesByFamily.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
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

      case 'situation-fournisseur':
        return (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder={t('common.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9"
                />
              </div>
              <OfflineIndicator />
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('menu.program.supplier')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                        <TableHead className="text-xs">{t('stores.fields.phone')}</TableHead>
                        <TableHead className="text-xs text-right">{t('menu.program.balance')}</TableHead>
                        <TableHead className="text-xs text-center">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSuppliers.map(supplier => (
                        <TableRow key={supplier.id} className="h-10">
                          <TableCell className="text-xs font-medium">{supplier.name}</TableCell>
                          <TableCell className="text-xs">{supplier.phone || '—'}</TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            {formatCurrency(supplier.balance)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs',
                              supplier.balance === 0 ? 'bg-success/20 text-success' : 
                              supplier.balance > 0 ? 'bg-warning/20 text-warning' : 'bg-danger/20 text-danger'
                            )}>
                              {supplier.balance === 0 ? t('common.success') : t('common.credit')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSuppliers.length === 0 && (
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
      <InvoiceDetailsDialog 
        sale={selectedSale} 
        onClose={() => setSelectedSale(null)} 
      />
    </div>
  );
}