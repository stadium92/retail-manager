import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Search, AlertTriangle, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit_price: number;
  quantity: number;
  min_quantity?: number;
}

export function InventoryQuickView() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [items, setItems] = useState<Product[]>([]);
  const [filteredItems, setFilteredItems] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

  const useLocalBridge = true;

  const localBridgeRequest = async <T,>(path: string, init: RequestInit = {}) => {
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
  };

  useEffect(() => {
    fetchInventory();
  }, [user, useLocalBridge]);

  useEffect(() => {
    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredItems(filtered);
  }, [searchQuery, items]);

  const fetchInventory = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      if (useLocalBridge) {
        const params = new URLSearchParams();
        const storeId = user.user_metadata?.store_id;
        if (!storeId) {
          throw new Error('No store assigned to this user.');
        }
        params.set('store_id', storeId);
        const data = await localBridgeRequest<Product[]>(`/rest/v1/products?${params.toString()}`);
        if (data) {
          const mappedItems = (data || []).map(item => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            unit_price: Number(item.unit_price) || 0,
            quantity: item.quantity,
            min_quantity: item.min_quantity,
          }));
          setItems(mappedItems);
          setFilteredItems(mappedItems);
        }
        return;
      }

      // Non-local-first path removed (supabase no longer available)
      console.warn('InventoryQuickView: non-local-first path is not supported');
      setLoading(false);
    } catch (error) {
      console.error('Unexpected error fetching inventory:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('common.failedToLoad'),
        variant: 'destructive',
      });
      setItems([]);
      setFilteredItems([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('worker.inventory.search')}
            className="pl-9"
            disabled
          />
        </div>
        <div className="text-center py-8 text-muted-foreground">
          {t('worker.inventory.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('worker.inventory.search')}
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? t('worker.inventory.noItemsFound') : t('worker.inventory.noItems')}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => {
            const isLowStock = item.quantity <= (item.min_quantity || 10);
            const isOutOfStock = item.quantity === 0;

            return (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.sku && (
                          <p className="text-sm text-muted-foreground">{t('worker.inventory.sku')}: {item.sku}</p>
                        )}
                        <p className="text-lg font-semibold mt-1">
                          ${Number(item.unit_price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-1">
                      <p className="text-2xl font-bold">{item.quantity}</p>
                      <p className="text-xs text-muted-foreground">{t('worker.inventory.inStock')}</p>
                      
                      {isOutOfStock && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t('worker.inventory.outOfStock')}
                        </Badge>
                      )}
                      {isLowStock && !isOutOfStock && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {t('worker.inventory.lowStock')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
