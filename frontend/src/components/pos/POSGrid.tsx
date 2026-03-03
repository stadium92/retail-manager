import { useCallback, useEffect, useRef } from 'react';
import { usePOSStore, CartItem } from '@/stores/usePOSStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Minus, Plus, Trash2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

interface POSGridProps {
  onRowSelect?: (item: CartItem | null) => void;
}

export function POSGrid({ onRowSelect }: POSGridProps) {
  const { t, i18n } = useTranslation();
  const {
    cart,
    selectedRowIndex,
    selectRow,
    selectNextRow,
    selectPreviousRow,
    incrementQuantity,
    decrementQuantity,
    updateQuantity,
    updateDiscount,
    removeFromCart,
  } = usePOSStore();

  const gridRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Notify parent of selection changes
  useEffect(() => {
    if (onRowSelect) {
      onRowSelect(selectedRowIndex >= 0 ? cart[selectedRowIndex] : null);
    }
  }, [selectedRowIndex, cart, onRowSelect]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectNextRow();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectPreviousRow();
        break;
      case '+':
      case '=':
        e.preventDefault();
        if (selectedRowIndex >= 0 && cart[selectedRowIndex]) {
          incrementQuantity(cart[selectedRowIndex].product.id);
        }
        break;
      case '-':
        e.preventDefault();
        if (selectedRowIndex >= 0 && cart[selectedRowIndex]) {
          decrementQuantity(cart[selectedRowIndex].product.id);
        }
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (selectedRowIndex >= 0 && cart[selectedRowIndex]) {
          removeFromCart(cart[selectedRowIndex].product.id);
        }
        break;
    }
  }, [cart, selectedRowIndex, selectNextRow, selectPreviousRow, incrementQuantity, decrementQuantity, removeFromCart]);

  useEffect(() => {
    const grid = gridRef.current;
    if (grid) {
      grid.addEventListener('keydown', handleKeyDown);
      return () => grid.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  // Focus the grid on mount
  useEffect(() => {
    gridRef.current?.focus();
  }, []);

  const { formatCurrency } = useFormatters();

  const getStockStatus = (quantity: number, threshold: number = 10) => {
    if (quantity <= 0) return 'rupture';
    if (quantity <= threshold) return 'low';
    return 'ok';
  };

  if (cart.length === 0) {
    return (
      <div 
        ref={gridRef}
        tabIndex={0}
        className="flex-1 flex flex-col items-center justify-center text-muted-foreground glass-card p-8"
      >
        <Package className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">{t('pos.grid.empty')}</p>
        <p className="text-sm mt-1">{t('pos.grid.scanPrompt')} <kbd className="kbd-shortcut">Cmd+K</kbd></p>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      tabIndex={0}
      className="flex-1 overflow-hidden glass-card focus:outline-none focus:ring-1 focus:ring-primary/30"
    >
      {/* Header */}
      <div className="grid grid-cols-[48px_1fr_100px_100px_80px_100px_100px_40px] gap-2 px-3 py-2 bg-muted/50 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <div></div>
        <div>{t('pos.grid.headers.designation')}</div>
        <div className="text-right">{t('pos.grid.headers.sku')}</div>
        <div className="text-right">{t('pos.grid.headers.price')}</div>
        <div className="text-center">{t('pos.grid.headers.qty')}</div>
        <div className="text-right">{t('pos.grid.headers.discount')}</div>
        <div className="text-right">{t('pos.grid.headers.total')}</div>
        <div></div>
      </div>

      {/* Rows */}
      <div className="overflow-y-auto max-h-[calc(100vh-380px)]">
        {cart.map((item, index) => {
          const isSelected = index === selectedRowIndex;
          const threshold = item.product.min_quantity ?? 10;
          const stockStatus = getStockStatus(item.product.quantity, threshold);

          return (
            <div
              key={item.product.id}
              onClick={() => selectRow(index)}
              className={cn(
                'grid grid-cols-[48px_1fr_100px_100px_80px_100px_100px_40px] gap-2 px-3 items-center table-row-dense border-b border-border/30',
                isSelected && 'selected bg-primary/10'
              )}
            >
              {/* Avatar */}
              <div className="flex items-center justify-center">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={item.product.image_url || ''} alt={item.product.name} />
                  <AvatarFallback className="rounded-lg text-[10px] bg-muted">
                    {item.product.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Designation */}
              <div className="truncate">
                <p className="font-medium truncate text-sm">{item.product.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    stockStatus === 'ok' && 'status-ok',
                    stockStatus === 'low' && 'status-low',
                    stockStatus === 'rupture' && 'status-rupture'
                  )}>
                    {t('pos.grid.stock')}: {item.product.quantity}
                  </span>
                </div>
              </div>

              {/* SKU */}
              <div className="text-right text-xs text-muted-foreground font-mono data-cell">
                {item.product.sku || '—'}
              </div>

              {/* Unit Price */}
              <div className="text-right font-medium data-cell text-sm">
                {formatCurrency(item.unitPrice)}
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center justify-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md hover:bg-primary/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    decrementQuantity(item.product.id);
                  }}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  ref={(el) => {
                    if (el) inputRefs.current.set(`qty-${item.product.id}`, el);
                  }}
                  type="number"
                  min={1}
                  max={item.product.quantity}
                  value={item.quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    updateQuantity(index, val);
                  }}
                  className="h-6 w-10 text-center text-sm p-0 input-numeric bg-transparent border-none focus:ring-1 focus:ring-primary/50"
                  onClick={(e) => e.stopPropagation()}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md hover:bg-primary/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    incrementQuantity(item.product.id);
                  }}
                  disabled={item.quantity >= item.product.quantity}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Discount */}
              <div className="flex items-center justify-end">
                <NumericInput
                  min={0}
                  max={100}
                  value={item.discount}
                  onValueChange={(v) => updateDiscount(index, v)}
                  className="h-6 w-16 text-right text-sm p-1 input-numeric bg-transparent border-none focus:ring-1 focus:ring-primary/50"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-muted-foreground ml-1">%</span>
              </div>

              {/* Line Total */}
              <div className={cn(
                'text-right font-semibold data-cell text-sm',
                item.discount > 0 && 'text-success text-glow-success'
              )}>
                {formatCurrency(item.lineTotal)}
              </div>

              {/* Remove */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md text-muted-foreground hover:text-danger hover:bg-danger/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromCart(item.product.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}