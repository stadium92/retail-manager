import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, TrendingUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Notification {
  id: string;
  type: 'low_stock' | 'new_sale';
  message: string;
  timestamp: string;
}

interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className }: NotificationCenterProps = {}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Persistent list of read notification IDs
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('djati_read_notification_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const currentLocale = i18n.language === 'en' ? enUS : fr;

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const { data: storesList } = await OfflineStoreService.getStores();
      const allNotifications: Notification[] = [];
      
      if (storesList) {
        await Promise.all(storesList.map(async (store) => {
          // 1. Fetch low stock items for this store
          const { data: inventory } = await OfflineInventoryService.getInventory(store.id);
          const lowStock = inventory?.filter(item => item.quantity <= (item.low_stock_threshold || 10)) || [];
          
          lowStock.slice(0, 15).forEach(item => {
            allNotifications.push({
              id: `low-stock-${store.id}-${item.id}`,
              type: 'low_stock',
              message: `⚠️ [${store.name}] Rupture imminente : ${item.name} (${item.quantity} restants)`,
              timestamp: item.updated_at || new Date().toISOString(),
            });
          });

          // 2. Fetch sales from today
          const sales = await OfflineSalesService.getSales(store.id);
          const today = new Date().toISOString().split('T')[0];
          const todaySales = sales.filter(s => s.created_at && s.created_at.startsWith(today) && s.sale_type !== 'proforma');
          
          todaySales.slice(0, 10).forEach(sale => {
            allNotifications.push({
              id: `sale-${sale.id}`,
              type: 'new_sale',
              message: `💰 Nouvelle vente à ${store.name} : ${sale.invoice_number || 'Facture'} (${Number(sale.total_price || 0).toLocaleString()} F CFA)`,
              timestamp: sale.created_at,
            });
          });
        }));
      }

      // Sort notifications by timestamp descending
      allNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setNotifications(allNotifications);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const nextReadIds = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(nextReadIds);
    localStorage.setItem('djati_read_notification_ids', JSON.stringify(nextReadIds));
  };

  const markAsRead = (id: string) => {
    if (readIds.includes(id)) return;
    const nextReadIds = [...readIds, id];
    setReadIds(nextReadIds);
    localStorage.setItem('djati_read_notification_ids', JSON.stringify(nextReadIds));
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    const isMaster = user?.role === 'master';

    if (notification.type === 'low_stock') {
      let productName = '';
      const colonIdx = notification.message.indexOf(':');
      const parenIdx = notification.message.lastIndexOf('(');
      if (colonIdx !== -1 && parenIdx !== -1 && parenIdx > colonIdx) {
        productName = notification.message.substring(colonIdx + 1, parenIdx).trim();
      }

      if (isMaster) {
        const query = productName ? `?search=${encodeURIComponent(productName)}` : '';
        navigate(`/master/inventory${query}`);
      } else {
        localStorage.setItem('worker_active_module', 'produits');
        if (productName) {
          localStorage.setItem('worker_product_search_query', productName);
          window.dispatchEvent(new CustomEvent('worker-product-search-update', { detail: { query: productName } }));
        }
        navigate('/worker/dashboard');
        window.dispatchEvent(new CustomEvent('worker-active-module-change', { detail: { module: 'produits' } }));
      }
    } else if (notification.type === 'new_sale') {
      let invoiceNumber = '';
      const colonIdx = notification.message.indexOf(':');
      const parenIdx = notification.message.lastIndexOf('(');
      if (colonIdx !== -1 && parenIdx !== -1 && parenIdx > colonIdx) {
        invoiceNumber = notification.message.substring(colonIdx + 1, parenIdx).trim();
      }

      if (isMaster) {
        const query = invoiceNumber ? `?search=${encodeURIComponent(invoiceNumber)}` : '';
        navigate(`/master/sales${query}`);
      } else {
        localStorage.setItem('worker_active_module', 'suivi-ventes-factures');
        navigate('/worker/dashboard');
        window.dispatchEvent(new CustomEvent('worker-active-module-change', { detail: { module: 'suivi-ventes-factures' } }));
      }
    }
  };

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  return (
    <Popover onOpenChange={(open) => { if (open) loadNotifications(); }}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "relative h-10 w-10 rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-rs-surface-tint/60",
            unreadCount > 0 
              ? "border-rs-surface-tint/40 bg-rs-surface-tint/10 hover:bg-rs-surface-tint/20 text-rs-surface-tint" 
              : "border-neutral-800/40 bg-neutral-900/40 hover:bg-neutral-800/60 text-neutral-300",
            className
          )}
        >
          <Bell className={cn("h-5 w-5", unreadCount > 0 && "animate-pulse-subtle")} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rs-surface-tint px-1.5 text-[10px] font-black text-black shadow-lg shadow-rs-surface-tint/30">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 border-neutral-800 bg-[#0d0d0d] text-white p-4 shadow-2xl" align="end">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800/60">
          <h3 className="font-bold text-sm tracking-wide uppercase">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="h-7 text-xs text-rs-surface-tint hover:bg-rs-surface-tint/10 hover:text-rs-surface-tint gap-1 px-2"
            >
              <Check className="h-3.5 w-3.5" />
              {i18n.language === 'en' ? 'Mark read' : 'Tout marquer lu'}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px] pr-1">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-xs">
              <Bell className="h-8 w-8 mx-auto opacity-20 mb-2" />
              {i18n.language === 'en' ? 'No new notifications' : 'Aucune nouvelle notification'}
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const isLowStock = notification.type === 'low_stock';
                const isRead = readIds.includes(notification.id);
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer",
                      isRead 
                        ? "bg-[#141414] border-neutral-950/20 text-neutral-500 opacity-50 hover:bg-neutral-900" 
                        : isLowStock 
                          ? "bg-amber-950/15 border-amber-800/30 text-white hover:bg-amber-950/20" 
                          : "bg-emerald-950/15 border-emerald-800/30 text-white hover:bg-emerald-950/20"
                    )}
                  >
                    <div className="flex gap-2">
                      <div className="mt-0.5 shrink-0">
                        {isLowStock ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-relaxed">{notification.message}</p>
                        <p className="text-[10px] text-neutral-500 mt-1 font-mono">
                          {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true, locale: currentLocale })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
