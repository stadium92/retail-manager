import { useState, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { OfflineDataService } from '@/services/OfflineDataService';
import { ExportService } from '@/services/ExportService';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getCurrencyConfig } from '@/utils/currencyConfig';
import { toast } from 'sonner';

interface FicheCaisseModuleProps {
  storeId: string;
}

interface BillCount {
  denomination: number;
  count: number;
}

export function FicheCaisseModule({ storeId }: FicheCaisseModuleProps) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useFormatters();
  const { user } = useAuth();
  const { currency } = useSettingsStore();
  const [fondsCaisse, setFondsCaisse] = useState(0);
  const [observations, setObservations] = useState('');
  const [cashierName, setCashierName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { localBridgeBaseUrl } = getDataClient();
  
  // Billetage (Cash counting)
  const [bills, setBills] = useState<BillCount[]>([]);
  const [jetons, setJetons] = useState(0);

  // Update denominations when currency changes
  useEffect(() => {
    const config = getCurrencyConfig(currency);
    setBills(config.denominations.map(denom => ({
      denomination: denom,
      count: 0
    })));
  }, [currency]);

  // Day transactions
  const [dayData, setDayData] = useState({
    especesJour: 0,
    cheques: 0,
    reglementCredit: 0,
    venteCredit: 0,
    reglementFournisseur: 0,
    depensesJour: 0,
    versementBanque: 0,
    refBanque: '',
  });

  // Computer calculated values
  const [computerValues, setComputerValues] = useState({
    especes: 0,
    cheques: 0,
    credits: 0,
    ventesCredit: 0,
  });

  const currentDate = new Date();

  // Fetch today's sales and payments
  const fetchData = useCallback(async () => {
    if (!storeId) return;
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    console.log('[FicheCaisse] Fetching transactions for today...');

    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;

      // Fetch Sales
      const salesRes = await fetch(`${localBridgeBaseUrl}/rest/v1/sales?store_id=${storeId}`, { headers });
      const sales = await salesRes.json().catch(() => []);
      
      // Fetch Supplier Payments (Expenses)
      const paymentsRes = await fetch(`${localBridgeBaseUrl}/rest/v1/supplier_payments?store_id=${storeId}`, { headers });
      const payments = await paymentsRes.json().catch(() => []);

      if (salesRes.ok) {
        const todaySales = (sales as any[]).filter(s => s.created_at && new Date(s.created_at) >= todayStart && s.sale_type !== 'proforma');
        
        const cashTotal = todaySales
          .filter(s => s.payment_method === 'cash')
          .reduce((sum, s) => sum + (s.total_price || 0), 0);
          
        const creditTotal = todaySales
          .filter(s => s.payment_method === 'credit')
          .reduce((sum, s) => sum + (s.total_price || 0), 0);

        const chequeTotal = todaySales
          .filter(s => s.payment_method === 'cheque')
          .reduce((sum, s) => sum + (s.total_price || 0), 0);

        const supplierTotal = (payments as any[])
          .filter(p => p.created_at && new Date(p.created_at) >= todayStart)
          .reduce((sum, p) => sum + (p.amount || 0), 0);

        setDayData(prev => ({ 
          ...prev, 
          especesJour: cashTotal,
          cheques: chequeTotal,
          venteCredit: creditTotal,
          reglementFournisseur: supplierTotal
        }));

        setComputerValues({
          especes: cashTotal,
          cheques: chequeTotal,
          credits: 0, 
          ventesCredit: creditTotal
        });
      }
    } catch (err) {
      console.error('[FicheCaisse] Fetch error:', err);
    }
  }, [storeId, localBridgeBaseUrl]);

  useEffect(() => {
    fetchData();

    const handleRefresh = (e: any) => {
      if (e.detail?.type === 'sale') {
        console.log('[FicheCaisse] Refreshing due to sale event');
        fetchData();
      }
    };

    window.addEventListener('localDbDataUpdated', handleRefresh);
    return () => window.removeEventListener('localDbDataUpdated', handleRefresh);
  }, [fetchData]);

  // Calculate totals
  const billTotal = useMemo(() => {
    return bills.reduce((sum, bill) => sum + (bill.denomination * bill.count), 0) + jetons;
  }, [bills, jetons]);

  const totalEncaissement = useMemo(() => {
    return dayData.especesJour + dayData.cheques + dayData.reglementCredit - dayData.venteCredit;
  }, [dayData]);

  const handleSave = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const closingData = {
        store_id: storeId,
        opening_balance: fondsCaisse,
        expected_balance: computerValues.especes,
        actual_balance: billTotal,
        difference: billTotal - computerValues.especes,
        bill_details_json: JSON.stringify({ bills, jetons, dayData }),
        observations: observations || `Caissier: ${cashierName}`
      };

      const success = await OfflineDataService.submitCashClosing(closingData);
      
      if (success) {
        // Export PDF
        const exportData = [
          ...bills.filter(b => b.count > 0).map(b => ({
            Libelle: `${b.denomination} x ${b.count}`,
            Montant: formatCurrency(b.denomination * b.count)
          })),
          { Libelle: 'Jetons', Montant: formatCurrency(jetons) },
          { Libelle: 'TOTAL BILLETAGE', Montant: formatCurrency(billTotal) },
          { Libelle: '----------------', Montant: '----------------' },
          { Libelle: 'Especes Jour', Montant: formatCurrency(dayData.especesJour) },
          { Libelle: 'Depenses', Montant: formatCurrency(dayData.depensesJour) },
          { Libelle: 'Ecart', Montant: formatCurrency(billTotal - computerValues.especes) }
        ];

        ExportService.exportToPDF(
          exportData, 
          `cloture-${storeId}-${new Date().getTime()}`,
          `FICHE DE CAISSE - ${cashierName || 'SYSTEM'}`,
          [
            { header: 'Libelle', dataKey: 'Libelle' },
            { header: 'Montant', dataKey: 'Montant' }
          ]
        );

        toast.success(t('common.saveSuccess'));
        
        // Reset form
        setFondsCaisse(0);
        setObservations('');
        setCashierName('');
        setJetons(0);
        const config = getCurrencyConfig(currency);
        setBills(config.denominations.map(denom => ({ denomination: denom, count: 0 })));
      } else {
        toast.error(t('common.error'));
      }
    } catch (error) {
      console.error('Save cash closing error:', error);
      toast.error(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  }, [storeId, billTotal, bills, jetons, computerValues, fondsCaisse, observations, cashierName, i18n.language, currency, t, formatCurrency]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const updateBillCount = (denomination: number, count: number) => {
    setBills(prev => prev.map(bill => 
      bill.denomination === denomination 
        ? { ...bill, count: Math.max(0, count) }
        : bill
    ));
  };
  
  return (
    <div className="h-full flex flex-col p-4 bg-[hsl(60,80%,85%)] dark:bg-transparent">
      <ScrollArea className="flex-1">
        <div className="glass-card p-4">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-4 md:gap-8 mb-6 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Label className="font-bold whitespace-nowrap">{t('menu.program.team')}</Label>
              <Input 
                value="" 
                className="w-20 h-8 bg-success/30"
                readOnly
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="font-bold whitespace-nowrap">{t('menu.program.cashier')}</Label>
              <Input 
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                className="w-40 h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="font-bold whitespace-nowrap">{t('menu.program.date')}</Label>
              <Input 
                value={currentDate.toLocaleDateString(i18n.language === 'bm' ? 'fr-ML' : i18n.language)} 
                className="w-28 h-8 bg-success/30"
                readOnly
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="font-bold whitespace-nowrap">{t('menu.program.time')} {t('menu.program.to')}</Label>
              <Input 
                value={currentDate.toLocaleTimeString(i18n.language === 'bm' ? 'fr-ML' : i18n.language, { hour: '2-digit', minute: '2-digit' })} 
                className="w-20 h-8 bg-success/30"
                readOnly
              />
              <Label>{t('menu.program.to')}</Label>
              <Input className="w-20 h-8 bg-success/30" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="font-bold whitespace-nowrap">{t('menu.program.cashFund')}:</Label>
              <NumericInput 
                value={fondsCaisse}
                onValueChange={(v) => setFondsCaisse(v)}
                className="w-24 h-8 bg-success/30 text-right"
              />
            </div>
          </div>

          {/* Main Grid - 3 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_auto] gap-6">
            {/* Left: Billetage */}
            <div>
              <div className="bg-[hsl(300,70%,60%)] text-white px-3 py-1 rounded-t-lg font-bold text-sm">
                {t('menu.program.cashCounting')}
              </div>
              <div className="border border-border rounded-b-lg p-3 bg-card/50">
                <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm">
                  <span className="font-medium">{t('menu.program.denomination')}</span>
                  <span></span>
                  <span className="font-medium">{t('menu.program.amount')}</span>
                  <span></span>
                  
                  {bills.map((bill) => (
                    <div key={`bill-${bill.denomination}`} className="contents">
                      <NumericInput 
                        value={bill.count}
                        onValueChange={(v) => updateBillCount(bill.denomination, v)}
                        integer
                        className="w-12 h-7 text-center bg-success/30"
                      />
                      <span>x {formatCurrency(bill.denomination)}</span>
                      <span>...=</span>
                      <span className="text-right font-mono">
                        {formatCurrency(bill.denomination * bill.count)}
                      </span>
                    </div>
                  ))}
                  
                  <span className="col-span-2 mt-2">{t('menu.program.tokens')} ...=</span>
                  <span></span>
                  <NumericInput 
                    value={jetons}
                    onValueChange={(v) => setJetons(v)}
                    integer
                    className="w-20 h-7 text-right bg-success/30"
                  />
                </div>
                
                <div className="border-t border-dashed border-border mt-3 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{t('worker.sales.total')} .....=</span>
                    <Input 
                      value={formatCurrency(billTotal)}
                      className="w-28 h-8 text-right bg-success/30 font-bold"
                      readOnly
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-medium">{t('menu.program.hqTransfer')} ....:</span>
                    <Input className="w-28 h-8 text-right" />
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Transactions du Jour */}
            <div>
              <div className="bg-[hsl(300,70%,60%)] text-white px-3 py-1 rounded-t-lg font-bold text-sm">
                {t('menu.program.dailyTransactions')}
              </div>
              <div className="border border-border rounded-b-lg p-3 bg-card/50">
                <div className="space-y-2 text-sm">
                  <div className="font-bold mb-2">{t('menu.program.collections')} :</div>
                  
                  <div className="flex justify-between items-center">
                    <span>- {t('menu.program.cashOfDay')} ....:</span>
                    <Input 
                      value={formatCurrency(dayData.especesJour)}
                      className="w-28 h-7 text-right bg-success/30"
                      readOnly
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>- {t('menu.program.checks')} ...........:</span>
                    <Input 
                      value={formatCurrency(dayData.cheques)}
                      className="w-28 h-7 text-right bg-success/30"
                      readOnly
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>- {t('menu.program.creditSettlement')}......:</span>
                    <Input 
                      value={formatCurrency(dayData.reglementCredit)}
                      className="w-28 h-7 text-right bg-success/30"
                      readOnly
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>- {t('menu.program.creditSale')}.......:</span>
                    <Input 
                      value={formatCurrency(dayData.venteCredit)}
                      className="w-28 h-7 text-right bg-success/30"
                      readOnly
                    />
                  </div>
                  
                  <div className="flex justify-between items-center mt-3">
                    <span>{t('menu.program.supplierPayment')}.:</span>
                    <Input 
                      value={formatCurrency(dayData.reglementFournisseur)}
                      className="w-28 h-7 text-right bg-success/30"
                      readOnly
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t('menu.program.dailyExpenses')} .....:</span>
                    <Input 
                      value={formatCurrency(dayData.depensesJour)}
                      className="w-28 h-7 text-right bg-success/30"
                      readOnly
                    />
                  </div>
                  
                  <div className="border-t border-dashed border-border mt-3 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[hsl(300,70%,50%)]">{t('worker.sales.total')} {t('menu.program.collections')}....:</span>
                      <Input 
                        value={formatCurrency(totalEncaissement)}
                        className="w-28 h-8 text-right bg-success/30 font-bold"
                        readOnly
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2">
                    <span>{t('menu.program.bankTransfer')}.......:</span>
                    <NumericInput 
                      value={dayData.versementBanque}
                      onValueChange={(v) => setDayData(prev => ({ ...prev, versementBanque: v }))}
                      className="w-28 h-7 text-right"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t('menu.program.bankRef')}:</span>
                    <Input 
                      value={dayData.refBanque}
                      onChange={(e) => setDayData(prev => ({ ...prev, refBanque: e.target.value }))}
                      className="w-40 h-7"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Ordinateur */}
            <div className="w-full lg:w-48">
              <div className="bg-[hsl(300,70%,60%)] text-white px-3 py-1 rounded-t-lg font-bold text-sm text-center">
                {t('menu.program.computer')}
              </div>
              <div className="border border-border rounded-b-lg p-3 bg-danger text-danger-foreground">
                <div className="space-y-2 text-right font-mono text-lg">
                  <div>{formatCurrency(computerValues.especes)}</div>
                  <div>{formatCurrency(computerValues.cheques)}</div>
                  <div>{formatCurrency(computerValues.credits)}</div>
                  <div>{formatCurrency(computerValues.ventesCredit)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="mt-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <Label className="font-bold">{t('menu.program.observations')}</Label>
              <Input 
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="flex-1 h-8 bg-success/30"
                placeholder="..."
              />
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Action Bar */}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm">
          {t('common.cancel')} (Esc)
        </Button>
        <Button size="sm" className="btn-neon" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {t('common.save')} (F2)
        </Button>
      </div>
    </div>
  );
}
