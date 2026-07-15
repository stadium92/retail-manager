import { useState, useEffect } from 'react';
import { usePurchasingStore, Supplier } from '@/stores/usePurchasingStore';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { LocalDatabase } from '@/services/LocalDatabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreditCard, Coins, History, Search, CalendarIcon, Filter } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface ReglementsFournisseursModuleProps {
  storeId: string;
  isMasterView?: boolean;
}

interface Payment {
  id: string;
  supplier_id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  supplier?: { name: string };
}

export function ReglementsFournisseursModule({ storeId, isMasterView }: ReglementsFournisseursModuleProps) {
  const { t, i18n } = useTranslation();
  const { suppliers, fetchSuppliers, addPayment } = usePurchasingStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: endOfDay(new Date()),
  });

  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

  const useLocalBridge = isLocalFirst;

  const { formatCurrency } = useFormatters();

  const localBridgeRequest = async <T,>(path: string, init: RequestInit = {}) => {
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
          ...headers,
          ...(init.headers || {}),
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
    });
    let payload: any = null;
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
  };

  useEffect(() => {
    if (storeId) {
      fetchSuppliers(storeId);
      fetchPayments();
    }
  }, [storeId, useLocalBridge, dateRange]);

  const fetchPayments = async () => {
    // 1. OFFLINE-FIRST: Immediate local data
    try {
      await LocalDatabase.init();
      const localPayments = await LocalDatabase.getSupplierPayments(storeId);
      if (localPayments.length > 0) {
        setPayments(localPayments);
      }
    } catch (e) {
      console.warn('[Payments] Local fetch failed:', e);
    }

    // 2. BACKGROUND SYNC
    const syncProc = async () => {
      let remote: any[] = [];
      let success = false;
      try {
        if (useLocalBridge) {
          const params = new URLSearchParams({ store_id: storeId });
          const headers = await OfflineAuthService.getAuthHeaders();
          if (headers) {
            const res = await fetch(`${localBridgeBaseUrl}/rest/v1/supplier_payments?${params.toString()}`, { headers });
            if (res.ok) {
              remote = await res.json();
              success = true;
            }
          }
        } else if (navigator.onLine) {
          // No remote fallback available; payments remain from local cache
        }

        if (success && remote.length > 0) {
          for (const p of remote) {
            await LocalDatabase.saveSupplierPayment({ ...p, synced: true });
          }
          setPayments(remote);
        }
      } catch (err) {
        console.warn('[Payments] Background sync failed:', err);
      }
    };

    syncProc();
  };

  const suppliersWithBalance = suppliers.filter(s => 
    s.balance > 0 && 
    (!supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
  );

  const filteredHistory = payments.filter(p => {
    const matchesSearch = !historySearch || 
      p.supplier?.name.toLowerCase().includes(historySearch.toLowerCase()) ||
      p.reference?.toLowerCase().includes(historySearch.toLowerCase());
    
    const date = new Date(p.created_at);
    const matchesDate = date >= dateRange.from && date <= dateRange.to;
    
    return matchesSearch && matchesDate;
  });

  const totalDebt = suppliers.filter(s => s.balance > 0).reduce((sum, s) => sum + s.balance, 0);

  const openPaymentModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setPaymentAmount(supplier.balance);
    setPaymentMethod('cash');
    setPaymentReference('');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const submitPayment = async () => {
    if (!selectedSupplier || paymentAmount <= 0) return;

    setLoading(true);
    try {
      const paymentData = {
        id: crypto.randomUUID(),
        store_id: storeId,
        supplier_id: selectedSupplier.id,
        amount: paymentAmount,
        payment_method: paymentMethod,
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined,
        created_at: new Date().toISOString(),
        synced: false
      };

      // 1. Save Locally
      await LocalDatabase.init();
      await LocalDatabase.saveSupplierPayment(paymentData);
      
      // Update UI optimistically
      setPayments(prev => [paymentData as any, ...prev]);

      // 2. Submit to store/bridge/cloud
      await addPayment(paymentData as any);

      toast.success(t('common.success'));
      setShowPaymentModal(false);
      fetchSuppliers(storeId);
      fetchPayments();
    } catch (error) {
      console.error(error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
        "h-full flex flex-col p-4 gap-4 transition-colors",
        !isMasterView && "bg-[hsl(60,80%,85%)]",
        "dark:bg-transparent"
    )}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-red-600 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Coins className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('menu.program.totalDebt')}</p>
                <p className="text-xl font-black text-red-600 font-mono">{formatCurrency(totalDebt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-amber-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('menu.program.suppliersToSettle')}</p>
                <p className="text-xl font-black text-amber-600">{suppliers.filter(s => s.balance > 0).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-green-600 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <History className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('menu.program.paymentsThisMonth')}</p>
                <p className="text-xl font-black text-green-600">{payments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden">
        <Card className="overflow-hidden border-2 shadow-lg flex flex-col">
          <CardHeader className="py-3 border-b bg-muted/10">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest font-mono shrink-0">{t('menu.program.supplierBalances')}</CardTitle>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                <Input 
                  placeholder={t('common.search')} 
                  value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)}
                  className="h-7 pl-7 text-[10px] uppercase font-bold"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.supplier')}</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.dueBalance')}</TableHead>
                    <TableHead className="text-xs w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliersWithBalance.map(supplier => (
                    <TableRow key={supplier.id} className="h-11 border-b hover:bg-muted/5 transition-colors">
                      <TableCell>
                        <div>
                          <p className="text-xs font-black uppercase">{supplier.name}</p>
                          {supplier.phone && (
                            <p className="text-[9px] text-muted-foreground font-mono">{supplier.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-black text-red-600 font-mono bg-red-50 px-2 py-1 rounded border border-red-100">
                          {formatCurrency(supplier.balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[10px] font-bold uppercase tracking-tighter"
                          onClick={() => openPaymentModal(supplier)}
                        >
                          {t('menu.program.settle')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {suppliersWithBalance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-24 uppercase font-mono tracking-widest opacity-50">
                        {t('common.noData')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-2 shadow-lg flex flex-col">
          <CardHeader className="py-3 border-b bg-muted/10">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest font-mono">{t('menu.program.paymentHistory')}</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                  <Input 
                    placeholder={t('common.search')} 
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="h-7 pl-7 text-[10px] uppercase font-bold"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-2 font-mono text-[9px] border-2">
                      <CalendarIcon className="h-3 w-3" />
                      {format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM')}
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
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.date')}</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.supplier')}</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.mode')}</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map(payment => (
                    <TableRow key={payment.id} className="h-11 border-b hover:bg-muted/5 transition-colors">
                      <TableCell className="text-[10px] font-mono text-muted-foreground">
                        {format(new Date(payment.created_at), 'dd/MM HH:mm')}
                      </TableCell>
                      <TableCell className="text-xs font-black uppercase">{payment.supplier?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[8px] uppercase border-muted-foreground/30 font-bold px-1 h-4">
                          {payment.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-black font-mono text-green-600 bg-green-50/50">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-24 uppercase font-mono tracking-widest opacity-50">
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

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest font-mono">{t('menu.program.supplierPayment')}</DialogTitle>
          </DialogHeader>
          {selectedSupplier && (
            <div className="space-y-4 pt-2">
              <div className="bg-primary/5 border-l-4 border-primary rounded p-4">
                <p className="text-xs font-black uppercase text-primary">{selectedSupplier.name}</p>
                <p className="text-xl font-black text-red-600 font-mono mt-1">
                  {t('menu.program.balance')}: {formatCurrency(selectedSupplier.balance)}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">{t('menu.program.amount')}</label>
                  <NumericInput
                    min={0}
                    max={selectedSupplier.balance}
                    value={paymentAmount}
                    onValueChange={(v) => setPaymentAmount(v)}
                    className="h-12 text-2xl font-black font-mono border-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">{t('menu.program.mode')}</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-10 border-2 font-bold uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash" className="uppercase font-bold">{t('common.cash')}</SelectItem>
                        <SelectItem value="bank" className="uppercase font-bold">{t('menu.program.bankTransfer')}</SelectItem>
                        <SelectItem value="cheque" className="uppercase font-bold">{t('menu.program.checks')}</SelectItem>
                        <SelectItem value="mobile" className="uppercase font-bold">{t('menu.program.mobileMoney')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">{t('menu.program.bankRef')}</label>
                    <Input
                      placeholder="..."
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="h-10 border-2 uppercase font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">{t('menu.program.notes')}</label>
                  <Textarea
                    placeholder="..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                    className="border-2"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button variant="ghost" className="uppercase font-bold text-muted-foreground" onClick={() => setShowPaymentModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={submitPayment} 
              disabled={loading || paymentAmount <= 0}
              className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest"
            >
              {t('menu.program.confirmPayment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}