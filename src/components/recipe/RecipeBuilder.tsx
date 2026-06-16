import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Plus, Trash2, Minus, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Ingredient, RecipeIngredient } from '@/types/ingredients';
import { IngredientSearchDropdown } from './IngredientSearchDropdown';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { supabase } from '@/lib/supabase';
import { getDataClient } from '@/lib/dataClient';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface RecipeItemRow {
  tempId: string;
  ingredient_id: string;
  ingredient_name: string;
  quantity_needed: number | string;
  unit: string;
  current_stock: number;
  cost_per_unit: number;
  min_threshold: number;
  default_unit: string;
}

interface RecipeBuilderProps {
  dishId: string | null;
  storeId: string;
  sellingPrice: number;
  onChange: (items: { ingredient_id: string; quantity_needed: number; unit: string }[]) => void;
  onCostChange?: (cost: number) => void;
}

// Convert helper for culinary conversions
function convertQuantity(qty: number, from: string, to: string): number {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  if (f === t) return qty;
  
  if (f === 'g' && t === 'kg') return qty / 1000;
  if (f === 'kg' && t === 'g') return qty * 1000;
  if (f === 'ml' && t === 'l') return qty / 1000;
  if (f === 'l' && t === 'ml') return qty * 1000;
  
  return qty; // Fallback
}

interface SortableRecipeRowProps {
  item: RecipeItemRow;
  onUpdateField: (tempId: string, field: keyof RecipeItemRow, val: any) => void;
  onRemoveRow: (tempId: string) => void;
  stockBadge: React.ReactNode;
}

// Extracted to prevent re-creation on every render, solving the input focus loss bug
const SortableRecipeRow = ({ item, onUpdateField, onRemoveRow, stockBadge }: SortableRecipeRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.tempId,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        transition,
      }
    : undefined;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b hover:bg-muted/20 transition-colors group"
    >
      <td className="p-3 align-middle">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing p-1"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </td>
      <td className="p-3 font-bold text-sm text-foreground align-middle">
        {item.ingredient_name}
      </td>
      <td className="p-3 align-middle w-[220px]">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 flex-shrink-0 text-muted-foreground"
            onClick={() =>
              onUpdateField(
                item.tempId,
                'quantity_needed',
                Math.max(0.001, (Number(item.quantity_needed) || 0) - 1)
              )
            }
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="text"
            inputMode="decimal"
            value={item.quantity_needed}
            onChange={e =>
              onUpdateField(item.tempId, 'quantity_needed', e.target.value)
            }
            className="h-8 text-xs font-bold text-center w-32 px-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 flex-shrink-0 text-muted-foreground"
            onClick={() =>
              onUpdateField(item.tempId, 'quantity_needed', (Number(item.quantity_needed) || 0) + 1)
            }
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </td>
      <td className="p-3 align-middle w-[120px]">
        <select
          value={item.unit}
          onChange={e => onUpdateField(item.tempId, 'unit', e.target.value)}
          className="h-8 w-full text-xs font-bold border rounded-md px-2 bg-card text-foreground"
        >
          <option value="g">g</option>
          <option value="kg">kg</option>
          <option value="ml">ml</option>
          <option value="L">L</option>
          <option value="pcs">pcs</option>
        </select>
      </td>
      <td className="p-3 align-middle text-xs font-mono font-bold text-muted-foreground">
        {item.current_stock} {item.default_unit}
      </td>
      <td className="p-3 align-middle">
        {stockBadge}
      </td>
      <td className="p-3 align-middle text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemoveRow(item.tempId)}
          className="text-red-500 hover:bg-red-500/10 hover:text-red-600 h-8 w-8"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
};

export function RecipeBuilder({ dishId, storeId, sellingPrice, onChange, onCostChange }: RecipeBuilderProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<RecipeItemRow[]>([]);
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  // Fetch recipe
  useEffect(() => {
    const fetchRecipe = async () => {
      if (!dishId) {
        setItems([]);
        if (onCostChange) onCostChange(0);
        return;
      }
      setLoading(true);
      try {
        const dc = getDataClient();
        if (dc.isLocalFirst) {
          const res = await OfflineAuthService.localBridgeRequest<RecipeIngredient[]>(
            `/rest/v1/recipes?dish_id=${dishId}`,
            { method: 'GET' }
          );
          const mapped = (res || []).map(r => ({
            tempId: crypto.randomUUID(),
            ingredient_id: r.ingredient_id,
            ingredient_name: r.ingredient_name,
            quantity_needed: r.quantity_needed,
            unit: r.unit,
            current_stock: r.current_stock,
            cost_per_unit: r.cost_per_unit,
            min_threshold: r.min_threshold,
            default_unit: r.default_unit || r.unit,
          }));
          setItems(mapped);
        } else {
          const { data, error } = await supabase
            .from('dish_recipes')
            .select('*, ingredients(*)')
            .eq('dish_id', dishId);
          
          if (error) throw error;
          
          const mapped = (data || []).map((r: any) => ({
            tempId: crypto.randomUUID(),
            ingredient_id: r.ingredient_id,
            ingredient_name: r.ingredients?.name || '—',
            quantity_needed: r.quantity_needed,
            unit: r.unit,
            current_stock: r.ingredients?.current_stock || 0,
            cost_per_unit: r.ingredients?.cost_per_unit || 0,
            min_threshold: r.ingredients?.min_threshold || 0,
            default_unit: r.ingredients?.unit || r.unit,
          }));
          setItems(mapped);
        }
      } catch (err) {
        console.error('Failed to load recipe:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [dishId]);

  // Calculate estimated cost
  const totalCost = items.reduce((sum, item) => {
    const qty = Number(item.quantity_needed) || 0;
    // Convert recipe quantity to database ingredient base unit for cost calculation
    const baseQty = convertQuantity(qty, item.unit, item.default_unit);
    return sum + baseQty * item.cost_per_unit;
  }, 0);

  // Trigger parent updates
  useEffect(() => {
    onChange(
      items.map(i => ({
        ingredient_id: i.ingredient_id,
        quantity_needed: Number(i.quantity_needed) || 0,
        unit: i.unit,
      }))
    );
    if (onCostChange) {
      onCostChange(totalCost);
    }
  }, [items, totalCost]);

  // Add ingredient
  const handleAddIngredient = (ing: Ingredient) => {
    const exists = items.some(item => item.ingredient_id === ing.id);
    if (exists) return;

    setItems(prev => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        ingredient_id: ing.id,
        ingredient_name: ing.name,
        quantity_needed: 1,
        unit: ing.unit,
        current_stock: ing.current_stock,
        cost_per_unit: ing.cost_per_unit,
        min_threshold: ing.min_threshold,
        default_unit: ing.unit,
      },
    ]);
  };

  // Remove row
  const handleRemoveRow = (tempId: string) => {
    setItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  // Update field
  const handleUpdateField = (tempId: string, field: keyof RecipeItemRow, val: any) => {
    setItems(prev =>
      prev.map(item => (item.tempId === tempId ? { ...item, [field]: val } : item))
    );
  };

  // Drag End handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems(prev => {
        const oldIndex = prev.findIndex(item => item.tempId === active.id);
        const newIndex = prev.findIndex(item => item.tempId === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const getStockBadge = (item: RecipeItemRow) => {
    const qty = Number(item.quantity_needed) || 0;
    if (qty <= 0) return <Badge variant="outline" className="text-gray-400">Inconnu</Badge>;
    
    // Convert to default stock unit
    const neededBase = convertQuantity(qty, item.unit, item.default_unit);
    const portionsLeft = neededBase > 0 ? (item.current_stock / neededBase) : 0;

    if (portionsLeft >= 10) {
      return <Badge className="bg-emerald-500 text-white border-none text-[10px] px-2 py-0.5">🟢 Suffisant</Badge>;
    }
    if (portionsLeft >= 3) {
      return <Badge className="bg-amber-500 text-white border-none text-[10px] px-2 py-0.5">🟡 Faible</Badge>;
    }
    return <Badge className="bg-red-500 text-white border-none text-[10px] px-2 py-0.5">🔴 Insuffisant</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex flex-col gap-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
          COMPOSITION DU PLAT
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Définissez les ingrédients et les quantités nécessaires pour préparer une portion de ce plat. Les stocks seront déduits automatiquement lors de la vente.
        </p>
        <IngredientSearchDropdown
          storeId={storeId}
          onSelect={handleAddIngredient}
          excludeIds={items.map(i => i.ingredient_id)}
        />
      </div>

      <div className="border-2 rounded-xl overflow-hidden bg-card shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <th className="p-3 w-10"></th>
              <th className="p-3">Ingrédient</th>
              <th className="p-3">Quantité</th>
              <th className="p-3">Unité</th>
              <th className="p-3">Stock Actuel</th>
              <th className="p-3">Disponibilité</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                  Aucun ingrédient dans la composition de ce plat.
                </td>
              </tr>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.tempId)} strategy={verticalListSortingStrategy}>
                  {items.map(item => (
                    <SortableRecipeRow 
                      key={item.tempId} 
                      item={item} 
                      onUpdateField={handleUpdateField}
                      onRemoveRow={handleRemoveRow}
                      stockBadge={getStockBadge(item)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-muted-foreground/10">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Coût de revient estimé
          </span>
          <span className="text-2xl font-black text-foreground font-mono">
            {totalCost.toLocaleString()} F CFA
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Marge brute estimée
          </span>
          <span className="text-2xl font-black text-teal font-mono">
            {(sellingPrice - totalCost).toLocaleString()} F CFA
          </span>
        </div>
      </div>
    </div>
  );
}
