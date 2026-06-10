import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Bike, CheckCircle2, Clock, PackageCheck, RefreshCw, ReceiptText, Trash2, Utensils, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFormatters } from '@/utils/formatting';
import { getDataClient } from '@/lib/dataClient';

interface CashierReadyOrdersBellProps {
  storeId: string;
}

interface ReadyOrderItem {
  id: string;
  product_name?: string;
  productName?: string;
  designation?: string;
  quantity?: number;
}

interface ReadyOrder {
  id: string;
  invoice_number?: string | null;
  order_ref?: string | null;
  table_number?: number | null;
  order_type?: 'dine_in' | 'takeaway' | 'delivery';
  order_status?: 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
  status?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  kitchen_notes?: string | null;
  total_price?: number;
  total?: number;
  amount_paid?: number;
  created_at?: string;
  updated_at?: string;
  items?: ReadyOrderItem[];
}

const servedStorageKey = (storeId: string) => `cashier_served_notifications_cleared:${storeId}`;

function getOrderStatus(order: ReadyOrder) {
  return order.order_status || order.status;
}

function getOrderLabel(order: ReadyOrder) {
  if (order.table_number) return `Table ${order.table_number}`;
  if (order.order_type === 'delivery') return 'Livraison';
  return 'À emporter';
}

function getOrderTypeIcon(order: ReadyOrder) {
  if (order.order_type === 'delivery') return Bike;
  if (order.order_type === 'takeaway') return PackageCheck;
  return Utensils;
}

function getOrderTotal(order: ReadyOrder) {
  return Number(order.total_price ?? order.total ?? 0);
}

export function CashierReadyOrdersBell({ storeId }: CashierReadyOrdersBellProps) {
  const { formatCurrency } = useFormatters();
  const [orders, setOrders] = useState<ReadyOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clearedServedIds, setClearedServedIds] = useState<string[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const previousReadyIds = useRef<Set<string>>(new Set());
  const hasLoadedOnce = useRef(false);

  // Load cleared IDs from localStorage on mount
  useEffect(() => {
    if (!storeId) return;
    try {
      const stored = localStorage.getItem(servedStorageKey(storeId));
      setClearedServedIds(stored ? JSON.parse(stored) : []);
    } catch {
      setClearedServedIds([]);
    }
  }, [storeId]);

  const fetchOrders = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    try {
      const sales = await OfflineSalesService.getSales(storeId);
      const visibleOrders = sales.filter((sale: ReadyOrder) => {
        const status = getOrderStatus(sale);
        return status === 'ready' || status === 'served';
      });

      setOrders(visibleOrders);

      const currentReadyIds = new Set(
        visibleOrders
          .filter((order) => getOrderStatus(order) === 'ready')
          .map((order) => order.id)
      );

      if (hasLoadedOnce.current) {
        const newReadyOrders = visibleOrders.filter((order) =>
          getOrderStatus(order) === 'ready' && !previousReadyIds.current.has(order.id)
        );
        newReadyOrders.forEach((order) => {
          // Play a notification sound effect using the Web Audio API
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
          } catch {
            // Audio API not available — silent fallback
          }

          toast.success(`🍽️ Commande prête !`, {
            description: `${getOrderLabel(order)} — ${order.invoice_number || order.id.slice(0, 8)} | ${formatCurrency(getOrderTotal(order))}`,
            duration: 8000,
          });
        });
      }

      previousReadyIds.current = currentReadyIds;
      hasLoadedOnce.current = true;
    } catch (error) {
      console.error('[CashierReadyOrdersBell] Failed to fetch ready orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [formatCurrency, storeId]);

  // ─── Polling fallback (4s) ────────────────────────────────────────────────
  useEffect(() => {
    fetchOrders();

    const handleLocalUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || detail.type === 'sale') {
        fetchOrders();
      }
    };

    window.addEventListener('localDbDataUpdated', handleLocalUpdate);
    const interval = window.setInterval(fetchOrders, 4000);

    return () => {
      window.removeEventListener('localDbDataUpdated', handleLocalUpdate);
      window.clearInterval(interval);
    };
  }, [fetchOrders]);

  // ─── Supabase Realtime — instant cook→cashier sync ───────────────────────
  useEffect(() => {
    // Supabase Realtime is used for instant cook→cashier sync.
    // We subscribe to Supabase changes when online to get immediate notifications.
    const channel = supabase
      .channel(`cashier-ready-orders:${storeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sales',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const newStatus = payload.new?.order_status;
          if (newStatus === 'ready' || newStatus === 'served') {
            // Fetch full list so items are included
            fetchOrders();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales',
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          if (payload.new?.order_status === 'ready') {
            fetchOrders();
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('[CashierBell] Supabase Realtime connected — instant sync active');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setIsRealtimeConnected(false);
    };
  }, [storeId, fetchOrders]);

  // ─── Computed views ───────────────────────────────────────────────────────
  const readyOrders = useMemo(
    () => orders.filter((order) => getOrderStatus(order) === 'ready'),
    [orders]
  );

  const servedOrders = useMemo(
    () => orders.filter((order) =>
      getOrderStatus(order) === 'served' && !clearedServedIds.includes(order.id)
    ),
    [clearedServedIds, orders]
  );

  // ─── Actions ──────────────────────────────────────────────────────────────
  const confirmOrder = async (order: ReadyOrder) => {
    try {
      const total = getOrderTotal(order);
      const { error } = await OfflineSalesService.updateSale(order.id, {
        order_status: 'served',
        status: 'served',
        payment_status: 'paid',
        amount_paid: order.amount_paid || total,
        served_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      toast.success('✅ Vente confirmée', {
        description: `Commande ${order.invoice_number || order.id.slice(0, 8)} marquée comme servie.`,
      });
      fetchOrders();
    } catch (error) {
      console.error('[CashierReadyOrdersBell] Confirm sale failed:', error);
      toast.error('Confirmation impossible');
    }
  };

  const clearServedOrders = () => {
    const nextIds = Array.from(new Set([...clearedServedIds, ...servedOrders.map((order) => order.id)]));
    setClearedServedIds(nextIds);
    if (storeId) {
      localStorage.setItem(servedStorageKey(storeId), JSON.stringify(nextIds));
    }
  };

  const visibleCount = readyOrders.length;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative ml-auto flex h-9 w-9 items-center justify-center rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-[#F5C518]/60',
            visibleCount > 0
              ? 'border-[#F5C518]/60 bg-[#F5C518]/15 animate-pulse-subtle'
              : 'border-[#F5C518]/30 bg-[#1A1A1A] hover:bg-[#F5C518]/15'
          )}
          aria-label="Notifications commandes prêtes"
        >
          <Bell className={cn('h-4 w-4', visibleCount > 0 ? 'text-[#F5C518]' : 'text-white/60')} />
          {visibleCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F5C518] px-1 text-[10px] font-black text-black shadow-lg shadow-[#F5C518]/30">
              {visibleCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(440px,calc(100vw-16px))] border-[#F5C518]/25 bg-[#0D0D0D] p-0 text-white shadow-2xl shadow-black/70"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F5C518]/15 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-black uppercase tracking-wide text-white">
                Commandes Prêtes
              </p>
              {/* Realtime indicator */}
              <span className={cn(
                'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase',
                isRealtimeConnected
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              )}>
                <Zap className="h-2.5 w-2.5" />
                {isRealtimeConnected ? 'Live' : '4s'}
              </span>
            </div>
            <p className="text-[11px] text-white/50">
              Synchronisé avec l'écran cuisine
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={fetchOrders}
            className="h-8 gap-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Sync
          </Button>
        </div>

        {/* Order list */}
        <div className="max-h-[480px] overflow-y-auto scroll-smooth px-3 py-3 space-y-3">

          {/* Empty state */}
          {readyOrders.length === 0 && servedOrders.length === 0 && (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
              <CheckCircle2 className="mb-3 h-8 w-8 text-white/20" />
              <p className="text-sm font-bold text-white/60">Aucune commande prête</p>
              <p className="mt-1 text-xs text-white/30">
                Les plats marqués prêts par la cuisine apparaîtront ici instantanément.
              </p>
            </div>
          )}

          {/* Ready orders */}
          {readyOrders.map((order) => {
            const OrderIcon = getOrderTypeIcon(order);
            return (
              <div
                key={order.id}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.07] p-3.5 transition-all hover:border-emerald-400/50"
              >
                {/* Order header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                        <OrderIcon className="h-4 w-4 text-emerald-300" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white leading-tight">
                          {getOrderLabel(order)}
                        </p>
                        {order.customer_name && (
                          <p className="text-[11px] text-white/60 leading-tight">{order.customer_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/55">
                      <span className="inline-flex items-center gap-1">
                        <ReceiptText className="h-3 w-3 shrink-0" />
                        {order.invoice_number || `#${order.id.slice(0, 8)}`}
                      </span>
                      {order.order_ref && (
                        <span className="inline-flex items-center gap-1">
                          Réf: {order.order_ref}
                        </span>
                      )}
                      {order.customer_phone && (
                        <span>{order.customer_phone}</span>
                      )}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="shrink-0 rounded-lg bg-[#F5C518]/15 border border-[#F5C518]/30 px-2.5 py-1.5 text-center">
                    <p className="text-xs font-black text-[#F5C518] leading-none">
                      {formatCurrency(getOrderTotal(order))}
                    </p>
                  </div>
                </div>

                {/* Kitchen notes */}
                {order.kitchen_notes && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1.5">
                    <span className="text-[10px] font-black uppercase text-amber-300 shrink-0 mt-0.5">Note:</span>
                    <p className="text-xs text-white/85">{order.kitchen_notes}</p>
                  </div>
                )}

                {/* Items list */}
                {order.items && order.items.length > 0 && (
                  <div className="mt-2.5 space-y-1 border-t border-white/[0.06] pt-2">
                    {order.items.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-white/75">
                          {item.product_name || item.productName || item.designation || 'Article'}
                        </span>
                        <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-black text-white">
                          ×{item.quantity || 1}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 5 && (
                      <p className="text-[10px] text-white/35">
                        +{order.items.length - 5} autres articles
                      </p>
                    )}
                  </div>
                )}

                {/* Confirm button */}
                <Button
                  type="button"
                  onClick={() => confirmOrder(order)}
                  className="mt-3.5 h-9 w-full bg-[#F5C518] text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-[#F5C518]/20 hover:bg-[#ffe066] hover:shadow-[#F5C518]/30 active:scale-[0.98] transition-all"
                >
                  ✓ Confirmer & Enregistrer la vente
                </Button>
              </div>
            );
          })}

          {/* Served / cleared section */}
          {servedOrders.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-white/70">
                    Déjà servies
                  </p>
                  <p className="text-[10px] text-white/35">
                    {servedOrders.length} commande(s) terminée(s)
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearServedOrders}
                  className="h-8 gap-1.5 text-xs text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Tout effacer
                </Button>
              </div>
              <div className="space-y-1.5">
                {servedOrders.slice(0, 6).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate text-white/50">
                      {getOrderLabel(order)} — {order.invoice_number || `#${order.id.slice(0, 8)}`}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-emerald-400/80">
                      <Clock className="h-3 w-3" />
                      servi
                    </span>
                  </div>
                ))}
                {servedOrders.length > 6 && (
                  <p className="text-center text-[10px] text-white/25">
                    +{servedOrders.length - 6} de plus...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
