import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { LocalDatabase } from '@/services/LocalDatabase';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Card, 
  CardContent, 
  CardHeader, 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from 'react-i18next';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { ScrollText, Search, User, Loader2, AlertCircle, Database, Wrench, Trash2, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  timestamp: string;
  user_id?: string;
  action_type: string;
  entity_affected?: string;
  entity_id?: string;
  old_value?: string;
  new_value?: string;
  ip_address?: string;
  store_id?: string;
}

export default function AuditLogsPage() {
  const { t, i18n } = useTranslation();
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfDay(subDays(new Date(), 7)),
    to: endOfDay(new Date()),
  });
  const [searchQuery, setSearchQuery] = useState('');
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
  const { stores } = useMasterDataStore();

  const handleRepairDb = async () => {
    if (!confirm(t('audit.repairConfirm', 'Voulez-vous vraiment lancer la réparation de la base de données ?'))) return;
    
    try {
      if (!isLocalFirst) return;
      const headers = await OfflineAuthService.getAuthHeaders();
      const res = await smartFetch(`${localBridgeBaseUrl}/system-repair`, {
        method: 'POST',
        headers: { ...headers }
      });
      
      if (res.ok) {
        toast({ title: t('common.success'), description: t('audit.repairSuccess') });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: t('common.error'), description: data.message || t('common.error'), variant: "destructive" });
      }
    } catch (e) {
      toast({ title: t('common.error'), description: t('common.failedToLoad'), variant: "destructive" });
    }
  };

  const handleHardReset = async () => {
    if (!confirm(t('audit.hardResetConfirm'))) return;
    
    try {
      if (!isLocalFirst) return;
      const headers = await OfflineAuthService.getAuthHeaders();
      const res = await smartFetch(`${localBridgeBaseUrl}/system-hard-reset`, {
        method: 'POST',
        headers: { ...headers }
      });
      
      if (res.ok) {
        // Clear IndexedDB
        await LocalDatabase.clearAll();
        
        // Clear LocalStorage & SessionStorage
        localStorage.clear();
        sessionStorage.clear();

        // Clear Zustand stores
        useMasterDataStore.getState().clearAll();

        toast({ title: t('audit.wiped'), description: t('audit.resetMessage') });
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: t('common.error'), description: data.message || t('common.error'), variant: "destructive" });
      }
    } catch (e) {
      console.error(e);
      toast({ title: t('common.error'), description: t('common.failedToLoad'), variant: "destructive" });
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', actionFilter, storeFilter, dateRange],
    queryFn: async () => {
      try {
        if (isLocalFirst) {
            const headers = await OfflineAuthService.getAuthHeaders();
            if (!headers) throw new Error('NotAuthenticated');
            
            const params = new URLSearchParams();
            if (actionFilter !== 'all') params.set('action_type', actionFilter);
            if (storeFilter !== 'all') params.set('store_id', storeFilter);
            params.set('from', dateRange.from.toISOString());
            params.set('to', dateRange.to.toISOString());
            params.set('limit', '500');
  
            const response = await smartFetch(`${localBridgeBaseUrl}/rest/v1/audit_logs?${params.toString()}`, {
              headers: headers
            });
            
            if (!response.ok) {
              const errBody = await response.json().catch(() => ({}));
              throw new Error(errBody.message || 'Failed to fetch logs');
            }
            return response.json() as Promise<{ data: AuditLog[], total: number }>;
        } else {
            // Online mode (Master)
            const { supabase } = getDataClient();
            let q = supabase.from('audit_logs').select('*', { count: 'exact' });
            
            if (actionFilter !== 'all') q = q.eq('action_type', actionFilter);
            if (storeFilter !== 'all') q = q.eq('store_id', storeFilter);
            q = q.gte('timestamp', dateRange.from.toISOString());
            q = q.lte('timestamp', dateRange.to.toISOString());
            q = q.order('timestamp', { ascending: false }).limit(500);

            const { data: logs, count, error } = await q;
            if (error) throw error;
            return { data: (logs || []) as AuditLog[], total: count || 0 };
        }
      } catch (err: any) {
        console.error('Audit logs fetch error:', err);
        throw err;
      }
    },
    retry: 1
  });

  const filteredLogs = useMemo(() => {
    if (!data?.data) return [];
    return data.data.filter(log => 
        (log.action_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.user_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.entity_affected || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.new_value || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  const getLocale = () => {
    if (i18n.language === 'fr' || i18n.language === 'bm') return fr;
    return enUS;
  };

  const formatLogDate = (timestamp: string) => {
    try {
      if (!timestamp) return '—';
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return t('common.invalidDate');
      return format(date, 'dd/MM HH:mm:ss', { locale: getLocale() });
    } catch (err) {
      return t('common.invalidDate');
    }
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes('delete')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (action.includes('login')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (action.includes('price')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (action.includes('inventory')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
  };

  const translateAction = (action: string) => {
    switch (action) {
      case 'user_login': return t('audit.login');
      case 'price_change': return t('audit.priceChange');
      case 'inventory_movement': return t('audit.inventory');
      case 'sale_deletion': return t('audit.saleDeletion');
      case 'product_creation': return t('audit.productCreation', 'Création Produit');
      case 'product_update': return t('audit.productUpdate', 'Maj Produit');
      default: return action;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2 uppercase">
            <ScrollText className="h-8 w-8 text-primary" />
            {t('sidebar.systemLogs')}
          </h1>
          <p className="text-muted-foreground font-medium">
            {t('analytics.description')}
          </p>
        </div>
        <div className="flex gap-2">
          {isLocalFirst && (
            <Button variant="destructive" size="sm" onClick={handleRepairDb} className="font-bold uppercase tracking-widest text-[10px]">
              <Wrench className="h-4 w-4 mr-2" />
              {t('audit.repairDb')}
            </Button>
          )}
          <Button variant="outline" size="sm" className="border-red-500 text-red-500 hover:bg-red-50 font-bold uppercase tracking-widest text-[10px]" onClick={handleHardReset}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t('audit.hardReset')}
          </Button>
        </div>
      </div>

      <Card className="border-2 shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 border-2"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-2 font-mono text-xs">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>

              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="w-[160px] h-9 border-2">
                  <Filter className="h-3 w-3 mr-2 opacity-50" />
                  <SelectValue placeholder={t('sidebar.stores')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.allStores', 'Tous les magasins')}</SelectItem>
                  {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[160px] h-9 border-2">
                  <SelectValue placeholder={t('audit.actionType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="user_login">{t('audit.login')}</SelectItem>
                  <SelectItem value="price_change">{t('audit.priceChange')}</SelectItem>
                  <SelectItem value="inventory_movement">{t('audit.inventory')}</SelectItem>
                  <SelectItem value="sale_deletion">{t('audit.saleDeletion')}</SelectItem>
                  <SelectItem value="product_creation">{t('audit.productCreation', 'Créations')}</SelectItem>
                  <SelectItem value="product_update">{t('audit.productUpdate', 'Modifications')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm border-b-2">
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[140px] font-bold uppercase text-[10px]">{t('storeDetails.sales.table.date')}</TableHead>
                  <TableHead className="w-[150px] font-bold uppercase text-[10px]">{t('sidebar.team')}</TableHead>
                  <TableHead className="w-[120px] font-bold uppercase text-[10px]">{t('common.actions')}</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">{t('inventory.table.name')}</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] text-right">{t('common.details', 'Détails')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                        <span className="text-xs font-bold uppercase tracking-widest opacity-50">{t('common.loading')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center text-destructive">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <span className="font-bold uppercase text-xs">
                        {error instanceof Error && error.message === 'NotAuthenticated' 
                          ? t('audit.sessionExpired') 
                          : (error instanceof Error ? error.message : t('audit.errorLoadingLogs'))}
                      </span>
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center text-muted-foreground opacity-50">
                      <Database className="h-8 w-8 mx-auto mb-2" />
                      <span className="font-bold uppercase text-xs tracking-widest">{t('common.noData')}</span>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="h-12 border-b hover:bg-muted/5 transition-colors">
                      <TableCell className="font-mono text-[10px] whitespace-nowrap opacity-70">
                        {formatLogDate(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[11px] font-bold truncate max-w-[120px] uppercase">{log.user_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter", 
                            getActionBadgeClass(log.action_type)
                        )}>
                          {translateAction(log.action_type)}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px] font-bold uppercase">
                        {log.entity_affected} <span className="opacity-30 font-mono text-[9px] ml-1">({log.entity_id?.slice(0, 8)})</span>
                      </TableCell>
                      <TableCell className="text-[10px] text-right text-muted-foreground max-w-[300px] truncate font-mono">
                        {log.old_value && <span className="text-red-500/70 line-through mr-1">{log.old_value}</span>}
                        {log.new_value && <span className="text-green-600 font-bold">{log.new_value}</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}