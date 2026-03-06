import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Trash2, Tag } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { NavigableCell, useNavigationStore } from '@/navigation';
import { SanifereLineItem } from './SanifereGrid';

interface SanifereRowProps {
  item: SanifereLineItem;
  index: number;
  selectedIndex: number;
  gridTemplateColumns: string;
  onSelectLine: (index: number) => void;
  onDesignationChange?: (index: number, val: string) => void;
  onOpenSearch?: () => void;
  onPriceChange?: (index: number, val: any) => void;
  onToggleUnit?: (index: number) => void;
  onQuantityChange: (index: number, quantity: any) => void;
  onDiscountChange: (index: number, discount: any) => void;
  onDeleteLine: (index: number) => void;
  onRowTierChange?: (index: number, tier: number) => void;
  enablePriceTiers: boolean;
  formatCurrency: (amount: number) => string;
}

export function SanifereRow({ 
  item, index, selectedIndex, gridTemplateColumns, onSelectLine, 
  onDesignationChange, onOpenSearch, onPriceChange, onToggleUnit,
  onQuantityChange, onDiscountChange, onDeleteLine, onRowTierChange,
  enablePriceTiers, formatCurrency
}: SanifereRowProps) {
  const activeRow = useNavigationStore(s => s.activeCell?.row);
  const inputMethod = useNavigationStore(s => s.inputMethod);
  const isSelected = inputMethod === 'keyboard' ? index === activeRow : index === selectedIndex;
  const stockStatus = item.stock <= 0 ? 'rupture' : item.stock <= 10 ? 'low' : 'ok';

  return (
    <div
      onClick={() => onSelectLine(index)}
      className={cn('grid font-mono text-sm border-b border-white/20 cursor-pointer transition-colors relative',
        isSelected ? 'bg-[hsl(50,100%,50%)] text-black !important shadow-inner' : 'text-white hover:bg-white/10'
      )}
      style={{ gridTemplateColumns }}
    >
      <div className="px-1 py-1.5 border-r border-white/20 text-center">
        {isSelected ? '►' : ''}
      </div>

      <NavigableCell
        row={index}
        column="designation"
        onOpenSearch={() => {
          if (onOpenSearch) onOpenSearch();
          else document.getElementById(`designation-input-${index}`)?.focus();
        }}
        className="px-2 py-0.5 border-r border-white/20 truncate relative group"
      >
        {onDesignationChange ? (
           <Input
            id={`designation-input-${index}`}
            value={item.designation}
            onChange={(e) => onDesignationChange?.(index, e.target.value)}
            onClick={(e) => {
              e.stopPropagation();
              const store = useNavigationStore.getState();
              store.setActiveCell({ row: index, col: 0 });
              store.setMode('edit');
            }}
            className={cn(
              'h-full w-full p-1 border-none font-mono text-sm bg-transparent',
              isSelected ? 'text-black focus:bg-white/50' : 'text-white focus:bg-white/20'
            )}
          />
        ) : (
          <div className="py-1">{item.designation}</div>
        )}
      </NavigableCell>

      <NavigableCell row={index} column="code" className="px-2 py-1.5 border-r border-white/20 text-center text-xs truncate">
        {item.code}
      </NavigableCell>

      <NavigableCell
        row={index}
        column="conditionnement"
        onToggleUnit={() => onToggleUnit?.(index)}
        className="px-1 py-1.5 border-r border-white/20 text-center cursor-pointer hover:bg-white/20"
      >
        <div 
          onClick={(e) => { e.stopPropagation(); onToggleUnit?.(index); }}
          className="w-full h-full flex items-center justify-center"
        >
          <span className="text-[10px] font-bold">
            {item.isBox ? (item.unit_type?.toUpperCase() || 'BOX') : 'PC'}
          </span>
        </div>
      </NavigableCell>

      <NavigableCell row={index} column="stock" className={cn('px-2 py-1.5 border-r border-white/20 text-center', stockStatus === 'rupture' && 'text-red-400', stockStatus === 'low' && 'text-yellow-400')}>
        {item.stock}
      </NavigableCell>

      <NavigableCell row={index} column="price" className="px-1 py-0.5 border-r border-white/20 flex items-center">
        {item.priceTiers && onRowTierChange && enablePriceTiers && (
          <DropdownMenu>
            <DropdownMenuTrigger className="h-full px-1 hover:bg-white/20 focus:outline-none cursor-pointer text-white/50 hover:text-white flex items-center">
              <Tag className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Item Price Tier</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRowTierChange(index, 1)}>
                <span>Detail:</span> <span className="ml-auto font-bold">{formatCurrency((item.priceTiers[1] || 0) * (item.isBox ? (item.conditionnement || 1) : 1))}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRowTierChange(index, 2)}>
                <span>Discount:</span> <span className="ml-auto font-bold">{formatCurrency((item.priceTiers[2] || 0) * (item.isBox ? (item.conditionnement || 1) : 1))}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRowTierChange(index, 3)}>
                <span>Bulk:</span> <span className="ml-auto font-bold">{formatCurrency((item.priceTiers[3] || 0) * (item.isBox ? (item.conditionnement || 1) : 1))}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRowTierChange(index, 4)}>
                <span>Resale:</span> <span className="ml-auto font-bold">{formatCurrency((item.priceTiers[4] || 0) * (item.isBox ? (item.conditionnement || 1) : 1))}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {onPriceChange ? (
           <div className="relative flex-1 group h-full">
              <Input
                id={`price-input-${index}`}
                type="number"
                value={item.unitPrice === 0 ? '' : (item.isBox ? Number(item.unitPrice) * (item.conditionnement || 1) : item.unitPrice)}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  const baseVal = (item.isBox && val !== '') ? (Number(val) / (item.conditionnement || 1)) : val;
                  onPriceChange?.(index, baseVal);
                }}
                onBlur={() => { 
                  if (item.unitPrice === '') onPriceChange?.(index, 0); 
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const store = useNavigationStore.getState();
                  store.setActiveCell({ row: index, col: 4 });
                  store.setMode('edit');
                }}
                className={cn('h-full w-full p-1 text-right border-none font-mono text-sm bg-transparent tabular-nums focus:ring-0', isSelected ? 'text-black focus:bg-white/50' : 'text-white focus:bg-white/20')}
              />
              {item.isBox && <span className="absolute left-1 top-0.5 text-[7px] font-black uppercase opacity-30 pointer-events-none group-focus-within:hidden">Scaled</span>}
           </div>
        ) : (
          <div className="py-1 text-right tabular-nums w-full">
              {formatCurrency(Number(item.unitPrice) * (item.isBox ? (item.conditionnement || 1) : 1))}
          </div>
        )}
      </NavigableCell>

      <NavigableCell row={index} column="quantity" className="px-1 py-0.5 border-r border-white/20">
        <Input
          id={`quantity-input-${index}`}
          type="number"
          min={1}
          value={item.quantity === 0 ? '' : item.quantity}
          onChange={(e) => onQuantityChange(index, e.target.value === '' ? '' : parseInt(e.target.value))}
          onBlur={() => { 
            if (item.quantity === '') onQuantityChange(index, 1); 
            const store = useNavigationStore.getState();
            if (store.activeCell?.row === index && store.activeCell?.col === 5 && store.mode === 'edit') store.setMode('hover');
          }}
          onClick={(e) => {
            e.stopPropagation();
            const store = useNavigationStore.getState();
            store.setActiveCell({ row: index, col: 5 });
            store.setMode('edit');
          }}
          className={cn('h-6 w-full text-center text-sm p-0 border-none', isSelected ? 'bg-white text-black' : 'bg-transparent text-white')}
        />
      </NavigableCell>

      <NavigableCell row={index} column="discount" className="px-1 py-0.5 border-r border-white/20">
        <Input
          id={`discount-input-${index}`}
          type="number"
          min={0}
          max={100}
          value={item.discountPercent === 0 ? '' : item.discountPercent}
          onChange={(e) => onDiscountChange(index, e.target.value === '' ? '' : parseFloat(e.target.value))}
          onBlur={() => { 
            if (item.discountPercent === '') onDiscountChange(index, 0); 
            const store = useNavigationStore.getState();
            if (store.activeCell?.row === index && store.activeCell?.col === 6 && store.mode === 'edit') store.setMode('hover');
          }}
          onClick={(e) => {
            e.stopPropagation();
            const store = useNavigationStore.getState();
            store.setActiveCell({ row: index, col: 6 });
            store.setMode('edit');
          }}
          className={cn('h-6 w-full text-center text-sm p-0 border-none', isSelected ? 'bg-white text-black' : 'bg-transparent text-white')}
        />
      </NavigableCell>

      <NavigableCell row={index} column="total" className={cn('px-2 py-1.5 text-right tabular-nums font-bold truncate', item.discountPercent > 0 && !isSelected && 'text-green-300')}>
        {formatCurrency(item.lineTotal)}
      </NavigableCell>

      <div className="flex items-center justify-center border-l border-white/20">
        <button onClick={(e) => { e.stopPropagation(); onDeleteLine(index); }} className="text-white/50 hover:text-red-400 p-1">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
