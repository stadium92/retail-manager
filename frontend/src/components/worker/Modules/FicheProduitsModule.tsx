import { useState, useEffect, useCallback, useRef } from 'react';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Package,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Boxes,
  UtensilsCrossed,
  X,
  Trash2,
  Minus,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getDataClient } from '@/lib/dataClient';
import { RecipeBuilder, RecipeIngredient } from '@/components/recipe/RecipeBuilder';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { supabase } from '@/lib/supabase';

interface FicheProduitsModuleProps {
  storeId: string;
}

interface MenuItem {
  id: string;
  name: string;
  price?: number;
  unit_price?: number;
  selling_price_detail?: number;
  image_url?: string;
  item_type?: string;
  pack_items?: string[] | string;
  category_id?: string;
  quantity?: number;
  updated_at?: string;
}

interface Pack {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  item_type: 'pack';
  pack_items?: string[];
}

interface PackForm {
  name: string;
  price: string;
  image_url: string;
  selected_items: string[];
}

const defaultPackForm: PackForm = {
  name: '',
  price: '',
  image_url: '',
  selected_items: [],
};

export interface PlateFormState {
  id: string;
  _ui_pendingId: string;
  name: string;
  image_url: string;
  selling_price_detail: number;
  recipeItems: RecipeIngredient[];
  recipeCost: number;
  unit_type: string;
  packaging: string;
  quantity: number;
  min_stock_alert: number;
  prep_time_minutes: number;
  course_type: string;
  is_available: boolean;
}

const getInitialPlateFormState = (): PlateFormState => ({
  id: crypto.randomUUID(),
  _ui_pendingId: crypto.randomUUID(),
  name: '',
  image_url: '',
  selling_price_detail: 0,
  recipeItems: [],
  recipeCost: 0,
  unit_type: 'Pièce',
  packaging: '1',
  quantity: 0,
  min_stock_alert: 5,
  prep_time_minutes: 15,
  course_type: 'Main',
  is_available: true
});

export function FicheProduitsModule({ storeId }: FicheProduitsModuleProps) {
  const { t, i18n } = useTranslation();
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPack, setSavingPack] = useState(false);

  // ── State for Adding Plates ───────────────────────────────────────────────
  const [plateDialogOpen, setPlateDialogOpen] = useState(false);
  const [savingPlate, setSavingPlate] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'single' | 'multi'>('single');
  const [selectedMultiPlateIndex, setSelectedMultiPlateIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'informations' | 'prix' | 'composition' | 'logistique'>('informations');
  
  const [singlePlateForm, setSinglePlateForm] = useState<PlateFormState>(getInitialPlateFormState());
  const [multiPlates, setMultiPlates] = useState<PlateFormState[]>([getInitialPlateFormState()]);


  const [searchQuery, setSearchQuery] = useState('');

  // Pack state
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [packForm, setPackForm] = useState<PackForm>(defaultPackForm);
  const [packSearchTerm, setPackSearchTerm] = useState('');
  const [editingPack, setEditingPack] = useState<Pack | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (amount: number) =>
    amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' F';

  const loadItems = useCallback(async (silent = false) => {
    if (!storeId) return;
    if (!silent) setLoading(true);
    try {
      const { data, error } = await OfflineInventoryService.getInventory(storeId, { notify: false });
      if (error) throw error;
      
      const mapped = ((data as unknown as MenuItem[]) || []).map(item => {
        let parsedPackItems: string[] = [];
        if (item.pack_items) {
          try {
            parsedPackItems = typeof item.pack_items === 'string'
              ? JSON.parse(item.pack_items)
              : item.pack_items;
          } catch (e) {
            console.error('Failed to parse pack_items:', e);
          }
        }
        return {
          ...item,
          pack_items: parsedPackItems
        };
      });
      setAllItems(mapped);
    } catch (err) {
      console.error('[FicheProduitsModule] load error:', err);
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [storeId, t]);

  useEffect(() => {
    loadItems();
    const handler = (e: any) => {
      if (['inventory', 'product'].includes(e.detail?.type)) loadItems(true);
    };
    window.addEventListener('localDbDataUpdated' as any, handler);
    return () => window.removeEventListener('localDbDataUpdated' as any, handler);
  }, [loadItems]);

  // Separate packs from individual menu items
  const packs = allItems.filter(i => i.item_type === 'pack') as unknown as Pack[];
  const menuItems = allItems.filter(i => i.item_type !== 'pack');

  const filteredItems = menuItems.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getItemPrice = (item: MenuItem) =>
    item.unit_price || item.selling_price_detail || item.price || 0;

  const scrollPacks = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'right' ? 200 : -200, behavior: 'smooth' });
    }
  };

  const handleOpenAddPlate = () => {
    setSinglePlateForm(getInitialPlateFormState());
    setMultiPlates([getInitialPlateFormState()]);
    setRegistrationMode('single');
    setSelectedMultiPlateIndex(0);
    setActiveTab('informations');
    setPlateDialogOpen(true);
  };

  const addMultiPlateRow = () => {
    setMultiPlates(prev => {
        setTimeout(() => setSelectedMultiPlateIndex(prev.length), 0);
        return [...prev, getInitialPlateFormState()];
    });
  };

  const removeMultiPlateRow = (id: string) => {
    setMultiPlates(prev => {
        const newItems = prev.filter(item => item.id !== id);
        setTimeout(() => {
            setSelectedMultiPlateIndex(curr => Math.min(curr, Math.max(0, newItems.length - 1)));
        }, 0);
        return newItems;
    });
  };

  const updateActivePlate = (updates: Partial<PlateFormState>) => {
    if (registrationMode === 'single') {
        setSinglePlateForm(prev => ({ ...prev, ...updates }));
    } else {
        setMultiPlates(prev => {
            const next = [...prev];
            if (next[selectedMultiPlateIndex]) {
                next[selectedMultiPlateIndex] = { ...next[selectedMultiPlateIndex], ...updates };
            }
            return next;
        });
    }
  };

  const handleSavePlate = async () => {
    const itemsToSave = (registrationMode === 'single' ? [singlePlateForm] : multiPlates).filter(item => {
        return item.name.trim() !== '' && item.selling_price_detail > 0;
    });

    if (itemsToSave.length === 0) {
      toast({ title: 'Remplissez au moins un plat avec un nom et un prix valide', variant: 'destructive' });
      return;
    }

    setSavingPlate(true);
    try {
      for (const item of itemsToSave) {
          const data = {
            name: item.name,
            selling_price_detail: Number(item.selling_price_detail),
            image_url: item.image_url,
            item_type: 'dish',
            unit_type: item.unit_type,
            packaging: item.packaging,
            quantity: Number(item.quantity) || 0,
            min_stock_alert: Number(item.min_stock_alert) || 0,
            prep_time_minutes: Number(item.prep_time_minutes) || 0,
            course_type: item.course_type,
            is_available: item.is_available,
            store_id: storeId,
          };

          const result = await OfflineInventoryService.createItem({ ...data, id: item.id });
          if (result.error) throw result.error;

          // Save composition
          if (item.recipeItems && item.recipeItems.length > 0) {
              const dc = getDataClient();
              if (dc.isLocalFirst) {
                  await OfflineAuthService.localBridgeRequest('/rest/v1/recipes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      dish_id: item.id,
                      items: item.recipeItems,
                    }),
                  });
              } else {
                  // Delete existing recipe composition for this dish
                  const { error: delErr } = await supabase
                      .from('dish_recipes')
                      .delete()
                      .eq('dish_id', item.id);
                  if (delErr) throw delErr;

                  // Insert new recipe items
                  const now = new Date().toISOString();
                  const insertPayload = item.recipeItems.map((recipeItem: any) => ({
                      id: crypto.randomUUID(),
                      dish_id: item.id,
                      ingredient_id: recipeItem.ingredient_id,
                      quantity_needed: Number(recipeItem.quantity_needed),
                      unit: recipeItem.unit,
                      created_at: now,
                      updated_at: now
                  }));
                  const { error: insErr } = await supabase
                      .from('dish_recipes')
                      .insert(insertPayload);
                  if (insErr) throw insErr;
              }
          }
      }

      toast({ title: registrationMode === 'single' ? `🍽️ Plat "${itemsToSave[0].name}" créé avec succès` : `🍽️ ${itemsToSave.length} plats créés avec succès` });
      setPlateDialogOpen(false);
      loadItems(true);
    } catch (err: any) {
      toast({ title: err.message || 'Erreur', variant: 'destructive' });
    } finally {
      setSavingPlate(false);
    }
  };


  const handleCreatePack = async () => {
    if (!packForm.name.trim()) {
      toast({ title: 'Le nom du pack est requis', variant: 'destructive' });
      return;
    }
    setSavingPack(true);
    try {
      const dc = getDataClient();
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) throw new Error('Session requise');

      const payload = {
        store_id: storeId,
        name: packForm.name.trim(),
        unit_price: Number(packForm.price) || 0,
        image_url: packForm.image_url || null,
        item_type: 'pack',
        pack_items: packForm.selected_items,
        is_available: true,
      };

      let res;
      if (editingPack) {
        res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/products/${editingPack.id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/products`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error('Échec de sauvegarde du pack');

      toast({ title: editingPack ? `✅ Pack "${packForm.name}" mis à jour !` : `✅ Pack "${packForm.name}" créé !` });
      setPackDialogOpen(false);
      setPackForm(defaultPackForm);
      setEditingPack(null);
      loadItems(true);
    } catch (err: any) {
      toast({ title: err.message || 'Erreur', variant: 'destructive' });
    } finally {
      setSavingPack(false);
    }
  };

  const handleDeletePack = async (id: string, name: string) => {
    if (!confirm(`Supprimer le pack "${name}" ? Cette action est irréversible.`)) return;
    setSavingPack(true);
    try {
      const dc = getDataClient();
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) throw new Error('Session requise');

      const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/products/${id}`, {
        method: 'DELETE',
        headers: { ...headers },
      });

      if (!res.ok) throw new Error('Échec de suppression du pack');

      toast({ title: `🗑️ Pack "${name}" supprimé` });
      setPackDialogOpen(false);
      setPackForm(defaultPackForm);
      setEditingPack(null);
      loadItems(true);
    } catch (err: any) {
      toast({ title: err.message || 'Erreur', variant: 'destructive' });
    } finally {
      setSavingPack(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-5 p-4 overflow-y-auto">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            Menu
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {menuItems.length} plat{menuItems.length !== 1 ? 's' : ''} · {packs.length} pack{packs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={() => { setEditingPack(null); setPackForm(defaultPackForm); setPackDialogOpen(true); }}
          variant="outline"
          className="gap-2 border-primary/30 text-primary hover:bg-primary/10 font-bold text-xs"
        >
          <Boxes className="h-4 w-4" />
          Créer un Pack
        </Button>
      </div>

      {/* ── PACK SCROLLER ZONE ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Boxes className="h-3.5 w-3.5" /> Packs &amp; Combos
          </h3>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scrollPacks('left')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scrollPacks('right')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {packs.length === 0 ? (
          <div
            onClick={() => setPackDialogOpen(true)}
            className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-border/50 text-muted-foreground cursor-pointer hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all"
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs font-bold">Créer votre premier pack combo...</span>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex flex-row gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            style={{ scrollbarWidth: 'thin' }}
          >
            {packs.map(pack => (
              <div
                key={pack.id}
                onClick={() => {
                  setEditingPack(pack);
                  setPackForm({
                    name: pack.name,
                    price: String(pack.price || getItemPrice(pack as any) || 0),
                    image_url: pack.image_url || '',
                    selected_items: pack.pack_items || [],
                  });
                  setPackDialogOpen(true);
                }}
                className="flex-shrink-0 w-36 h-44 rounded-xl border border-border/60 bg-card overflow-hidden cursor-pointer hover:scale-105 hover:shadow-lg transition-all duration-200 group"
              >
                {/* Image area */}
                <div className="h-[60%] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative overflow-hidden">
                  {pack.image_url ? (
                    <img src={pack.image_url} alt={pack.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">📦</span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {/* Info area */}
                <div className="h-[40%] p-2 flex flex-col justify-between">
                  <span className="font-bold text-xs text-foreground truncate leading-tight">{pack.name}</span>
                  <span className="text-primary font-black text-sm font-mono">
                    {formatCurrency(pack.price || getItemPrice(pack as any) || 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-border/40" />

      {/* ── INDIVIDUAL ITEMS ZONE ─────────────────────────────────────────── */}
      <div className="space-y-3 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 flex-shrink-0">
            <UtensilsCrossed className="h-3.5 w-3.5" /> Plats Individuels
          </h3>
          <div className="relative flex-1 max-w-xs flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="pl-8 h-8 text-xs bg-card border-border/60"
              />
            </div>
            <Button
              onClick={handleOpenAddPlate}
              className="h-8 gap-2 bg-primary text-white font-bold text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter un plat
            </Button>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 opacity-20 mb-2" />
            <p className="text-sm">{searchQuery ? `Aucun résultat pour "${searchQuery}"` : 'Aucun plat enregistré'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredItems.map(item => {
              const stock = item.quantity ?? 0;
              const price = getItemPrice(item);
              const hasImage = !!item.image_url;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group"
                >
                  {/* Image / placeholder */}
                  <div className="aspect-video bg-gradient-to-br from-muted/60 to-muted/20 flex items-center justify-center overflow-hidden">
                    {hasImage ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <UtensilsCrossed className="h-8 w-8 opacity-20" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-2.5 space-y-1">
                    <p className="font-bold text-xs text-foreground truncate leading-tight">{item.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-primary font-black text-sm font-mono">{formatCurrency(price)}</span>
                      <Badge
                        className={cn(
                          'text-[9px] border-none px-1.5 py-0',
                          stock <= 0
                            ? 'bg-red-500/15 text-red-400'
                            : stock <= 5
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'bg-teal-500/15 text-teal-400'
                        )}
                      >
                        {stock <= 0 ? 'Rupture' : `×${stock}`}
                      </Badge>
                    </div>
                    {item.category_id && (
                      <p className="text-[10px] text-muted-foreground truncate">{item.category_id}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create Pack Dialog ────────────────────────────────────────────── */}
      <Dialog open={packDialogOpen} onOpenChange={(open) => {
        setPackDialogOpen(open);
        if (!open) {
          setEditingPack(null);
          setPackForm(defaultPackForm);
        }
      }}>
        <DialogContent className="max-w-md bg-card border-border [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Boxes className="h-4 w-4 text-primary" />
              {editingPack ? 'Modifier le Pack / Combo' : 'Créer un Pack / Combo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Nom du Pack *</Label>
              <Input
                value={packForm.name}
                onChange={e => setPackForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Pack Burger Combo"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Prix (CFA)</Label>
              <Input
                type="number"
                value={packForm.price}
                onChange={e => setPackForm(f => ({ ...f, price: e.target.value }))}
                placeholder="5000"
                className="h-9 font-mono"
              />
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Image (optionnel)</Label>
              <ImageUpload
                currentImageUrl={packForm.image_url}
                onImageUploaded={(url) => setPackForm(f => ({ ...f, image_url: url }))}
                onImageRemoved={() => setPackForm(f => ({ ...f, image_url: '' }))}
                folder="inventory"
                className="w-full"
              />
            </div>

            <div className="space-y-1.5 flex flex-col h-full">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex justify-between items-center">
                <span>Plats inclus ({packForm.selected_items.length} sélectionné{packForm.selected_items.length !== 1 ? 's' : ''})</span>
              </Label>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un plat..."
                  className="pl-9 h-9 text-xs"
                  value={packSearchTerm}
                  onChange={(e) => setPackSearchTerm(e.target.value)}
                />
              </div>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-border/50 bg-muted/20">
                {menuItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">Aucun plat disponible</p>
                ) : (
                  menuItems.filter(item => item.name.toLowerCase().includes(packSearchTerm.toLowerCase())).map(item => {
                    const selected = packForm.selected_items.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => setPackForm(f => ({
                          ...f,
                          selected_items: selected
                            ? f.selected_items.filter(id => id !== item.id)
                            : [...f.selected_items, item.id],
                        }))}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40 border-b last:border-0 transition-colors',
                          selected && 'bg-primary/5'
                        )}
                      >
                        <div className={cn(
                          'h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          selected ? 'bg-primary border-primary' : 'border-border'
                        )}>
                          {selected && <X className="h-2.5 w-2.5 text-primary-foreground" />}
                        </div>
                        <span className="text-xs font-medium text-foreground truncate">{item.name}</span>
                        <span className="ml-auto text-xs font-mono text-primary flex-shrink-0">
                          {formatCurrency(getItemPrice(item))}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full gap-2">
            {editingPack && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDeletePack(editingPack.id, editingPack.name)}
                disabled={savingPack}
                className="text-xs mr-auto gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setPackDialogOpen(false);
                  setEditingPack(null);
                  setPackForm(defaultPackForm);
                }}
                className="text-xs"
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreatePack}
                disabled={savingPack}
                className="bg-primary text-primary-foreground font-bold text-xs gap-1.5"
              >
                {savingPack && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingPack ? 'Modifier le Pack' : 'Créer le Pack'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Plate Dialog ──────────────────────────────────────────────── */}
      <Dialog open={plateDialogOpen} onOpenChange={setPlateDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 flex flex-col gap-0 overflow-hidden shadow-2xl rounded-xl border border-gray-200 bg-white [&>button]:hidden">
          <div className="flex flex-col h-full bg-slate-50/50 djati-modal-wrapper">
            <style>{`
              .djati-modal-wrapper {
                --teal: #00b09b;
                --teal-h: #009688;
                --teal-light: #e6f7f5;
                --teal-border: #53dbc5;
                --txt: #111827;
                --txt-2: #6b7280;
                --txt-m: #9ca3af;
                --border: #e5e7eb;
                --surface: #ffffff;
                --surface-l: #f9fafb;
                font-family: 'Inter', sans-serif;
                color: var(--txt);
              }
              .djati-tab-bar {
                display: flex; gap: 2px; padding: 10px 24px;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0; background: #fff; justify-content: center;
              }
              .djati-tab-btn {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 6px 14px; border-radius: 9999px;
                font-size: 13px; font-weight: 500; border: none; cursor: pointer;
                background: transparent; color: var(--txt-2); transition: all .15s;
              }
              .djati-tab-btn:hover { background: var(--teal-light); color: var(--teal); }
              .djati-tab-btn.active { background: var(--teal); color: #fff; }
              .djati-toggle {
                width: 44px; height: 24px; background: #d1d5db; border-radius: 9999px;
                position: relative; cursor: pointer; transition: background .2s; flex-shrink: 0;
              }
              .djati-toggle.on { background: var(--teal); }
              .djati-toggle::after {
                content: ''; width: 18px; height: 18px; background: #fff; border-radius: 9999px;
                position: absolute; top: 3px; left: 3px; transition: transform .2s;
                box-shadow: 0 1px 3px rgba(0,0,0,.2);
              }
              .djati-toggle.on::after { transform: translateX(20px); }
            `}</style>

            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white flex justify-between items-center shadow-sm z-10 relative">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-black text-foreground">
                  {registrationMode === 'multi' ? 'AJOUT MULTIPLE' : 'Nouvel Article (Plat)'}
                </h2>
                <div className="flex flex-col ml-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Mode Multiple</span>
                  <div 
                    className={cn("djati-toggle", registrationMode === 'multi' && "on")}
                    onClick={() => {
                      const val = registrationMode === 'single';
                      setRegistrationMode(val ? 'multi' : 'single');
                      if (val && multiPlates.length === 0) addMultiPlateRow();
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-red-500/10 hover:text-red-600 text-muted-foreground transition-colors" onClick={() => setPlateDialogOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="djati-tab-bar">
              <button type="button" className={cn("djati-tab-btn", activeTab === 'informations' && "active")} onClick={() => setActiveTab('informations')}>
                Informations
              </button>
              <button type="button" className={cn("djati-tab-btn", activeTab === 'prix' && "active")} onClick={() => setActiveTab('prix')}>
                Prix
              </button>
              <button type="button" className={cn("djati-tab-btn", activeTab === 'logistique' && "active")} onClick={() => setActiveTab('logistique')}>
                Logistique
              </button>
              <button type="button" className={cn("djati-tab-btn", activeTab === 'composition' && "active")} onClick={() => setActiveTab('composition')}>
                Composition
              </button>
            </div>

            <div className={cn("flex-1 overflow-hidden flex flex-row", registrationMode === 'multi' ? "p-0" : "p-6")}>
              {registrationMode === 'multi' && (
                <div className="w-[280px] flex-shrink-0 border-r bg-muted/5 overflow-y-auto p-4 space-y-3">
                  {multiPlates.map((item, index) => (
                    <div 
                      key={item.id} 
                      className={cn(
                        "p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between shadow-sm",
                        index === selectedMultiPlateIndex 
                          ? "border-primary bg-primary/5" 
                          : "border-transparent bg-white hover:border-primary/30"
                      )}
                      onClick={() => setSelectedMultiPlateIndex(index)}
                    >
                      <div className="flex flex-col flex-1 min-w-0 mr-2">
                        <span className="font-bold text-sm truncate text-foreground">
                          {item.name || `Nouveau Plat #${index + 1}`}
                        </span>
                        <span className="text-xs font-mono text-primary font-black mt-1">
                          {item.selling_price_detail > 0 ? `${item.selling_price_detail.toLocaleString()} F` : 'Prix non défini'}
                        </span>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" 
                        onClick={(e) => { e.stopPropagation(); removeMultiPlateRow(item.id); }}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    type="button" 
                    className="w-full mt-2 border-dashed border-2 border-primary/30 text-primary hover:bg-primary/5 font-semibold" 
                    onClick={addMultiPlateRow}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Ajouter un plat
                  </Button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 bg-white min-w-0">
                {(() => {
                  const activeData = registrationMode === 'single' ? singlePlateForm : multiPlates[selectedMultiPlateIndex];
                  if (!activeData) {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <UtensilsCrossed className="h-12 w-12 mb-4 opacity-20" />
                        <p>Aucun plat sélectionné</p>
                      </div>
                    );
                  }

                  return (
                    <div className="max-w-2xl mx-auto w-full h-full flex flex-col">
                      <div className={cn("space-y-4", activeTab === 'informations' ? "block" : "hidden")}>
                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Informations</h3>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom du Plat <span className="text-red-500">*</span></Label>
                          <Input
                            value={activeData.name}
                            onChange={e => updateActivePlate({ name: e.target.value })}
                            placeholder="Ex: Burger Maison"
                            className="h-10 border-gray-300 font-medium"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Image (Optionnel)</Label>
                          <ImageUpload
                            currentImageUrl={activeData.image_url}
                            onImageUploaded={(url) => updateActivePlate({ image_url: url })}
                            onImageRemoved={() => updateActivePlate({ image_url: '' })}
                            folder="inventory"
                          />
                        </div>
                      </div>

                      <div className={cn("space-y-4", activeTab === 'prix' ? "block" : "hidden")}>
                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Prix & Marges</h3>
                        <div className="space-y-2 pt-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-primary">Prix de Vente <span className="text-red-500">*</span></Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={activeData.selling_price_detail || ''}
                              onChange={e => updateActivePlate({ selling_price_detail: Number(e.target.value) })}
                              className="h-14 border-gray-300 font-black text-2xl pl-4 pr-12 text-primary bg-primary/5"
                              placeholder="0"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">F</span>
                          </div>
                        </div>
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mt-6">
                          <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Coût de revient estimé</div>
                          <div className="text-2xl font-black text-primary font-mono">{activeData.recipeCost.toLocaleString()} F CFA</div>
                          <div className="text-[10px] text-muted-foreground mt-1">Calculé automatiquement depuis la composition</div>
                        </div>
                      </div>

                      <div className={cn("space-y-4", activeTab === 'logistique' ? "block" : "hidden")}>
                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Logistique</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unité</Label>
                            <select 
                              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" 
                              value={activeData.unit_type} 
                              onChange={e => updateActivePlate({ unit_type: e.target.value })}
                            >
                              <option value="Pièce">Pièce (Assiette)</option>
                              <option value="Carton">Carton</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type de plat</Label>
                            <select 
                              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" 
                              value={activeData.course_type} 
                              onChange={e => updateActivePlate({ course_type: e.target.value })}
                            >
                              <option value="Starter">Entrée</option>
                              <option value="Main">Plat Principal</option>
                              <option value="Dessert">Dessert</option>
                              <option value="Drink">Boisson</option>
                              <option value="Side">Accompagnement</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Préparation (Min)</Label>
                            <Input 
                              type="number" 
                              value={activeData.prep_time_minutes} 
                              onChange={e => updateActivePlate({ prep_time_minutes: Number(e.target.value) })}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stock Actuel (Optionnel)</Label>
                            <Input 
                              type="number" 
                              value={activeData.quantity} 
                              onChange={e => updateActivePlate({ quantity: Number(e.target.value) })}
                              className="h-10"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 border rounded-xl mt-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold">Disponible à la vente</span>
                            <span className="text-xs text-muted-foreground">Activer pour la commande</span>
                          </div>
                          <div 
                            className={cn("djati-toggle", activeData.is_available && "on")} 
                            onClick={() => updateActivePlate({ is_available: !activeData.is_available })}
                          />
                        </div>
                      </div>

                      <div className={cn("flex-1 flex-col h-full min-h-[400px]", activeTab === 'composition' ? "flex" : "hidden")}>
                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Composition (Recette)</h3>
                        <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                          <RecipeBuilder
                            dishId={activeData._ui_pendingId}
                            storeId={storeId}
                            sellingPrice={activeData.selling_price_detail}
                            onChange={(items) => updateActivePlate({ recipeItems: items })}
                            onCostChange={(cost) => updateActivePlate({ recipeCost: cost })}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex-shrink-0 px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 z-10 relative">
              <Button variant="outline" className="h-11 px-6 font-bold" onClick={() => setPlateDialogOpen(false)} disabled={savingPlate}>
                Annuler
              </Button>
              <Button onClick={handleSavePlate} disabled={savingPlate} className="h-11 px-8 font-black bg-primary hover:bg-primary/90 text-white shadow-lg">
                {savingPlate ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : (registrationMode === 'multi' ? `Enregistrer ${multiPlates.length} plats` : 'Enregistrer le Plat')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
