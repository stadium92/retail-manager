import { useState, useEffect } from 'react';
import { usePurchasingStore, Supplier } from '@/stores/usePurchasingStore';
import { supabase } from '@/integrations/supabase/client';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CreditCard, Coins, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface ReglementsFournisseursModuleProps {
  storeId: string;
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

export function ReglementsFournisseursModule({ storeId }: ReglementsFournisseursModuleProps) {
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
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...headers,
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
  }, [storeId, useLocalBridge]);

  const fetchPayments = async () => {
    if (useLocalBridge) {
      const data = await localBridgeRequest<Payment[]>(
        `/rest/v1/supplier_payments?${new URLSearchParams({ store_id: storeId }).toString()}`
      );
      setPayments((data as Payment[]) || []);
      return;
    }

    const { data } = await (supabase as any)
      .from('supplier_payments')
      .select('*, supplier:suppliers(name)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(50);
    setPayments((data as Payment[]) || []);
  };

  const suppliersWithBalance = suppliers.filter(s => s.balance > 0);
  const totalDebt = suppliersWithBalance.reduce((sum, s) => sum + s.balance, 0);

  const openPaymentModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setPaymentAmount(supplier.balance);
    setPaymentMethod('cash');
    setPaymentReference('');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const submitPayment = async () => {
    if (!selectedSupplier || paymentAmount <= 0) {
      toast.error(t('common.error'));
      return;
    }

    if (paymentAmount > selectedSupplier.balance) {
      toast.error(t('common.error'));
      return;
    }

    setLoading(true);
    try {
      await addPayment({
        store_id: storeId,
        supplier_id: selectedSupplier.id,
        amount: paymentAmount,
        payment_method: paymentMethod,
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined
      });

      toast.success(t('common.success'));
      setShowPaymentModal(false);
      fetchSuppliers(storeId);
      fetchPayments();
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Coins className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('menu.program.totalDebt')}</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('menu.program.suppliersToSettle')}</p>
                <p className="text-xl font-bold">{suppliersWithBalance.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <History className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('menu.program.paymentsThisMonth')}</p>
                <p className="text-xl font-bold">{payments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden">
        <Card className="overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('menu.program.supplierBalances')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-3rem)]">
            <div className="h-full overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="text-xs">{t('menu.program.supplier')}</TableHead>
                    <TableHead className="text-xs text-right">{t('menu.program.dueBalance')}</TableHead>
                    <TableHead className="text-xs w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliersWithBalance.map(supplier => (
                    <TableRow key={supplier.id} className="h-10">
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{supplier.name}</p>
                          {supplier.phone && (
                            <p className="text-xs text-muted-foreground">{supplier.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-bold text-red-600">
                          {formatCurrency(supplier.balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPaymentModal(supplier)}
                        >
                          {t('menu.program.settle')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {suppliersWithBalance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        {t('common.noData')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('menu.program.paymentHistory')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-3rem)]">
            <div className="h-full overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="text-xs">{t('menu.program.date')}</TableHead>
                    <TableHead className="text-xs">{t('menu.program.supplier')}</TableHead>
                    <TableHead className="text-xs">{t('menu.program.mode')}</TableHead>
                    <TableHead className="text-xs text-right">{t('menu.program.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(payment => (
                    <TableRow key={payment.id} className="h-10">
                      <TableCell className="text-xs">
                        {new Date(payment.created_at).toLocaleDateString(i18n.language === 'bm' ? 'fr-ML' : i18n.language)}
                      </TableCell>
                      <TableCell className="text-sm">{payment.supplier?.name}</TableCell>
                      <TableCell className="text-xs capitalize">{payment.payment_method}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-600">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {t('common.noData')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('menu.program.supplierPayment')}</DialogTitle>
          </DialogHeader>
          {selectedSupplier && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium">{selectedSupplier.name}</p>
                <p className="text-lg font-bold text-red-600">
                  {t('menu.program.balance')}: {formatCurrency(selectedSupplier.balance)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('menu.program.amount')}</label>
                <Input
                  type="number"
                  min={0}
                  max={selectedSupplier.balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('menu.program.mode')}</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t('common.cash')}</SelectItem>
                    <SelectItem value="bank">{t('menu.program.bankTransfer')}</SelectItem>
                    <SelectItem value="cheque">{t('menu.program.checks')}</SelectItem>
                    <SelectItem value="mobile">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('menu.program.bankRef')}</label>
                <Input
                  placeholder="..."
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">{t('menu.program.notes')}</label>
                <Textarea
                  placeholder="..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submitPayment} disabled={loading || paymentAmount <= 0}>
              {t('menu.program.confirmPayment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}