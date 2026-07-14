import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Coins, Search, Save, WifiOff, RefreshCw, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface CashierCreditsModuleProps {
  storeId: string;
}

interface CashierCredit {
  id: string;
  store_id: string;
  worker_id: string;
  client_name: string;
  amount: number;
  status: 'unpaid' | 'paid';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function CashierCreditsModule({ storeId }: CashierCreditsModuleProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatters();
  const [credits, setCredits] = useState<CashierCredit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // New credit form state
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const fetchCredits = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    try {
      const data = await OfflineAuthService.localBridgeRequest<CashierCredit[]>(
        `/rest/v1/cashier_credits?store_id=${storeId}`,
        { method: 'GET' }
      );
      setCredits(data || []);
    } catch (e) {
      console.error('Failed to load cashier credits:', e);
      toast.error(t('common.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [storeId, t]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

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

  // Filter local db refresh events
  useEffect(() => {
    const handleRefresh = (e: any) => {
      if (e.detail?.type === 'cashier_credit') {
        fetchCredits();
      }
    };
    window.addEventListener('localDbDataUpdated', handleRefresh);
    return () => window.removeEventListener('localDbDataUpdated', handleRefresh);
  }, [fetchCredits]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || amount <= 0) {
      toast.error(t('common.error') || 'Invalide');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        store_id: storeId,
        client_name: clientName.trim(),
        amount: Number(amount),
        notes: notes.trim() || null,
        status: 'unpaid' as const,
      };

      await OfflineAuthService.localBridgeRequest<CashierCredit>('/rest/v1/cashier_credits', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(t('common.success') || 'Credit recorded successfully');
      setClientName('');
      setAmount(0);
      setNotes('');
      fetchCredits();
    } catch (error: any) {
      console.error('Failed to create cashier credit:', error);
      toast.error(`${t('common.error')}: ${error.message || 'Error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (credit: CashierCredit) => {
    const newStatus = credit.status === 'unpaid' ? 'paid' : 'unpaid';
    
    // Optimistic update
    setCredits(prev =>
      prev.map(c => (c.id === credit.id ? { ...c, status: newStatus } : c))
    );

    try {
      await OfflineAuthService.localBridgeRequest(`/rest/v1/cashier_credits/${credit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(t('common.success') || 'Status updated');
      fetchCredits();
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error(t('common.error') || 'Failed to update');
      // Revert on failure
      fetchCredits();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm') || 'Are you sure?')) return;

    // Optimistic delete
    setCredits(prev => prev.filter(c => c.id !== id));

    try {
      await OfflineAuthService.localBridgeRequest(`/rest/v1/cashier_credits/${id}`, {
        method: 'DELETE',
      });
      toast.success(t('common.deletedSuccessfully'));
      fetchCredits();
    } catch (error) {
      console.error('Failed to delete cashier credit:', error);
      toast.error(t('common.failedToDelete'));
      fetchCredits();
    }
  };

  const filteredCredits = credits.filter(c => {
    const matchesSearch = c.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const unpaidTotal = credits
    .filter(c => c.status === 'unpaid')
    .reduce((sum, c) => sum + c.amount, 0);

  const OfflineIndicator = () => isOffline ? (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-warning/20 text-warning text-xs">
      <WifiOff className="h-3 w-3" />
      <span>{t('common.offline')}</span>
    </div>
  ) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 p-4 h-full overflow-hidden">
      {/* Sidebar form */}
      <div className="space-y-4 overflow-y-auto pr-2">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold uppercase tracking-widest flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            {t('menu.sales.cashierCredits') || 'CRÉDITS CAISSIERS'}
          </h2>
          <OfflineIndicator />
        </div>

        <Card className="border-2 shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <h3 className="text-xs font-black uppercase text-primary border-b pb-2 mb-4">
              {t('common.create') || 'Enregistrer un Crédit'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  {t('common.name') || 'Nom du Client'}
                </Label>
                <Input
                  required
                  placeholder="Ex: Diallo"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="h-10 border-2"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  {t('common.amount') || 'Montant'}
                </Label>
                <NumericInput
                  min={0.01}
                  value={amount}
                  onValueChange={v => setAmount(v)}
                  className="h-11 text-lg font-black font-mono border-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Notes / Détails
                </Label>
                <Textarea
                  placeholder="Détails supplémentaires..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="border-2"
                />
              </div>

              <Button
                type="submit"
                disabled={isSaving || !clientName.trim() || amount <= 0}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {t('common.save') || 'Enregistrer'}
              </Button>
            </form>

            <div className="pt-4 border-t-2 mt-4 space-y-2">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">
                Total des En-cours (Non payés)
              </div>
              <div className="text-2xl font-black font-mono text-danger">
                {formatCurrency(unpaidTotal)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Listing */}
      <div className="overflow-hidden flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          {/* Search bar */}
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('pos.grid.searchPrompt') || 'Rechercher un crédit...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 border-2"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 bg-muted/40 p-1 rounded-lg border">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className={cn("h-8 text-xs font-bold uppercase px-3", statusFilter === 'all' && "bg-primary text-white shadow-sm")}
            >
              {t('common.all') || 'Tout'}
            </Button>
            <Button
              variant={statusFilter === 'unpaid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('unpaid')}
              className={cn("h-8 text-xs font-bold uppercase px-3", statusFilter === 'unpaid' && "bg-danger text-white shadow-sm")}
            >
              Non Payé
            </Button>
            <Button
              variant={statusFilter === 'paid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('paid')}
              className={cn("h-8 text-xs font-bold uppercase px-3", statusFilter === 'paid' && "bg-success text-white shadow-sm")}
            >
              Payé
            </Button>
          </div>
        </div>

        {/* Table list */}
        <Card className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                <TableRow className="bg-muted/50 border-b-2">
                  <TableHead className="text-[10px] uppercase font-bold w-32">{t('menu.program.date')}</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">{t('common.name')}</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-right">{t('common.amount')}</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Notes</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-center">Statut</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold text-center w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-24 uppercase font-mono tracking-widest opacity-40">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      {t('common.loading')}
                    </TableCell>
                  </TableRow>
                ) : filteredCredits.map(c => (
                  <TableRow key={c.id} className="h-14 border-b hover:bg-muted/5 transition-colors">
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="text-xs font-black uppercase">
                      {c.client_name}
                    </TableCell>
                    <TableCell className={cn(
                      "text-xs font-black font-mono text-right",
                      c.status === 'unpaid' ? "text-danger" : "text-success"
                    )}>
                      {formatCurrency(c.amount)}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">
                      {c.notes || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] uppercase font-black px-2 py-0.5 border-2",
                          c.status === 'paid'
                            ? "bg-success/10 border-success text-success"
                            : "bg-danger/10 border-danger text-danger animate-pulse"
                        )}
                      >
                        {c.status === 'paid' ? 'Payé' : 'Non Payé'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleToggleStatus(c)}
                          className={cn(
                            "h-8 w-8 border-2 transition-colors",
                            c.status === 'paid'
                              ? "hover:bg-warning/10 hover:text-warning"
                              : "hover:bg-success/10 hover:text-success"
                          )}
                          title={c.status === 'paid' ? "Marquer non payé" : "Marquer payé"}
                        >
                          {c.status === 'paid' ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(c.id)}
                          className="h-8 w-8 text-muted-foreground border-2 hover:bg-danger/10 hover:text-danger hover:border-danger transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredCredits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-24 uppercase font-mono tracking-widest opacity-35">
                      {t('common.noData')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
