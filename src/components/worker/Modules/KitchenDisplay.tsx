import { useState, useEffect, useCallback, useMemo } from 'react';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Play, CheckCircle, Clock, Utensils, ChefHat, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface KitchenDisplayProps {
  storeId: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  modifiers?: string | any[];
}

interface Order {
  id: string;
  invoice_number: string;
  table_number: number | null;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  order_status: 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
  kitchen_notes: string | null;
  waiter_id: string | null;
  created_at: string;
  items?: OrderItem[];
}

export function KitchenDisplay({ storeId }: KitchenDisplayProps) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [crossedItems, setCrossedItems] = useState<Record<string, boolean>>({});

  // Fetch orders from the local bridge
  const fetchOrders = useCallback(async () => {
    if (!storeId) return;
    try {
      const sales = await OfflineSalesService.getSales(storeId);
      // Filter sales that are restaurant orders and not yet served or completed
      const now = new Date();
      const activeOrders = sales
        .filter((sale: any) => {
          const status = sale.order_status || sale.status;
          const isPendingOrPreparingOrReady = status === 'pending' || status === 'preparing' || status === 'ready';
          
          if (!isPendingOrPreparingOrReady) return false;

          // Filter out stale/ghost orders older than 24 hours
          if (sale.created_at) {
            const diffMs = now.getTime() - new Date(sale.created_at).getTime();
            if (diffMs > 24 * 60 * 60 * 1000) {
              return false;
            }
          }
          return true;
        })
        .map((sale: any) => ({
          id: sale.id,
          invoice_number: sale.invoice_number || '—',
          table_number: sale.table_number || null,
          order_type: sale.order_type || 'dine_in',
          order_status: sale.order_status || 'pending',
          kitchen_notes: sale.kitchen_notes || null,
          waiter_id: sale.waiter_id || null,
          created_at: sale.created_at || new Date().toISOString(),
          items: sale.items || [],
        }));
      setOrders(activeOrders);
    } catch (err) {
      console.error('[KDS] Fetch orders error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  // Sync / poll orders periodically
  useEffect(() => {
    fetchOrders();

    const handleRefresh = (e: any) => {
      if (e.detail?.type === 'sale') {
        fetchOrders();
      }
    };

    window.addEventListener('localDbDataUpdated', handleRefresh);
    const interval = setInterval(fetchOrders, 5000); // Poll every 5s for fast updates
    return () => {
      window.removeEventListener('localDbDataUpdated', handleRefresh);
      clearInterval(interval);
    };
  }, [fetchOrders]);

  // Keep timers updating every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to real-time order updates via Supabase
  useEffect(() => {
    if (!storeId) return;

    console.log('[KDS] Subscribing to Supabase Realtime for orders in store:', storeId);
    const channel = supabase
      .channel(`kds-orders:${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${storeId}`,
        },
        () => {
          console.log('[KDS] Realtime change detected, refreshing orders...');
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, fetchOrders]);

  const handleStatusChange = async (orderId: string, nextStatus: Order['order_status']) => {
    try {
      const { error } = await OfflineSalesService.updateSale(orderId, { order_status: nextStatus });
      if (error) throw error;
      toast({
        title: t('common.success') || 'Succès',
        description: `Commande mise à jour : ${nextStatus}`,
      });
      fetchOrders();
    } catch (err: any) {
      toast({
        title: t('common.error') || 'Erreur',
        description: err.message || 'Mise à jour échouée.',
        variant: 'destructive',
      });
    }
  };

  const toggleItemCross = (itemId: string) => {
    setCrossedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Helper to calculate elapsed time in minutes
  const getElapsedTime = (createdAt: string) => {
    const elapsedMs = currentTime - new Date(createdAt).getTime();
    const minutes = Math.floor(elapsedMs / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    return {
      minutes,
      seconds,
      text: `${minutes}m ${seconds}s`,
    };
  };

  // Group orders by status
  const pendingOrders = useMemo(() => orders.filter((o) => o.order_status === 'pending'), [orders]);
  const preparingOrders = useMemo(() => orders.filter((o) => o.order_status === 'preparing'), [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.order_status === 'ready'), [orders]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-slate-100">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span>{t('common.loading') || 'Chargement KDS...'}</span>
        </div>
      </div>
    );
  }

  const renderOrderCard = (order: Order) => {
    const elapsed = getElapsedTime(order.created_at);
    const isLate = elapsed.minutes >= 15;

    return (
      <div
        key={order.id}
        className={cn(
          'glass-card p-4 flex flex-col gap-3 transition-all relative border border-white/10 text-white rounded-lg shadow-lg',
          order.order_status === 'pending' && 'bg-slate-800/80 hover:bg-slate-800',
          order.order_status === 'preparing' && 'bg-amber-950/40 border-amber-500/30 hover:bg-amber-950/50',
          order.order_status === 'ready' && 'bg-emerald-950/40 border-emerald-500/30 hover:bg-emerald-950/50',
          isLate && 'border-red-500/50 shadow-red-500/5'
        )}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-primary">
              {order.table_number ? `TABLE ${order.table_number}` : 'À EMPORTER'}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              #{order.invoice_number}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-black/40">
            <Clock className={cn('h-3.5 w-3.5', isLate ? 'text-red-500 animate-pulse' : 'text-primary')} />
            <span className={cn(isLate ? 'text-red-400 font-bold' : 'text-white')}>
              {elapsed.text}
            </span>
          </div>
        </div>

        {/* Kitchen Notes */}
        {order.kitchen_notes && (
          <div className="flex items-start gap-1.5 p-2 bg-red-500/10 border border-red-500/20 text-red-200 rounded text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="font-semibold italic">« {order.kitchen_notes} »</p>
          </div>
        )}

        {/* Order Items List */}
        <div className="flex-1 flex flex-col gap-2 min-h-[100px]">
          {order.items?.map((item) => {
            const isCrossed = crossedItems[item.id] || false;
            let parsedModifiers: string[] = [];
            if (item.modifiers) {
              parsedModifiers = typeof item.modifiers === 'string' 
                ? JSON.parse(item.modifiers) 
                : item.modifiers;
            }

            return (
              <div
                key={item.id}
                onClick={() => toggleItemCross(item.id)}
                className={cn(
                  'flex items-start justify-between p-2 rounded cursor-pointer transition-all border border-white/5 hover:bg-white/5',
                  isCrossed ? 'bg-slate-900/40 border-slate-700/20 opacity-40 line-through' : 'bg-black/20'
                )}
              >
                <div className="flex flex-col">
                  <span className={cn('font-bold', isCrossed ? 'text-slate-400' : 'text-slate-100')}>
                    {item.product_name}
                  </span>
                  {parsedModifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {parsedModifiers.map((mod, i) => (
                        <span key={i} className="text-[10px] bg-slate-700/40 text-slate-300 px-1.5 py-0.5 rounded border border-white/5 font-mono">
                          {mod}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-primary font-black text-sm px-2 py-0.5 rounded bg-white/5">
                  x{item.quantity}
                </span>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="mt-2">
          {order.order_status === 'pending' && (
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-xs tracking-wider h-10 gap-1.5"
              onClick={() => handleStatusChange(order.id, 'preparing')}
            >
              <Play className="h-4 w-4 fill-black" />
              Commencer Préparation
            </Button>
          )}
          {order.order_status === 'preparing' && (
            <Button
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase text-xs tracking-wider h-10 gap-1.5"
              onClick={() => handleStatusChange(order.id, 'ready')}
            >
              <CheckCircle className="h-4 w-4" />
              Prêt à Servir
            </Button>
          )}
          {order.order_status === 'ready' && (
            <Button
              className="w-full bg-blue-500 hover:bg-blue-600 text-black font-black uppercase text-xs tracking-wider h-10 gap-1.5"
              onClick={() => handleStatusChange(order.id, 'served')}
            >
              <Utensils className="h-4 w-4" />
              Servir Commande
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 p-4 gap-4 select-none">
      {/* Title Header */}
      <div className="flex items-center justify-between bg-black border-b border-white/10 px-4 py-3 -mx-4 -mt-4 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded bg-primary/20 border border-primary/30">
            <ChefHat className="h-6 w-6 text-primary animate-bounce" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white tracking-wider uppercase">
              Écran Cuisine (KDS)
            </h1>
            <span className="text-xs text-muted-foreground">
              Gestion de la préparation des plats en temps réel
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={fetchOrders} className="text-white border-white/10 bg-slate-900/50 hover:bg-slate-900 gap-2 h-9">
          <RefreshCw className="h-4 w-4" />
          Rafraîchir
        </Button>
      </div>

      {/* Main Grid Columns */}
      <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
        {/* 1. Pending Column */}
        <div className="flex flex-col gap-3 bg-slate-900/30 border border-white/5 rounded-xl p-3 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg font-black text-xs uppercase tracking-widest shrink-0">
            <span>En Attente</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20">{pendingOrders.length}</span>
          </div>
          <ScrollArea className="flex-1 pr-1">
            <div className="flex flex-col gap-3">
              {pendingOrders.map(renderOrderCard)}
              {pendingOrders.length === 0 && (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm border border-dashed border-white/5 rounded-lg">
                  Aucun plat en attente
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 2. Preparing Column */}
        <div className="flex flex-col gap-3 bg-slate-900/30 border border-white/5 rounded-xl p-3 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg font-black text-xs uppercase tracking-widest shrink-0">
            <span>En Préparation</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20">{preparingOrders.length}</span>
          </div>
          <ScrollArea className="flex-1 pr-1">
            <div className="flex flex-col gap-3">
              {preparingOrders.map(renderOrderCard)}
              {preparingOrders.length === 0 && (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm border border-dashed border-white/5 rounded-lg">
                  Aucun plat en préparation
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 3. Ready Column */}
        <div className="flex flex-col gap-3 bg-slate-900/30 border border-white/5 rounded-xl p-3 overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg font-black text-xs uppercase tracking-widest shrink-0">
            <span>Prêt à Servir</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20">{readyOrders.length}</span>
          </div>
          <ScrollArea className="flex-1 pr-1">
            <div className="flex flex-col gap-3">
              {readyOrders.map(renderOrderCard)}
              {readyOrders.length === 0 && (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm border border-dashed border-white/5 rounded-lg">
                  Rien de prêt pour l'instant
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
