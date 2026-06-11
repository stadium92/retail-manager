import { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Loader2, X } from 'lucide-react';
import { Ingredient } from '@/types/ingredients';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IngredientSearchDropdownProps {
  storeId: string;
  onSelect: (ingredient: Ingredient) => void;
  excludeIds?: string[];
}

export function IngredientSearchDropdown({ storeId, onSelect, excludeIds = [] }: IngredientSearchDropdownProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Quick create form state
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickForm, setQuickForm] = useState({
    name: '',
    unit: 'g' as 'g' | 'kg' | 'ml' | 'L' | 'pcs',
    category: 'perishable' as 'perishable' | 'dry' | 'liquid' | 'condiment',
    min_threshold: 0,
    cost_per_unit: 0,
    current_stock: 0,
  });
  const [creating, setCreating] = useState(false);

  // ── Bug 1 Fix: click-away listener ──────────────────────────────────────────
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowQuickCreate(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown, true);
    return () => document.removeEventListener('mousedown', handleMouseDown, true);
  }, []);
  // ────────────────────────────────────────────────────────────────────────────

  const fetchIngredients = async () => {
    setLoading(true);
    try {
      const res = await OfflineAuthService.localBridgeRequest<Ingredient[]>(
        `/rest/v1/ingredients?store_id=${storeId}`,
        { method: 'GET' }
      );
      setIngredients(res || []);
    } catch (err) {
      console.error('Failed to fetch ingredients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchIngredients();
    }
  }, [storeId]);

  // Fuzzy filter
  const filteredIngredients = useMemo(() => {
    return ingredients.filter(ing => {
      const isExcluded = excludeIds.includes(ing.id);
      const matchesSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase());
      return !isExcluded && matchesSearch;
    });
  }, [ingredients, searchQuery, excludeIds]);

  const handleSelect = (ing: Ingredient) => {
    onSelect(ing);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleQuickCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickForm.name.trim()) return;

    setCreating(true);
    try {
      const newIng = await OfflineAuthService.localBridgeRequest<Ingredient>('/rest/v1/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          ...quickForm,
        }),
      });

      if (newIng) {
        setIngredients(prev => [...prev, newIng]);
        onSelect(newIng);
        setShowQuickCreate(false);
        setIsOpen(false);
        setQuickForm({
          name: '',
          unit: 'g',
          category: 'perishable',
          min_threshold: 0,
          cost_per_unit: 0,
          current_stock: 0,
        });
      }
    } catch (err) {
      console.error('Failed to create ingredient:', err);
    } finally {
      setCreating(false);
    }
  };

  const getStockStatusBadge = (ing: Ingredient) => {
    const stock = ing.current_stock;
    const threshold = ing.min_threshold;
    if (stock <= 0) {
      return <Badge className="bg-red-500 text-white border-none text-[8px] px-1.5 py-0.5">Rupture</Badge>;
    }
    if (stock < threshold) {
      return <Badge className="bg-orange-500 text-white border-none text-[8px] px-1.5 py-0.5">Faible</Badge>;
    }
    return <Badge className="bg-teal text-white border-none text-[8px] px-1.5 py-0.5">OK</Badge>;
  };

  return (
    // ── Bug 1 Fix: wrap with containerRef ────────────────────────────────────
    <div ref={containerRef} className="relative w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Rechercher ou créer un ingrédient..."
            className="pl-9 h-10 border-primary/20 bg-primary/5 font-medium"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery('');
                setIsOpen(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border-2 border-border rounded-xl shadow-2xl overflow-hidden max-h-[350px] flex flex-col">
          {loading ? (
            <div className="p-4 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Chargement...</span>
            </div>
          ) : showQuickCreate ? (
            <form onSubmit={handleQuickCreateSubmit} className="p-4 space-y-3 bg-muted/20">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-primary">Créer un Ingrédient</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowQuickCreate(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-bold uppercase">Nom *</Label>
                  <Input
                    required
                    value={quickForm.name}
                    onChange={e => setQuickForm({ ...quickForm, name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">Unité</Label>
                  <Select
                    value={quickForm.unit}
                    onValueChange={v => setQuickForm({ ...quickForm, unit: v as any })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">Grammes (g)</SelectItem>
                      <SelectItem value="kg">Kilogrammes (kg)</SelectItem>
                      <SelectItem value="ml">Millilitres (ml)</SelectItem>
                      <SelectItem value="L">Litres (L)</SelectItem>
                      <SelectItem value="pcs">Pièces (pcs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">Catégorie</Label>
                  <Select
                    value={quickForm.category}
                    onValueChange={v => setQuickForm({ ...quickForm, category: v as any })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="perishable">Périssable</SelectItem>
                      <SelectItem value="dry">Épicerie Sèche</SelectItem>
                      <SelectItem value="liquid">Liquide</SelectItem>
                      <SelectItem value="condiment">Condiment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">Stock Initial</Label>
                  <Input
                    type="number"
                    value={quickForm.current_stock || ''}
                    onChange={e => setQuickForm({ ...quickForm, current_stock: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase">Seuil Min</Label>
                  <Input
                    type="number"
                    value={quickForm.min_threshold || ''}
                    onChange={e => setQuickForm({ ...quickForm, min_threshold: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] font-bold uppercase">Coût unitaire (CFA)</Label>
                  <Input
                    type="number"
                    value={quickForm.cost_per_unit || ''}
                    onChange={e => setQuickForm({ ...quickForm, cost_per_unit: Number(e.target.value) })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickCreate(false)}
                  className="h-8 text-xs"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creating}
                  className="h-8 text-xs bg-primary text-white font-bold"
                >
                  {creating ? 'Création...' : 'Créer'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="overflow-y-auto flex-1 max-h-[280px]">
              {/* ── Bug 2 Fix: only show results when query has 1+ chars ── */}
              {searchQuery.length === 0 ? (
                <div className="p-5 text-center text-muted-foreground text-xs leading-relaxed">
                  <Search className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  Tapez au moins <strong>1 caractère</strong> pour rechercher un ingrédient...
                </div>
              ) : filteredIngredients.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  Aucun ingrédient trouvé pour "<strong>{searchQuery}</strong>".
                </div>
              ) : (
                filteredIngredients.map(ing => (
                  <div
                    key={ing.id}
                    onClick={() => handleSelect(ing)}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 cursor-pointer border-b last:border-0"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">{ing.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {ing.category === 'perishable' ? 'Périssable' : ing.category === 'dry' ? 'Sèche' : ing.category === 'liquid' ? 'Liquide' : 'Condiment'} • {ing.cost_per_unit} F / {ing.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-muted-foreground">{ing.current_stock} {ing.unit}</span>
                      {getStockStatusBadge(ing)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Always-visible footer */}
          {!showQuickCreate && (
            <div
              className="border-t p-2 bg-muted/10 hover:bg-primary/5 cursor-pointer flex items-center justify-center gap-1.5 text-primary text-xs font-black uppercase tracking-wider"
              onClick={() => {
                setQuickForm({ ...quickForm, name: searchQuery });
                setShowQuickCreate(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Créer l'ingrédient {searchQuery ? `"${searchQuery}"` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
