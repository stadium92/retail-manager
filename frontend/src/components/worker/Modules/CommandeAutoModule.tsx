import { useState, useEffect } from 'react';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Zap, ShoppingCart, AlertTriangle } from 'lucide-react';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useTranslation } from 'react-i18next';

interface CommandeAutoModuleProps {
  storeId: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  min_quantity: number;
  cost_price: number | null;
  supplier_id?: string;
  suggested_qty: number;
  selected: boolean;
}

export function CommandeAutoModule({ storeId }: CommandeAutoModuleProps) {
  const { t } = useTranslation();
  const { suppliers, fetchSuppliers, createOrder } = usePurchasingStore();
  const [products, setProducts] = useState<LowStockProduct[]>([]);
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(false);
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
    if (storeId) {
      fetchSuppliers(storeId);
      fetchLowStockProducts();
      fetchFamilies();
    }
  }, [storeId, useLocalBridge]);

  const fetchFamilies = async () => {
    const { data } = await OfflineInventoryService.getProductFamilies(storeId);
    if (data) {
      setCategories(data.map(f => ({ id: f.id, name: f.name })));
    }
  };

  const fetchLowStockProducts = async () => {
    setLoading(true);
    try {
      if (useLocalBridge) {
        const data = await localBridgeRequest<any[]>(
          `/rest/v1/products?${new URLSearchParams({ store_id: storeId }).toString()}`
        );
        const lowStock = (data || [])
          .filter(p => (p.quantity || 0) <= (p.min_quantity || 0))
          .map(p => ({
            id: p.id,
            name: p.name,
            category: (p as any).category ?? null,
            quantity: p.quantity || 0,
            min_quantity: p.min_quantity || 0,
            cost_price: (p as any).cost_price ?? null,
            suggested_qty: Math.max(10, (p.min_quantity || 10) * 2 - (p.quantity || 0)),
            selected: true,
          }));
        setProducts(lowStock);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('products')
        .select('*, product_families(name)')
        .eq('store_id', storeId)
        .eq('is_active', true);

      if (data) {
        const lowStock = data
          .filter(p => p.quantity <= (p.min_quantity || 0))
          .map(p => ({
            id: p.id,
            name: p.name,
            category: p.product_families?.name || p.category,
            quantity: p.quantity,
            min_quantity: p.min_quantity || 0,
            cost_price: p.cost_price,
            suggested_qty: Math.max(10, (p.min_quantity || 10) * 2 - p.quantity),
            selected: true
          }));
        
        setProducts(lowStock);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const toggleProduct = (productId: string) => {
    setProducts(products.map(p => 
      p.id === productId ? { ...p, selected: !p.selected } : p
    ));
  };

  const toggleAll = (checked: boolean) => {
    setProducts(products.map(p => ({ ...p, selected: checked })));
  };

  const updateQuantity = (productId: string, qty: number) => {
    setProducts(products.map(p => 
      p.id === productId ? { ...p, suggested_qty: qty } : p
    ));
  };

  const assignSupplier = (productId: string, supplierId: string) => {
    setProducts(products.map(p => 
      p.id === productId ? { ...p, supplier_id: supplierId } : p
    ));
  };

  const filteredProducts = products.filter(p => {
    if (filterSupplier !== 'all' && p.supplier_id !== filterSupplier) return false;
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    return true;
  });

  const selectedProducts = filteredProducts.filter(p => p.selected && p.supplier_id);

  const generateOrders = async () => {
    if (selectedProducts.length === 0) {
      toast.error(t('menu.program.assignSuppliersPrompt'));
      return;
    }

    setLoading(true);
    try {
      const bySupplier = selectedProducts.reduce((acc, p) => {
        if (!p.supplier_id) return acc;
        if (!acc[p.supplier_id]) acc[p.supplier_id] = [];
        acc[p.supplier_id].push(p);
        return acc;
      }, {} as Record<string, LowStockProduct[]>);

      let ordersCreated = 0;
      for (const [supplierId, items] of Object.entries(bySupplier)) {
        const totalAmount = items.reduce((sum, p) => sum + (p.suggested_qty * (p.cost_price || 0)), 0);
        
        const order = await createOrder(
          {
            store_id: storeId,
            supplier_id: supplierId,
            status: 'draft',
            total_amount: totalAmount
          },
          items.map(p => ({
            order_id: '',
            product_id: p.id,
            quantity_ordered: p.suggested_qty,
            quantity_received: 0,
            unit_cost: p.cost_price || 0
          }))
        );
        
        if (order) ordersCreated++;
      }

      toast.success(t('common.success'));
      fetchLowStockProducts();
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const allSelected = filteredProducts.length > 0 && filteredProducts.every(p => p.selected);

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {t('menu.program.autoOrderTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">{t('menu.program.filterBySupplier')}</label>
              <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('inventory.allStores')}</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">{t('menu.program.filterByCategory')}</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchLowStockProducts} variant="outline" size="sm" disabled={loading}>
                {t('common.refresh')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full">
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={allSelected}
                      onCheckedChange={(checked) => toggleAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                  <TableHead className="text-xs w-20 text-center">{t('inventory.quantity')}</TableHead>
                  <TableHead className="text-xs w-20 text-center">Min</TableHead>
                  <TableHead className="text-xs w-28">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      {t('menu.program.deficit')}
                    </span>
                  </TableHead>
                  <TableHead className="text-xs w-28">{t('menu.program.suggestedQty')}</TableHead>
                  <TableHead className="text-xs w-40">{t('menu.program.supplier')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => {
                  const categoryName = categories.find(c => c.id === product.category || c.name === product.category)?.name || product.category;
                  return (
                  <TableRow key={product.id} className="h-10">
                    <TableCell className="p-2">
                      <Checkbox 
                        checked={product.selected}
                        onCheckedChange={() => toggleProduct(product.id)}
                      />
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {product.name}
                      {categoryName && (
                        <span className="text-xs text-muted-foreground ml-2">({categoryName})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-medium ${product.quantity <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {product.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm">{product.min_quantity}</TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-red-600">
                        -{Math.max(0, product.min_quantity - product.quantity)}
                      </span>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        type="number"
                        min={1}
                        value={product.suggested_qty}
                        onChange={(e) => updateQuantity(product.id, parseInt(e.target.value) || 1)}
                        className="h-8 text-center"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Select 
                        value={product.supplier_id || ''} 
                        onValueChange={(v) => assignSupplier(product.id, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder={t('common.search')} />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {loading ? t('common.loading') : t('inventory.noItemsFound')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
        <div className="text-sm text-muted-foreground">
          {selectedProducts.length} {t('common.itemsSelected')}
        </div>
        <Button 
          onClick={generateOrders} 
          disabled={loading || selectedProducts.length === 0}
          className="gap-2"
        >
          <ShoppingCart className="h-4 w-4" />
          {t('menu.program.generateOrders')}
        </Button>
      </div>
    </div>
  );
}