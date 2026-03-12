import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Product } from '@/types';
import { useProductSearch } from '@/hooks/useProductSearch';
import { useTranslation } from 'react-i18next';
import { useMasterDataStore } from '@/stores/useMasterDataStore';

interface ProductLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  mode: 'retail' | 'wholesale';
  onSelect: (product: Product) => void;
  title?: string;
  standalone?: boolean;
}

export function ProductLookupDialog({
  open,
  onOpenChange,
  storeId,
  mode,
  onSelect,
  title,
  standalone
}: ProductLookupDialogProps) {
  const { t, i18n } = useTranslation();
  const { stores } = useMasterDataStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { search, setSearch, results, isLoading } = useProductSearch(storeId, open);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  const getPrice = useCallback((product: Product) => {
    if (mode === 'wholesale') {
      return product.wholesale_price || product.unit_price;
    }
    return product.unit_price;
  }, [mode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex]);
          onOpenChange(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  };

  const getStoreName = (sId?: string) => {
    if (!sId) return '-';
    return stores.find(s => s.id === sId)?.name || sId.slice(0, 8);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
            "max-w-5xl h-[700px] flex flex-col p-0 gap-0 border-4",
            standalone ? "bg-card border-primary/20 shadow-2xl" : "bg-[hsl(180,60%,85%)] border-[hsl(180,60%,40%)]"
        )}
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className={cn("px-4 py-3 shrink-0", standalone ? "bg-primary" : "bg-[hsl(180,60%,40%)]")}>
          <DialogTitle className="text-white font-black uppercase tracking-widest text-lg">
            {title || `${t('menu.files.products')} - ${t('common.search')}`}
          </DialogTitle>
        </DialogHeader>

        <div className={cn("p-4 shrink-0", standalone ? "bg-muted/30" : "bg-[hsl(180,60%,75%)]")}>
          <div className="relative">
            <Input
                autoFocus
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn("bg-white border-2 font-mono h-12 text-lg", standalone ? "border-primary/20" : "border-[hsl(180,60%,40%)]")}
            />
            {isLoading && <div className="absolute right-4 top-3.5 animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 pt-0">
            <div className="grid grid-cols-[1fr_120px_100px_80px_100px_80px] font-black uppercase tracking-widest text-[10px] bg-primary text-white py-3 px-4 rounded-t-xl sticky top-0 z-10 shadow-md">
              <div>{t('pos.grid.headers.designation')}</div>
              <div className="text-center">Magasin</div>
              <div className="text-center">{t('pos.grid.headers.sku')}</div>
              <div className="text-center">{t('pos.grid.headers.qty')}</div>
              <div className="text-right">{mode === 'wholesale' ? t('inventory.fields.wholesalePriceHT') : t('inventory.fields.retailPriceShort')}</div>
              <div className="text-right">COÛT</div>
            </div>

            {results.length === 0 && !isLoading ? (
              <div className="py-20 text-center text-muted-foreground font-black uppercase tracking-[0.2em] opacity-20">
                {t('common.noData')}
              </div>
            ) : (
              results.map((product, index) => {
                const isSelected = index === selectedIndex;
                const price = getPrice(product);
                const stockStatus = product.quantity <= 0 ? 'rupture' : product.quantity <= (product.min_quantity || 10) ? 'low' : 'ok';

                return (
                  <div
                    key={product.id}
                    onClick={() => {
                      onSelect(product);
                      onOpenChange(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'grid grid-cols-[1fr_120px_100px_80px_100px_80px] font-mono text-xs py-3 px-4 cursor-pointer border-b transition-all items-center',
                      isSelected 
                        ? 'bg-primary text-white scale-[1.01] rounded-lg shadow-lg z-20 relative' 
                        : 'bg-white hover:bg-muted/50 text-black border-muted'
                    )}
                  >
                    <div className="font-bold uppercase truncate">{product.name}</div>
                    <div className="text-center text-[10px] font-black uppercase tracking-tighter opacity-60">
                        {getStoreName((product as any).store_id)}
                    </div>
                    <div className="text-center text-[10px] opacity-60">{product.sku || product.barcode || '—'}</div>
                    <div className={cn(
                      'text-center font-bold',
                      !isSelected && stockStatus === 'rupture' && 'text-red-600',
                      !isSelected && stockStatus === 'low' && 'text-orange-600'
                    )}>
                      {product.quantity}
                    </div>
                    <div className="text-right tabular-nums font-black">
                      {formatCurrency(price)}
                    </div>
                    <div className="text-right tabular-nums text-[10px] opacity-70">
                      {formatCurrency(product.cost_price || 0)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className={cn("px-6 py-3 font-black uppercase tracking-widest text-[10px] flex items-center justify-between shrink-0 border-t", standalone ? "bg-card text-muted-foreground" : "bg-[hsl(180,60%,75%)] text-black/70")}>
          <div className="flex gap-6">
            <span>↑↓ Navigation</span>
            <span>ENTRÉE: Confirmer</span>
            <span>ESC: Fermer</span>
          </div>
          <span>{results.length} ARTICLES TROUVÉS</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
