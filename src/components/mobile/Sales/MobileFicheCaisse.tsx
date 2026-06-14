import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getCurrencyConfig } from '@/utils/currencyConfig';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { getDataClient } from '@/lib/dataClient';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, WalletCards, Save, Loader2, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface BillCount {
  denomination: number;
  count: number;
}

export function MobileFicheCaisse() {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useFormatters();
  const { currency } = useSettingsStore();
  const { toast } = useToast();
  const [storeId, setStoreId] = useState<string>('');
  
  const [bills, setBills] = useState<BillCount[]>([]);
  const [fondsCaisse, setFondsCaisse] = useState(0);
  const [depensesJour, setDepensesJour] = useState(0);
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [computerValues, setComputerValues] = useState({
    especes: 0,
    cheques: 0,
    credits: 0,
    ventesCredit: 0,
  });

  useEffect(() => {
    OfflineAuthService.getOfflineSession().then(session => {
        if (session?.user?.user_metadata?.store_id) {
            setStoreId(session.user.user_metadata.store_id);
        }
    });
  }, []);

  useEffect(() => {
    const config = getCurrencyConfig(currency);
    setBills(config.denominations.map(denom => ({
      denomination: denom,
      count: 0
    })));
  }, [currency]);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    try {
      const sales = await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/sales?store_id=${storeId}`, { method: 'GET' });
      if (sales) {
        const todaySales = sales.filter(s => s.created_at && new Date(s.created_at) >= todayStart && s.sale_type !== 'proforma');
        const cashTotal = todaySales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + (s.total_price || 0), 0);
        
        setComputerValues(prev => ({ ...prev, especes: cashTotal }));
      }
    } catch (error) {
      console.error('[MobileFicheCaisse] Failed to fetch sales:', error);
    }
  }, [storeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalBilletage = useMemo(() => {
    return bills.reduce((acc, b) => acc + (b.denomination * b.count), 0);
  }, [bills]);

  const totalCalculated = useMemo(() => {
    return computerValues.especes + fondsCaisse - depensesJour;
  }, [computerValues.especes, fondsCaisse, depensesJour]);

  const ecart = totalBilletage - totalCalculated;

  const updateBillCount = (index: number, delta: number) => {
    setBills(prev => {
      const next = [...prev];
      const newVal = next[index].count + delta;
      if (newVal >= 0) {
        next[index].count = newVal;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!storeId) return;
    setIsSubmitting(true);
    try {
      const payload = {
        store_id: storeId,
        date: new Date().toISOString(),
        fonds_caisse: fondsCaisse,
        observations,
        total_billetage: totalBilletage,
        total_informatique: computerValues.especes,
        ecart: ecart,
        billets_details: bills,
      };
      
      const res = await OfflineAuthService.localBridgeRequest('/rest/v1/cash_register_closures', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      toast({ title: "Fermeture Enregistrée", description: "La fiche de caisse a été enregistrée avec succès." });
      // Reset
      setBills(bills.map(b => ({...b, count: 0})));
      setFondsCaisse(0);
      setDepensesJour(0);
      setObservations('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: "Erreur", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] md:pb-0 font-sans">
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
                <WalletCards className="w-4 h-4 text-rs-surface-tint" />
            </div>
            <h1 className="text-lg font-bold text-white uppercase tracking-wider">
                Fermeture Caisse
            </h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Summary Card */}
        <div className="bg-[#141414] border border-rs-surface-container-highest rounded-xl p-4 flex flex-col gap-3">
          <h2 className="font-bold text-rs-surface-tint uppercase tracking-wider text-sm">Bilan Informatique</h2>
          <div className="flex justify-between items-center">
            <span className="text-rs-on-surface-variant font-medium">Ventes Espèces (Jour)</span>
            <span className="text-white font-mono font-bold">{formatCurrency(computerValues.especes)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-rs-on-surface-variant font-medium">Fonds de Caisse</span>
            <Input 
                type="number"
                value={fondsCaisse || ''}
                onChange={(e) => setFondsCaisse(Number(e.target.value))}
                className="w-24 text-right bg-[#0a0a0a] border-rs-surface-container h-8"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-rs-on-surface-variant font-medium">Dépenses / Sorties</span>
            <Input 
                type="number"
                value={depensesJour || ''}
                onChange={(e) => setDepensesJour(Number(e.target.value))}
                className="w-24 text-right bg-[#0a0a0a] border-rs-surface-container h-8"
            />
          </div>
          <div className="border-t border-rs-surface-container pt-3 flex justify-between items-center">
            <span className="font-bold text-white">Solde Attendu</span>
            <span className="font-bold font-mono text-xl text-white">{formatCurrency(totalCalculated)}</span>
          </div>
        </div>

        {/* Billetage */}
        <div className="bg-[#141414] border border-rs-surface-container-highest rounded-xl p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-rs-surface-container pb-2 mb-2">
            <h2 className="font-bold text-rs-surface-tint uppercase tracking-wider text-sm">Billetage (Espèces réelles)</h2>
            <span className="font-bold font-mono text-xl text-white">{formatCurrency(totalBilletage)}</span>
          </div>

          <div className="space-y-3">
            {bills.map((bill, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4">
                <div className="w-20 font-bold text-rs-on-surface-variant font-mono text-right">
                  {formatCurrency(bill.denomination)}
                </div>
                <div className="flex items-center bg-[#0a0a0a] rounded-lg border border-rs-surface-container-highest flex-1 max-w-[140px]">
                  <button onClick={() => updateBillCount(idx, -1)} className="w-10 h-10 flex items-center justify-center text-rs-surface-tint active:bg-rs-surface-container">
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="flex-1 text-center font-bold text-white text-lg">
                    {bill.count}
                  </div>
                  <button onClick={() => updateBillCount(idx, 1)} className="w-10 h-10 flex items-center justify-center text-rs-surface-tint active:bg-rs-surface-container">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ecart & Obs */}
        <div className={`border rounded-xl p-4 flex flex-col gap-3 ${ecart === 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
           <div className="flex justify-between items-center">
             <span className="font-bold text-white">Écart de Caisse</span>
             <span className={`font-bold font-mono text-xl ${ecart === 0 ? 'text-green-400' : 'text-red-400'}`}>
                {ecart > 0 ? '+' : ''}{formatCurrency(ecart)}
             </span>
           </div>
           <Input 
             placeholder="Observations (Ex: Erreur de rendu de monnaie)"
             value={observations}
             onChange={e => setObservations(e.target.value)}
             className="bg-[#0a0a0a] border-rs-surface-container text-white mt-2"
           />
        </div>
      </div>

      <div className="bg-[#141414] border-t border-rs-surface-container-highest px-4 py-3 z-40 pb-safe">
        <button 
          disabled={isSubmitting}
          onClick={handleSave}
          className="w-full h-[48px] rounded-lg bg-rs-surface-tint text-rs-on-primary font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span className="uppercase tracking-wide">Clôturer la Caisse</span>
        </button>
      </div>
    </div>
  );
}
