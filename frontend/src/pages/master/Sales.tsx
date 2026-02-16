import { useState, useEffect } from 'react';
import { SalesService } from '@/services/SalesService';
import { StoreService } from '@/services/StoreService';
import { SaleWithDetails, Store } from '@/types';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ShoppingCart, Search, Trash2, Coins, TrendingUp, Download, FileText, FileSpreadsheet, File } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ExportService } from '@/services/ExportService';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useSelection } from '@/hooks/useSelection';

export default function SalesPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatCurrency, formatDate } = useFormatters();
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [salesRes, storesRes] = await Promise.all([
      SalesService.getSales(),
      StoreService.getStores(),
    ]);

    if (salesRes.error) {
      toast({
        title: t('common.error'),
        description: t('common.failedToLoad'),
        variant: 'destructive',
      });
    } else {
      setSales(salesRes.data || []);
    }

    if (storesRes.error) {
      toast({
        title: t('common.error'),
        description: t('common.failedToLoad'),
        variant: 'destructive',
      });
    } else {
      setStores(storesRes.data || []);
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedSale) return;

    const { error } = await SalesService.deleteSale(selectedSale.id);
    if (error) {
      toast({
        title: t('common.error'),
        description: t('sales.failedToDeleteSale'),
        variant: 'destructive',
      });
    } else {
      toast({ title: t('common.success'), description: t('sales.saleDeletedSuccessfully') });
      loadData();
    }
    setDeleteDialogOpen(false);
    setSelectedSale(null);
  };

  const openDeleteDialog = (sale: SaleWithDetails) => {
    setSelectedSale(sale);
    setDeleteDialogOpen(true);
  };

  const filteredSales = sales.filter((sale) => {
    const itemNames = sale.items?.map(i => i.product_name.toLowerCase()).join(' ') || '';
    const matchesSearch =
      sale.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      itemNames.includes(searchQuery.toLowerCase());
    const matchesStore =
      selectedStoreFilter === 'all' || sale.store_id === selectedStoreFilter;
    return matchesSearch && matchesStore;
  });

  const selection = useSelection(filteredSales);

  const handleBulkDelete = async () => {
    if (selection.selectedCount === 0) return;

    const deletePromises = selection.selectedItems.map(sale => 
      SalesService.deleteSale(sale.id)
    );

    const results = await Promise.all(deletePromises);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      toast({
        title: t('common.error'),
        description: t('sales.failedToDeleteSales', { count: errors.length }),
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('common.success'),
        description: t('sales.deletedSales', { count: selection.selectedCount }),
      });
    }

    selection.clearSelection();
    loadData();
  };

  const totalSales = filteredSales.reduce((sum, sale) => sum + Number(sale.total_price), 0);
  const averageSale = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

  if (loading) {
    return (
      <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
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

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('sales.title')}</h1>
          <p className="text-muted-foreground">{t('sales.manageSales')}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              {t('export.title')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                const exportData = ExportService.formatSalesForExport(sales);
                ExportService.exportToCSV(exportData, 'sales');
                toast({ title: t('export.success') });
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              {t('export.csv')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const exportData = ExportService.formatSalesForExport(sales);
                ExportService.exportToExcel(exportData, 'sales', t('sales.exportSheetName'));
                toast({ title: t('export.success') });
              }}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t('export.excel')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const exportData = ExportService.formatSalesForExport(sales);
                const columns = [
                  { header: t('sales.export.columns.date'), dataKey: 'Date' },
                  { header: t('sales.export.columns.item'), dataKey: 'Item' },
                  { header: t('sales.export.columns.quantity'), dataKey: 'Quantity' },
                  { header: t('sales.export.columns.total'), dataKey: 'Total' },
                  { header: t('sales.export.columns.worker'), dataKey: 'Worker' },
                  { header: t('sales.export.columns.customer'), dataKey: 'Customer' },
                ];
                ExportService.exportToPDF(exportData, 'sales', t('sales.export.reportTitle'), columns);
                toast({ title: t('export.success') });
              }}
            >
              <File className="h-4 w-4 mr-2" />
              {t('export.pdf')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('sales.totalSales')}</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
            <p className="text-xs text-muted-foreground">
              {filteredSales.length} {t('common.transactions')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('sales.averageSale')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageSale)}</div>
            <p className="text-xs text-muted-foreground">{t('common.perTransaction')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('sales.totalCount')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSales.length}</div>
            <p className="text-xs text-muted-foreground">{t('sales.salesTransactions')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('sales.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedStoreFilter} onValueChange={setSelectedStoreFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('sales.filterByStore')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sales.allStores')}</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selection.hasSelection && (
        <Card className="border-primary">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selection.selectedCount} {t('common.itemsSelected')}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selection.clearSelection}
                >
                  {t('common.clear')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('common.deleteSelected')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t('sales.salesTransactions')}
          </CardTitle>
          <CardDescription>{t('sales.salesAcrossStores')}</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('sales.noSalesMatch')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selection.isAllSelected}
                        onCheckedChange={selection.toggleAll}
                      />
                    </TableHead>
                <TableHead>{t('sales.date')}</TableHead>
                    <TableHead>{t('stores.title')}</TableHead>
                    <TableHead>{t('sales.item')}</TableHead>
                    <TableHead>{t('sales.customer')}</TableHead>
                    <TableHead>{t('sales.total')}</TableHead>
                    <TableHead>{t('sales.worker')}</TableHead>
                    <TableHead className="text-right">{t('sales.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => {
                    const saleStore = stores.find(s => s.id === sale.store_id);
                    return (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <Checkbox
                            checked={selection.isSelected(sale.id)}
                            onCheckedChange={() => selection.toggleSelect(sale.id)}
                          />
                        </TableCell>
                      <TableCell>
                          {formatDate(sale.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className="cursor-pointer hover:bg-accent"
                            onClick={() => window.location.href = `/master/stores/${sale.store_id}`}
                          >
                            {saleStore?.name || t('common.unknown')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {sale.items?.map(i => i.product_name).join(', ') || t('common.unknown')}
                        </TableCell>
                        <TableCell>{sale.customer_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {formatCurrency(Number(sale.total_price))}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {sale.worker?.full_name || sale.worker?.email || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(sale)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <ConfirmActionDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title={`${t('common.delete')} ${t('sales.title')}`}
        description={`${t('sales.deleteConfirm')} ${t('sales.deleteConfirmDescription')}`}
        variant="destructive"
      />
    </div>
  );
}
