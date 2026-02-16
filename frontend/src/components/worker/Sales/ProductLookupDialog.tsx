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

interface ProductLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  mode: 'retail' | 'wholesale';
  onSelect: (product: Product) => void;
}

export function ProductLookupDialog({
  open,
  onOpenChange,
  storeId,
  mode,
  onSelect,
}: ProductLookupDialogProps) {
  const { t, i18n } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { search, setSearch, results, isLoading } = useProductSearch(storeId, open);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language);
  };

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Get price based on mode
  const getPrice = useCallback((product: Product) => {
    if (mode === 'wholesale') {
      // PVG HT - wholesale price excluding tax
      return product.wholesale_price || product.unit_price;
    }
    // Prix RVT - retail price
    return product.unit_price;
  }, [mode]);

  // Keyboard navigation
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl h-[600px] flex flex-col p-0 gap-0 bg-[hsl(180,60%,85%)] border-4 border-[hsl(180,60%,40%)]"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="bg-[hsl(180,60%,40%)] px-4 py-2">
          <DialogTitle className="text-white font-mono text-lg">
            {t('menu.files.products')} - {t('common.search')} ({mode === 'wholesale' ? t('menu.sales.billingWholesale') : t('menu.sales.retail')})
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="p-3 bg-[hsl(180,60%,75%)]">
          <Input
            autoFocus
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white border-2 border-[hsl(180,60%,40%)] font-mono"
          />
        </div>

        {/* Products Grid */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Header */}
            <div className="grid grid-cols-[1fr_100px_80px_100px_80px] font-mono text-sm font-bold bg-[hsl(50,100%,50%)] text-black py-1 px-2 border-b-2 border-black">
              <div>{t('pos.grid.headers.designation')}</div>
              <div className="text-center">{t('pos.grid.headers.sku')}</div>
              <div className="text-center">{t('pos.grid.headers.qty')}</div>
              <div className="text-right">{mode === 'wholesale' ? t('inventory.fields.wholesalePriceHT') : t('inventory.fields.retailPriceShort')}</div>
              <div className="text-right">{t('inventory.cost')}</div>
            </div>

            {/* Products */}
            {isLoading ? (
               <div className="py-8 text-center text-black/50 font-mono">{t('common.loading')}</div>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-black/50 font-mono">
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
                      'grid grid-cols-[1fr_100px_80px_100px_80px] font-mono text-sm py-1.5 px-2 cursor-pointer border-b border-black/20',
                      isSelected 
                        ? 'bg-[hsl(220,100%,35%)] text-white' 
                        : 'bg-white hover:bg-[hsl(180,60%,90%)] text-black'
                    )}
                  >
                    <div className="truncate">{product.name}</div>
                    <div className="text-center text-xs">{product.sku || product.barcode || '—'}</div>
                    <div className={cn(
                      'text-center',
                      !isSelected && stockStatus === 'rupture' && 'text-red-600',
                      !isSelected && stockStatus === 'low' && 'text-orange-600'
                    )}>
                      {product.quantity}
                    </div>
                    <div className="text-right tabular-nums font-bold">
                      {formatCurrency(price)}
                    </div>
                    <div className="text-right tabular-nums text-xs opacity-70">
                      {formatCurrency(product.cost_price || 0)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer hints */}
        <div className="px-4 py-2 bg-[hsl(180,60%,75%)] font-mono text-xs text-black/70 flex items-center justify-between">
          <span>↑↓ {t('pos.totals.navigation')} • Entrée: {t('common.confirm')} • Esc: {t('common.close')}</span>
          <span>{results.length} {t('common.transactions')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}