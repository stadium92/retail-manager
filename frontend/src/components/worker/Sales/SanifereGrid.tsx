import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export interface SanifereLineItem {
  id: string;
  lineNumber: number;
  productId?: string;
  designation: string;
  code: string;
  conditionnement: number;
  stock: number;
  unitPrice: number;
  quantity: number;
  discountPercent: number;
  lineTotal: number;
}

interface SanifereGridProps {
  items: SanifereLineItem[];
  selectedIndex: number;
  maxLines?: number;
  priceLabel?: string;
  onSelectLine: (index: number) => void;
  onQuantityChange: (index: number, quantity: number) => void;
  onDiscountChange: (index: number, discount: number) => void;
  onDeleteLine: (index: number) => void;
  onDesignationChange?: (index: number, val: string) => void;
  onPriceChange?: (index: number, val: number) => void;
  persistenceKey?: string;
}

const INITIAL_WIDTHS = {
  s: 30,
  designation: 500,
  code: 200,
  cndt: 50,
  stock: 70,
  price: 90,
  qty: 50,
  rem: 60,
  montant: 100,
  action: 40
};

export function SanifereGrid({
  items,
  selectedIndex,
  maxLines = 200,
  priceLabel = 'PRIX',
  onSelectLine,
  onQuantityChange,
  onDiscountChange,
  onDeleteLine,
  onDesignationChange,
  onPriceChange,
  persistenceKey,
}: SanifereGridProps) {
  const { t, i18n } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);
  
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language);
  };

  const [colWidths, setColWidths] = useState(() => {
    if (persistenceKey) {
      try {
        const saved = localStorage.getItem(`grid_widths_${persistenceKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...INITIAL_WIDTHS, ...parsed };
        }
      } catch (e) {
        console.error('Failed to load grid preferences:', e);
      }
    }
    return INITIAL_WIDTHS;
  });

  useEffect(() => {
    if (persistenceKey) {
      localStorage.setItem(`grid_widths_${persistenceKey}`, JSON.stringify(colWidths));
    }
  }, [colWidths, persistenceKey]);
  
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = useRef<{ 
    colId: keyof typeof INITIAL_WIDTHS; 
    startX: number; 
    startWidth: number; 
    maxWidth: number; 
  } | null>(null);

  const startResize = (colId: keyof typeof INITIAL_WIDTHS, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const containerWidth = gridRef.current?.clientWidth || 0;
    
    let otherColsWidth = 0;
    (Object.keys(colWidths) as Array<keyof typeof INITIAL_WIDTHS>).forEach(key => {
      if (key !== colId) {
        otherColsWidth += colWidths[key];
      }
    });
    
    const maxWidth = Math.max(30, containerWidth - otherColsWidth);

    setIsResizing(true);
    resizingRef.current = {
      colId,
      startX: e.clientX,
      startWidth: colWidths[colId],
      maxWidth
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    
    const { colId, startX, startWidth, maxWidth } = resizingRef.current;
    const diff = e.clientX - startX;
    
    let newWidth = startWidth + diff;
    newWidth = Math.max(30, newWidth);
    newWidth = Math.min(maxWidth, newWidth);
    
    setColWidths(prev => ({ ...prev, [colId]: newWidth }));
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
  }, [handleMouseMove]);

  const gridTemplateColumns = `${colWidths.s}px ${colWidths.designation}px ${colWidths.code}px ${colWidths.cndt}px ${colWidths.stock}px ${colWidths.price}px ${colWidths.qty}px ${colWidths.rem}px ${colWidths.montant}px minmax(${colWidths.action}px, 1fr)`;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (selectedIndex < items.length - 1) {
          onSelectLine(selectedIndex + 1);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (selectedIndex > 0) {
          onSelectLine(selectedIndex - 1);
        }
        break;
      case 'Delete':
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          onDeleteLine(selectedIndex);
        }
        break;
      case '+':
      case '=':
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          onQuantityChange(selectedIndex, items[selectedIndex].quantity + 1);
        }
        break;
      case '-':
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex] && items[selectedIndex].quantity > 1) {
          onQuantityChange(selectedIndex, items[selectedIndex].quantity - 1);
        }
        break;
    }
  }, [items, selectedIndex, onSelectLine, onQuantityChange, onDeleteLine]);

  useEffect(() => {
    const grid = gridRef.current;
    if (grid) {
      grid.addEventListener('keydown', handleKeyDown);
      return () => grid.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  useEffect(() => {
    gridRef.current?.focus();
  }, []);

  const ResizeHandle = ({ colId }: { colId: keyof typeof INITIAL_WIDTHS }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-black/50 z-10"
      onMouseDown={(e) => startResize(colId, e)}
    />
  );

  return (
    <div 
      ref={gridRef}
      tabIndex={0}
      className="flex-1 flex flex-col overflow-hidden focus:outline-none select-none"
    >
      <div 
        className="bg-[hsl(50,100%,45%)] text-black font-mono text-sm font-bold grid border-b-2 border-black"
        style={{ gridTemplateColumns }}
      >
        <div className="px-1 py-1 border-r border-black/30 relative">S</div>
        
        <div className="px-2 py-1 border-r border-black/30 relative flex justify-between items-center">
          <span className="uppercase">{t('pos.grid.headers.designation')}</span>
          <span className="text-[10px] font-normal ml-2">Lig: {items.length}/{maxLines}</span>
          <ResizeHandle colId="designation" />
        </div>
        
        <div className="px-2 py-1 border-r border-black/30 text-center relative uppercase">
          {t('pos.grid.headers.sku')}
          <ResizeHandle colId="code" />
        </div>
        
        <div className="px-1 py-1 border-r border-black/30 text-center relative">
          Cndt
          <ResizeHandle colId="cndt" />
        </div>
        
        <div className="px-2 py-1 border-r border-black/30 text-center relative uppercase">
          {t('pos.grid.stock')}
          <ResizeHandle colId="stock" />
        </div>
        
        <div className="px-2 py-1 border-r border-black/30 text-right relative uppercase">
          {priceLabel}
          <ResizeHandle colId="price" />
        </div>
        
        <div className="px-1 py-1 border-r border-black/30 text-center relative uppercase">
          {t('pos.grid.headers.qty')}
          <ResizeHandle colId="qty" />
        </div>
        
        <div className="px-1 py-1 border-r border-black/30 text-center relative">
          {t('pos.grid.headers.discount')}
          <ResizeHandle colId="rem" />
        </div>
        
        <div className="px-2 py-1 border-r border-black/30 text-right relative uppercase">
          {t('pos.grid.headers.total')}
          <ResizeHandle colId="montant" />
        </div>

        <div className="px-1 py-1 text-center relative">
          ACT
        </div>
      </div>

      <div className="flex-1 bg-[hsl(220,100%,35%)] overflow-y-auto overflow-x-hidden">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/50 font-mono p-8 text-center uppercase">
            {t('pos.grid.scanPrompt')}
          </div>
        ) : (
          items.map((item, index) => {
            const isSelected = index === selectedIndex;
            const stockStatus = item.stock <= 0 ? 'rupture' : item.stock <= 10 ? 'low' : 'ok';

            return (
              <div
                key={item.id}
                onClick={() => onSelectLine(index)}
                className={cn(
                  'grid font-mono text-sm border-b border-white/20 cursor-pointer transition-colors',
                  isSelected 
                    ? 'bg-[hsl(50,100%,50%)] text-black' 
                    : 'text-white hover:bg-white/10'
                )}
                style={{ gridTemplateColumns }}
              >
                <div className="px-1 py-1.5 border-r border-white/20 text-center">
                  {isSelected ? '►' : ''}
                </div>

                <div className="px-2 py-0.5 border-r border-white/20 truncate relative group">
                  {onDesignationChange ? (
                     <Input
                      value={item.designation}
                      onChange={(e) => onDesignationChange?.(index, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'h-full w-full p-1 border-none font-mono text-sm bg-transparent',
                        isSelected ? 'text-black focus:bg-white/50' : 'text-white focus:bg-white/20'
                      )}
                    />
                  ) : (
                    <div className="py-1">{item.designation}</div>
                  )}
                </div>

                <div className="px-2 py-1.5 border-r border-white/20 text-center text-xs truncate">
                  {item.code}
                </div>

                <div className="px-1 py-1.5 border-r border-white/20 text-center">
                  {item.conditionnement}
                </div>

                <div className={cn(
                  'px-2 py-1.5 border-r border-white/20 text-center',
                  stockStatus === 'rupture' && 'text-red-400',
                  stockStatus === 'low' && 'text-yellow-400'
                )}>
                  {item.stock}
                </div>

                <div className="px-1 py-0.5 border-r border-white/20">
                  {onPriceChange ? (
                     <Input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => onPriceChange?.(index, Number(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'h-full w-full p-1 text-right border-none font-mono text-sm bg-transparent tabular-nums',
                        isSelected ? 'text-black focus:bg-white/50' : 'text-white focus:bg-white/20'
                      )}
                    />
                  ) : (
                    <div className="py-1 text-right tabular-nums">{formatCurrency(item.unitPrice)}</div>
                  )}
                </div>

                <div className="px-1 py-0.5 border-r border-white/20">
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => onQuantityChange(index, parseInt(e.target.value) || 1)}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'h-6 w-full text-center text-sm p-0 border-none',
                      isSelected ? 'bg-white text-black' : 'bg-transparent text-white'
                    )}
                  />
                </div>

                <div className="px-1 py-0.5 border-r border-white/20">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={item.discountPercent}
                    onChange={(e) => onDiscountChange(index, parseFloat(e.target.value) || 0)}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'h-6 w-full text-center text-sm p-0 border-none',
                      isSelected ? 'bg-white text-black' : 'bg-transparent text-white'
                    )}
                  />
                </div>

                <div className={cn(
                  'px-2 py-1.5 border-r border-white/20 text-right tabular-nums font-bold truncate',
                  item.discountPercent > 0 && !isSelected && 'text-green-300'
                )}>
                  {formatCurrency(item.lineTotal)}
                </div>

                <div className="px-1 py-0.5 flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-7 w-7",
                      isSelected ? "text-black hover:bg-black/10" : "text-white hover:bg-white/20"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteLine(index);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}