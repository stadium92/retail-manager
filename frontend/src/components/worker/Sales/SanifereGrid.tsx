import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Tag } from 'lucide-react';
import { useNavigationStore } from '@/navigation';
import { SanifereRow } from './SanifereRow';

export interface SanifereLineItem {
  id: string;
  lineNumber: number;
  productId?: string;
  designation: string;
  code: string;
  conditionnement: number;
  isBox?: boolean; // New: Track if selling as Box
  unit_type?: string; // New: Unit type label (Carton, Paquet, etc)
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
  onSelectLine: (index: number) => void;
  onQuantityChange: (index: number, quantity: any) => void;
  onDiscountChange: (index: number, discount: any) => void;
  onDeleteLine: (index: number) => void;
  onDesignationChange?: (index: number, val: string) => void;
  onOpenSearch?: () => void;
  onPriceChange?: (index: number, val: any) => void;
  onToggleUnit?: (index: number) => void;
  priceLabel?: string;
  onGlobalTierChange?: (tier: number) => void;
  onRowTierChange?: (index: number, tier: number) => void;
  enablePriceTiers?: boolean;
  activeTier?: number;
  maxLines?: number;
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
  onOpenSearch,
  onPriceChange,
  onToggleUnit,
  onGlobalTierChange,
  onRowTierChange,
  activeTier,
  enablePriceTiers = false,
  persistenceKey
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

  const resizingRef = useRef<{
    colId: keyof typeof INITIAL_WIDTHS;
    startX: number;
    startWidth: number;
    maxWidth: number;
  } | null>(null);

  const startResize = (colId: keyof typeof INITIAL_WIDTHS, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = colWidths[colId];
    const gridWidth = gridRef.current?.offsetWidth || 1000;
    
    resizingRef.current = {
      colId,
      startX,
      startWidth,
      maxWidth: gridWidth * 0.8
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    
    const { colId, startX, startWidth, maxWidth } = resizingRef.current;
    const diff = e.pageX - startX;
    const newWidth = Math.max(20, Math.min(startWidth + diff, maxWidth));
    
    setColWidths(prev => {
      const updated = { ...prev, [colId]: newWidth };
      if (persistenceKey) {
        localStorage.setItem(`grid_widths_${persistenceKey}`, JSON.stringify(updated));
      }
      return updated;
    });
  }, [persistenceKey]);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
  }, [handleMouseMove]);

  useEffect(() => {
    useNavigationStore.getState().setRowCount(items.length);
  }, [items.length]);

  // Synchronize selection with navigation store
  const activeRow = useNavigationStore(s => s.activeCell?.row);
  useEffect(() => {
    if (typeof activeRow === 'number' && activeRow !== selectedIndex) {
      onSelectLine(activeRow);
    }
  }, [activeRow, selectedIndex, onSelectLine]);

  useEffect(() => {
    gridRef.current?.focus();
  }, []);

  const ResizeHandle = ({ colId }: { colId: keyof typeof INITIAL_WIDTHS }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-black/50 z-10"
      onMouseDown={(e) => startResize(colId, e)}
    />
  );

  // FIX: Using 'fr' instead of 'px' for all resizable columns to ensure proportional scaling on all screens
  const gridTemplateColumns = `${colWidths.s}fr ${colWidths.designation}fr ${colWidths.code}fr ${colWidths.cndt}fr ${colWidths.stock}fr ${colWidths.price}fr ${colWidths.qty}fr ${colWidths.rem}fr ${colWidths.montant}fr 40px`;

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
        <div className="px-1 py-1 border-r border-black/30 text-center relative">
          S
          <ResizeHandle colId="s" />
        </div>
        
        <div className="px-2 py-1 border-r border-black/30 relative flex justify-between items-center uppercase">
          <span>{t('pos.grid.headers.designation')}</span>
          <span className="text-[10px] font-normal ml-2">Lig: {items.length}/{maxLines}</span>
          <ResizeHandle colId="designation" />
        </div>
        
        <div className="px-2 py-1 border-r border-black/30 text-center relative uppercase">
          {t('pos.grid.headers.sku')}
          <ResizeHandle colId="code" />
        </div>
        
        <div className="px-1 py-1 border-r border-black/30 text-center relative uppercase">
          {t('inventory.fields.packagingShort')}
          <ResizeHandle colId="cndt" />
        </div>
        
        <div className="px-1 py-1 border-r border-black/30 text-center relative uppercase">
          {t('pos.grid.stock')}
          <ResizeHandle colId="stock" />
        </div>
        
        <div className="px-2 py-1 border-r border-black/30 flex items-center justify-end gap-1 relative uppercase">
          {onGlobalTierChange && enablePriceTiers ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 hover:text-white focus:outline-none cursor-pointer">
                <span className="truncate">{priceLabel}</span> <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Global Price Tier</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onGlobalTierChange(1)}>
                  <span>Detail (Price 1)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onGlobalTierChange(2)}>
                  <span>Discount (Price 2)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onGlobalTierChange(3)}>
                  <span>Bulk (Price 3)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onGlobalTierChange(4)}>
                  <span>Resale (Price 4)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="truncate">{priceLabel}</span>
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
          items.map((item, index) => (
            <SanifereRow 
              key={item.id}
              item={item}
              index={index}
              selectedIndex={selectedIndex}
              gridTemplateColumns={gridTemplateColumns}
              onSelectLine={onSelectLine}
              onDesignationChange={onDesignationChange}
              onOpenSearch={onOpenSearch}
              onPriceChange={onPriceChange}
              onToggleUnit={onToggleUnit}
              onQuantityChange={onQuantityChange}
              onDiscountChange={onDiscountChange}
              onDeleteLine={onDeleteLine}
              onRowTierChange={onRowTierChange}
              enablePriceTiers={enablePriceTiers}
              formatCurrency={formatCurrency}
            />
          ))
        )}
      </div>
    </div>
  );
}
