import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useSalesStore, DEFAULT_SESSION } from '@/stores/useSalesStore';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useToast } from '@/hooks/use-toast';
import { explainSaleError } from '@/utils/saleError';
import { useProductSearch } from '@/hooks/useProductSearch';
import { format } from 'date-fns';
import { ChevronDown, Plus, Minus, Search, Trash2, User, ArrowLeft, ShoppingCart } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';

export function MobileSalesModule({ mode, onBack }: { mode: 'vente-detail' | 'facturation-detail' | 'facturation-gros' | 'proforma', onBack?: () => void }) {
    const { t } = useTranslation();
    const { formatCurrency } = useFormatters();
    const { sessions, updateSession, clearSession } = useSalesStore();
    const { clients } = useMasterDataStore();
    const { toast } = useToast();

    const currentSession = sessions[mode] || DEFAULT_SESSION;

    const lineItems = (currentSession.lineItems || []) as any[];
    const { customerName, orderRef } = currentSession;

    const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
    const [isClientSheetOpen, setIsClientSheetOpen] = useState(false);
    const [storeId, setStoreId] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        OfflineAuthService.getOfflineSession().then(offlineSession => {
            if (offlineSession?.user?.user_metadata?.store_id) {
                setStoreId(offlineSession.user.user_metadata.store_id);
            }
        });
    }, []);

    const { search, setSearch, results, isLoading } = useProductSearch(storeId, isProductSheetOpen);

    const activeTier = mode === 'facturation-gros' ? 3 : 1;

    const getProductPrice = (product: any, tier: number) => {
        if (mode === 'facturation-gros') return product.selling_price_3 || product.selling_price_2 || product.unit_price;
        switch(tier) {
            case 1: return product.unit_price;
            case 2: return product.selling_price_2 || product.unit_price;
            case 3: return product.selling_price_3 || product.unit_price;
            case 4: return product.selling_price_4 || product.unit_price;
            default: return product.unit_price;
        }
    };

    const handleAddProduct = (product: any) => {
        const existingIndex = lineItems.findIndex(i => i.product.id === product.id && i.isBox === false);
        const unitPrice = getProductPrice(product, activeTier);
        
        let newItems = [...lineItems];
        if (existingIndex >= 0) {
            newItems[existingIndex] = {
                ...newItems[existingIndex],
                quantity: newItems[existingIndex].quantity + 1,
            };
        } else {
            newItems.push({
                product,
                quantity: 1,
                unitPrice,
                discountPercent: 0,
                discountAmount: 0,
                isBox: false,
                packSize: product.pack_size || 1,
            });
        }
        updateSession(mode, { lineItems: newItems });
        setIsProductSheetOpen(false);
    };

    const updateQuantity = (index: number, delta: number) => {
        const newItems = [...lineItems];
        const newQ = newItems[index].quantity + delta;
        if (newQ > 0) {
            newItems[index].quantity = newQ;
            updateSession(mode, { lineItems: newItems });
        }
    };

    const removeItem = (index: number) => {
        const newItems = lineItems.filter((_, i) => i !== index);
        updateSession(mode, { lineItems: newItems });
    };

    const total = useMemo(() => {
        return lineItems.reduce<number>((acc, item) => {
            const multiplier = item.isBox ? (Number(item.conditionnement) || 1) : 1;
            const itemPrice = Number(item.unitPrice) || 0;
            const itemQty = Number(item.quantity) || 0;
            const itemDiscount = Number(item.discountAmount) || 0;
            return acc + (itemPrice * itemQty * multiplier) - itemDiscount;
        }, 0);
    }, [lineItems]);

    const handleCheckout = async (paymentMethod: 'cash' | 'card' | 'mobile') => {
        setIsProcessing(true);
        try {
            let userId = '';
            let sid = storeId;
            const offlineSession = await OfflineAuthService.getOfflineSession();
            if (offlineSession?.user) {
                userId = offlineSession.user.id;
                sid = offlineSession.user.user_metadata?.store_id;
            }
            if (!sid) throw new Error('No store assigned');

            const saleType = mode === 'proforma' ? 'proforma' : (mode === 'facturation-gros' ? 'gros' : 'detail');
            
            const { error } = await OfflineSalesService.createSale({
                store_id: sid,
                worker_id: userId,
                // Two bugs lived in this map, both silent:
                //
                // 1. `quantity` sent the raw line quantity even for a box/pack
                //    line, while the total above multiplies by conditionnement.
                //    Selling 3 cartons of 12 charged for 36 pieces but the
                //    sale_items_ai trigger deducted only 3 units, so stock
                //    drifted UPWARD by (packSize-1)x qty on every mobile box
                //    sale - phantom inventory and missed reorders. The desktop
                //    path already converts to units before submitting.
                // 2. The key was `price`, but OfflineSalesService's mapper
                //    reads unit_price/unitPrice and total/lineTotal. Neither
                //    matched, so every mobile line item persisted at 0 CFA -
                //    the sale header total looked right while item-level
                //    reports, reprinted invoices and top-product revenue all
                //    read zero.
                items: lineItems.map(item => {
                    const multiplier = item.isBox ? (Number(item.conditionnement) || 1) : 1;
                    const unitPrice = Number(item.unitPrice) || 0;
                    const qtyUnits = (Number(item.quantity) || 0) * multiplier;
                    const discount = Number(item.discountAmount) || 0;
                    return {
                        product: item.product,
                        quantity: qtyUnits,
                        unit_price: unitPrice,
                        discount,
                        total: Math.round(unitPrice * qtyUnits - discount),
                    };
                }),
                total_price: total,
                payment_method: paymentMethod,
                sale_type: saleType,
                customer_name: customerName,
                notes: orderRef,
            });

            if (error) throw error;

            toast({ title: t('worker.sales.saleRecorded'), description: `${t('worker.sales.total')}: ${formatCurrency(total)}` });
            clearSession(mode);
        } catch (err: any) {
            console.error('[MobileSalesModule] Sale recording failed:', err);
            toast({ variant: 'destructive', title: 'Erreur', description: explainSaleError(err) });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] md:pb-0 font-sans">
            {/* Header */}
            <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-3 sticky top-0 z-10 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {onBack && (
                            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                        )}
                        <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-rs-surface-tint" />
                        </div>
                        <h1 className="text-lg font-bold text-white uppercase tracking-wider">
                            {mode.replace('-', ' ')}
                        </h1>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsClientSheetOpen(true)}
                        className="flex-1 bg-rs-surface-container px-3 py-2 rounded-lg flex items-center gap-2 border border-rs-surface-container-highest active:scale-95 transition-all"
                    >
                        <User className="w-4 h-4 text-rs-surface-tint" />
                        <span className="text-sm font-medium text-white truncate">
                            {customerName || 'Sélectionner Client'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-rs-on-surface-variant ml-auto" />
                    </button>
                    
                    <button 
                        onClick={() => setIsProductSheetOpen(true)}
                        className="flex-1 bg-rs-surface-tint text-rs-on-primary px-3 py-2 rounded-lg flex items-center justify-center gap-2 font-bold active:scale-95 transition-all shadow-lg"
                    >
                        <Search className="w-4 h-4" />
                        <span>Ajouter Produit</span>
                    </button>
                </div>
            </header>

            {/* Cart List */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {lineItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-4">
                        <ShoppingCart className="w-16 h-16 text-rs-on-surface-variant" />
                        <p className="text-lg font-medium text-rs-on-surface">Panier vide</p>
                    </div>
                ) : (
                    lineItems.map((item, idx) => {
                        const lineTotal = (item.unitPrice * item.quantity * (item.isBox ? item.packSize : 1)) - item.discountAmount;
                        return (
                            <div key={idx} className="bg-[#141414] rounded-xl p-3 border border-rs-surface-container-highest flex flex-col gap-3">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white text-base leading-tight">{item.product.name}</h3>
                                        <div className="flex gap-2 text-xs text-rs-surface-tint mt-1 font-medium">
                                            <span>{formatCurrency(item.unitPrice)}</span>
                                        </div>
                                    </div>
                                    <span className="font-bold text-lg text-white font-mono">{formatCurrency(lineTotal)}</span>
                                </div>
                                <div className="flex items-center justify-between border-t border-rs-surface-container pt-3">
                                    <div className="flex items-center bg-rs-surface-container-low rounded-lg border border-rs-surface-container-highest overflow-hidden">
                                        <button onClick={() => updateQuantity(idx, -1)} className="w-10 h-10 flex items-center justify-center text-rs-surface-tint active:bg-rs-surface-container">
                                            <Minus className="w-5 h-5" />
                                        </button>
                                        <div className="w-12 text-center font-bold text-white text-lg">{item.quantity}</div>
                                        <button onClick={() => updateQuantity(idx, 1)} className="w-10 h-10 flex items-center justify-center text-rs-surface-tint active:bg-rs-surface-container">
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <button onClick={() => removeItem(idx)} className="w-10 h-10 rounded-full flex items-center justify-center text-red-400 bg-red-400/10 active:scale-95">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="bg-[#141414] border-t border-rs-surface-container-highest px-4 py-3 flex flex-col gap-3 z-40 pb-safe">
                <div className="flex justify-between items-end">
                    <span className="font-bold tracking-tight text-rs-on-surface text-xl">NET À PAYER</span>
                    <div className="bg-[#0C0C0C] px-5 py-2 rounded border border-rs-surface-container-highest">
                        <span className="font-mono text-2xl font-bold leading-none text-rs-surface-tint tracking-tight">{formatCurrency(total)}</span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        disabled={lineItems.length === 0 || isProcessing}
                        onClick={() => handleCheckout('cash')}
                        className="flex-[2] h-[48px] rounded-lg bg-rs-surface-tint text-rs-on-primary font-bold flex items-center justify-center hover:bg-rs-primary-fixed active:scale-95 transition-all shadow-lg uppercase tracking-wide disabled:opacity-50 text-sm">
                        {isProcessing ? 'TRAITEMENT...' : 'VALIDER & PAYER'}
                    </button>
                </div>
            </div>

            {/* Product Lookup Sheet */}
            <Sheet open={isProductSheetOpen} onOpenChange={setIsProductSheetOpen}>
                <SheetContent side="bottom" className="h-[90vh] bg-[#0a0a0a] border-t border-rs-surface-container-highest flex flex-col p-0">
                    <SheetHeader className="px-4 pt-4 pb-2 border-b border-rs-surface-container text-left">
                        <SheetTitle className="text-white text-lg font-bold">Chercher un produit</SheetTitle>
                        <Input 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Nom du produit ou code-barres..."
                            className="bg-[#141414] border-rs-surface-container-highest text-white mt-2 h-12"
                            autoFocus
                        />
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                        {isLoading ? (
                            <p className="text-rs-on-surface-variant text-center pt-8">Recherche...</p>
                        ) : results?.map((p: any) => (
                            <button key={p.id} onClick={() => handleAddProduct(p)} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest active:bg-rs-surface-container transition-colors text-left">
                                <div>
                                    <p className="font-bold text-white text-sm">{p.name}</p>
                                    <p className="text-xs text-rs-on-surface-variant">Code: {p.code_barre || 'N/A'}</p>
                                </div>
                                <span className="font-bold text-rs-surface-tint">{formatCurrency(getProductPrice(p, activeTier))}</span>
                            </button>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Client Lookup Sheet */}
            <Sheet open={isClientSheetOpen} onOpenChange={setIsClientSheetOpen}>
                <SheetContent side="bottom" className="h-[80vh] bg-[#0a0a0a] border-t border-rs-surface-container-highest flex flex-col p-0">
                    <SheetHeader className="px-4 pt-4 pb-2 border-b border-rs-surface-container text-left">
                        <SheetTitle className="text-white text-lg font-bold">Sélectionner un Client</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                        {clients.map((c: any) => (
                            <button key={c.id} onClick={() => {
                                updateSession(mode, { customerName: c.nom_societe || c.nom_contact, customerCode: c.code_client });
                                setIsClientSheetOpen(false);
                            }} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest active:bg-rs-surface-container transition-colors text-left">
                                <p className="font-bold text-white text-sm">{c.nom_societe || c.nom_contact}</p>
                            </button>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
