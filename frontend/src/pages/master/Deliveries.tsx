import { useState, useEffect, useCallback } from 'react';
import { Delivery, Store, DeliveryStatus } from '@/types';
import { useDeliveryRealtime } from '@/hooks/useDeliveryRealtime';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { TruckIcon, Search, Package, CheckCircle, Clock, Download, FileText, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ExportService } from '@/services/ExportService';
import { useTranslation } from 'react-i18next';
import { useSelection } from '@/hooks/useSelection';
import { useFormatters } from '@/utils/formatting';

export default function DeliveriesPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatDate } = useFormatters();
  const { deliveries, loading, refetch } = useDeliveryRealtime();
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
  const [stores, setStores] = useState<Store[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const useLocalBridge = isLocalFirst;

  const localBridgeRequest = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    if (!useLocalBridge) {
      throw new Error('LocalBridge mode is not enabled.');
    }
    const headers = await OfflineAuthService.getAuthHeaders();
    if (!headers) {
      throw new Error('LocalBridge session expired. Please sign in again.');
    }
    const response = await fetch(`${localBridgeBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...headers,
      },
    });
    let payload: { message?: string } | null = null;
    if (response.status !== 204) {
      try {
        payload = await response.json();
      } catch (error) {
        // ignore
      }
    }
    if (!response.ok) {
      const message = payload?.message || 'LocalBridge request failed';
      throw new Error(message);
    }
    return payload as T;
  }, [localBridgeBaseUrl, useLocalBridge]);

  const loadStores = useCallback(async () => {
    const { data, error } = await OfflineStoreService.getStores();
    if (!error) {
      setStores(data || []);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const filteredDeliveries = deliveries.filter((delivery) => {
    const matchesSearch =
      delivery.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.delivery_address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || delivery.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const storeMap = stores.reduce((acc, store) => {
    acc[store.id] = store.name;
    return acc;
  }, {} as Record<string, string>);

  const exportLabels = {
    date: t('deliveries.export.columns.date'),
    customer: t('deliveries.export.columns.customer'),
    phone: t('pos.totals.phone'),
    address: t('deliveries.export.columns.address'),
    status: t('deliveries.export.columns.status'),
    deliverer: t('deliveries.export.columns.deliverer'),
    store: t('sidebar.stores')
  };

  const selection = useSelection(filteredDeliveries);

  const handleBulkDelete = async () => {
    if (selection.selectedCount === 0) return;

    const deletePromises = selection.selectedItems.map((delivery) =>
      useLocalBridge
        ? localBridgeRequest(`/rest/v1/deliveries/${delivery.id}`, { method: 'DELETE' })
        : supabase.from('deliveries').delete().eq('id', delivery.id)
    );

    const results = await Promise.allSettled(deletePromises);
    const errors = results.filter((result) => {
      if (result.status === 'rejected') return true;
      return !!(result.value as { error?: string })?.error;
    });

    if (errors.length > 0) {
      toast({
        title: t('common.error'),
        description: t('deliveries.failedToDelete', { count: errors.length }),
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('common.success'),
        description: t('deliveries.deletedDeliveries', { count: selection.selectedCount }),
      });
    }

    selection.clearSelection();
    refetch();
  };

  const pendingCount = deliveries.filter(d => d.status === 'pending').length;
  const inTransitCount = deliveries.filter(d => d.status === 'in_transit').length;
  const deliveredCount = deliveries.filter(d => d.status === 'delivered').length;

  const getStatusBadge = (status: DeliveryStatus) => {
    const variants: Record<DeliveryStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pending: { variant: 'secondary', label: t('deliveries.pending') },
      assigned: { variant: 'outline', label: t('deliveries.assigned') },
      in_transit: { variant: 'default', label: t('deliveries.inTransit') },
      delivered: { variant: 'default', label: t('deliveries.delivered') },
      cancelled: { variant: 'destructive', label: t('deliveries.cancelled') },
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

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
                <Skeleton className="h-8 w-16" />
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
          <h1 className="text-3xl font-bold">{t('deliveries.title')}</h1>
          <p className="text-muted-foreground">{t('deliveries.trackAndManage')}</p>
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
                const exportData = ExportService.formatDeliveriesForExport(deliveries, storeMap, exportLabels);
                ExportService.exportToCSV(exportData, 'deliveries');
                toast({ title: t('export.success') });
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              {t('export.csv')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const exportData = ExportService.formatDeliveriesForExport(deliveries, storeMap, exportLabels);
                ExportService.exportToExcel(exportData, 'deliveries', t('deliveries.export.sheetName'));
                toast({ title: t('export.success') });
              }}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t('export.excel')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const exportData = ExportService.formatDeliveriesForExport(deliveries, storeMap, exportLabels);
                const columns = [
                  { header: exportLabels.date, dataKey: exportLabels.date },
                  { header: exportLabels.customer, dataKey: exportLabels.customer },
                  { header: exportLabels.store, dataKey: exportLabels.store },
                  { header: exportLabels.address, dataKey: exportLabels.address },
                  { header: exportLabels.status, dataKey: exportLabels.status },
                  { header: exportLabels.deliverer, dataKey: exportLabels.deliverer },
                ];
                ExportService.exportToPDF(exportData, 'deliveries', t('deliveries.export.reportTitle'), columns);
                toast({ title: t('export.success') });
              }}
            >
              <FileIcon className="h-4 w-4 mr-2" />
              {t('export.pdf')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('deliveries.pending')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">{t('deliveries.awaitingAssignment')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('deliveries.inTransit')}</CardTitle>
            <TruckIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inTransitCount}</div>
            <p className="text-xs text-muted-foreground">{t('deliveries.inProgress')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('deliveries.delivered')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveredCount}</div>
            <p className="text-xs text-muted-foreground">{t('deliveries.completed')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('deliveries.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('deliveries.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('deliveries.allStatuses')}</SelectItem>
            <SelectItem value="pending">{t('deliveries.pending')}</SelectItem>
            <SelectItem value="assigned">{t('deliveries.assigned')}</SelectItem>
            <SelectItem value="in_transit">{t('deliveries.inTransit')}</SelectItem>
            <SelectItem value="delivered">{t('deliveries.delivered')}</SelectItem>
            <SelectItem value="cancelled">{t('deliveries.cancelled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selection.hasSelection && (
        <Card className="border-primary">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selection.selectedCount} {t('common.selected')}
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
                  <TruckIcon className="h-4 w-4 mr-2" />
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
            <Package className="h-5 w-5" />
            {t('deliveries.title')}
          </CardTitle>
          <CardDescription>
            {t('deliveries.title')}: {filteredDeliveries.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDeliveries.length === 0 ? (
            <div className="text-center py-12">
              <TruckIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('deliveries.noDeliveriesMatch')}</p>
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
                    <TableHead>{t('deliveries.date')}</TableHead>
                    <TableHead>{t('deliveries.customerName')}</TableHead>
                    <TableHead>{t('deliveries.deliveryAddress')}</TableHead>
                    <TableHead>{t('deliveries.customerPhone')}</TableHead>
                    <TableHead>{t('deliveries.status')}</TableHead>
                    <TableHead>{t('stores.title')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeliveries.map((delivery) => {
                    const store = stores.find(s => s.id === delivery.store_id);
                    return (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <Checkbox
                            checked={selection.isSelected(delivery.id)}
                            onCheckedChange={() => selection.toggleSelect(delivery.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {formatDate(delivery.created_at)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {delivery.customer_name}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {delivery.delivery_address}
                        </TableCell>
                        <TableCell>{delivery.customer_phone}</TableCell>
                        <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                        <TableCell>{store?.name || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
