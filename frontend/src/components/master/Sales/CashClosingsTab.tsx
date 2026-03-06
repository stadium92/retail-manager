import { useState, useEffect, useMemo } from 'react';
import { OfflineDataService } from '@/services/OfflineDataService';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { Store } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Search, RefreshCw, Eye, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { cn } from '@/lib/utils';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { OfflineTeamService } from '@/services/OfflineTeamService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export function CashClosingsTab() {
  const { t } = useTranslation();
  const { formatCurrency, formatDate } = useFormatters();
  const { selectedStoreIds, isAllStoresSelected } = useMasterDashboardStore();
  
  const [closings, setClosings] = useState<any[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [workerMap, setWorkerMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClosing, setSelectedClosing] = useState<any | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    loadData();
    const handleUpdate = (e: any) => {
        if (e.detail?.type === 'cash_closings') loadData();
    };
    window.addEventListener('localDbDataUpdated', handleUpdate);
    return () => window.removeEventListener('localDbDataUpdated', handleUpdate);
  }, [selectedStoreIds, isAllStoresSelected, dateRange]);

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
      if (workersRes.data) {
        workersRes.data.forEach(w => { if (w.id) wMap[w.id] = w.full_name || w.email; });
      }
      setWorkerMap(wMap);

      const activeStoreIds = isAllStoresSelected ? allStores.map(s => s.id) : selectedStoreIds;
      const promises = activeStoreIds.map(sid => OfflineDataService.getCashClosings(sid));
      const results = await Promise.all(promises);
      
      let allClosings: any[] = [];
      results.forEach(data => { if (data) allClosings.push(...data); });

      // Filter by date range
      if (dateRange?.from) {
          const from = startOfDay(dateRange.from);
          const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
          allClosings = allClosings.filter(c => {
              const d = new Date(c.created_at);
              return d >= from && d <= to;
          });
      }

      setClosings(allClosings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) {
      console.error('Failed to load cash closings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClosings = closings.filter(c => 
    workerMap[c.worker_id]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.observations?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getBillDetails = (json: string) => {
    try {
        return JSON.parse(json);
    } catch (e) {
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-2xl border-2 shadow-inner">
        <div className="space-y-1">
          <Label className="text-[9px] font-black uppercase tracking-widest ml-1">{t('menu.program.date')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-black text-[10px] bg-background h-10 border-2">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</> : format(dateRange.from, "dd/MM/yy")) : <span>Date...</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar initialFocus mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] font-black uppercase tracking-widest ml-1">{t('common.search')}</Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t('common.search')} 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9 h-10 border-2 font-black uppercase tracking-tighter" 
            />
          </div>
        </div>
        <div className="flex items-end pb-1">
          <Button variant="outline" size="icon" onClick={loadData} className="h-10 w-10 border-2">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <Card className="border-2 shadow-2xl overflow-hidden rounded-2xl">
        <CardContent className="p-0 overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 border-b-2 shadow-md">
              <TableRow className="h-14">
                <TableHead className="font-black uppercase tracking-widest text-[9px] pl-6">{t('menu.program.time')}</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[9px]">{t('sales.table.store')}</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[9px]">{t('menu.program.cashier')}</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[9px] text-right">{t('menu.program.expected')}</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[9px] text-right">{t('menu.program.actual')}</TableHead>
                <TableHead className="font-black uppercase tracking-widest text-[9px] text-right">{t('menu.program.difference')}</TableHead>
                <TableHead className="text-right font-black uppercase tracking-widest text-[9px] pr-6">{t('sales.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && closings.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center"><Skeleton className="h-12 w-full" /></TableCell></TableRow>
              ) : filteredClosings.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center font-black uppercase opacity-40">{t('common.noData')}</TableCell></TableRow>
              ) : filteredClosings.map((c) => (
                <TableRow key={c.id} className="border-b-2 hover:bg-muted/30 h-16 group transition-colors">
                  <TableCell className="font-mono text-[10px] pl-6 font-black opacity-60">{formatDate(c.created_at)}</TableCell>
                  <TableCell><Badge variant="outline" className="font-black uppercase text-[9px] border-2 bg-background">{stores.find(s => s.id === c.store_id)?.name || '?'}</Badge></TableCell>
                  <TableCell className="text-[10px] font-black uppercase">{workerMap[c.worker_id] || ((loading && !workerMap[c.worker_id]) ? '...' : (c.worker_id ? (c.worker_id.length < 15 ? c.worker_id : c.worker_id.slice(0,8)) : '?'))}</TableCell>
                  <TableCell className="text-right font-black font-mono text-xs">{formatCurrency(c.expected_balance)}</TableCell>
                  <TableCell className="text-right font-black font-mono text-xs">{formatCurrency(c.actual_balance)}</TableCell>
                  <TableCell className={cn("text-right font-black font-mono text-xs", (c.difference || 0) < 0 ? "text-danger" : (c.difference || 0) > 0 ? "text-success" : "")}>
                    {formatCurrency(c.difference)}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedClosing(c)} className="h-8 w-8 text-primary border-2">
                        <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedClosing} onOpenChange={(open) => !open && setSelectedClosing(null)}>
        <DialogContent className="max-w-2xl border-4 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tighter text-2xl border-b-4 pb-2">
              {t('menu.program.cashClosingDetails')}
            </DialogTitle>
          </DialogHeader>
          {selectedClosing && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-4 rounded-xl border-2">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{t('menu.program.cashier')}</p>
                    <p className="font-black uppercase">{workerMap[selectedClosing.worker_id] || selectedClosing.worker_id}</p>
                </div>
                <div className="bg-muted/30 p-4 rounded-xl border-2">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{t('menu.program.date')}</p>
                    <p className="font-black font-mono">{formatDate(selectedClosing.created_at)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border-2 bg-card">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{t('menu.program.expected')}</p>
                    <p className="font-black font-mono text-lg">{formatCurrency(selectedClosing.expected_balance)}</p>
                </div>
                <div className="p-4 rounded-xl border-2 bg-card">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{t('menu.program.actual')}</p>
                    <p className="font-black font-mono text-lg">{formatCurrency(selectedClosing.actual_balance)}</p>
                </div>
                <div className={cn("p-4 rounded-xl border-2", (selectedClosing.difference || 0) < 0 ? "bg-danger/10 border-danger/20" : "bg-success/10 border-success/20")}>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{t('menu.program.difference')}</p>
                    <p className={cn("font-black font-mono text-lg", (selectedClosing.difference || 0) < 0 ? "text-danger" : "text-success")}>
                        {formatCurrency(selectedClosing.difference)}
                    </p>
                </div>
              </div>

              <div className="bg-card border-2 rounded-xl p-4">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-3">{t('menu.program.billCounting')}</p>
                <ScrollArea className="h-48">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                        {getBillDetails(selectedClosing.bill_details_json)?.bills?.map((b: any) => (
                            <div key={b.denomination} className="flex justify-between items-center border-b border-dashed py-1">
                                <span className="text-xs font-black uppercase opacity-60">{b.denomination} x {b.count}</span>
                                <span className="text-xs font-black font-mono">{formatCurrency(b.denomination * b.count)}</span>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
              </div>

              {selectedClosing.observations && (
                <div className="bg-warning/10 border-2 border-warning/20 p-4 rounded-xl">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{t('menu.program.observations')}</p>
                    <p className="text-sm font-medium italic">{selectedClosing.observations}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
