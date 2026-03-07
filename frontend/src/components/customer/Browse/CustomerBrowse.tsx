import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Search, Package, ShoppingBag, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  unit_price: number;
  quantity: number;
  image_url?: string;
}

export function CustomerBrowse() {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatters();
  const [items, setItems] = useState<Product[]>([]);
  const [filteredItems, setFilteredItems] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('CustomerBrowse: Component mounted');
    fetchProducts();
  }, []);

  useEffect(() => {
    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredItems(filtered);
  }, [searchQuery, items]);

  const fetchProducts = async () => {
    try {
      console.log('CustomerBrowse: Fetching products...');
      const { localBridgeBaseUrl } = getDataClient();
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) {
        console.error('CustomerBrowse: No auth headers available');
        setLoading(false);
        return;
      }
      const response = await fetch(`${localBridgeBaseUrl}/rest/v1/products`, { headers });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        console.error('CustomerBrowse: Error fetching products:', data);
        setLoading(false);
        return;
      }

      if (data) {
        console.log('CustomerBrowse: Products loaded:', data.length);
        const mappedItems = (data as any[])
          .filter((item: any) => item.quantity > 0)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            sku: item.sku,
            unit_price: Number(item.unit_price) || 0,
            quantity: item.quantity,
            image_url: item.image_url,
          }));
        setItems(mappedItems);
        setFilteredItems(mappedItems);
      }
    } catch (error) {
      console.error('CustomerBrowse: Unexpected error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Store className="h-6 w-6" />
              {t('customer.catalog.title')}
            </h1>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          {t('customer.catalog.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background mobile-container">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-4">
            <Store className="h-6 w-6" />
            {t('customer.catalog.title')}
          </h1>
          
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('customer.catalog.searchPlaceholder')}
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <main className="container mx-auto px-4 py-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? t('customer.catalog.noProductsFound') : t('customer.catalog.noProductsAvailable')}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {t('customer.catalog.productCount', { count: filteredItems.length })}
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(item => (
                <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-16 w-16 text-muted-foreground" />
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(Number(item.unit_price))}
                      </p>
                      <Badge variant={item.quantity > 10 ? 'default' : 'secondary'}>
                        {t('customer.catalog.inStock', { quantity: item.quantity })}
                      </Badge>
                    </div>
                    {item.sku && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {t('customer.catalog.sku')}: {item.sku}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t mt-12">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>{t('customer.catalog.footer.browse')}</p>
          <p className="mt-2">{t('customer.catalog.footer.contact')}</p>
        </div>
      </footer>
    </div>
  );
}
