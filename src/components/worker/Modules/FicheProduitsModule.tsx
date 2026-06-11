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
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getDataClient } from '@/lib/dataClient';

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

export function FicheProduitsModule({ storeId }: FicheProduitsModuleProps) {
  const { t, i18n } = useTranslation();
  const [allItems, setAllItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Pack state
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [packForm, setPackForm] = useState<PackForm>(defaultPackForm);
  const [savingPack, setSavingPack] = useState(false);
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
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="pl-8 h-8 text-xs bg-card border-border/60"
            />
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
        <DialogContent className="max-w-md bg-card border-border">
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

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">URL Image (optionnel)</Label>
              <Input
                value={packForm.image_url}
                onChange={e => setPackForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="https://..."
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                Plats inclus ({packForm.selected_items.length} sélectionné{packForm.selected_items.length !== 1 ? 's' : ''})
              </Label>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-border/50 bg-muted/20">
                {menuItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">Aucun plat disponible</p>
                ) : (
                  menuItems.map(item => {
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
    </div>
  );
}
