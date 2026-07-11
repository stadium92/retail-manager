import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { Product } from '@/types';
import { Plus, Trash2, Check, ScanBarcode } from 'lucide-react';
import { BarcodeScanner } from '@/components/shared/BarcodeScanner';
import { toast } from '@/hooks/use-toast';
import { explainSaleError } from '@/utils/saleError';
import { OfflineManager } from '@/services/OfflineManager';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SaleItem {
  product: Product;
  quantity: number;
  price: number;
}

export function SalesEntryForm() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [needsDelivery, setNeedsDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [storeId, setStoreId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' XAF';
  };

  const useLocalBridge = isLocalFirst;

  const localBridgeRequest = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    if (!useLocalBridge) {
      throw new Error('LocalBridge mode is not enabled.');
    }

    const headers = await OfflineAuthService.getAuthHeaders();
    if (!headers) {
      throw new Error('LocalBridge session expired. Please sign in again.');
    }

    const response = await fetch(`${localBridgeBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...headers,
      },
    });

    let payload: any = null;
    if (response.status !== 204) {
      try {
        payload = await response.json();
      } catch (error) {
        // ignore
      }
    }

    if (!response.ok) {
      const message = payload?.message || 'LocalBridge request failed';
      throw new Error(message);
    }

    return payload as T;
  }, [localBridgeBaseUrl, useLocalBridge]);

  const fetchUserStore = useCallback(async () => {
    if (!user) return;

    if (useLocalBridge) {
      const metaStoreId = user.user_metadata?.store_id;
      if (metaStoreId) {
        setStoreId(metaStoreId);
        return;
      }
      toast({
        title: t('worker.sales.noStoreAssigned'),
        description: t('worker.sales.contactManager'),
        variant: 'destructive',
      });
      return;
    }

    // Non-local-first path removed (supabase no longer available)
    console.warn('fetchUserStore: non-local-first path is not supported');
    return;
  }, [t, useLocalBridge, user, toast]);

  const fetchProducts = useCallback(async () => {
    try {
      if (useLocalBridge) {
        const params = new URLSearchParams();
        params.set('store_id', storeId);
        const data = await localBridgeRequest<Product[]>(`/rest/v1/products?${params.toString()}`);
        const filtered = (data || []).filter((item) => (item.quantity || 0) > 0);
        if (filtered) {
          const mappedProducts: Product[] = filtered.map(item => ({
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
          setProducts(mappedProducts);
        }
        return;
      }

      // Non-local-first path removed (supabase no longer available)
      console.warn('fetchProducts: non-local-first path is not supported');
    } catch (error) {
      console.error('Failed to fetch products', error);
      toast({
        title: t('common.error'),
        description: t('common.failedToLoad'),
        variant: 'destructive',
      });
    }
  }, [localBridgeRequest, storeId, t, useLocalBridge, toast]);

  useEffect(() => {
    fetchUserStore();
  }, [fetchUserStore]);

  useEffect(() => {
    if (storeId) {
      fetchProducts();
    }
  }, [storeId, fetchProducts]);

  const addItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setSelectedItems([...selectedItems, {
      product,
      quantity: 1,
      price: Number(product.unit_price),
    }]);
  };

  const updateQuantity = (index: number, quantity: number) => {
    setSelectedItems(selectedItems.map((si, i) =>
      i === index ? { ...si, quantity } : si
    ));
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return selectedItems.reduce((sum, si) => sum + (si.price * si.quantity), 0);
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast({
        title: t('worker.sales.noItems'),
        description: t('worker.sales.addAtLeastOne'),
        variant: 'destructive',
      });
      return;
    }

    if (needsDelivery && !deliveryAddress.trim()) {
      toast({
        title: t('worker.sales.deliveryAddressRequired'),
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
        if (false) {
        // Non-local-first direct supabase path removed
        } else {
          if (useLocalBridge) {
            const saleResult = await OfflineSalesService.createSale({
              store_id: storeId,
              worker_id: user?.id || '',
              items: selectedItems.map((item) => ({
                product: item.product,
                quantity: item.quantity,
                discount: 0,
                unitPrice: item.price,
                lineTotal: item.price * item.quantity,
                total: item.price * item.quantity,
              })),
              total_price: calculateTotal(),
              payment_method: 'cash',
              sale_type: 'detail',
              customer_name: customerName,
              customer_phone: customerPhone,
            });
            if (saleResult.error) {
              throw saleResult.error;
            }
            toast({
              title: t('worker.sales.saleQueued'),
              description: t('worker.sales.itemsQueued', { count: selectedItems.length, total: formatCurrency(calculateTotal()) }),
            });
          } else {
            const offlineSaleData = {
              store_id: storeId,
              worker_id: user?.id,
              customer_name: customerName,
              customer_phone: customerPhone,
              total_price: calculateTotal(),
              items: selectedItems,
            };
            OfflineManager.addToQueue('sale', offlineSaleData);
            toast({
              title: t('worker.sales.saleQueued'),
              description: t('worker.sales.itemsQueued', { count: selectedItems.length, total: formatCurrency(calculateTotal()) }),
            });
          }
        }

      setSelectedItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setNeedsDelivery(false);
      setDeliveryAddress('');

      if (!useLocalBridge && OfflineManager.isOnline()) {
        fetchProducts();
      }
    } catch (error) {
      console.error('Sale error:', error);
      toast({
        title: t('worker.sales.errorRecording'),
        description: explainSaleError(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleScanResult = (result: string) => {
    const scannedProduct = products.find(
      (p) => p.sku?.toLowerCase() === result.toLowerCase() || p.barcode?.toLowerCase() === result.toLowerCase()
    );

    if (scannedProduct) {
      toast({
        title: t('common.success'),
        description: t('worker.sales.itemFound', { name: scannedProduct.name }),
      });
      addItem(scannedProduct.id);
    } else {
      toast({
        title: t('common.error'),
        description: t('worker.sales.itemNotFound'),
        variant: 'destructive',
      });
    }
    setIsScanning(false);
  };

  return (
    <Card>
      <BarcodeScanner
        isScanning={isScanning}
        onResult={handleScanResult}
        onClose={() => setIsScanning(false)}
      />
      <CardHeader>
        <CardTitle>{t('worker.sales.newSale')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>{t('worker.sales.addItem')}</Label>
          <div className="flex gap-2">
            <Select onValueChange={addItem}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t('worker.sales.selectItem')} />
              </SelectTrigger>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsScanning(true)}
                className="ml-2 shrink-0"
                title={t('common.scanBarcode')}
              >
                <ScanBarcode className="h-4 w-4" />
              </Button>
              <SelectContent>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} - {formatCurrency(Number(product.unit_price))} ({product.quantity} {t('worker.sales.inStock')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedItems.length > 0 && (
          <div className="space-y-3">
            <Label>{t('worker.sales.items', { count: selectedItems.length })}</Label>
            {selectedItems.map((si, index) => (
              <div key={`${si.product.id}-${index}`} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{si.product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(si.price)} {t('worker.sales.each')}
                  </p>
                </div>
                <Input
                  type="number"
                  min="1"
                  max={si.product.quantity}
                  value={si.quantity}
                  onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                  className="w-20"
                />
                <p className="font-medium w-32 text-right">
                  {formatCurrency(si.price * si.quantity)}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex justify-between items-center pt-3 border-t">
              <span className="text-lg font-semibold">{t('worker.sales.total')}</span>
              <span className="text-2xl font-bold">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer-name">{t('worker.sales.customerName')}</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('worker.sales.enterCustomerName')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-phone">{t('worker.sales.customerPhone')}</Label>
            <Input
              id="customer-phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder={t('worker.sales.enterPhone')}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="needs-delivery"
              checked={needsDelivery}
              onCheckedChange={(checked) => setNeedsDelivery(checked as boolean)}
            />
            <Label htmlFor="needs-delivery" className="cursor-pointer">
              {t('worker.sales.needsDelivery')}
            </Label>
          </div>

          {needsDelivery && (
            <div className="space-y-2">
              <Label htmlFor="delivery-address">{t('worker.sales.deliveryAddress')}</Label>
              <Input
                id="delivery-address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder={t('worker.sales.enterDeliveryAddress')}
                required
              />
            </div>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting || selectedItems.length === 0}
          className="w-full"
          size="lg"
        >
          {submitting ? (
            t('worker.sales.recording')
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              {t('worker.sales.recordSale')} - {formatCurrency(calculateTotal())}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}