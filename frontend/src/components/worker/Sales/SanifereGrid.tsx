import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Trash2, ChevronDown, Tag } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

export interface SanifereLineItem {
  id: string;
  lineNumber: number;
  productId?: string;
  designation: string;
  code: string;
  conditionnement: number;
  isBox?: boolean; // New: Track if selling as Box
  stock: number;
  basePrice: number; // New: Store original unit price
  unitPrice: number | string;
  quantity: number | string;
  discountPercent: number | string;
  lineTotal: number;
  priceTiers?: Record<number, number>;
}

interface SanifereGridProps {
  items: SanifereLineItem[];
  selectedIndex: number;
  maxLines?: number;
  priceLabel?: string;
  activeTier?: number;
  onSelectLine: (index: number) => void;
  onQuantityChange: (index: number, quantity: any) => void;
  onDiscountChange: (index: number, discount: any) => void;
  onDeleteLine: (index: number) => void;
  onDesignationChange?: (index: number, val: string) => void;
  onPriceChange?: (index: number, val: any) => void;
  onToggleUnit?: (index: number) => void;
  onGlobalTierChange?: (tier: number) => void;
  onRowTierChange?: (index: number, tier: number) => void;
  enablePriceTiers?: boolean;
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
  montant: 100
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
  onToggleUnit,
  onGlobalTierChange,
  onRowTierChange,
  activeTier,
  enablePriceTiers = false,
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
    
    // Total includes the 40px bin column + a small buffer to ensure nothing is pushed off
    const maxWidth = Math.max(30, containerWidth - otherColsWidth - 50);

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
    
    // Calculate how many 'fr' units one pixel represents on the current screen
    const containerWidth = gridRef.current?.clientWidth || 1;
    const totalParts = Object.values(colWidths).reduce((a, b) => a + b, 0);
    const pxToFrRatio = totalParts / containerWidth;

    let newWidth = startWidth + (diff * pxToFrRatio);
    newWidth = Math.max(10, newWidth); // Minimum 10 parts
    
    setColWidths(prev => ({ ...prev, [colId]: newWidth }));
  }, [colWidths]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
  }, [handleMouseMove]);

  // FIX: Using 'fr' instead of 'px' for all resizable columns to ensure proportional scaling on all screens
  const gridTemplateColumns = `${colWidths.s}fr ${colWidths.designation}fr ${colWidths.code}fr ${colWidths.cndt}fr ${colWidths.stock}fr ${colWidths.price}fr ${colWidths.qty}fr ${colWidths.rem}fr ${colWidths.montant}fr 40px`;

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
        
        <div className="px-2 py-1 border-r border-black/30 text-right relative uppercase flex items-center justify-end gap-1">
          {onGlobalTierChange && enablePriceTiers ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 hover:text-white focus:outline-none cursor-pointer">
                {priceLabel} <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Global Price Tier</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onGlobalTierChange(1)}>Price 1 (Detail)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onGlobalTierChange(2)}>Price 2 (Discount)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onGlobalTierChange(3)}>Price 3 (Bulk)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onGlobalTierChange(4)}>Price 4 (Resale)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            priceLabel
          )}
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
        
        <div className="px-2 py-1 text-right relative uppercase">
          {t('pos.grid.headers.total')}
          <ResizeHandle colId="montant" />
        </div>
        
        <div className="px-1 py-1 border-l border-black/30"></div>
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

                <div 
                  className="px-1 py-1.5 border-r border-white/20 text-center cursor-pointer hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleUnit?.(index);
                  }}
                >
                  {item.isBox ? `BOX(${item.conditionnement})` : 'PC'}
                </div>

                <div className={cn(
                  'px-2 py-1.5 border-r border-white/20 text-center',
                  stockStatus === 'rupture' && 'text-red-400',
                  stockStatus === 'low' && 'text-yellow-400'
                )}>
                  {item.stock}
                </div>

                <div className="px-1 py-0.5 border-r border-white/20 flex items-center">
                  {item.priceTiers && onRowTierChange && enablePriceTiers && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-full px-1 hover:bg-white/20 focus:outline-none cursor-pointer text-white/50 hover:text-white flex items-center">
                        <Tag className="h-3 w-3" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Item Price Tier</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onRowTierChange(index, 1)}>
                          <span>Detail:</span> <span className="ml-auto font-bold">{formatCurrency(item.priceTiers[1] || 0)}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRowTierChange(index, 2)}>
                          <span>Discount:</span> <span className="ml-auto font-bold">{formatCurrency(item.priceTiers[2] || 0)}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRowTierChange(index, 3)}>
                          <span>Bulk:</span> <span className="ml-auto font-bold">{formatCurrency(item.priceTiers[3] || 0)}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRowTierChange(index, 4)}>
                          <span>Resale:</span> <span className="ml-auto font-bold">{formatCurrency(item.priceTiers[4] || 0)}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {onPriceChange ? (
                     <Input
                      type="number"
                      value={item.unitPrice === 0 ? '' : item.unitPrice}
                      onChange={(e) => onPriceChange?.(index, e.target.value === '' ? '' : Number(e.target.value))}
                      onBlur={() => { if (item.unitPrice === '') onPriceChange?.(index, 0); }}
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
                    value={item.quantity === 0 ? '' : item.quantity}
                    onChange={(e) => onQuantityChange(index, e.target.value === '' ? '' : parseInt(e.target.value))}
                    onBlur={() => { if (item.quantity === '') onQuantityChange(index, 1); }}
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
                    value={item.discountPercent === 0 ? '' : item.discountPercent}
                    onChange={(e) => onDiscountChange(index, e.target.value === '' ? '' : parseFloat(e.target.value))}
                    onBlur={() => { if (item.discountPercent === '') onDiscountChange(index, 0); }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'h-6 w-full text-center text-sm p-0 border-none',
                      isSelected ? 'bg-white text-black' : 'bg-transparent text-white'
                    )}
                  />
                </div>

                <div className={cn(
                  'px-2 py-1.5 text-right tabular-nums font-bold truncate',
                  item.discountPercent > 0 && !isSelected && 'text-green-300'
                )}>
                  {formatCurrency(item.lineTotal)}
                </div>

                <div className="flex items-center justify-center border-l border-white/20">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteLine(index);
                    }}
                    className="text-white/50 hover:text-red-400 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}