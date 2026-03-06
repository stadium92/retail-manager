import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useProductSearch } from '@/hooks/useProductSearch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Search, Package, Box, Barcode, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Product } from '@/types';

interface ProductLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: Product) => void;
  storeId: string;
  mode?: 'retail' | 'wholesale';
  title?: string;
  standalone?: boolean;
  initialSearch?: string;
}

export function ProductLookupDialog({
  open,
  onOpenChange,
  onSelect,
  storeId,
  mode = 'retail',
  title,
  standalone = false,
  initialSearch
}: ProductLookupDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { results, isLoading } = useProductSearch(storeId);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSearch(initialSearch || '');
      setSelectedIndex(0);
    }
  }, [open, initialSearch]);

  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[selectedIndex]) {
        onSelect(results[selectedIndex]);
        onOpenChange(false);
      }
    } else if (e.key === 'Escape') {
      onOpenChange(false);
    }
  }, [open, results, selectedIndex, onSelect, onOpenChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 gap-0 border-none overflow-hidden bg-white dark:bg-zinc-950">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Search className="h-6 w-6 text-primary" />
              {title || t('menu.program.productSearch') || 'Recherche de Produits'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                {mode === 'wholesale' ? 'GROS' : 'DÉTAIL'}
              </div>
            </div>
          </div>
          
          <div className="relative mt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder={t('inventory.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-14 text-lg font-bold border-2 focus:ring-primary/20"
            />
          </div>
        </DialogHeader>

        <div className="bg-zinc-900 text-white grid grid-cols-[40px_minmax(150px,1fr)_100px_minmax(100px,120px)_100px_90px_90px_80px_100px_80px] font-black uppercase tracking-widest text-[10px] py-3 px-4 sticky top-0 z-30 border-b border-white/10">
          <div className="text-center">#</div>
          <div>{t('inventory.itemName')}</div>
          <div className="text-center">SKU</div>
          <div>{t('inventory.fields.family')}</div>
          <div className="text-center">{t('inventory.fields.unitType')}</div>
          <div className="text-right">{t('inventory.fields.retailPriceShort')}</div>
          <div className="text-right">{t('inventory.fields.wholesalePriceShort')}</div>
          <div className="text-center">{t('inventory.fields.packagingShort')}</div>
          <div className="text-center">{t('inventory.fields.minStock')}</div>
          <div className="text-center">{t('inventory.quantity')}</div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="font-black uppercase tracking-widest text-xs">{t('common.searching')}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground font-black uppercase tracking-[0.2em] opacity-20">
              {t('common.noData')}
            </div>
          ) : (
            <div className="divide-y divide-muted/50">
              {results.map((product, index) => {
                const isSelected = index === selectedIndex;
                const retailPrice = product.unit_price || product.price || 0;
                const costPrice = product.cost_price || product.cost || 0;
                const stockStatus = product.quantity <= 0 ? 'rupture' : product.quantity <= (product.min_quantity || 10) ? 'low' : 'ok';

                return (
                  <div
                    key={product.id}
                    ref={isSelected ? selectedRowRef : null}
                    onClick={() => {
                      onSelect(product);
                      onOpenChange(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'grid grid-cols-[40px_minmax(150px,1fr)_100px_minmax(100px,120px)_100px_90px_90px_80px_100px_80px] font-mono text-xs py-3 px-4 cursor-pointer border-b transition-all items-center',
                      isSelected
                        ? 'bg-primary text-white scale-[1.01] rounded-lg shadow-lg z-20 relative'
                        : 'bg-white hover:bg-muted/50 text-black border-muted'
                    )}
                  >
                    <div className="text-center text-[10px] opacity-40 font-black">{index + 1}</div>
                    <div className="font-black uppercase truncate pr-4">{product.name}</div>
                    <div className="text-center opacity-60 truncate">{product.sku || '-'}</div>
                    <div className="text-[10px] opacity-60 truncate">{product.family_name || '-'}</div>
                    <div className="text-center uppercase font-black">{product.unit_type || 'PC'}</div>
                    <div className="text-right font-black">{formatCurrency(retailPrice)}</div>
                    <div className="text-right font-black">{formatCurrency(product.selling_price_2 || retailPrice)}</div>
                    <div className="text-center font-black">{product.conditionnement || 1}</div>
                    <div className="text-center opacity-60">{product.min_quantity || 0}</div>
                    <div className={cn(
                      "text-center font-black rounded-md px-2 py-1",
                      stockStatus === 'rupture' ? "bg-red-500 text-white" : 
                      stockStatus === 'low' ? "bg-yellow-500 text-black" : "bg-green-500 text-white"
                    )}>
                      {product.quantity || 0}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 bg-muted/30 border-t flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-6 h-4 bg-zinc-900 rounded border border-white/20 flex items-center justify-center text-[8px] text-white">↑↓</span>
              <span>{t('common.navigation') || 'Navigation'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 h-4 bg-zinc-900 rounded border border-white/20 flex items-center justify-center text-[8px] text-white">ENTER</span>
              <span>{t('common.enterConfirm')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-4 bg-zinc-900 rounded border border-white/20 flex items-center justify-center text-[8px] text-white">ESC</span>
              <span>{t('common.escClose')}</span>
            </div>
          </div>
          <span>{t('common.itemsFound', { count: results.length })}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
