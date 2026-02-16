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
import { ShoppingCart, AlertTriangle, User, Zap, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

interface ReplenishmentNeed {
  product_id: string;
  product_name: string;
  sku?: string;
  current_stock: number;
  min_stock: number;
  source: 'low_stock' | 'worker_request';
  suggested_qty: number;
  requester_name?: string;
  request_reason?: string;
  category_name?: string;
  selected?: boolean;
  order_qty?: number;
  supplier_id?: string;
}

interface Props {
  storeId: string;
}

export function ReplenishmentNeeds({ storeId }: Props) {
  const { t } = useTranslation();
  const { suppliers, fetchSuppliers, createOrder } = usePurchasingStore();
  const [needs, setNeeds] = useState<ReplenishmentNeed[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (storeId) {
      fetchSuppliers(storeId);
      loadNeeds();
    }
  }, [storeId]);

  const loadNeeds = async () => {
    setLoading(true);
    try {
      const { localBridgeBaseUrl } = getDataClient();
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;

      const res = await fetch(`${localBridgeBaseUrl}/rest/v1/purchasing/needs?store_id=${storeId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNeeds(data.map((item: any) => ({
          ...item,
          selected: true,
          order_qty: item.suggested_qty,
          supplier_id: '' 
        })));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrders = async () => {
    const selected = needs.filter(n => n.selected && n.order_qty && n.order_qty > 0 && n.supplier_id);
    if (selected.length === 0) {
      toast.error(t('menu.program.assignSuppliersPrompt'));
      return;
    }

    setLoading(true);
    try {
      const groups = selected.reduce((acc, item) => {
        const supId = item.supplier_id!;
        if (!acc[supId]) acc[supId] = [];
        acc[supId].push(item);
        return acc;
      }, {} as Record<string, ReplenishmentNeed[]>);

      let count = 0;
      for (const [supId, items] of Object.entries(groups)) {
        await createOrder({
          store_id: storeId,
          supplier_id: supId,
          status: 'draft',
          total_amount: 0 
        }, items.map(i => ({
          product_id: i.product_id,
          quantity_ordered: i.order_qty!,
          quantity_received: 0,
          unit_cost: 0 
        })));
        count++;
      }
      toast.success(`${count} ${t('menu.purchases.ordersCreated') || 'commandes créées'}`);
      loadNeeds();
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          {t('menu.purchases.needsAlerts')}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadNeeds} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
          <Button onClick={handleCreateOrders} disabled={loading}>
            <ShoppingCart className="h-4 w-4 mr-2" />
            {t('menu.program.generateOrders')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox /></TableHead>
                <TableHead>{t('menu.stock.trigger')}</TableHead>
                <TableHead className="text-center">{t('menu.program.currentStock')}</TableHead>
                <TableHead>{t('menu.purchases.source')}</TableHead>
                <TableHead className="w-24">{t('menu.purchases.suggestedQtyShort')}</TableHead>
                <TableHead className="w-48">{t('menu.program.supplier')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {needs.map(item => (
                <TableRow key={item.product_id}>
                  <TableCell>
                    <Checkbox 
                      checked={item.selected} 
                      onCheckedChange={(c) => {
                        setNeeds(needs.map(n => n.product_id === item.product_id ? { ...n, selected: !!c } : n));
                      }} 
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{item.product_name}</div>
                    <div className="text-xs text-muted-foreground">{item.sku}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className={item.current_stock <= item.min_stock ? "text-red-500 font-bold" : ""}>
                      {item.current_stock}
                    </div>
                    <div className="text-xs text-muted-foreground">Min: {item.min_stock}</div>
                  </TableCell>
                  <TableCell>
                    {item.source === 'low_stock' ? (
                      <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3"/> {t('menu.purchases.stockLow')}</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1"><User className="h-3 w-3"/> {t('menu.purchases.workerRequest')} {item.requester_name}</Badge>
                    )}
                    {item.request_reason && <div className="text-xs mt-1 text-muted-foreground">"{item.request_reason}"</div>}
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      value={item.order_qty} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setNeeds(needs.map(n => n.product_id === item.product_id ? { ...n, order_qty: val } : n));
                      }}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={item.supplier_id} 
                      onValueChange={(v) => {
                        setNeeds(needs.map(n => n.product_id === item.product_id ? { ...n, supplier_id: v } : n));
                      }}
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
              ))}
              {needs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t('menu.purchases.noNeedsIdentified')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}