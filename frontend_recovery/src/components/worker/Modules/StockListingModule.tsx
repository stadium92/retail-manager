import { useState, useEffect, useMemo } from 'react';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Product } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Download, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface StockListingModuleProps {
  storeId: string;
}

type StockFilter = 'all' | 'ok' | 'low' | 'rupture';

export function StockListingModule({ storeId }: StockListingModuleProps) {
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { supabase, isLocalFirst, localBridgeBaseUrl } = getDataClient();

  const useLocalBridge = isLocalFirst;

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
    const fetchProducts = async () => {
      if (!storeId) return;
      setIsLoading(true);

      try {
        if (useLocalBridge) {
          const params = new URLSearchParams();
          params.set('store_id', storeId);
          const data = await localBridgeRequest<Product[]>(`/rest/v1/products?${params.toString()}`);
          setProducts(data || []);
          return;
        }

        const { data } = await supabase
          .from('products')
          .select('*')
          .eq('store_id', storeId)
          .order('name');
        
        if (data) {
          // Map products to Product interface
          const mappedProducts: Product[] = data.map(item => ({
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
      } catch (error) {
        console.error('Failed to fetch products', error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProducts();
  }, [storeId, useLocalBridge]);

  const getStockStatus = (quantity: number, threshold: number = 10): StockFilter => {
    if (quantity <= 0) return 'rupture';
    if (quantity <= threshold) return 'low';
    return 'ok';
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      
      if (filter === 'all') return true;
      
      const status = getStockStatus(product.quantity, product.min_quantity);
      return status === filter;
    });
  }, [products, searchQuery, filter]);

  const stats = useMemo(() => {
    const total = products.length;
    const ok = products.filter(p => getStockStatus(p.quantity, p.min_quantity) === 'ok').length;
    const low = products.filter(p => getStockStatus(p.quantity, p.min_quantity) === 'low').length;
    const rupture = products.filter(p => getStockStatus(p.quantity, p.min_quantity) === 'rupture').length;
    const totalValue = products.reduce((sum, p) => sum + (p.unit_price * p.quantity), 0);
    
    return { total, ok, low, rupture, totalValue };
  }, [products]);

  const { formatCurrency } = useFormatters();

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 bg-[hsl(60,80%,85%)] dark:bg-transparent">
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex items-center gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search')}
              className="w-64 h-8"
            />
            <Button variant="outline" size="sm">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Filter */}
          <Select value={filter} onValueChange={(v) => setFilter(v as StockFilter)}>
            <SelectTrigger className="w-40 h-8">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')} ({stats.total})</SelectItem>
              <SelectItem value="ok">{t('inventory.inStock')} ({stats.ok})</SelectItem>
              <SelectItem value="low">{t('inventory.lowStock')} ({stats.low})</SelectItem>
              <SelectItem value="rupture">{t('inventory.outOfStock')} ({stats.rupture})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="px-3 py-1 bg-success/20 text-success rounded-lg">
            ✓ {stats.ok} OK
          </div>
          <div className="px-3 py-1 bg-warning/20 text-warning rounded-lg">
            ⚠ {stats.low} {t('inventory.lowStock')}
          </div>
          <div className="px-3 py-1 bg-danger/20 text-danger rounded-lg">
            ✕ {stats.rupture} {t('inventory.outOfStock')}
          </div>
          <div className="px-3 py-1 bg-primary/20 text-primary rounded-lg font-medium">
            {t('menu.program.value')}: {formatCurrency(stats.totalValue)}
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="flex-1 glass-card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[80px_1fr_120px_100px_100px_100px_100px_120px_120px] gap-2 px-4 py-2 bg-muted/50 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase">
          <div>{t('menu.program.photo')}</div>
          <div>{t('pos.grid.headers.designation')}</div>
          <div>{t('pos.grid.headers.sku')}</div>
          <div className="text-right">{t('inventory.price')}</div>
          <div className="text-right">{t('inventory.fields.wholesalePriceShort')}</div>
          <div className="text-center">{t('inventory.quantity')}</div>
          <div className="text-center">{t('menu.program.threshold')}</div>
          <div className="text-right">{t('menu.program.value')}</div>
          <div className="text-right">Marge</div>
        </div>

        {/* Table Body */}
        <ScrollArea className="h-[calc(100%-40px)]">
          {filteredProducts.map((product) => {
            const status = getStockStatus(product.quantity, product.min_quantity);
            const isSelected = product.id === selectedId;
            const value = product.unit_price * product.quantity;
            const marginAmt = product.unit_price - (product.cost_price || 0);
            const marginPct = product.unit_price > 0 && product.cost_price 
              ? (((product.unit_price - product.cost_price) / product.unit_price) * 100).toFixed(1) 
              : '0';
            
            return (
              <div
                key={product.id}
                onClick={() => setSelectedId(product.id)}
                className={cn(
                  'grid grid-cols-[80px_1fr_120px_100px_100px_100px_100px_120px_120px] gap-2 px-4 items-center',
                  'border-b border-border/30 cursor-pointer transition-colors',
                  'hover:bg-primary/5',
                  isSelected && 'bg-primary/10 border-l-2 border-l-primary'
                )}
                style={{ height: '48px' }}
              >
                {/* Photo */}
                <div className="flex items-center justify-center">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-medium">
                      {product.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Designation */}
                <div className="truncate font-medium">{product.name}</div>

                {/* SKU */}
                <div className="text-xs text-muted-foreground font-mono">{product.sku || '—'}</div>

                {/* Price */}
                <div className="text-right font-medium">{formatCurrency(product.unit_price)}</div>

                {/* Wholesale Price */}
                <div className="text-right text-muted-foreground text-xs">
                  {formatCurrency(product.wholesale_price_ttc || 0)}
                </div>

                {/* Stock */}
                <div className="flex justify-center">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    status === 'ok' && 'status-ok',
                    status === 'low' && 'status-low',
                    status === 'rupture' && 'status-rupture'
                  )}>
                    {product.quantity}
                  </span>
                </div>

                {/* Threshold */}
                <div className="text-center text-sm text-muted-foreground">
                  {product.min_quantity || 10}
                </div>

                {/* Value */}
                <div className="text-right font-medium text-primary">
                  {formatCurrency(value)}
                </div>

                {/* Margin */}
                <div className="text-right font-bold text-success whitespace-nowrap">
                  {formatCurrency(marginAmt)} ({marginPct}%)
                </div>
              </div>
            );
          })}
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="mt-3 flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {filteredProducts.length} {t('menu.program.productsDisplayed')}
        </span>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          {t('export.title')}
        </Button>
      </div>
    </div>
  );
}