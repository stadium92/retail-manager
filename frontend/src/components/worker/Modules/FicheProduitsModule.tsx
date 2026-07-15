import { useState, useEffect, useCallback } from 'react';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { ProductMaster } from '@/stores/useMasterDataStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronLeft, 
  ChevronRight, 
  Search,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface FicheProduitsModuleProps {
  storeId: string;
}

export function FicheProduitsModule({ storeId }: FicheProduitsModuleProps) {
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const currentProduct = products[currentIndex];

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' F';
  };

  const loadProducts = useCallback(async (notify = false) => {
    if (!storeId) return;
    if (!notify) setIsLoading(true);

    try {
      const { data, error } = await OfflineInventoryService.getInventory(storeId, { notify: false });
      
      if (error) throw error;
      
      if (data) {
        // Map InventoryItem to ProductMaster format if needed (they are largely compatible)
        const mapped = data.map(item => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          barcode: item.sku, // using sku as barcode placeholder
          description: item.description,
          purchase_price: item.cost || (item as any).cost_price || 0,
          selling_price_detail: item.price || (item as any).unit_price || 0,
          selling_price_wholesale: item.wholesale_price_ttc || (item as any).wholesale_price_ttc || 0,
          selling_price_ht: item.wholesale_price_ht || (item as any).wholesale_price_ht || 0,
          selling_price_ttc: item.wholesale_price_ttc || (item as any).wholesale_price_ttc || 0,
          min_stock_alert: item.low_stock_threshold || (item as any).min_quantity || 0,
          current_stock: item.quantity,
          unit_type: item.unit_type || 'Pièce',
          family_id: item.category_id,
          brand: item.brand || '',
          packaging: item.packaging || '',
          aisle: item.aisle || '',
          expiry_date: item.expiry_date,
          store_id: item.store_id,
          image_url: item.image_url,
          created_at: item.created_at,
          updated_at: item.updated_at,
        } as unknown as ProductMaster));
        
        setProducts(mapped);
      }
    } catch (error) {
      console.error('Failed to load products for FicheProduit', error);
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [storeId, t]);

  useEffect(() => {
    loadProducts();

    // IMPLEMENT ROBUST SYNC: Listen for global database updates
    const handleDataUpdate = (e: any) => {
      if (e.detail?.type === 'inventory' || e.detail?.type === 'sale' || e.detail?.type === 'product') {
        console.log('FicheProduits: Syncing data from global update event');
        loadProducts(true);
      }
    };

    window.addEventListener('localDbDataUpdated' as any, handleDataUpdate);
    return () => window.removeEventListener('localDbDataUpdated' as any, handleDataUpdate);
  }, [loadProducts]);

  const goToNext = () => {
    if (currentIndex < products.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSearch = () => {
    const index = products.findIndex(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (index >= 0) {
      setCurrentIndex(index);
    } else {
      toast({ title: t('worker.sales.itemNotFound'), variant: 'destructive' });
    }
  };

  const getStockStatus = (quantity: number, threshold: number = 10) => {
    if (quantity <= 0) return 'rupture';
    if (quantity <= threshold) return 'low';
    return 'ok';
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentProduct) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <div className="text-muted-foreground">{t('common.noData')}</div>
        </div>
      </div>
    );
  }

  const stockStatus = getStockStatus(currentProduct.current_stock, currentProduct.min_stock_alert);

  return (
    <div className="h-full flex flex-col p-4 bg-[hsl(60,80%,95%)] dark:bg-transparent">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4 bg-card/50 p-2 rounded-lg border border-border/50">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('common.search')}
              className="w-64 h-9 pl-8"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={handleSearch} className="hover:bg-primary/10">
            {t('common.search')}
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="icon"
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="bg-primary/10 px-3 py-1 rounded text-xs font-bold min-w-[80px] text-center">
              {currentIndex + 1} / {products.length}
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={goToNext}
              disabled={currentIndex >= products.length - 1}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Product Form - ROBUST SYNCED VIEW */}
      <ScrollArea className="flex-1 rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="p-6 space-y-8">
          {/* Main Info Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
               <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('inventory.table.name')}</Label>
                  <div className="text-3xl font-black text-primary tracking-tight">{currentProduct.name}</div>
               </div>
               
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">REF / SKU</Label>
                    <div className="font-mono text-lg">{currentProduct.sku || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('inventory.fields.category')}</Label>
                    <div className="font-semibold text-lg">{currentProduct.family_id || t('common.unknown')}</div>
                  </div>
               </div>
            </div>

            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 flex flex-col justify-center items-center text-center">
               <Label className="text-[10px] font-bold uppercase text-primary tracking-widest mb-2">{t('menu.program.sellingPrice')}</Label>
               <div className="text-4xl font-black text-primary">{formatCurrency(currentProduct.selling_price_detail || 0)}</div>
               {currentProduct.packaging && (
                 <div className="mt-2 text-xs font-bold text-muted-foreground italic">
                   {t('inventory.fields.packaging')}: {currentProduct.packaging}
                 </div>
               )}
            </div>
          </div>

          <div className="h-px bg-border/50" />

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
             <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('menu.program.purchasePrice')}</Label>
                <div className="text-xl font-bold">{formatCurrency(currentProduct.purchase_price || 0)}</div>
             </div>
             <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('inventory.fields.wholesalePrice')}</Label>
                <div className="text-xl font-bold text-success">{formatCurrency(currentProduct.selling_price_wholesale || 0)}</div>
             </div>
             <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('inventory.fields.brand')}</Label>
                <div className="text-xl font-bold">{currentProduct.brand || '—'}</div>
             </div>
             <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('inventory.fields.aisle') || 'Rayon'}</Label>
                <div className="text-xl font-bold">{currentProduct.aisle || '—'}</div>
             </div>
          </div>

          {/* Stock Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
             <div className={cn(
               "lg:col-span-1 rounded-2xl p-6 border flex flex-col items-center justify-center text-center space-y-2",
               stockStatus === 'ok' ? "bg-success/5 border-success/20 text-success" :
               stockStatus === 'low' ? "bg-warning/5 border-warning/20 text-warning" :
               "bg-danger/5 border-danger/20 text-danger"
             )}>
                <Label className="text-[10px] font-bold uppercase tracking-widest">{t('menu.program.currentStock')}</Label>
                <div className="text-5xl font-black">{currentProduct.current_stock}</div>
                <div className="text-xs font-bold uppercase">
                  {stockStatus === 'ok' ? t('inventory.statusIn') : 
                   stockStatus === 'low' ? t('inventory.statusLow') : t('inventory.outOfStock')}
                </div>
             </div>

             <div className="lg:col-span-2 grid grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('menu.program.minimumStock')}</Label>
                  <div className="text-xl font-bold">{currentProduct.min_stock_alert || 0}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('inventory.fields.unit')}</Label>
                  <div className="text-xl font-bold">{currentProduct.unit_type || t('inventory.unitTypes.piece')}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{t('inventory.fields.expiryDate')}</Label>
                  <div className="text-xl font-bold text-danger">{currentProduct.expiry_date || '—'}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Description</Label>
                  <div className="text-sm text-muted-foreground leading-relaxed">{currentProduct.description || 'No description available.'}</div>
                </div>
             </div>
          </div>
        </div>
      </ScrollArea>

      <div className="mt-4 flex justify-between items-center px-2">
        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter italic">
          {t('common.lastUpdate')}: {currentProduct.updated_at ? new Date(currentProduct.updated_at).toLocaleString() : '—'}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadProducts()} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-2" /> {t('common.refresh')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper icons
function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
