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
import { Label } from '@/components/ui/label';
import { getDataClient } from '@/lib/dataClient';

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
        const sid = session?.roles?.find(r => r.store_id)?.store_id || session?.user?.user_metadata?.store_id;
        if (sid) {
            setStoreId(sid);
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
                id: item.id,
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
        if (selectedOrderId) {
            // Flow 1: Receiving an existing order
            const payloadItems = receiptItems.map(r => ({
                id: r.id,
                quantity_received: r.quantity_received,
                unit_cost: r.unit_cost,
            }));
            await receiveOrder(selectedOrderId, payloadItems);
        } else {
            // Flow 2: Ad-Hoc / Direct Reception without an order
            if (!selectedSupplierId) {
                throw new Error("Fournisseur requis pour une réception libre");
            }
            const totalAmountOnReceipt = receiptItems.reduce((sum, item) => sum + (item.quantity_received * item.unit_cost), 0);
            const payload = {
                store_id: storeId,
                supplier_id: selectedSupplierId,
                status: 'received',
                total_amount: totalAmountOnReceipt,
                notes: 'Direct Purchase / Ad-Hoc Reception (Mobile)',
                items: receiptItems.map(item => ({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity_ordered: item.quantity_received,
                    quantity_received: item.quantity_received,
                    unit_cost: item.unit_cost
                }))
            };

            const dc = getDataClient();
            const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/purchase_orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(await OfflineAuthService.getAuthHeaders() || {})
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save direct purchase');
        }

        toast({ title: "Réception Validée", description: "Les stocks ont été mis à jour." });
        window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
        setReceiptItems([]);
        setSelectedOrderId('');
        setSelectedSupplierId('');
        fetchOrders(storeId, 'ordered');
    } catch (err: any) {
        toast({ variant: 'destructive', title: "Erreur", description: err.message || err.toString() });
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
            <button onClick={() => setIsOrderSheetOpen(true)} className="flex-1 bg-rs-surface-container px-3 py-2 rounded-lg flex items-center gap-2 border border-rs-surface-container-highest active:scale-95 transition-all text-left">
                <FileText className="w-4 h-4 text-rs-surface-tint shrink-0" />
                <span className="text-sm font-medium text-white truncate">
                    {selectedOrderId ? 'Commande Sélec...' : 'Choisir Commande'}
                </span>
            </button>
            <button onClick={() => setIsSupplierSheetOpen(true)} className="flex-1 bg-rs-surface-container px-3 py-2 rounded-lg flex items-center gap-2 border border-rs-surface-container-highest active:scale-95 transition-all text-left">
                <User className="w-4 h-4 text-rs-surface-tint shrink-0" />
                <span className="text-sm font-medium text-white truncate">
                    {selectedSupplierId ? suppliers.find(s => s.id === selectedSupplierId)?.name : 'Ou Fournisseur...'}
                </span>
            </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {receiptItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-4 py-12">
                <Package className="w-16 h-16 text-rs-on-surface-variant" />
                <p className="text-lg font-medium text-rs-on-surface">Aucun article à recevoir</p>
                <button onClick={() => setIsProductSheetOpen(true)} className="mt-4 px-6 py-3 bg-rs-surface-tint text-rs-on-primary rounded-full font-bold flex items-center gap-2 active:scale-95 transition-all">
                    <Plus className="w-5 h-5" /> Ajouter Produit (Libre)
                </button>
            </div>
        ) : (
            <>
                <button onClick={() => setIsProductSheetOpen(true)} className="w-full py-3 border border-dashed border-rs-surface-tint text-rs-surface-tint rounded-xl font-bold flex items-center justify-center gap-2 mb-4 active:scale-95 transition-all">
                    <Plus className="w-5 h-5" /> Ajouter Article
                </button>
                {receiptItems.map((item, idx) => (
                    <div key={idx} className="bg-[#141414] rounded-xl p-3 border border-rs-surface-container-highest flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-white text-base leading-tight flex-1 mr-2">{item.product_name}</h3>
                            <div className="flex flex-col items-end gap-1">
                              <Label className="text-[10px] text-rs-on-surface-variant">Coût Unit.</Label>
                              <Input 
                                  type="number"
                                  value={item.unit_cost}
                                  onChange={(e) => {
                                      const next = [...receiptItems];
                                      next[idx].unit_cost = Number(e.target.value);
                                      setReceiptItems(next);
                                  }}
                                  className="w-24 h-8 bg-[#0a0a0a] border-rs-surface-container-highest text-white font-mono px-2 text-right text-sm"
                              />
                            </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-rs-surface-container pt-3">
                            <div className="flex items-center bg-rs-surface-container-low rounded-lg border border-rs-surface-container-highest overflow-hidden">
                                <button onClick={() => updateQuantity(idx, -1)} className="w-10 h-10 flex items-center justify-center text-rs-surface-tint active:bg-rs-surface-container"><Minus className="w-5 h-5" /></button>
                                <div className="w-12 text-center font-bold text-white text-lg">{item.quantity_received}</div>
                                <button onClick={() => updateQuantity(idx, 1)} className="w-10 h-10 flex items-center justify-center text-rs-surface-tint active:bg-rs-surface-container"><Plus className="w-5 h-5" /></button>
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

      {/* Sheets */}
      <Sheet open={isOrderSheetOpen} onOpenChange={setIsOrderSheetOpen}>
        <SheetContent side="bottom" className="h-[80vh] bg-[#0a0a0a] border-t border-rs-surface-container-highest flex flex-col p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-rs-surface-container text-left">
                <SheetTitle className="text-white text-lg font-bold">Commandes en attente</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                {orders.filter((o: any) => o.status === 'ordered').map((o: any) => (
                    <button key={o.id} onClick={() => handleSelectOrder(o)} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest active:bg-rs-surface-container text-left">
                        <div>
                            <p className="font-bold text-white text-sm">Cmd #{o.order_number}</p>
                            <p className="text-xs text-rs-on-surface-variant">{o.supplier?.name || 'Sans F.'}</p>
                        </div>
                        <span className="font-bold text-rs-surface-tint">{formatCurrency(o.total_cost || o.total_amount)}</span>
                    </button>
                ))}
            </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isSupplierSheetOpen} onOpenChange={setIsSupplierSheetOpen}>
        <SheetContent side="bottom" className="h-[70vh] bg-[#0a0a0a] border-t border-rs-surface-container-highest p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b border-rs-surface-container text-left">
                <SheetTitle className="text-white">Choisir Fournisseur</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-4 py-2 space-y-2">
                {suppliers.length === 0 ? (
                    <p className="text-center text-xs text-rs-on-surface-variant py-8">
                        Aucun fournisseur disponible.
                    </p>
                ) : (
                    suppliers.map(s => (
                        <button key={s.id} onClick={() => { setSelectedSupplierId(s.id); setSelectedOrderId(''); setReceiptItems([]); setIsSupplierSheetOpen(false); }} className="w-full text-left p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest font-bold text-white">
                            {s.name}
                        </button>
                    ))
                )}
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
                {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                        <span className="material-symbols-outlined animate-spin text-rs-surface-tint">refresh</span>
                    </div>
                ) : search.length < 2 ? (
                    <p className="text-center text-xs text-rs-on-surface-variant py-8">
                        Saisissez au moins 2 caractères pour rechercher...
                    </p>
                ) : results.length === 0 ? (
                    <p className="text-center text-xs text-rs-on-surface-variant py-8">
                        Aucun produit trouvé.
                    </p>
                ) : (
                    results.map((p: any) => (
                        <button key={p.id} onClick={() => handleAddProduct(p)} className="w-full flex items-center justify-between p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest active:bg-rs-surface-container text-left">
                            <div>
                                <p className="font-bold text-white text-sm">{p.name}</p>
                                {p.sku && <p className="text-[10px] text-rs-on-surface-variant">SKU: {p.sku}</p>}
                            </div>
                            <span className="font-bold text-rs-surface-tint">{formatCurrency(p.cost_price || p.unit_price || 0)}</span>
                        </button>
                    ))
                )}
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
