import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePOSStore, CartItem } from '@/stores/usePOSStore';
import { POSGrid } from '@/components/pos/POSGrid';
import { POSCommandBar } from '@/components/pos/POSCommandBar';
import { POSSidebar } from '@/components/pos/POSSidebar';
import { POSTotals } from '@/components/pos/POSTotals';
import { BarcodeScanner } from '@/components/shared/BarcodeScanner';
import { InventoryItem } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { LogOut, Zap } from 'lucide-react';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

export default function StrategicPOS() {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useFormatters();
  const { user } = useAuth();
  const { 
    cart, 
    clearCart,
    completeTransaction,
  } = usePOSStore();
  
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [storeId, setStoreId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CartItem | null>(null);
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
  const useLocalBridge = isLocalFirst;

  useEffect(() => {
    const fetchStore = async () => {
      if (!user) return;
      if (useLocalBridge) {
        const storeId = user.user_metadata?.store_id;
        if (storeId) setStoreId(storeId);
        return;
      }
      const { data } = await supabase
        .from('user_roles')
        .select('store_id')
        .eq('user_id', user.id)
        .in('role', ['worker', 'master'])
        .single();
      if (data?.store_id) setStoreId(data.store_id);
    };
    fetchStore();
  }, [user, useLocalBridge]);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!storeId) return;
      setIsLoading(true);
      if (useLocalBridge) {
        try {
          const headers = await OfflineAuthService.getAuthHeaders();
          if (!headers) {
            setIsLoading(false);
            return;
          }
          const params = new URLSearchParams({ store_id: storeId });
          const response = await fetch(`${localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, { headers });
          const payload = await response.json().catch(() => []);
          if (response.ok && payload) {
            const mappedProducts: InventoryItem[] = (payload || []).map((item: any) => ({
              id: item.id,
              name: item.name,
              description: item.description || undefined,
              sku: item.sku || undefined,
              price: Number(item.unit_price) || 0,
              cost: Number(item.cost_price) || 0,
              quantity: item.quantity,
              low_stock_threshold: item.min_quantity || undefined,
              category_id: item.category || undefined,
              store_id: item.store_id,
              image_url: item.image_url || undefined,
              created_at: item.created_at,
              updated_at: item.updated_at,
            }));
            setProducts(mappedProducts);
          }
        } catch (e) {
          console.error(e);
        }
        setIsLoading(false);
        return;
      }
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .order('name');
      if (data) {
        const mappedProducts: InventoryItem[] = data.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description || undefined,
          sku: item.sku || undefined,
          price: Number(item.unit_price) || 0,
          cost: Number(item.cost_price) || 0,
          quantity: item.quantity,
          low_stock_threshold: item.min_quantity || undefined,
          category_id: item.category || undefined,
          store_id: item.store_id,
          image_url: item.image_url || undefined,
          created_at: item.created_at,
          updated_at: item.updated_at,
        }));
        setProducts(mappedProducts);
      }
      setIsLoading(false);
    };
    fetchProducts();
  }, [storeId, localBridgeBaseUrl, useLocalBridge]);

  const handlePayment = useCallback(async () => {
    const transaction = completeTransaction('cash');
    if (!transaction) return;

    const saleData = {
      store_id: storeId,
      worker_id: user?.id,
      customer_name: transaction.customerName,
      customer_phone: transaction.customerPhone,
      sale_type: 'detail' as const,
      total_price: transaction.grandTotal,
      payment_method: 'cash',
      payment_status: 'paid' as const,
    };

    const saleItems = transaction.items.map(item => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.lineTotal,
    }));

    const { error } = await OfflineSalesService.createSaleWithItems(saleData, saleItems);
    
    if (error) {
      toast({ 
        title: t('common.error'), 
        description: t('worker.sales.errorRecording'), 
        variant: 'destructive' 
      });
      return;
    }
    
    toast({ 
      title: t('worker.sales.saleRecorded'), 
      description: `${t('worker.sales.total')}: ${formatCurrency(transaction.grandTotal)}` 
    });
  }, [completeTransaction, storeId, user?.id, t, i18n.language]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setIsScanning(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) handlePayment();
      } else if (e.key === 'Escape') {
        setIsScanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, handlePayment]);

  const handleScanResult = useCallback((result: string) => {
    const product = products.find(p => p.sku?.toLowerCase() === result.toLowerCase());
    if (product) {
      usePOSStore.getState().addToCart(product);
      toast({ title: t('worker.sales.itemFound', { name: product.name }) });
    } else {
      toast({ 
        title: t('worker.sales.itemNotFound'), 
        description: `SKU: ${result}`, 
        variant: 'destructive' 
      });
    }
    setIsScanning(false);
  }, [products, t]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="h-screen flex flex-col bg-background bg-grid overflow-hidden">
      <header className="h-14 px-4 flex items-center justify-between border-b border-border/50 glass-card rounded-none">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Strategic POS</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <POSGrid onRowSelect={setSelectedItem} />
          <POSTotals 
            onPayment={handlePayment} 
            onScan={() => setIsScanning(true)} 
            onClear={clearCart}
          />
        </div>

        <POSSidebar selectedItem={selectedItem} className="w-72 shrink-0" />
      </div>

      <POSCommandBar products={products} isLoading={isLoading} />
      
      <BarcodeScanner 
        isScanning={isScanning} 
        onResult={handleScanResult} 
        onClose={() => setIsScanning(false)} 
      />
    </div>
  );
}
