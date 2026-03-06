import { useState, useEffect, useCallback } from 'react';
import { usePOSStore, CartItem } from '@/stores/usePOSStore';
import { POSGrid } from '@/components/pos/POSGrid';
import { POSCommandBar } from '@/components/pos/POSCommandBar';
import { POSSidebar } from '@/components/pos/POSSidebar';
import { POSTotals } from '@/components/pos/POSTotals';
import { BarcodeScanner } from '@/components/shared/BarcodeScanner';
import { Product } from '@/types';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useRegisterShortcuts } from '@/contexts/ShortcutsContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';

interface FacturationModuleProps {
  storeId: string;
  mode: 'vente-detail' | 'facturation-detail' | 'facturation-gros';
}

// Map Product to InventoryItem format for POS components
const mapProductToInventoryItem = (product: Product) => ({
  id: product.id,
  name: product.name,
  description: product.description,
  sku: product.sku,
  price: product.unit_price,
  unit_price: product.unit_price,
  cost: product.cost_price,
  cost_price: product.cost_price,
  quantity: product.quantity,
  low_stock_threshold: product.min_quantity,
  min_quantity: product.min_quantity,
  category_id: undefined,
  store_id: product.store_id,
  image_url: product.image_url,
  created_at: product.created_at,
  updated_at: product.updated_at,
});

export function FacturationModule({ storeId, mode }: FacturationModuleProps) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useFormatters();
  const { getKeyForAction } = useSettingsStore();
  const { user } = useAuth();
  const { 
    cart, 
    addToCart, 
    clearCart,
    completeTransaction,
    setCommandOpen,
  } = usePOSStore();

  const keyValidate = getKeyForAction('ACTION_VALIDATE') || 'F2';
  const keySearch = getKeyForAction('ACTION_SEARCH') || 'F3';
  const keyPay = getKeyForAction('ACTION_PAY') || 'F4';
  const keyPrint = getKeyForAction('ACTION_PRINT') || 'F10';
  const keyScan = getKeyForAction('ACTION_SCAN');

  const modeLabels = {
    'vente-detail': t('menu.sales.retail'),
    'facturation-detail': t('menu.sales.billingRetail'),
    'facturation-gros': t('menu.sales.billingWholesale'),
  };
  
  const [products, setProducts] = useState<ReturnType<typeof mapProductToInventoryItem>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CartItem | null>(null);

  // Register Shortcuts
  useRegisterShortcuts([
        {
          key: keyScan || 'none',
          label: t('pos.totals.scan'),
          action: () => setIsScanning(true),
          group: 'POS'
        },
        {
          key: keySearch,
          label: t('common.search'),
          action: () => toast({ description: "Search not implemented in this view" }), // Placeholder or CommandPalette
          group: 'POS'
        },
        {
          key: keyPay,
          label: t('pos.totals.pay'),
          action: () => {
            if (cart.length > 0) handlePayment();
          },
          group: 'POS'
        },
        {
          key: keyValidate,
          label: t('menu.program.validate'),
          action: () => {
            if (cart.length > 0) handlePayment();
          },
          group: 'POS'
        },
        {
          key: keyPrint,
          label: t('common.print'),
          action: () => toast({ title: t('common.print'), description: "Printing..." }),
          group: 'POS'
        },
        {
          key: 'Escape',
          label: t('common.cancel'),
          action: () => setIsScanning(false),
          group: 'POS'
        }
      ]);
  // Fetch products from products table via local bridge
  useEffect(() => {
    const fetchProducts = async () => {
      if (!storeId) return;
      setIsLoading(true);
      try {
        const { localBridgeBaseUrl } = getDataClient();
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          setIsLoading(false);
          return;
        }
        const params = new URLSearchParams({ store_id: storeId });
        const response = await fetch(`${localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, { headers });
        const data = await response.json().catch(() => []);
        if (response.ok && data) {
          const mappedProducts = (data as any[]).map((item: any) => ({
            id: item.id,
            store_id: item.store_id,
            name: item.name,
            description: item.description,
            sku: item.sku,
            unit_price: Number(item.unit_price) || 0,
            cost_price: Number(item.cost_price) || 0,
            quantity: item.quantity,
            min_quantity: item.min_quantity,
            image_url: item.image_url,
            created_at: item.created_at,
            updated_at: item.updated_at,
          }));
          setProducts(mappedProducts.map(mapProductToInventoryItem));
        }
      } catch (e) {
        console.error('Failed to fetch products:', e);
      }
      setIsLoading(false);
    };
    fetchProducts();
  }, [storeId]);

  const handleScanResult = useCallback((result: string) => {
    const product = products.find(p => 
      p.sku?.toLowerCase() === result.toLowerCase() ||
      p.name.toLowerCase().includes(result.toLowerCase())
    );
    
    if (product) {
      addToCart(product);
      toast({ title: t('worker.sales.itemFound', { name: product.name }), description: product.name });
    } else {
      toast({ 
        title: t('worker.sales.itemNotFound'), 
        description: `${t('pos.grid.headers.sku')}: ${result}`, 
        variant: 'destructive' 
      });
    }
    setIsScanning(false);
  }, [products, addToCart, t]);

  const handlePayment = async () => {
    const transaction = completeTransaction('cash');
    if (!transaction) return;

    // Create sale with items using the new schema
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
        variant: 'destructive',
      });
      return;
    }
    
    toast({ 
      title: t('worker.sales.saleRecorded'), 
      description: `${t('worker.sales.total')}: ${formatCurrency(transaction.grandTotal)}` 
    });
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[hsl(60,80%,85%)] dark:bg-transparent">
      {/* Mode indicator */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-sm font-medium">
            {modeLabels[mode]}
          </span>
          <span className="text-xs text-muted-foreground">
            {keyPay}: {t('pos.totals.pay')} • {keyScan}: {t('pos.totals.scan')} • Cmd+K: {t('common.search')}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          {cart.length} {t('worker.sales.items', { count: cart.length })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left: Grid + Totals */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <POSGrid onRowSelect={setSelectedItem} />
          <POSTotals 
            onPayment={handlePayment} 
            onScan={() => setIsScanning(true)} 
            onClear={clearCart}
          />
        </div>

        {/* Right: Sidebar */}
        <POSSidebar selectedItem={selectedItem} className="w-72 shrink-0" />
      </div>

      {/* Command Bar */}
      <POSCommandBar products={products} isLoading={isLoading} />
      
      {/* Barcode Scanner */}
      <BarcodeScanner 
        isScanning={isScanning} 
        onResult={handleScanResult} 
        onClose={() => setIsScanning(false)} 
      />
    </div>
  );
}
