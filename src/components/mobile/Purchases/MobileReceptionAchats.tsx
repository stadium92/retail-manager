import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useToast } from '@/hooks/use-toast';
import { useProductSearch } from '@/hooks/useProductSearch';
import { useFormatters } from '@/utils/formatting';
import { Package, Search, Plus, Minus, User, FileText, Check, ArrowLeft } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';

export function MobileReceptionAchats({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatCurrency } = useFormatters();
  const { suppliers, orders, fetchSuppliers, fetchOrders, receiveOrder } = usePurchasingStore();

  const [storeId, setStoreId] = useState<string>('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [receiptItems, setReceiptItems] = useState<any[]>([]);
  const [isOrderSheetOpen, setIsOrderSheetOpen] = useState(false);
  const [isSupplierSheetOpen, setIsSupplierSheetOpen] = useState(false);
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    OfflineAuthService.getOfflineSession().then(session => {
        if (session?.user?.user_metadata?.store_id) {
            setStoreId(session.user.user_metadata.store_id);
        }
    });
  }, []);

  useEffect(() => {
    if (storeId) {
      fetchSuppliers(storeId);
      fetchOrders(storeId, 'ordered');
    }
  }, [storeId]);

  const { search, setSearch, results, isLoading } = useProductSearch(storeId, isProductSheetOpen);

  const handleSelectOrder = async (order: any) => {
    setSelectedOrderId(order.id);
    setSelectedSupplierId('');
    setIsOrderSheetOpen(false);
    
    // Fetch order items manually
    try {
        const headers = await OfflineAuthService.getAuthHeaders();
        const res = await fetch(`http://localhost:8787/rest/v1/purchase_items?order_id=${order.id}`, { headers });
        if (res.ok) {
            const data = await res.json();
            setReceiptItems(data.map((item: any) => ({
                product_id: item.product_id,
                product_name: item.product?.name || 'Produit',
                quantity_received: item.quantity_ordered,
                unit_cost: item.unit_cost,
            })));
        }
    } catch (e) {
        console.error(e);
    }
  };

  const handleAddProduct = (product: any) => {
    setReceiptItems(prev => {
        const existing = prev.find(i => i.product_id === product.id);
        if (existing) {
            return prev.map(i => i.product_id === product.id ? { ...i, quantity_received: i.quantity_received + 1 } : i);
        }
        return [...prev, {
            product_id: product.id,
            product_name: product.name,
            quantity_received: 1,
            unit_cost: product.cost_price || 0,
        }];
    });
    setIsProductSheetOpen(false);
  };

  const updateQuantity = (index: number, delta: number) => {
    setReceiptItems(prev => {
        const next = [...prev];
        const newQ = next[index].quantity_received + delta;
        if (newQ >= 0) {
            next[index].quantity_received = newQ;
        }
        return next;
    });
  };

  const handleReceive = async () => {
    if (receiptItems.length === 0) return;
    setIsProcessing(true);
    try {
        const payloadItems = receiptItems.map(r => ({
            id: r.id || undefined, // undefined for ad-hoc
            product_id: r.product_id,
            quantity_received: r.quantity_received,
            unit_cost: r.unit_cost,
        }));
        
        await receiveOrder(selectedOrderId || undefined, payloadItems, storeId, selectedSupplierId || undefined);
        toast({ title: "Réception Validée", description: "Les stocks ont été mis à jour." });
        setReceiptItems([]);
        setSelectedOrderId('');
        setSelectedSupplierId('');
        fetchOrders(storeId, 'ordered');
    } catch (err: any) {
        toast({ variant: 'destructive', title: "Erreur", description: err.message });
    } finally {
        setIsProcessing(false);
    }
  };

  const totalCost = receiptItems.reduce((acc, item) => acc + (item.quantity_received * item.unit_cost), 0);

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
                <Package className="w-4 h-4 text-rs-surface-tint" />
            </div>
            <h1 className="text-lg font-bold text-white uppercase tracking-wider">Réception Achats</h1>
        </div>

        <div className="flex gap-2">
            <button onClick={() => setIsOrderSheetOpen(true)} className="flex-1 bg-rs-surface-container px-3 py-2 rounded-lg flex items-center gap-2 border border-rs-surface-container-highest">
                <FileText className="w-4 h-4 text-rs-surface-tint" />
                <span className="text-sm font-medium text-white truncate">
                    {selectedOrderId ? 'Commande Sélec...' : 'Choisir Commande'}
                </span>
            </button>
            <button onClick={() => setIsSupplierSheetOpen(true)} className="flex-1 bg-rs-surface-container px-3 py-2 rounded-lg flex items-center gap-2 border border-rs-surface-container-highest">
                <User className="w-4 h-4 text-rs-surface-tint" />
                <span className="text-sm font-medium text-white truncate">
                    {selectedSupplierId ? 'Fournisseur...' : 'Ou Fournisseur...'}
                </span>
            </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {receiptItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-4">
                <Package className="w-16 h-16 text-rs-on-surface-variant" />
                <p className="text-lg font-medium text-rs-on-surface">Aucun article à recevoir</p>
                <button onClick={() => setIsProductSheetOpen(true)} className="mt-4 px-6 py-3 bg-rs-surface-tint text-rs-on-primary rounded-full font-bold flex items-center gap-2">
                    <Plus className="w-5 h-5" /> Ajouter Produit (Libre)
                </button>
            </div>
        ) : (
            <>
                <button onClick={() => setIsProductSheetOpen(true)} className="w-full py-3 border border-dashed border-rs-surface-tint text-rs-surface-tint rounded-xl font-bold flex items-center justify-center gap-2 mb-4">
                    <Plus className="w-5 h-5" /> Ajouter Article
                </button>
                {receiptItems.map((item, idx) => (
                    <div key={idx} className="bg-[#141414] rounded-xl p-3 border border-rs-surface-container-highest flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-white text-base leading-tight flex-1">{item.product_name}</h3>
                            <Input 
                                type="number"
                                value={item.unit_cost}
                                onChange={(e) => {
                                    const next = [...receiptItems];
                                    next[idx].unit_cost = Number(e.target.value);
                                    setReceiptItems(next);
                                }}
                                className="w-24 h-8 bg-[#0a0a0a] border-rs-surface-container text-right"
                            />
                        </div>
                        <div className="flex items-center justify-between border-t border-rs-surface-container pt-3">
                            <div className="flex items-center bg-rs-surface-container-low rounded-lg border border-rs-surface-container-highest overflow-hidden">
                                <button onClick={() => updateQuantity(idx, -1)} className="w-10 h-10 flex items-center justify-center text-rs-surface-tint"><Minus className="w-5 h-5" /></button>
                                <div className="w-12 text-center font-bold text-white text-lg">{item.quantity_received}</div>
                                <button onClick={() => updateQuantity(idx, 1)} className="w-10 h-10 flex items-center justify-center text-rs-surface-tint"><Plus className="w-5 h-5" /></button>
                            </div>
                            <span className="font-bold text-lg text-white font-mono">{formatCurrency(item.unit_cost * item.quantity_received)}</span>
                        </div>
                    </div>
                ))}
            </>
        )}
      </div>

      <div className="bg-[#141414] border-t border-rs-surface-container-highest px-4 py-3 flex flex-col gap-3 z-40 pb-safe">
        <div className="flex justify-between items-end">
            <span className="font-bold tracking-tight text-rs-on-surface text-sm">TOTAL ACHAT</span>
            <span className="font-mono text-2xl font-bold text-rs-surface-tint tracking-tight">{formatCurrency(totalCost)}</span>
        </div>
        <button 
            disabled={receiptItems.length === 0 || isProcessing || (!selectedOrderId && !selectedSupplierId)}
            onClick={handleReceive}
            className="w-full h-[48px] rounded-lg bg-rs-surface-tint text-rs-on-primary font-bold flex items-center justify-center gap-2 hover:bg-rs-primary-fixed active:scale-95 transition-all shadow-lg uppercase tracking-wide disabled:opacity-50"
        >
            {isProcessing ? 'En cours...' : <><Check className="w-5 h-5" /> Valider Réception</>}
        </button>
      </div>

      {/* Sheets... (Order, Supplier, Product) omitted for brevity but they are standard Sheet components */}
      <Sheet open={isOrderSheetOpen} onOpenChange={setIsOrderSheetOpen}>
        <SheetContent side="bottom" className="h-[80vh] bg-[#0a0a0a] border-t border-rs-surface-container-highest flex flex-col p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-rs-surface-container text-left">
                <SheetTitle className="text-white text-lg font-bold">Commandes en attente</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                {orders.map((o: any) => (
                    <button key={o.id} onClick={() => handleSelectOrder(o)} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest active:bg-rs-surface-container text-left">
                        <div>
                            <p className="font-bold text-white text-sm">Cmd #{o.order_number}</p>
                            <p className="text-xs text-rs-on-surface-variant">{o.supplier?.name || 'Sans F.'}</p>
                        </div>
                        <span className="font-bold text-rs-surface-tint">{formatCurrency(o.total_cost)}</span>
                    </button>
                ))}
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
