import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useToast } from '@/hooks/use-toast';
import { useProductSearch } from '@/hooks/useProductSearch';
import { useFormatters } from '@/utils/formatting';
import { ShoppingBag, Plus, Minus, User, Send, Save, ArrowLeft } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';

export function MobileCommandeManuelle({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatCurrency } = useFormatters();
  const { suppliers, fetchSuppliers, createOrder } = usePurchasingStore();

  const [storeId, setStoreId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [isSupplierSheetOpen, setIsSupplierSheetOpen] = useState(false);
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    OfflineAuthService.getOfflineSession().then(session => {
        if (session?.user?.user_metadata?.store_id) {
            setStoreId(session.user.user_metadata.store_id);
            fetchSuppliers(session.user.user_metadata.store_id);
        }
    });
  }, []);

  const { search, setSearch, results, isLoading } = useProductSearch(storeId, isProductSheetOpen);

  const getSupplierDefaultPrice = (supplierId: string, product: any) => {
    const s = suppliers.find(sup => sup.id === supplierId);
    if (!s) return product.cost_price || 0;
    switch(s.default_purchase_type) {
        case 'wholesale': return product.wholesale_price_ttc || product.wholesale_price_ht || product.selling_price_3 || 0;
        case 'resale': return product.selling_price_4 || product.selling_price_2 || 0;
        case 'discount': return product.selling_price_2 || 0;
        default: return product.cost_price || 0;
    }
  };

  const handleAddProduct = (product: any) => {
    setItems(prev => {
        const existing = prev.find(i => i.product_id === product.id);
        if (existing) {
            return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
        }
        return [...prev, {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_cost: getSupplierDefaultPrice(selectedSupplierId, product),
        }];
    });
    setIsProductSheetOpen(false);
  };

  const updateQuantity = (index: number, delta: number) => {
    setItems(prev => {
        const next = [...prev];
        const newQ = next[index].quantity + delta;
        if (newQ > 0) {
            next[index].quantity = newQ;
        }
        return next;
    });
  };

  const handleCreateOrder = async (status: 'draft' | 'ordered') => {
    if (items.length === 0) return;
    setIsProcessing(true);
    try {
        const payloadItems = items.map(r => ({
            product_id: r.product_id,
            quantity_ordered: r.quantity,
            unit_cost: r.unit_cost,
        }));
        
        await createOrder(
          {
            store_id: storeId,
            supplier_id: selectedSupplierId || undefined,
            status,
            total_amount: totalCost,
          },
          payloadItems
        );
        toast({ title: status === 'ordered' ? "Commande Envoyée" : "Brouillon Sauvegardé" });
        setItems([]);
        setSelectedSupplierId('');
    } catch (err: any) {
        toast({ variant: 'destructive', title: "Erreur", description: err.message });
    } finally {
        setIsProcessing(false);
    }
  };

  const totalCost = items.reduce((acc, item) => acc + (item.quantity * item.unit_cost), 0);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] md:pb-0 font-sans">
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-3 sticky top-0 z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
            {onBack && (
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
                    <ArrowLeft className="w-6 h-6" />
                </button>
            )}
            <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-rs-surface-tint" />
            </div>
            <h1 className="text-lg font-bold text-white uppercase tracking-wider">Commande Manuelle</h1>
        </div>

        <button onClick={() => setIsSupplierSheetOpen(true)} className="w-full bg-rs-surface-container px-3 py-2 rounded-lg flex items-center gap-2 border border-rs-surface-container-highest">
            <User className="w-4 h-4 text-rs-surface-tint" />
            <span className="text-sm font-medium text-white truncate">
                {selectedSupplierId ? suppliers.find(s => s.id === selectedSupplierId)?.name : 'Choisir Fournisseur (Optionnel)'}
            </span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-4">
                <ShoppingBag className="w-16 h-16 text-rs-on-surface-variant" />
                <p className="text-lg font-medium text-rs-on-surface">Panier vide</p>
                <button onClick={() => setIsProductSheetOpen(true)} className="mt-4 px-6 py-3 bg-rs-surface-tint text-rs-on-primary rounded-full font-bold flex items-center gap-2">
                    <Plus className="w-5 h-5" /> Ajouter Produit
                </button>
            </div>
        ) : (
            <>
                <button onClick={() => setIsProductSheetOpen(true)} className="w-full py-3 border border-dashed border-rs-surface-tint text-rs-surface-tint rounded-xl font-bold flex items-center justify-center gap-2 mb-4">
                    <Plus className="w-5 h-5" /> Ajouter Article
                </button>
                {items.map((item, idx) => (
                    <div key={idx} className="bg-[#141414] rounded-xl p-3 border border-rs-surface-container-highest flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-white text-base leading-tight flex-1">{item.product_name}</h3>
                            <Input 
                                type="number"
                                value={item.unit_cost}
                                onChange={(e) => {
                                    const next = [...items];
                                    next[idx].unit_cost = Number(e.target.value);
                                    setItems(next);
                                }}
                                className="w-24 h-8 bg-[#0a0a0a] border-rs-surface-container-highest text-white font-semibold font-mono text-right text-sm px-2 focus-visible:ring-rs-surface-tint focus-visible:ring-1"
                            />
                        </div>
                        <div className="flex items-center justify-between border-t border-rs-surface-container pt-3">
                            <div className="flex items-center bg-rs-surface-container-low rounded-lg border border-rs-surface-container-highest overflow-hidden">
                                <button onClick={() => updateQuantity(idx, -1)} className="w-10 h-10 flex items-center justify-center text-rs-surface-tint"><Minus className="w-5 h-5" /></button>
                                <div className="w-12 text-center font-bold text-white text-lg">{item.quantity}</div>
                                <button onClick={() => updateQuantity(idx, 1)} className="w-10 h-10 flex items-center justify-center text-rs-surface-tint"><Plus className="w-5 h-5" /></button>
                            </div>
                            <span className="font-bold text-lg text-white font-mono">{formatCurrency(item.unit_cost * item.quantity)}</span>
                        </div>
                    </div>
                ))}
            </>
        )}
      </div>

      <div className="bg-[#141414] border-t border-rs-surface-container-highest px-4 py-3 flex flex-col gap-3 z-40 pb-safe">
        <div className="flex justify-between items-end">
            <span className="font-bold tracking-tight text-rs-on-surface text-sm">TOTAL</span>
            <span className="font-mono text-2xl font-bold text-rs-surface-tint tracking-tight">{formatCurrency(totalCost)}</span>
        </div>
        <div className="flex gap-2">
            <button 
                disabled={items.length === 0 || isProcessing}
                onClick={() => handleCreateOrder('draft')}
                className="flex-[1] h-[48px] rounded-lg bg-rs-surface-container text-white font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
                <Save className="w-5 h-5" />
            </button>
            <button 
                disabled={items.length === 0 || isProcessing}
                onClick={() => handleCreateOrder('ordered')}
                className="flex-[3] h-[48px] rounded-lg bg-rs-surface-tint text-rs-on-primary font-bold flex items-center justify-center gap-2 active:scale-95 shadow-lg uppercase tracking-wide disabled:opacity-50"
            >
                {isProcessing ? 'En cours...' : <><Send className="w-5 h-5" /> Envoyer</>}
            </button>
        </div>
      </div>

      <Sheet open={isSupplierSheetOpen} onOpenChange={setIsSupplierSheetOpen}>
        <SheetContent side="bottom" className="h-[70vh] bg-[#0a0a0a] border-t border-rs-surface-container-highest p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-rs-surface-container text-left"><SheetTitle className="text-white">Choisir Fournisseur</SheetTitle></SheetHeader>
            <div className="overflow-y-auto px-4 py-2 space-y-2">
                {suppliers.map(s => (
                    <button key={s.id} onClick={() => { setSelectedSupplierId(s.id); setIsSupplierSheetOpen(false); }} className="w-full text-left p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest font-bold text-white">
                        {s.name}
                    </button>
                ))}
            </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isProductSheetOpen} onOpenChange={setIsProductSheetOpen}>
        <SheetContent side="bottom" className="h-[90vh] bg-[#0a0a0a] border-t border-rs-surface-container-highest p-0 flex flex-col">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-rs-surface-container text-left">
                <SheetTitle className="text-white text-lg font-bold">Chercher un produit</SheetTitle>
                <Input 
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Recherche..." className="bg-[#141414] border-rs-surface-container-highest text-white mt-2 h-12" autoFocus
                />
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                {results?.map((p: any) => (
                    <button key={p.id} onClick={() => handleAddProduct(p)} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest active:bg-rs-surface-container text-left">
                        <div>
                            <p className="font-bold text-white text-sm">{p.name}</p>
                        </div>
                        <span className="font-bold text-rs-surface-tint">{formatCurrency(getSupplierDefaultPrice(selectedSupplierId, p))}</span>
                    </button>
                ))}
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
