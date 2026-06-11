import { useState, useEffect, useCallback } from 'react';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  FlaskConical,
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react';

interface Ingredient {
  id: string;
  store_id: string;
  name: string;
  unit: 'g' | 'kg' | 'ml' | 'L' | 'pcs';
  category: 'perishable' | 'dry' | 'liquid' | 'condiment';
  current_stock: number;
  min_threshold: number;
  cost_per_unit: number;
  created_at?: string;
  updated_at?: string;
}

type IngredientForm = Omit<Ingredient, 'id' | 'store_id' | 'created_at' | 'updated_at'>;

const defaultForm: IngredientForm = {
  name: '',
  unit: 'g',
  category: 'perishable',
  current_stock: 0,
  min_threshold: 0,
  cost_per_unit: 0,
};

const categoryLabels: Record<string, string> = {
  perishable: 'Périssable',
  dry: 'Épicerie Sèche',
  liquid: 'Liquide',
  condiment: 'Condiment',
};

interface IngredientsModuleProps {
  storeId: string;
}

export function IngredientsModule({ storeId }: IngredientsModuleProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IngredientForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await OfflineAuthService.localBridgeRequest<Ingredient[]>(
        `/rest/v1/ingredients?store_id=${storeId}`,
        { method: 'GET' }
      );
      setIngredients(res || []);
    } catch (err) {
      console.error('[IngredientsModule] load error:', err);
      toast({ title: 'Erreur de chargement', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = ingredients.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (ing: Ingredient) => {
    setEditingId(ing.id);
    setForm({
      name: ing.name,
      unit: ing.unit,
      category: ing.category,
      current_stock: ing.current_stock,
      min_threshold: ing.min_threshold,
      cost_per_unit: ing.cost_per_unit,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Le nom est requis', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await OfflineAuthService.localBridgeRequest<Ingredient>(
          `/rest/v1/ingredients/${editingId}`,
          { method: 'PATCH', body: JSON.stringify(form) }
        );
        toast({ title: '✅ Ingrédient mis à jour' });
      } else {
        await OfflineAuthService.localBridgeRequest<Ingredient>(
          '/rest/v1/ingredients',
          { method: 'POST', body: JSON.stringify({ store_id: storeId, ...form }) }
        );
        toast({ title: '✅ Ingrédient créé' });
      }
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: err.message || 'Erreur lors de la sauvegarde', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer l'ingrédient "${name}" ? Cette action est irréversible.`)) return;
    setDeletingId(id);
    try {
      await OfflineAuthService.localBridgeRequest(
        `/rest/v1/ingredients/${id}`,
        { method: 'DELETE' }
      );
      toast({ title: `🗑️ "${name}" supprimé` });
      setIngredients(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      toast({ title: err.message || 'Erreur de suppression', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const getStockBadge = (ing: Ingredient) => {
    if (ing.current_stock <= 0) {
      return (
        <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 gap-1 text-[10px]">
          <AlertTriangle className="h-2.5 w-2.5" /> Rupture
        </Badge>
      );
    }
    if (ing.current_stock < ing.min_threshold) {
      return (
        <Badge className="bg-orange-500/15 text-orange-400 border border-orange-500/30 gap-1 text-[10px]">
          <TrendingDown className="h-2.5 w-2.5" /> Faible
        </Badge>
      );
    }
    return (
      <Badge className="bg-teal-500/15 text-teal-400 border border-teal-500/30 gap-1 text-[10px]">
        <CheckCircle2 className="h-2.5 w-2.5" /> OK
      </Badge>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Ingrédients
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gérez vos matières premières et consommables
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2"
        >
          <Plus className="h-4 w-4" />
          Ajouter un Ingrédient
        </Button>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Rechercher un ingrédient..."
          className="pl-9 h-9 bg-card border-border/60"
        />
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">Chargement...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            <FlaskConical className="h-10 w-10 opacity-20" />
            <p className="text-sm">Aucun ingrédient trouvé</p>
            {!searchQuery && (
              <Button variant="outline" size="sm" onClick={openAdd} className="mt-1 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Créer le premier ingrédient
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="p-3">Nom</th>
                  <th className="p-3">Unité</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3">Stock Actuel</th>
                  <th className="p-3">Seuil Min</th>
                  <th className="p-3">Coût/Unité</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ing => (
                  <tr key={ing.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-bold text-sm text-foreground">{ing.name}</td>
                    <td className="p-3 text-xs font-mono font-bold text-primary">{ing.unit}</td>
                    <td className="p-3 text-xs text-muted-foreground">{categoryLabels[ing.category] || ing.category}</td>
                    <td className="p-3 text-sm font-mono font-bold">
                      {ing.current_stock} <span className="text-muted-foreground text-[10px]">{ing.unit}</span>
                    </td>
                    <td className="p-3 text-sm font-mono text-muted-foreground">
                      {ing.min_threshold} <span className="text-[10px]">{ing.unit}</span>
                    </td>
                    <td className="p-3 text-sm font-mono font-bold">
                      {ing.cost_per_unit.toLocaleString()} <span className="text-[10px] text-muted-foreground">F/{ing.unit}</span>
                    </td>
                    <td className="p-3">{getStockBadge(ing)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => openEdit(ing)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          disabled={deletingId === ing.id}
                          onClick={() => handleDelete(ing.id, ing.name)}
                        >
                          {deletingId === ing.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Stats footer ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
        <span>{ingredients.length} ingrédients au total</span>
        <span>•</span>
        <span className="text-red-400">
          {ingredients.filter(i => i.current_stock <= 0).length} en rupture
        </span>
        <span>•</span>
        <span className="text-orange-400">
          {ingredients.filter(i => i.current_stock > 0 && i.current_stock < i.min_threshold).length} en stock faible
        </span>
      </div>

      {/* ── Add / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              {editingId ? "Modifier l'ingrédient" : 'Nouvel ingrédient'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Nom *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Farine de blé"
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Unité</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v as any }))}>
                  <SelectTrigger className="h-9">
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

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as any }))}>
                  <SelectTrigger className="h-9">
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
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Stock Initial</Label>
                <Input
                  type="number"
                  value={form.current_stock || ''}
                  onChange={e => setForm(f => ({ ...f, current_stock: Number(e.target.value) }))}
                  className="h-9 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Seuil Min</Label>
                <Input
                  type="number"
                  value={form.min_threshold || ''}
                  onChange={e => setForm(f => ({ ...f, min_threshold: Number(e.target.value) }))}
                  className="h-9 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Coût (CFA)</Label>
                <Input
                  type="number"
                  value={form.cost_per_unit || ''}
                  onChange={e => setForm(f => ({ ...f, cost_per_unit: Number(e.target.value) }))}
                  className="h-9 font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-xs">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground font-bold text-xs gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
