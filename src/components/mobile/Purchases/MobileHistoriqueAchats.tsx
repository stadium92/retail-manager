import React, { useState, useEffect } from 'react';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useFormatters } from '@/utils/formatting';
import { ArrowLeft, Search, ShoppingBag, Eye, Calendar, ChevronRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

interface MobileHistoriqueAchatsProps {
  onBack: () => void;
}

export function MobileHistoriqueAchats({ onBack }: MobileHistoriqueAchatsProps) {
  const { formatCurrency, formatDate } = useFormatters();
  const { orders, fetchOrders, fetchOrderItems, orderItems, loading } = usePurchasingStore();
  const [storeId, setStoreId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    OfflineAuthService.getOfflineSession().then(session => {
      if (session?.user?.user_metadata?.store_id) {
        setStoreId(session.user.user_metadata.store_id);
        fetchOrders(session.user.user_metadata.store_id);
      }
    });
  }, []);

  const handleOpenDetails = async (order: any) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
    await fetchOrderItems(order.id);
  };

  const filteredOrders = (orders || []).filter(o => 
    (o.order_number || o.id.slice(0, 8))?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received': return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Reçue</Badge>;
      case 'ordered': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Envoyée</Badge>;
      case 'draft': return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Brouillon</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] font-sans text-white">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-rs-surface-tint" />
          </div>
          <h1 className="text-lg font-bold text-white uppercase tracking-wider">Historique Achats</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher commande, fournisseur..."
            className="w-full h-11 bg-rs-surface-container border border-rs-surface-container-highest rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-rs-surface-tint text-white placeholder-rs-on-surface-variant/50"
          />
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-rs-on-surface-variant/60" />
        </div>
      </header>

      {/* Main List */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-rs-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[32px] text-rs-surface-tint mb-2">refresh</span>
            <span>Chargement de l'historique...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 text-rs-on-surface-variant">
            <ShoppingBag className="h-12 w-12 mx-auto text-rs-on-surface-variant opacity-40 mb-3" />
            <p>Aucune commande trouvée.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredOrders.map(order => (
              <div 
                key={order.id}
                onClick={() => handleOpenDetails(order)}
                className="bg-[#141414] border border-rs-surface-container-highest rounded-2xl p-4 flex justify-between items-center active:bg-rs-surface-container-low transition-all shadow-md cursor-pointer"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">Cmd #{order.order_number || order.id.slice(0, 8)}</h3>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-sm text-rs-on-surface-variant truncate">{order.supplier?.name || 'Fournisseur inconnu'}</p>
                  <div className="flex items-center gap-1 text-xs text-rs-on-surface-variant">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(order.created_at)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4 flex items-center gap-2">
                  <span className="font-bold font-mono text-base text-rs-surface-tint">
                    {formatCurrency(order.total_amount || 0)}
                  </span>
                  <ChevronRight className="w-5 h-5 opacity-60 text-rs-on-surface-variant" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Details Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent side="bottom" className="h-[80vh] bg-[#0a0a0a] border-t border-rs-surface-container-highest flex flex-col p-0 text-white">
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-rs-surface-container text-left flex justify-between items-center">
            <div>
              <SheetTitle className="text-white text-lg font-bold">Détails de Commande</SheetTitle>
              {selectedOrder && (
                <p className="text-xs text-rs-on-surface-variant">Cmd #{selectedOrder.order_number || selectedOrder.id.slice(0, 8)} — {selectedOrder.supplier?.name}</p>
              )}
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {orderItems.length === 0 ? (
              <p className="text-center text-rs-on-surface-variant py-8">Aucun article dans cette commande.</p>
            ) : (
              orderItems.map((item: any, idx: number) => (
                <div key={idx} className="bg-[#141414] rounded-xl p-3 border border-rs-surface-container-highest flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white text-sm">{item.product?.name || 'Produit'}</h4>
                    <p className="text-xs text-rs-on-surface-variant font-mono">
                      Qte: {item.quantity_ordered || item.quantity_received} {item.product?.unit_type || 'pcs'}
                    </p>
                  </div>
                  <span className="font-bold text-sm text-rs-surface-tint font-mono">
                    {formatCurrency(item.unit_cost * (item.quantity_ordered || item.quantity_received))}
                  </span>
                </div>
              ))
            )}
          </div>
          {selectedOrder && (
            <div className="bg-[#141414] border-t border-rs-surface-container-highest px-4 py-4 flex justify-between items-center z-40 pb-safe">
              <span className="font-bold text-sm text-rs-on-surface">TOTAL</span>
              <span className="font-mono text-xl font-bold text-rs-surface-tint">
                {formatCurrency(selectedOrder.total_amount)}
              </span>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
