import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useToast } from '@/hooks/use-toast';

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

export function MobileKDS() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'ready'>('pending');
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [storeId, setStoreId] = useState<string | null>(null);

    // Get Store ID
    useEffect(() => {
        OfflineAuthService.getOfflineSession().then(session => {
            if (session?.user?.user_metadata?.store_id) {
                setStoreId(session.user.user_metadata.store_id);
            }
        });
    }, []);

    const fetchOrders = useCallback(async () => {
        if (!storeId) return;
        try {
            const sales = await OfflineSalesService.getSales(storeId);
            const activeOrders = sales
                .filter((sale: any) => {
                    const status = sale.order_status || sale.status;
                    return status === 'pending' || status === 'preparing' || status === 'ready';
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
            console.error('[MobileKDS] Fetch orders error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [storeId]);

    // Sync / poll orders
    useEffect(() => {
        fetchOrders();
        const handleRefresh = (e: any) => {
            if (e.detail?.type === 'sale') fetchOrders();
        };
        window.addEventListener('localDbDataUpdated', handleRefresh);
        const interval = setInterval(fetchOrders, 5000);
        return () => {
            window.removeEventListener('localDbDataUpdated', handleRefresh);
            clearInterval(interval);
        };
    }, [fetchOrders]);

    // Timers
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleStatusChange = async (orderId: string, nextStatus: Order['order_status']) => {
        try {
            const { error } = await OfflineSalesService.updateSale(orderId, { order_status: nextStatus });
            if (error) throw error;
            toast({ title: t('common.success'), description: `Commande mise à jour : ${nextStatus}` });
            fetchOrders();
        } catch (err: any) {
            toast({ title: t('common.error'), description: err.message || 'Erreur', variant: 'destructive' });
        }
    };

    const getElapsedTime = (createdAt: string) => {
        const elapsedMs = currentTime - new Date(createdAt).getTime();
        const minutes = Math.floor(elapsedMs / 60000);
        const seconds = Math.floor((elapsedMs % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    const pendingOrders = useMemo(() => orders.filter((o) => o.order_status === 'pending'), [orders]);
    const preparingOrders = useMemo(() => orders.filter((o) => o.order_status === 'preparing'), [orders]);
    const readyOrders = useMemo(() => orders.filter((o) => o.order_status === 'ready'), [orders]);

    const displayOrders = useMemo(() => {
        if (activeTab === 'pending') return pendingOrders;
        if (activeTab === 'preparing') return preparingOrders;
        return readyOrders;
    }, [activeTab, pendingOrders, preparingOrders, readyOrders]);

    return (
        <div className="bg-rs-surface text-rs-on-surface antialiased min-h-screen flex flex-col pt-[56px] pb-[64px] dark">
            {/* TopAppBar */}
            <header className="fixed top-0 w-full h-[56px] flex justify-between items-center px-4 z-50 bg-rs-surface border-b border-rs-surface-container-highest">
                <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-rs-surface-container-highest text-rs-on-surface-variant">
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <h1 className="font-bold text-rs-surface-tint text-lg">ÉCRAN CUISINE (KDS)</h1>
                <button onClick={fetchOrders} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-rs-surface-container-highest text-rs-on-surface-variant active:scale-95 transition-transform">
                    <span className="material-symbols-outlined">refresh</span>
                </button>
            </header>

            {/* Column Tab Strip */}
            <div className="sticky top-[56px] z-40 bg-rs-surface-container-lowest border-b border-rs-outline overflow-x-auto hide-scrollbar">
                <div className="flex px-4 min-w-max">
                    <button 
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'pending' ? 'border-rs-surface-tint text-rs-surface-tint' : 'border-transparent text-rs-on-surface-variant'}`}>
                        <span className="uppercase text-rs-subheader-md font-medium">EN ATTENTE</span>
                        <span className="bg-rs-surface-tint text-rs-on-primary text-rs-helper-xs px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('preparing')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'preparing' ? 'border-rs-surface-tint text-rs-surface-tint' : 'border-transparent text-rs-on-surface-variant'}`}>
                        <span className="uppercase text-rs-subheader-md font-medium">EN PRÉPARATION</span>
                        <span className="bg-rs-secondary-container text-rs-on-secondary-container text-rs-helper-xs px-2 py-0.5 rounded-full">{preparingOrders.length}</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('ready')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'ready' ? 'border-rs-surface-tint text-rs-surface-tint' : 'border-transparent text-rs-on-surface-variant'}`}>
                        <span className="uppercase text-rs-subheader-md font-medium">PRÊT À SERVIR</span>
                        <span className="bg-rs-surface-container-highest text-rs-on-surface-variant text-rs-helper-xs px-2 py-0.5 rounded-full">{readyOrders.length}</span>
                    </button>
                </div>
            </div>

            {/* Main Content Canvas */}
            <main className="flex-1 px-4 py-5 flex flex-col gap-3 overflow-y-auto">
                {isLoading ? (
                    <div className="text-center text-rs-on-surface-variant mt-10 flex flex-col items-center">
                        <span className="material-symbols-outlined animate-spin text-[32px] text-rs-surface-tint mb-2">refresh</span>
                        Chargement...
                    </div>
                ) : displayOrders.length === 0 ? (
                    <div className="text-center text-rs-on-surface-variant mt-10">Aucun plat dans cette section</div>
                ) : (
                    displayOrders.map(order => (
                        <article key={order.id} className="relative bg-[#141414] rounded-lg overflow-hidden flex flex-col shadow-md">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-rs-surface-tint"></div>
                            <div className="pl-3 p-4 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-1">
                                        <span className="bg-rs-surface-container-highest text-rs-on-surface text-rs-helper-xs px-2 py-1 rounded-full uppercase w-fit">
                                            {order.order_type === 'takeaway' ? 'À EMPORTER' : order.table_number ? `TABLE ${order.table_number}` : 'SUR PLACE'}
                                        </span>
                                        <span className="font-mono text-rs-on-surface">#{order.invoice_number}</span>
                                    </div>
                                    <div className={`font-mono text-rs-caption-sm px-2 py-1 rounded ${getElapsedTime(order.created_at).includes('15m') ? 'bg-rs-error text-rs-error-container animate-pulse' : 'bg-rs-secondary-container text-rs-on-secondary-container'}`}>
                                        {getElapsedTime(order.created_at)}
                                    </div>
                                </div>
                                <ul className="flex flex-col gap-2 border-t border-rs-outline pt-3">
                                    {order.items?.map((item, idx) => (
                                        <li key={item.id || idx} className={`flex justify-between items-center py-2 rounded px-2 ${idx % 2 === 0 ? 'bg-rs-surface' : ''}`}>
                                            <span className="text-rs-on-surface text-rs-body-base">{item.product_name}</span>
                                            <span className="bg-rs-surface-tint text-rs-on-primary font-mono w-6 h-6 flex items-center justify-center rounded-full text-rs-caption-sm">{item.quantity}</span>
                                        </li>
                                    ))}
                                </ul>
                                
                                {order.order_status === 'pending' && (
                                    <button 
                                        onClick={() => handleStatusChange(order.id, 'preparing')}
                                        className="w-full h-12 bg-rs-surface-tint hover:bg-rs-primary-fixed text-rs-on-primary font-medium text-rs-subheader-md rounded flex items-center justify-center gap-2 transition-colors mt-2 active:scale-95">
                                        <span className="material-symbols-outlined">play_arrow</span>
                                        COMMENCER PRÉPARATION
                                    </button>
                                )}
                                {order.order_status === 'preparing' && (
                                    <button 
                                        onClick={() => handleStatusChange(order.id, 'ready')}
                                        className="w-full h-12 bg-rs-secondary hover:bg-[#8ff2e6] text-rs-on-secondary font-medium text-rs-subheader-md rounded flex items-center justify-center gap-2 transition-colors mt-2 active:scale-95">
                                        <span className="material-symbols-outlined">check_circle</span>
                                        PRÊT À SERVIR
                                    </button>
                                )}
                                {order.order_status === 'ready' && (
                                    <button 
                                        onClick={() => handleStatusChange(order.id, 'served')}
                                        className="w-full h-12 bg-rs-outline hover:bg-rs-on-surface-variant text-rs-surface font-medium text-rs-subheader-md rounded flex items-center justify-center gap-2 transition-colors mt-2 active:scale-95">
                                        <span className="material-symbols-outlined">restaurant</span>
                                        SERVIR COMMANDE
                                    </button>
                                )}
                            </div>
                        </article>
                    ))
                )}
            </main>
        </div>
    );
}
