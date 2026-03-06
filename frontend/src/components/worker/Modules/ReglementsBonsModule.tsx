import { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, CreditCard, Coins, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useTranslation } from 'react-i18next';

interface ReglementsBonsModuleProps {
  storeId: string;
}

interface CreditSale {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  invoice_number: string | null;
  total_price: number;
  amount_paid: number;
  payment_status: 'pending' | 'partial' | 'paid';
}

interface LocalBridgeSale {
  id: string;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  invoice_number?: string | null;
  total_price?: number | null;
  payment_status?: string | null;
}

export function ReglementsBonsModule({ storeId }: ReglementsBonsModuleProps) {
  const { t, i18n } = useTranslation();
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
  const useLocalBridge = isLocalFirst;
  
  // Settlement modal state
  const [selectedSale, setSelectedSale] = useState<CreditSale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getLocale = () => {
    if (i18n.language === 'fr' || i18n.language === 'bm') return fr;
    return enUS;
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' F';
  };

  const localBridgeRequest = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) {
        throw new Error('LocalBridge session expired. Please sign in again.');
      }
      const response = await fetch(`${localBridgeBaseUrl}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers || {}) },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'LocalBridge request failed');
      }
      return payload as T;
    },
    [localBridgeBaseUrl]
  );

  // Fetch credit sales (pending or partial payment status)
  useEffect(() => {
    const fetchCreditSales = async () => {
      if (!storeId) return;
      setIsLoading(true);

      if (useLocalBridge) {
        try {
          const params = new URLSearchParams();
          if (storeId) params.set('store_id', storeId);
          const data = await localBridgeRequest<LocalBridgeSale[]>(
            `/rest/v1/sales?${params.toString()}`
          );
          const filtered = (data || []).filter((sale) =>
            ['pending', 'partial'].includes((sale.payment_status || '').toLowerCase())
          );
          const salesWithPaid: CreditSale[] = filtered.map((sale) => ({
            id: sale.id,
            created_at: sale.created_at,
            customer_name: sale.customer_name ?? null,
            customer_phone: sale.customer_phone ?? null,
            invoice_number: sale.invoice_number ?? null,
            total_price: Number(sale.total_price) || 0,
            payment_status: (sale.payment_status as 'pending' | 'partial' | 'paid') || 'pending',
            amount_paid: 0,
          }));
          setCreditSales(salesWithPaid);
        } catch (error) {
          console.error('Error fetching credit sales:', error);
          toast.error(t('common.failedToLoad'));
        } finally {
          setIsLoading(false);
        }
        return;
      }

      const { data, error } = { data: null as any, error: new Error('Remote client unavailable') };

      if (error) {
        console.error('Error fetching credit sales:', error);
        toast.error(t('common.failedToLoad'));
      } else {
        const salesWithPaid: CreditSale[] = (data || []).map(sale => ({
          ...sale,
          payment_status: sale.payment_status as 'pending' | 'partial' | 'paid',
          amount_paid: 0,
        }));
        setCreditSales(salesWithPaid);
      }

      setIsLoading(false);
    };

    fetchCreditSales();
  }, [storeId, useLocalBridge, localBridgeRequest, t]);

  // Filter by search
  const filteredSales = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return creditSales.filter(sale =>
      !searchQuery ||
      (sale.customer_name && sale.customer_name.toLowerCase().includes(query)) ||
      (sale.customer_phone && sale.customer_phone.includes(searchQuery)) ||
      (sale.invoice_number && sale.invoice_number.toLowerCase().includes(query))
    );
  }, [creditSales, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalDue = filteredSales.reduce((sum, s) => sum + s.total_price, 0);
    const totalPaid = filteredSales.reduce((sum, s) => sum + s.amount_paid, 0);
    const totalRemaining = totalDue - totalPaid;
    return { totalDue, totalPaid, totalRemaining, count: filteredSales.length };
  }, [filteredSales]);

  // Open settlement dialog
  const handleOpenSettlement = (sale: CreditSale) => {
    setSelectedSale(sale);
    setPaymentAmount(sale.total_price - sale.amount_paid); // Default to full remaining amount
    setIsDialogOpen(true);
  };

  // Handle settlement
  const handleSettlement = async () => {
    if (!selectedSale || paymentAmount <= 0) return;

    setIsSaving(true);
    try {
      const newAmountPaid = selectedSale.amount_paid + paymentAmount;
      const newStatus = newAmountPaid >= selectedSale.total_price ? 'paid' : 'partial';

      if (useLocalBridge) {
        await localBridgeRequest(`/rest/v1/sales/${selectedSale.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_status: newStatus }),
        });
      } else {
        // No remote client available; settlement requires local bridge
        toast.error(t('common.error'));
        console.error('Settlement requires local bridge mode');
        return;
      }

      toast.success(t('common.success'));
      
      // Update local state
      setCreditSales(sales => 
        sales.map(s => {
          if (s.id === selectedSale.id) {
            return { ...s, amount_paid: newAmountPaid, payment_status: newStatus as any };
          }
          return s;
        }).filter(s => s.payment_status !== 'paid') // Remove fully paid
      );
      
      setIsDialogOpen(false);
      setSelectedSale(null);
    } catch (error) {
      console.error('Settlement error:', error);
      toast.error(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden font-mono">
      {/* Header */}
      <div className="bg-[hsl(120,100%,35%)] px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-[hsl(60,100%,50%)] uppercase">{t('menu.program.voucherSettlement')}</span>
            <span className="ml-4 text-sm text-black">{totals.count} {t('common.transactions')}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-black">
            <span>{t('menu.program.totalDue')}: <span className="font-bold text-[hsl(0,100%,40%)]">{formatCurrency(totals.totalDue)}</span></span>
            <span>{t('menu.program.remaining')}: <span className="font-bold text-[hsl(0,100%,40%)]">{formatCurrency(totals.totalRemaining)}</span></span>
          </div>
        </div>
      </div>
      {/* Search bar */}
      <div className="bg-[hsl(50,100%,45%)] px-4 py-2 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/50" />
          <Input
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 bg-white border-2 border-black/30 font-mono"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 bg-[hsl(220,100%,35%)] overflow-hidden flex flex-col">
        {/* Column headers */}
        <div className="grid grid-cols-[100px_1fr_120px_150px_120px_100px_80px_100px] bg-[hsl(50,100%,45%)] text-black text-sm font-bold border-b-2 border-black">
          <div className="px-2 py-1.5 border-r border-black/30 uppercase">{t('menu.program.date')}</div>
          <div className="px-2 py-1.5 border-r border-black/30 uppercase">{t('pos.totals.customer')}</div>
          <div className="px-2 py-1.5 border-r border-black/30 uppercase">{t('stores.fields.phone')}</div>
          <div className="px-2 py-1.5 border-r border-black/30 uppercase">{t('menu.program.invoice')}</div>
          <div className="px-2 py-1.5 border-r border-black/30 text-right uppercase">{t('menu.program.totalDue')}</div>
          <div className="px-2 py-1.5 border-r border-black/30 text-right uppercase">{t('menu.program.remaining')}</div>
          <div className="px-2 py-1.5 border-r border-black/30 text-center uppercase">{t('team.table.status')}</div>
          <div className="px-2 py-1.5 text-center uppercase">{t('common.actions')}</div>
        </div>

        {/* Rows */}
        <ScrollArea className="flex-1">
          {filteredSales.length === 0 ? (
            <div className="h-full flex items-center justify-center text-white/50 py-8">
              {t('common.noData')}
            </div>
          ) : (
            filteredSales.map(sale => {
              const remaining = sale.total_price - sale.amount_paid;
              return (
                <div 
                  key={sale.id} 
                  className="grid grid-cols-[100px_1fr_120px_150px_120px_100px_80px_100px] text-white text-sm border-b border-white/20 hover:bg-white/10"
                >
                  <div className="px-2 py-2 border-r border-white/20">
                    {format(new Date(sale.created_at), 'dd/MM/yyyy', { locale: getLocale() })}
                  </div>
                  <div className="px-2 py-2 border-r border-white/20 truncate">
                    {sale.customer_name || t('common.unknown')}
                  </div>
                  <div className="px-2 py-2 border-r border-white/20">
                    {sale.customer_phone || '—'}
                  </div>
                  <div className="px-2 py-2 border-r border-white/20 text-xs">
                    {sale.invoice_number || sale.id.slice(0, 8)}
                  </div>
                  <div className="px-2 py-2 border-r border-white/20 text-right tabular-nums">
                    {formatCurrency(sale.total_price)}
                  </div>
                  <div className="px-2 py-2 border-r border-white/20 text-right tabular-nums text-red-300 font-bold">
                    {formatCurrency(remaining)}
                  </div>
                  <div className="px-2 py-2 border-r border-white/20 text-center">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-xs',
                      sale.payment_status === 'partial' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
                    )}>
                      {sale.payment_status === 'partial' ? t('menu.program.partial') : t('menu.program.unpaid')}
                    </span>
                  </div>
                  <div className="px-2 py-1.5 text-center">
                    <Button
                      size="sm"
                      onClick={() => handleOpenSettlement(sale)}
                      className="h-6 px-3 text-xs bg-[hsl(120,70%,35%)] hover:bg-[hsl(120,70%,30%)]"
                    >
                      {t('menu.program.settle')}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="bg-[hsl(220,20%,90%)] px-4 py-2 flex items-center justify-between text-black text-sm">
        <span>F4: {t('menu.program.settle')} • F5: {t('menu.program.lastMovements')} • Esc: {t('common.close')}</span>
        <span>{t('menu.program.remaining')}: <span className="font-bold text-red-600">{formatCurrency(totals.totalRemaining)}</span></span>
      </div>

      {/* Settlement Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('menu.program.voucherSettlement')}</DialogTitle>
            <DialogDescription>
              {selectedSale && (
                <>
                  {t('pos.totals.customer')}: <strong>{selectedSale.customer_name || t('common.unknown')}</strong>
                  <br />
                  {t('menu.program.invoice')}: <strong>{selectedSale.invoice_number || selectedSale.id.slice(0, 8)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t('common.total')}</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedSale.total_price)}</p>
                </div>
                <div className="p-3 rounded-lg bg-danger/10">
                  <p className="text-xs text-muted-foreground">{t('menu.program.remaining')}</p>
                  <p className="text-lg font-bold text-danger">
                    {formatCurrency(selectedSale.total_price - selectedSale.amount_paid)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">{t('menu.program.amount')}</Label>
                <NumericInput
                  id="paymentAmount"
                  min={0}
                  max={selectedSale.total_price - selectedSale.amount_paid}
                  value={paymentAmount}
                  onValueChange={(v) => setPaymentAmount(v)}
                  className="text-lg font-bold"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentAmount(selectedSale.total_price - selectedSale.amount_paid)}
                  >
                    {t('menu.program.payAll')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentAmount(Math.floor((selectedSale.total_price - selectedSale.amount_paid) / 2))}
                  >
                    50%
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSettlement}
              disabled={isSaving || paymentAmount <= 0}
            >
              {isSaving ? t('common.loading') : `${t('menu.program.settle')} ${formatCurrency(paymentAmount)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}