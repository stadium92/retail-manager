import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { CreditCard, ArrowRight, User } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function MobileReglementsFournisseurs() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatCurrency } = useFormatters();
  const { suppliers, fetchSuppliers } = usePurchasingStore();

  const [storeId, setStoreId] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'bank_transfer'>('cash');
  const [reference, setReference] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    OfflineAuthService.getOfflineSession().then(session => {
        if (session?.user?.user_metadata?.store_id) {
            setStoreId(session.user.user_metadata.store_id);
            fetchSuppliers(session.user.user_metadata.store_id);
        }
    });
  }, []);

  const handlePay = async () => {
    if (!selectedSupplier || amount <= 0) return;
    setIsProcessing(true);
    try {
        const payload = {
            store_id: storeId,
            supplier_id: selectedSupplier.id,
            amount: amount,
            payment_method: paymentMethod,
            reference_number: reference,
            payment_date: new Date().toISOString()
        };
        
        await OfflineAuthService.localBridgeRequest('/rest/v1/supplier_payments', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        toast({ title: "Paiement Enregistré" });
        setSelectedSupplier(null);
        setAmount(0);
        setReference('');
        fetchSuppliers(storeId);
    } catch (err: any) {
        toast({ variant: 'destructive', title: "Erreur", description: err.message });
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] md:pb-0 font-sans">
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-3 sticky top-0 z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-rs-surface-tint" />
            </div>
            <h1 className="text-lg font-bold text-white uppercase tracking-wider">Règlement Fournisseur</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {suppliers.map(s => (
            <button key={s.id} onClick={() => setSelectedSupplier(s)} className="w-full bg-[#141414] rounded-xl p-4 border border-rs-surface-container-highest flex items-center justify-between active:bg-rs-surface-container text-left">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rs-surface-container flex items-center justify-center">
                        <User className="w-5 h-5 text-rs-on-surface-variant" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">{s.name}</h3>
                        <p className="text-sm text-rs-surface-tint font-bold">Solde: {formatCurrency(s.balance || 0)}</p>
                    </div>
                </div>
                <ArrowRight className="w-5 h-5 text-rs-on-surface-variant" />
            </button>
        ))}
      </div>

      <Sheet open={!!selectedSupplier} onOpenChange={(open) => !open && setSelectedSupplier(null)}>
        <SheetContent side="bottom" className="h-[70vh] bg-[#0a0a0a] border-t border-rs-surface-container-highest flex flex-col p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-rs-surface-container text-left">
                <SheetTitle className="text-white">Payer {selectedSupplier?.name}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                <div className="bg-[#141414] border border-rs-surface-container p-4 rounded-xl text-center">
                    <p className="text-sm text-rs-on-surface-variant font-medium">Solde Actuel</p>
                    <p className="text-2xl font-bold font-mono text-rs-surface-tint mt-1">{formatCurrency(selectedSupplier?.balance || 0)}</p>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-rs-on-surface-variant mb-1 block">Montant du Paiement</label>
                        <Input 
                            type="number"
                            value={amount || ''}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            className="bg-[#141414] border-rs-surface-container text-white h-14 text-xl font-bold font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-rs-on-surface-variant mb-1 block">Méthode de paiement</label>
                        <div className="flex gap-2">
                            <button onClick={() => setPaymentMethod('cash')} className={`flex-1 py-3 rounded-lg border font-bold ${paymentMethod === 'cash' ? 'bg-rs-surface-tint/20 border-rs-surface-tint text-rs-surface-tint' : 'border-rs-surface-container text-rs-on-surface-variant'}`}>Espèces</button>
                            <button onClick={() => setPaymentMethod('bank_transfer')} className={`flex-1 py-3 rounded-lg border font-bold ${paymentMethod === 'bank_transfer' ? 'bg-rs-surface-tint/20 border-rs-surface-tint text-rs-surface-tint' : 'border-rs-surface-container text-rs-on-surface-variant'}`}>Virement / Chèque</button>
                        </div>
                    </div>
                    {paymentMethod === 'bank_transfer' && (
                        <div>
                            <label className="text-sm font-bold text-rs-on-surface-variant mb-1 block">Référence Bancaire</label>
                            <Input 
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="bg-[#141414] border-rs-surface-container text-white h-12"
                            />
                        </div>
                    )}
                </div>
            </div>
            <div className="bg-[#141414] border-t border-rs-surface-container-highest px-4 py-3 z-40 pb-safe">
                <button 
                    disabled={amount <= 0 || isProcessing}
                    onClick={handlePay}
                    className="w-full h-[48px] rounded-lg bg-rs-surface-tint text-rs-on-primary font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 uppercase tracking-wide shadow-lg"
                >
                    {isProcessing ? 'En cours...' : 'Enregistrer Paiement'}
                </button>
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
