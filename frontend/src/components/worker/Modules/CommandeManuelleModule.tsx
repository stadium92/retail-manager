import { useState, useEffect, useRef } from 'react';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { FileText, Plus, Trash2, Save, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface CommandeManuelleModuleProps {
  storeId: string;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  unit_type: 'Pièce' | 'Carton';
  packaging: string; // The raw string e.g. "12" or "6x1L"
  pack_size: number; // The parsed multiplier
}

export function CommandeManuelleModule({ storeId }: CommandeManuelleModuleProps) {
  const { t, i18n } = useTranslation();
  const { suppliers, fetchSuppliers, createOrder } = usePurchasingStore();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; cost_price: number | null; packaging: string | null }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { supabase, isLocalFirst, localBridgeBaseUrl } = getDataClient();

  const useLocalBridge = isLocalFirst;

  const { formatCurrency } = useFormatters();

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
      fetchProducts();
    }
  }, [storeId, useLocalBridge]);

  const fetchProducts = async () => {
    if (useLocalBridge) {
      const data = await localBridgeRequest<{ id: string; name: string; cost_price: number | null; packaging: string | null }[]>(
        `/rest/v1/products?${new URLSearchParams({ store_id: storeId }).toString()}`
      );
      const activeProducts = (data || []).filter(item => item.id);
      setProducts(
        activeProducts.map((item) => ({
          id: item.id,
          name: item.name,
          cost_price: item.cost_price ?? 0,
          packaging: item.packaging,
        }))
      );
      return;
    }

    const { data } = await supabase
      .from('products')
      .select('id, name, cost_price, packaging')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('name');
    setProducts(data || []);
  };

  const parsePackSize = (packaging: string | null): number => {
    if (!packaging) return 1;
    // Try to find the first number. e.g., "12" -> 12, "6x1L" -> 6
    const match = packaging.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !items.find(i => i.product_id === p.id)
  );

  const addProduct = (product: { id: string; name: string; cost_price: number | null; packaging: string | null }) => {
    setItems([...items, {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_cost: product.cost_price || 0,
      unit_type: 'Pièce',
      packaging: product.packaging || '',
      pack_size: parsePackSize(product.packaging)
    }]);
    setSearchTerm('');
    searchRef.current?.focus();
  };

  const updateItem = (productId: string, field: keyof OrderItem, value: any) => {
    setItems(items.map(item => 
      item.product_id === productId ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(item => item.product_id !== productId));
  };

  const calculateLineTotal = (item: OrderItem) => {
    const multiplier = item.unit_type === 'Carton' ? item.pack_size : 1;
    return item.quantity * item.unit_cost * multiplier;
  };

  const totalAmount = items.reduce((sum, item) => sum + calculateLineTotal(item), 0);

  const saveOrder = async (status: 'draft' | 'ordered') => {
    if (!selectedSupplierId) {
      toast.error(t('menu.program.supplier'));
      return;
    }
    if (items.length === 0) {
      toast.error(t('worker.sales.addAtLeastOne'));
      return;
    }

    setLoading(true);
    try {
      const order = await createOrder(
        {
          store_id: storeId,
          supplier_id: selectedSupplierId,
          status,
          total_amount: totalAmount
        },
        items.map(item => {
          // If buying in Cartons, convert to total units for inventory tracking if backend expects units
          // Or store as-is if backend handles unit types. 
          // Usually inventory is in base units (Pieces).
          // So quantity_ordered should be item.quantity * multiplier?
          // BUT the order record might want to preserve "2 Boxes".
          // Let's assume standard practice: store in base units for stock, but maybe note the pack.
          // For now, let's normalize to base units for the 'quantity_ordered' field to keep stock correct.
          const multiplier = item.unit_type === 'Carton' ? item.pack_size : 1;
          
          return {
            order_id: '',
            product_id: item.product_id,
            quantity_ordered: item.quantity * multiplier, 
            quantity_received: 0,
            unit_cost: item.unit_cost // This is cost per base unit
          };
        })
      );

      if (order) {
        toast.success(t('common.success'));
        setItems([]);
        setSelectedSupplierId('');
      }
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const sendViaWhatsApp = () => {
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!supplier?.phone) {
      toast.error(t('common.error'));
      return;
    }

    const message = `*${t('menu.program.manualOrderTitle')} - ${new Date().toLocaleDateString(i18n.language === 'bm' ? 'fr-ML' : i18n.language)}*\n\n` +
      items.map(item => {
        const unitLabel = item.unit_type === 'Carton' ? `Carton(s) (${item.pack_size}/u)` : 'Pièce(s)';
        return `• ${item.product_name}: ${item.quantity} ${unitLabel}`;
      }).join('\n') + 
      `\n\n*Total: ${formatCurrency(totalAmount)}*`;

    const phone = supplier.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('menu.program.manualOrderTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium mb-1 block">{t('menu.program.supplier')}</label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder={t('common.search')} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.balance > 0 && `(${t('menu.program.balance')}: ${formatCurrency(s.balance)})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative">
            <label className="text-xs font-medium mb-1 block">{t('menu.program.searchProductToAdd')} (F2)</label>
            <Input
              ref={searchRef}
              type="text"
              placeholder={t('common.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8"
            />
            {searchTerm && filteredProducts.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                {filteredProducts.slice(0, 10).map(product => (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex justify-between items-center"
                  >
                    <span>{product.name}</span>
                    <span className="text-muted-foreground">{formatCurrency(product.cost_price || 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full">
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                  <TableHead className="text-xs w-24">{t('menu.program.unit')}</TableHead>
                  <TableHead className="text-xs w-28 text-center">{t('inventory.table.quantity')}</TableHead>
                  <TableHead className="text-xs w-32 text-right">{t('inventory.price')} (Unit)</TableHead>
                  <TableHead className="text-xs w-28 text-right">Total</TableHead>
                  <TableHead className="text-xs w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.product_id} className="h-10">
                    <TableCell className="text-sm font-medium">
                      {item.product_name}
                      {item.packaging && <span className="ml-2 text-xs text-muted-foreground">({item.packaging})</span>}
                    </TableCell>
                    <TableCell className="p-1">
                      <Select 
                        value={item.unit_type} 
                        onValueChange={(val: 'Pièce' | 'Carton') => updateItem(item.product_id, 'unit_type', val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pièce">Pièce</SelectItem>
                          {item.pack_size > 1 && <SelectItem value="Carton">Carton (x{item.pack_size})</SelectItem>}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.product_id, 'quantity', parseInt(e.target.value) || 1)}
                        className="h-8 text-center"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unit_cost}
                        onChange={(e) => updateItem(item.product_id, 'unit_cost', parseFloat(e.target.value) || 0)}
                        className="h-8 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(calculateLineTotal(item))}
                    </TableCell>
                    <TableCell className="p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeItem(item.product_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {t('menu.program.searchProductPrompt')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
        <div className="text-lg font-bold">
          Total: {formatCurrency(totalAmount)}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => saveOrder('draft')} 
            disabled={loading || items.length === 0}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {t('menu.program.draft')}
          </Button>
          <Button 
            variant="outline"
            onClick={sendViaWhatsApp} 
            disabled={items.length === 0 || !selectedSupplierId}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button 
            onClick={() => saveOrder('ordered')} 
            disabled={loading || items.length === 0}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('menu.program.placeOrder')}
          </Button>
        </div>
      </div>
    </div>
  );
}