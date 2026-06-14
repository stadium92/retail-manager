import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { ArrowLeft, Search, FileText, Calendar, CreditCard, CheckCircle2, AlertCircle, ShoppingBag, Eye } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface MobileSuiviVentesJourProps {
  onBack: () => void;
}

export function MobileSuiviVentesJour({ onBack }: MobileSuiviVentesJourProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatCurrency, formatDate } = useFormatters();

  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [storeId, setStoreId] = useState('');
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  useEffect(() => {
    OfflineAuthService.getOfflineSession().then(session => {
      if (session?.user?.user_metadata?.store_id) {
        setStoreId(session.user.user_metadata.store_id);
        loadDailySales(session.user.user_metadata.store_id);
      }
    });
  }, []);

  const loadDailySales = async (sid: string) => {
    setLoading(true);
    try {
      const allSales = await OfflineSalesService.getSales(sid);
      // Filter for today's sales
      const todayStr = new Date().toISOString().split('T')[0];
      const todaySales = allSales.filter(s => s.created_at?.startsWith(todayStr));
      setSales(todaySales || allSales.slice(0, 50)); // Fallback to recent 50 if none today
    } catch (err) {
      console.error(err);
      toast({ title: t('common.error'), description: 'Erreur lors du chargement des ventes journalières', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = useMemo(() => {
    return sales.filter(s => 
      s.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.payment_method?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sales, searchQuery]);

  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + (s.total_price || 0), 0);
  }, [filteredSales]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] font-sans text-white">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-rs-surface-tint" />
          </div>
          <h1 className="text-lg font-bold text-white uppercase tracking-wider">Commandes Journalières</h1>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-2 bg-[#1A1A1A] p-3 rounded-xl border border-rs-surface-container-highest/60 mb-3">
          <div className="text-xs text-rs-on-surface-variant flex flex-col gap-0.5">
            <span>Total Recette</span>
            <span className="text-sm font-bold text-white font-mono">{formatCurrency(totalRevenue)}</span>
          </div>
          <div className="text-xs text-rs-on-surface-variant flex flex-col gap-0.5 items-end">
            <span>Nb Commandes</span>
            <span className="text-sm font-bold text-white font-mono">{filteredSales.length}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher facture, client, paiement..."
            className="w-full h-11 bg-rs-surface-container border border-rs-surface-container-highest rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-rs-surface-tint text-white placeholder-rs-on-surface-variant/50"
          />
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-rs-on-surface-variant/60" />
        </div>
      </header>

      {/* List */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-rs-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[32px] text-rs-surface-tint mb-2">refresh</span>
            <span>Chargement des ventes...</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-20 text-rs-on-surface-variant">
            <FileText className="h-12 w-12 mx-auto text-rs-on-surface-variant opacity-40 mb-3" />
            <p>Aucune vente enregistrée aujourd'hui.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredSales.map(sale => (
              <div 
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className="bg-[#141414] border border-rs-surface-container-highest rounded-2xl p-4 flex flex-col gap-3 shadow-md active:bg-rs-surface-container-low transition-all"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-mono text-sm font-bold text-white">#{sale.invoice_number}</h3>
                      <span className="text-[10px] bg-rs-surface-tint/15 text-rs-surface-tint px-1.5 py-0.5 rounded uppercase font-semibold">
                        {sale.sale_type || 'Détail'}
                      </span>
                    </div>
                    <p className="text-xs text-rs-on-surface-variant mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(sale.created_at, 'Pp')}
                    </p>
                  </div>
                  <span className="font-mono text-base font-bold text-white">
                    {formatCurrency(sale.total_price)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-rs-surface-container/30 text-xs">
                  <div className="text-rs-on-surface-variant truncate">
                    Client: <span className="text-white font-semibold">{sale.customer_name || 'Anonyme'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-rs-on-surface-variant uppercase font-mono">{sale.payment_method}</span>
                    {sale.status === 'paid' || sale.order_status === 'paid' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Sale Items Sheet */}
      <Sheet open={selectedSale !== null} onOpenChange={() => setSelectedSale(null)}>
        <SheetContent side="bottom" className="h-[80%] bg-[#141414] text-white border-t border-rs-surface-container-highest rounded-t-2xl p-6 dark">
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="text-xl font-mono font-bold text-rs-surface-tint">
              Détails Commande #{selectedSale?.invoice_number}
            </SheetTitle>
          </SheetHeader>
          {selectedSale && (
            <div className="space-y-4 overflow-y-auto max-h-[85%] pb-6">
              <div className="bg-rs-surface-container p-3 rounded-xl border border-rs-surface-container-highest/60 text-sm space-y-1.5">
                <p><span className="text-rs-on-surface-variant">Client:</span> {selectedSale.customer_name || 'Anonyme'}</p>
                {selectedSale.customer_phone && <p><span className="text-rs-on-surface-variant">Téléphone:</span> {selectedSale.customer_phone}</p>}
                <p><span className="text-rs-on-surface-variant">Paiement:</span> {selectedSale.payment_method?.toUpperCase()}</p>
                <p><span className="text-rs-on-surface-variant">Date:</span> {formatDate(selectedSale.created_at, 'Pp')}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase text-rs-on-surface-variant tracking-wider font-bold">Articles</p>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                  {selectedSale.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg bg-rs-surface-container-lowest border border-rs-surface-container">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-sm font-semibold truncate">{item.product_name || item.name}</p>
                        <p className="text-xs text-rs-on-surface-variant font-mono">
                          {item.quantity} x {formatCurrency(item.unit_price || item.price)}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-bold text-white shrink-0">
                        {formatCurrency((item.quantity || 1) * (item.unit_price || item.price || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-rs-surface-container/60">
                <span className="text-base font-bold text-rs-on-surface">Total</span>
                <span className="text-xl font-mono font-bold text-rs-surface-tint">
                  {formatCurrency(selectedSale.total_price)}
                </span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
