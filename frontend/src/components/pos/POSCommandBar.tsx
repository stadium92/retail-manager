import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePOSStore } from '@/stores/usePOSStore';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface POSCommandBarProps {
  products: any[]; // Accept both Product and InventoryItem
  isLoading?: boolean;
}

export function POSCommandBar({ products, isLoading }: POSCommandBarProps) {
  const { t, i18n } = useTranslation();
  const { isCommandOpen, setCommandOpen, addToCart } = usePOSStore();
  const [localQuery, setLocalQuery] = useState('');

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(!isCommandOpen);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isCommandOpen, setCommandOpen]);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!localQuery.trim()) return products.slice(0, 20);
    
    const query = localQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    ).slice(0, 20);
  }, [products, localQuery]);

  const handleSelect = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      addToCart(product);
      setCommandOpen(false);
      setLocalQuery('');
    }
  }, [products, addToCart, setCommandOpen]);

  const { formatCurrency } = useFormatters();

  const getStockStatus = (quantity: number, threshold: number = 10) => {
    if (quantity <= 0) return { label: t('inventory.outOfStock'), class: 'status-rupture' };
    if (quantity <= threshold) return { label: t('inventory.lowStock'), class: 'status-low' };
    return { label: t('inventory.inStock'), class: 'status-ok' };
  };

  const getPrice = (product: any) => {
    return product.unit_price ?? product.price ?? 0;
  };

  const getThreshold = (product: any) => {
    return product.min_quantity ?? product.low_stock_threshold ?? 10;
  };

  return (
    <CommandDialog open={isCommandOpen} onOpenChange={setCommandOpen}>
      <div className="command-bar animate-spring-in">
        <CommandInput
          placeholder={t('common.search')}
          value={localQuery}
          onValueChange={setLocalQuery}
          className="border-none focus:ring-0"
        />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
            )}
          </CommandEmpty>
          
          <CommandGroup heading={t('inventory.title')}>
            {filteredProducts.map((product) => {
              const status = getStockStatus(product.quantity, getThreshold(product));
              const isAvailable = product.quantity > 0;

              return (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={handleSelect}
                  disabled={!isAvailable}
                  className={cn(
                    'flex items-center gap-3 p-2 cursor-pointer rounded-lg transition-all',
                    'hover:bg-primary/10',
                    !isAvailable && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Avatar className="h-10 w-10 rounded-lg shrink-0">
                    <AvatarImage src={product.image_url || ''} alt={product.name} />
                    <AvatarFallback className="rounded-lg bg-muted text-xs">
                      {product.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{product.name}</span>
                      <Badge variant="outline" className={cn('text-[10px] shrink-0', status.class)}>
                        {product.quantity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {product.sku && (
                        <span className="font-mono">{product.sku}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-primary">{formatCurrency(getPrice(product))}</p>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
        
        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-t border-border/50">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="kbd-shortcut">↵</kbd> {t('common.create')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd-shortcut">↑↓</kbd> {t('pos.totals.navigation')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd-shortcut">Esc</kbd> {t('common.close')}
            </span>
          </div>
          <span>{filteredProducts.length} {t('common.transactions')}</span>
        </div>
      </div>
    </CommandDialog>
  );
}