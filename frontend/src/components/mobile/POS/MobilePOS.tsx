import React, { useState, useEffect } from 'react';
import { usePOSStore } from '@/stores/usePOSStore';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { CheckoutModal } from '@/pages/worker/components/CheckoutModal';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useToast } from '@/hooks/use-toast';
import { explainSaleError } from '@/utils/saleError';
import { useProductSearch } from '@/hooks/useProductSearch';
import { NotificationCenter } from '@/components/shared/NotificationCenter';
import { BarcodeScanner } from '@/components/shared/BarcodeScanner';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';

interface MobilePOSProps {
    onBack?: () => void;
    /**
     * The bottom tab row, fused directly into this screen's own fixed-bottom
     * panel instead of being rendered as a separate, independently-fixed
     * sibling. Two independently-positioned elements that merely calculate
     * matching offsets can still visibly desync (e.g. during a mobile
     * browser's address-bar collapse mid-scroll); rendering them as one
     * continuous box removes the seam entirely rather than trying to keep
     * both sides of it in sync.
     */
    tabBar?: React.ReactNode;
}

export function MobilePOS({ onBack, tabBar }: MobilePOSProps) {
    const { t } = useTranslation();
    const { formatCurrency } = useFormatters();
    const {
        cart,
        activeRow,
        addItem,
        setActiveRow,
        updateQuantity,
        removeItem,
        saleType,
        setSaleType,
        getTotal,
        grandTotal,
        clearCart,
        customerName,
        customerPhone,
        setCustomer,
    } = usePOSStore();

    const [orderNotes, setOrderNotes] = useState('');
    const [serviceType, setServiceType] = useState<'table' | 'emporter'>('emporter');
    const [globalDiscount, setGlobalDiscount] = useState(0);
    const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
    const [discountInputValue, setDiscountInputValue] = useState('');
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const { toast } = useToast();

    const handleScanResult = async (code: string) => {
        try {
            const items = await OfflineInventoryService.fetchInventory(storeId);
            const product = items.find((p: any) => p.barcode === code || p.sku === code);
            if (product) {
                addItem(product);
                toast({
                    title: 'Produit ajouté',
                    description: product.name,
                    duration: 1500,
                });
                setIsScannerOpen(false);
            } else {
                toast({
                    variant: "destructive",
                    title: 'Produit non trouvé',
                    description: `Code-barres: ${code}`,
                });
            }
        } catch (error) {
            console.error('Scan error:', error);
        }
    };


    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
    const [storeId, setStoreId] = useState<string>('');

    useEffect(() => {
        OfflineAuthService.getOfflineSession().then(offlineSession => {
            const sid = offlineSession?.roles?.find((r: any) => r.store_id)?.store_id || offlineSession?.user?.user_metadata?.store_id;
            if (sid) {
                setStoreId(sid);
            }
        });
    }, []);

    const { search, setSearch, results, isLoading } = useProductSearch(storeId, isProductSheetOpen);

    const handleCheckout = async (data: {
        amountData: { total: number };
        paymentMethod: 'cash' | 'card' | 'mobile' | 'credit';
        saleType: 'detail' | 'gros' | 'proforma';
        customerName?: string;
        customerPhone?: string;
    }) => {
        const dbPaymentMethod = data.paymentMethod === 'mobile' ? 'cash' : data.paymentMethod;
        setIsProcessing(true);
        try {
            let userId = '';
            let sid = storeId;

            const offlineSession = await OfflineAuthService.getOfflineSession();
            if (offlineSession?.user) {
                userId = offlineSession.user.id;
                sid = offlineSession.roles?.find((r: any) => r.store_id)?.store_id || offlineSession.user.user_metadata?.store_id || storeId;
            }

            if (!sid) {
                toast({ variant: "destructive", title: t('common.error'), description: t('worker.sales.noStoreAssigned') });
                return;
            }

            const { error } = await OfflineSalesService.createSale({
                store_id: sid,
                worker_id: userId,
                items: cart,
                total_price: data.amountData.total,
                payment_method: dbPaymentMethod,
                sale_type: data.saleType,
                customer_name: customerName || data.customerName,
                customer_phone: customerPhone || data.customerPhone,
                notes: orderNotes,
                order_type: serviceType,
            });

            if (error) throw error;

            toast({
                title: data.saleType === 'proforma' ? t('menu.sales.proforma') : t('worker.sales.saleRecorded'),
                description: `${t('worker.sales.total')}: ${formatCurrency(data.amountData.total)}`,
            });

            clearCart();
            setIsCheckoutOpen(false);
            onBack?.();

        } catch (err) {
            console.error('[MobilePOS] Sale recording failed:', err);
            toast({ variant: "destructive", title: t('worker.sales.errorRecording'), description: explainSaleError(err) });
        } finally {
            setIsProcessing(false);
        }
    };

    if (isProductSheetOpen) {
        return (
            <div className="antialiased h-[100svh] flex flex-col pt-safe md:pb-0 bg-[#0C0C0C] text-rs-on-surface dark">
                <header className="shrink-0 h-[56px] border-b border-rs-surface-container-highest bg-rs-surface flex items-center px-4 z-50 gap-3">
                    <button onClick={() => setIsProductSheetOpen(false)} className="active:scale-95 transition-transform duration-150 p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-rs-on-surface-variant">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex-1 relative">
                        <input
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Rechercher un article..."
                            className="w-full bg-rs-surface-container-low text-rs-on-surface h-[40px] rounded-full px-4 pl-10 focus:outline-none border border-rs-surface-container-highest focus:border-rs-surface-tint"
                        />
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-rs-on-surface-variant">search</span>
                    </div>
                </header>
                <main className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-2">
                    {isLoading ? (
                        <div className="text-center text-rs-on-surface-variant mt-10 flex flex-col items-center">
                            <span className="material-symbols-outlined animate-spin text-[32px] text-rs-surface-tint mb-2">refresh</span>
                            Recherche en cours...
                        </div>
                    ) : results.length === 0 ? (
                        <div className="text-center text-rs-on-surface-variant mt-10">Aucun produit trouvé</div>
                    ) : (
                        results.map((product: any) => (
                            <div 
                                key={product.id} 
                                onClick={() => { addItem(product, 1); setIsProductSheetOpen(false); }} 
                                className="bg-rs-surface border border-rs-surface-container-highest p-3 rounded-lg flex justify-between items-center active:bg-rs-surface-container-low transition-colors shadow-sm"
                            >
                                <div className="flex flex-col">
                                    <span className="font-semibold text-rs-on-surface text-rs-body-base">{product.name}</span>
                                    <span className="text-rs-helper-xs text-rs-on-surface-variant uppercase tracking-wide">{product.category || product.category_name || 'Général'}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-rs-surface-tint font-mono font-bold text-rs-body-base">{formatCurrency(product.unit_price ?? 0)}</span>
                                    <span className={`text-[10px] ${product.quantity > 0 ? 'text-rs-secondary-container' : 'text-rs-error'}`}>{product.quantity > 0 ? `Stock: ${product.quantity}` : 'Rupture'}</span>
                                </div>
                            </div>
                        ))
                    )}
                </main>
                {tabBar}
            </div>
        );
    }

    return (
        <div className="antialiased h-[100svh] flex flex-col pt-safe md:pb-0 bg-[#0C0C0C] text-rs-on-surface dark">
            {/* TopAppBar */}
            <header className="shrink-0 h-[56px] border-b border-rs-surface-container-highest bg-rs-surface flex justify-between items-center px-4 z-50">
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <h1 className="font-bold text-rs-surface-tint uppercase tracking-tight text-lg">TICKET COMMANDE</h1>
                        <span className="text-sm text-rs-on-surface-variant font-mono">Mobile POS</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button className="active:scale-95 transition-transform duration-150 p-2 rounded-full hover:bg-rs-surface-container-highest text-rs-on-surface-variant" onClick={() => window.print()}>
                        <span className="material-symbols-outlined">print</span>
                    </button>
                    <NotificationCenter />
                </div>
            </header>

            {/* Main Canvas */}
            <main className="flex-1 min-h-0 overflow-y-auto px-4 py-5 flex flex-col gap-5">
                
                {/* Ticket Meta Row */}
                <section className="bg-[#141414] rounded-lg p-3 flex flex-wrap gap-3 justify-between items-center border border-rs-surface-container-highest">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-rs-on-surface-variant uppercase">Date / Heure</span>
                        <span className="text-sm">Ven 12/06/2026 - 09:45:50</span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                        <span className="text-xs text-rs-on-surface-variant uppercase">Statut</span>
                        <div className="bg-rs-secondary-container/20 text-rs-secondary border border-rs-secondary-container/50 px-2 py-1 rounded-full flex items-center justify-center">
                            <span className="text-xs uppercase font-bold tracking-wide">En ligne</span>
                        </div>
                    </div>
                </section>

                {/* Informations Client */}
                <details className="group" id="client-info-details">
                    <summary className="flex justify-between items-center p-3 cursor-pointer list-none font-medium text-rs-on-surface bg-rs-surface-container-low hover:bg-rs-surface-container-highest transition-colors rounded-lg border border-rs-surface-container-highest">
                        Informations Client
                        <span className="material-symbols-outlined text-rs-on-surface-variant transition-transform duration-200 group-open:rotate-180">expand_more</span>
                    </summary>
                    <div className="p-3 border-t border-rs-surface-container-highest flex flex-col gap-3 bg-rs-surface-container-lowest rounded-b-lg -mt-1">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-rs-on-surface-variant uppercase tracking-wide">Nom du client</label>
                            <input 
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomer(undefined, e.target.value, customerPhone)}
                                placeholder="Ex: Jean Dupont"
                                className="w-full h-[40px] bg-rs-surface-container-low border border-rs-surface-container-highest rounded-md px-3 text-sm focus:border-rs-surface-tint focus:ring-1 focus:ring-rs-surface-tint outline-none text-rs-on-surface"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-rs-on-surface-variant uppercase tracking-wide">Téléphone</label>
                            <input 
                                type="tel"
                                value={customerPhone}
                                onChange={(e) => setCustomer(undefined, customerName, e.target.value)}
                                placeholder="Ex: 06 12 34 56 78"
                                className="w-full h-[40px] bg-rs-surface-container-low border border-rs-surface-container-highest rounded-md px-3 text-sm focus:border-rs-surface-tint focus:ring-1 focus:ring-rs-surface-tint outline-none text-rs-on-surface"
                            />
                        </div>
                    </div>
                </details>

                {/* Service Selector */}
                <section className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setServiceType('table')}
                            className={`flex-1 h-[48px] rounded-lg border flex items-center justify-center transition-colors active:scale-95 ${serviceType === 'table' ? 'border-rs-surface-tint text-rs-surface-tint bg-rs-surface-tint/10' : 'border-rs-surface-container-highest bg-rs-surface-container-high text-rs-on-surface'}`}
                        >
                            Table / Service
                        </button>
                        <button 
                            onClick={() => setServiceType('emporter')}
                            className={`flex-[1.5] h-[48px] rounded-lg border flex items-center justify-center transition-colors active:scale-95 text-sm ${serviceType === 'emporter' ? 'border-rs-surface-tint text-rs-surface-tint bg-rs-surface-tint/10' : 'border-rs-surface-container-highest bg-rs-surface-container-high text-rs-on-surface'}`}
                        >
                            À Emporter / Sur Place / Livraison
                        </button>
                    </div>
                    <div className="relative w-full">
                        <input 
                            id="order-notes"
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value)}
                            className="w-full h-[48px] bg-rs-surface-container-low border border-rs-surface-container-highest rounded-lg px-4 pt-4 pb-1 text-rs-on-surface focus:border-rs-surface-tint focus:ring-1 focus:ring-[#ffba41] outline-none transition-all peer" 
                            placeholder=" " 
                            type="text" 
                        />
                        <label className="absolute left-4 top-1/2 -translate-y-1/2 text-rs-on-surface-variant transition-all peer-focus:top-1 peer-focus:-translate-y-0 peer-focus:text-[10px] peer-focus:text-rs-surface-tint peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:-translate-y-0 peer-[:not(:placeholder-shown)]:text-[10px]" htmlFor="order-notes">Notes commande</label>
                    </div>
                </section>

                {/* Order Lines List */}
                <section className="flex flex-col gap-2">
                    {cart.map((item, index) => (
                        <div key={`${item.product.id}-${index}`} className={`border rounded-lg min-h-[56px] flex items-center pl-0 pr-4 relative overflow-hidden ${activeRow === index ? 'bg-[#1C1810] border-rs-surface-tint/30' : 'bg-rs-surface border-rs-surface-container-highest'} `} onClick={() => setActiveRow(index)}>
                            {activeRow === index && <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-rs-surface-tint"></div>}
                            <div className="flex-1 pl-4 py-2 flex flex-col justify-center">
                                <span className={`font-semibold leading-tight ${activeRow === index ? 'text-rs-on-surface' : 'text-rs-on-surface-variant'}`}>{item.product.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="flex items-center bg-rs-surface-container-highest rounded-full p-1 border border-rs-surface-container-highest">
                                    <button onClick={(e) => { e.stopPropagation(); if (item.quantity > 1) updateQuantity(index, item.quantity - 1); else removeItem(index); }} className="w-8 h-8 rounded-full flex items-center justify-center text-rs-on-surface hover:bg-rs-surface-container-highest active:scale-90 transition-all">
                                        <span className="material-symbols-outlined text-rs-title-lg">remove</span>
                                    </button>
                                    <span className="w-8 text-center font-mono">{item.quantity}</span>
                                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(index, item.quantity + 1); }} className="w-8 h-8 rounded-full flex items-center justify-center text-rs-on-surface hover:bg-rs-surface-container-highest active:scale-90 transition-all">
                                        <span className="material-symbols-outlined text-rs-title-lg">add</span>
                                    </button>
                                </div>
                                <span className="font-mono text-rs-surface-tint min-w-[60px] text-right">{formatCurrency(item.unitPrice * item.quantity)}</span>
                            </div>
                        </div>
                    ))}
                    <button 
                        onClick={() => setIsProductSheetOpen(true)}
                        className="w-full h-[56px] rounded-lg border-2 border-dashed border-rs-outline/50 hover:border-rs-surface-tint/50 text-rs-on-surface-variant hover:text-rs-surface-tint transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
                        <span className="material-symbols-outlined text-rs-title-lg">add_circle</span>
                        + Ajouter un article
                    </button>
                </section>
            </main>

            {/* Bottom Panel */}
            <div className="shrink-0 max-h-[50vh] overflow-y-auto bg-[#141414] border-t border-rs-surface-container-highest px-4 py-3 flex flex-col gap-3 z-40 pb-safe">
                <div className="flex justify-between items-end">
                    <span className="font-bold tracking-tight text-rs-on-surface text-xl">NET À PAYER</span>
                    <div className="flex flex-col items-end">
                        {globalDiscount > 0 && <span className="text-xs text-rs-surface-tint line-through opacity-70 mb-1">{formatCurrency(getTotal())}</span>}
                        <div className="bg-[#0C0C0C] px-5 py-2 rounded border border-rs-surface-container-highest">
                            <span className="font-mono text-2xl font-bold leading-none text-rs-surface-tint tracking-tight">{formatCurrency(grandTotal > 0 ? grandTotal : getTotal())}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        disabled={cart.length === 0}
                        onClick={() => handleCheckout({
                            amountData: { total: grandTotal > 0 ? grandTotal : getTotal() },
                            paymentMethod: 'cash',
                            saleType: 'proforma'
                        })}
                        className="flex-1 h-[48px] rounded-lg border border-rs-outline text-rs-on-surface flex items-center justify-center hover:bg-rs-surface-container-highest active:scale-95 transition-all uppercase tracking-wide disabled:opacity-50 font-bold text-sm">
                        F2 · VALIDER
                    </button>
                    <button 
                        disabled={cart.length === 0}
                        onClick={() => setIsCheckoutOpen(true)}
                        className="flex-[2] h-[48px] rounded-lg bg-rs-surface-tint text-rs-on-primary font-bold flex items-center justify-center hover:bg-rs-primary-fixed active:scale-95 transition-all shadow-lg shadow-[#ffba41]/20 uppercase tracking-wide disabled:opacity-50 text-sm">
                        F4 · PAYER
                    </button>
                </div>
                <div className="flex justify-between px-2 pt-2 pb-1 w-full">
                    <button className="shrink-0 flex flex-col items-center justify-center w-[72px] gap-1 text-rs-on-surface-variant hover:text-rs-surface-tint transition-colors" onClick={() => {
                        setDiscountInputValue(globalDiscount > 0 ? globalDiscount.toString() : '');
                        setIsDiscountDialogOpen(true);
                    }}>
                        <div className="w-12 h-12 rounded-full bg-rs-surface-container-low border border-rs-surface-container-highest flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined">percent</span>
                        </div>
                        <span className="text-[10px] text-center uppercase">Remise</span>
                    </button>
                    <button className="shrink-0 flex flex-col items-center justify-center w-[72px] gap-1 text-rs-on-surface-variant hover:text-rs-surface-tint transition-colors" onClick={() => {
                        const el = document.getElementById('client-info-details') as HTMLDetailsElement;
                        if (el) {
                            el.open = true;
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }}>
                        <div className="w-12 h-12 rounded-full bg-rs-surface-container-low border border-rs-surface-container-highest flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined">person_add</span>
                        </div>
                        <span className="text-[10px] text-center uppercase">Client</span>
                    </button>
                    <button className="shrink-0 flex flex-col items-center justify-center w-[72px] gap-1 text-rs-on-surface-variant hover:text-rs-surface-tint transition-colors" onClick={() => {
                        document.getElementById('order-notes')?.focus();
                    }}>
                        <div className="w-12 h-12 rounded-full bg-rs-surface-container-low border border-rs-surface-container-highest flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined">note_add</span>
                        </div>
                        <span className="text-[10px] text-center uppercase">Note</span>
                    </button>
                    <button className="shrink-0 flex flex-col items-center justify-center w-[72px] gap-1 text-rs-on-surface-variant hover:text-rs-surface-tint transition-colors" onClick={() => {
                        setIsOptionsOpen(true);
                    }}>
                        <div className="w-12 h-12 rounded-full bg-rs-surface-container-low border border-rs-surface-container-highest flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined">more_vert</span>
                        </div>
                        <span className="text-[10px] text-center uppercase">Options</span>
                    </button>
                </div>
            </div>

            {tabBar}

            <CheckoutModal
                open={isCheckoutOpen}
                onOpenChange={setIsCheckoutOpen}
                onConfirm={handleCheckout}
                isLoading={isProcessing}
            />

            {/* Custom Discount Dialog */}
            {isDiscountDialogOpen && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsDiscountDialogOpen(false);
                    }}
                >
                    <div className="bg-rs-surface border border-rs-outline/30 shadow-2xl rounded-2xl p-6 max-w-xs w-full mx-4 animate-in zoom-in duration-300">
                        <h3 className="text-base font-bold text-white uppercase tracking-wider mb-1 text-center">Remise Globale</h3>
                        <p className="text-xs text-rs-on-surface-variant mb-4 text-center">Entrez le montant de la remise (FCFA) :</p>
                        <input
                            type="number"
                            value={discountInputValue}
                            onChange={(e) => setDiscountInputValue(e.target.value)}
                            placeholder="Ex: 1000..."
                            className="w-full h-12 rounded-lg bg-rs-surface-container-low border border-rs-outline/40 px-4 text-white text-lg font-bold mb-4 text-center focus:outline-none focus:border-rs-surface-tint"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsDiscountDialogOpen(false)}
                                className="flex-1 h-11 rounded-lg border border-rs-outline text-rs-on-surface uppercase font-semibold text-xs active:scale-95 transition-transform"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    setGlobalDiscount(Number(discountInputValue) || 0);
                                    setIsDiscountDialogOpen(false);
                                }}
                                className="flex-1 h-11 rounded-lg bg-rs-surface-tint text-rs-on-primary uppercase font-bold text-xs active:scale-95 transition-all hover:bg-rs-primary-fixed"
                            >
                                Appliquer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Options Bottom Sheet */}
            {isOptionsOpen && (
                <div 
                    className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsOptionsOpen(false);
                    }}
                >
                    <div className="bg-rs-surface border-t border-rs-outline/30 rounded-t-3xl p-6 w-full max-w-md animate-in slide-in-from-bottom duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-base font-bold text-white uppercase tracking-wider">Plus d'Options</h3>
                            <button 
                                onClick={() => setIsOptionsOpen(false)}
                                className="p-2 rounded-full hover:bg-rs-surface-container-highest text-rs-on-surface-variant active:scale-95 transition-transform"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* Barcode Scanner option */}
                            <button 
                                onClick={() => {
                                    setIsOptionsOpen(false);
                                    setIsScannerOpen(true);
                                }}
                                className="w-full h-14 bg-rs-surface-container-low border border-rs-outline/30 rounded-xl px-4 flex items-center justify-between text-white hover:bg-rs-surface-container-highest active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-rs-surface-tint">photo_camera</span>
                                    <span className="font-semibold text-sm">Scanner Code-barres</span>
                                </div>
                                <span className="material-symbols-outlined text-rs-on-surface-variant text-sm">arrow_forward_ios</span>
                            </button>

                            {/* Sale Type toggle */}
                            <button 
                                onClick={() => {
                                    const nextType = saleType === 'detail' ? 'gros' : saleType === 'gros' ? 'proforma' : 'detail';
                                    setSaleType(nextType);
                                    toast({
                                        title: 'Type de vente mis à jour',
                                        description: `Nouveau mode: ${nextType.toUpperCase()}`,
                                    });
                                }}
                                className="w-full h-14 bg-rs-surface-container-low border border-rs-outline/30 rounded-xl px-4 flex items-center justify-between text-white hover:bg-rs-surface-container-highest active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-rs-surface-tint">swap_horiz</span>
                                    <div className="flex flex-col items-start">
                                        <span className="font-semibold text-sm">Type de Vente</span>
                                        <span className="text-[10px] text-rs-on-surface-variant uppercase font-bold">Actuel: {saleType}</span>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-rs-on-surface-variant text-sm">arrow_forward_ios</span>
                            </button>

                            {/* Clear Cart option */}
                            <button 
                                onClick={() => {
                                    if (confirm('Voulez-vous vraiment vider le panier actuel ?')) {
                                        clearCart();
                                        setIsOptionsOpen(false);
                                        toast({
                                            title: 'Panier vidé',
                                            description: 'Tous les articles ont été retirés.',
                                        });
                                    }
                                }}
                                disabled={cart.length === 0}
                                className="w-full h-14 bg-red-950/20 border border-red-500/20 rounded-xl px-4 flex items-center justify-between text-red-400 hover:bg-red-950/30 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined">delete_sweep</span>
                                    <span className="font-semibold text-sm">Vider le Panier</span>
                                </div>
                                <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Barcode Scanner Modal */}
            {isScannerOpen && (
                <BarcodeScanner 
                    isScanning={isScannerOpen}
                    onResult={handleScanResult}
                    onClose={() => setIsScannerOpen(false)}
                />
            )}
        </div>
    );
}
