import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getCurrencyConfig } from '@/utils/currencyConfig';

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
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
  
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

  // Day transactions (would come from real data)
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

  // Computer calculated values (simulated)
  const [computerValues] = useState({
    especes: 0,
    cheques: 0,
    credits: 0,
    ventesCredit: 0,
  });

  const currentDate = new Date();

  // Fetch today's sales
  useEffect(() => {
    const fetchDaySales = async () => {
      if (!storeId) return;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) return;
        const params = new URLSearchParams();
        params.set('store_id', storeId);
        const response = await fetch(`${localBridgeBaseUrl}/rest/v1/sales?${params.toString()}`, {
          headers,
        });
        const payload = await response.json().catch(() => []);
        if (response.ok) {
          const sales = (payload || []) as Array<{ total_price?: number; created_at?: string }>;
          const total = sales
            .filter((sale) => sale.created_at && new Date(sale.created_at) >= today)
            .reduce((sum, sale) => sum + Number(sale.total_price || 0), 0);
          setDayData(prev => ({ ...prev, especesJour: total }));
        }
        return;
      }

      const { data } = await supabase
        .from('sales')
        .select('total_price')
        .eq('store_id', storeId)
        .gte('created_at', today.toISOString());
      
      if (data) {
        const total = data.reduce((sum, sale) => sum + (sale.total_price || 0), 0);
        setDayData(prev => ({ ...prev, especesJour: total }));
      }
    };
    
    fetchDaySales();
  }, [storeId, isLocalFirst, localBridgeBaseUrl]);

  // Calculate totals
  const billTotal = useMemo(() => {
    return bills.reduce((sum, bill) => sum + (bill.denomination * bill.count), 0) + jetons;
  }, [bills, jetons]);

  const totalEncaissement = useMemo(() => {
    return dayData.especesJour + dayData.cheques + dayData.reglementCredit - dayData.venteCredit;
  }, [dayData]);

  const updateBillCount = (denomination: number, count: number) => {
    setBills(prev => prev.map(bill => 
      bill.denomination === denomination 
        ? { ...bill, count: Math.max(0, count) }
        : bill
    ));
      };
  
      return (
        <div className="h-full flex flex-col p-4 bg-[hsl(60,80%,85%)] dark:bg-transparent">      <ScrollArea className="flex-1">
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
              <Input 
                type="number"
                value={fondsCaisse}
                onChange={(e) => setFondsCaisse(Number(e.target.value))}
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
                      <Input 
                        type="number"
                        value={bill.count || ''}
                        onChange={(e) => updateBillCount(bill.denomination, parseInt(e.target.value) || 0)}
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
                  <Input 
                    type="number"
                    value={jetons || ''}
                    onChange={(e) => setJetons(parseInt(e.target.value) || 0)}
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
                    <Input 
                      type="number"
                      value={dayData.versementBanque || ''}
                      onChange={(e) => setDayData(prev => ({ ...prev, versementBanque: Number(e.target.value) }))}
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
        <Button size="sm" className="btn-neon">
          <Save className="h-4 w-4 mr-2" />
          {t('common.save')} (F2)
        </Button>
      </div>
    </div>
  );
}