// FILE: /Users/mohamedcoulibaly/MVP/Pro/retail-manager-restaurant/frontend/src/components/worker/Modules/IngredientsModule.tsx
// ACTION: CREATE (new file)
// TASK: 5 — full Ingrédients management module

import React, { useState, useEffect, useCallback } from 'react';
import {
  Package2,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Upload,
  AlertTriangle,
  TrendingDown,
  Layers,
  DollarSign,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { OfflineAuthService } from '@/services/OfflineAuthService';

// ─── Types ────────────────────────────────────────────────────────────────────

type IngredientUnit = 'g' | 'kg' | 'ml' | 'L' | 'pcs';
type IngredientCategory = 'perishable' | 'dry' | 'liquid' | 'condiment';

interface Ingredient {
  id: string;
  store_id: string;
  name: string;
  unit: IngredientUnit;
  category: IngredientCategory;
  current_stock: number;
  min_threshold: number;
  cost_per_unit: number;
  created_at?: string;
  updated_at?: string;
}

interface IngredientFormData {
  name: string;
  unit: IngredientUnit;
  category: IngredientCategory;
  current_stock: number;
  min_threshold: number;
  cost_per_unit: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<IngredientUnit, string> = {
  g: 'Grammes (g)',
  kg: 'Kilogrammes (kg)',
  ml: 'Millilitres (ml)',
  L: 'Litres (L)',
  pcs: 'Pièces (pcs)',
};

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  perishable: 'Périssable',
  dry: 'Épicerie Sèche',
  liquid: 'Liquide',
  condiment: 'Condiment',
};

const CATEGORY_PILL_CLS: Record<IngredientCategory, string> = {
  perishable:
    'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  dry: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  liquid: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
  condiment:
    'bg-purple-500/15 text-purple-400 border border-purple-500/30',
};

const DEFAULT_FORM: IngredientFormData = {
  name: '',
  unit: 'g',
  category: 'perishable',
  current_stock: 0,
  min_threshold: 0,
  cost_per_unit: 0,
};

// ─── Stock badge helper ───────────────────────────────────────────────────────

function stockBadge(ing: Ingredient): { label: string; cls: string } {
  if (ing.current_stock <= 0)
    return {
      label: 'Rupture',
      cls: 'bg-red-500/15 text-red-400 border border-red-500/30',
    };
  if (ing.current_stock < ing.min_threshold)
    return {
      label: 'Faible',
      cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    };
  return {
    label: 'OK',
    cls: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',
  };
}

// ─── Label component shared ───────────────────────────────────────────────────

const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean }> = ({
  children,
  required,
}) => (
  <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
    {children}
    {required && <span className="text-primary ml-0.5">*</span>}
  </label>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface IngredientsModuleProps {
  storeId: string;
}

export function IngredientsModule({ storeId }: IngredientsModuleProps) {

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<IngredientCategory | 'all'>('all');

  // Dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [form, setForm] = useState<IngredientFormData>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchIngredients = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await OfflineAuthService.localBridgeRequest<Ingredient[]>(
        `/rest/v1/ingredients?store_id=${storeId}`,
        { method: 'GET' },
      );
      setIngredients(data ?? []);
    } catch {
      toast({
        title: 'Erreur de chargement',
        description: 'Impossible de récupérer les ingrédients.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  // ── Dialog helpers ─────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingItem(null);
    setForm(DEFAULT_FORM);
    setIsDialogOpen(true);
  };

  const openEdit = (ing: Ingredient) => {
    setEditingItem(ing);
    setForm({
      name: ing.name,
      unit: ing.unit,
      category: ing.category,
      current_stock: ing.current_stock,
      min_threshold: ing.min_threshold,
      cost_per_unit: ing.cost_per_unit,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setForm(DEFAULT_FORM);
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({
        title: 'Champ requis',
        description: 'Le nom de l\'ingrédient est obligatoire.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      if (editingItem) {
        await OfflineAuthService.localBridgeRequest<Ingredient>(
          `/rest/v1/ingredients/${editingItem.id}`,
          { method: 'PATCH', body: JSON.stringify(form) },
        );
        toast({ title: '✓ Modifié', description: `"${form.name}" mis à jour.` });
      } else {
        await OfflineAuthService.localBridgeRequest<Ingredient>(
          `/rest/v1/ingredients`,
          {
            method: 'POST',
            body: JSON.stringify({ store_id: storeId, ...form }),
          },
        );
        toast({ title: '✓ Ajouté', description: `"${form.name}" enregistré.` });
      }
      closeDialog();
      fetchIngredients();
    } catch {
      toast({
        title: 'Erreur',
        description: 'L\'opération a échoué. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ing: Ingredient) => {
    if (!window.confirm(`Supprimer définitivement "${ing.name}" ?`)) return;
    try {
      await OfflineAuthService.localBridgeRequest<void>(
        `/rest/v1/ingredients/${ing.id}`,
        { method: 'DELETE' },
      );
      toast({ title: '✓ Supprimé', description: `"${ing.name}" supprimé.` });
      fetchIngredients();
    } catch {
      toast({
        title: 'Erreur',
        description: 'Suppression impossible.',
        variant: 'destructive',
      });
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalValue = ingredients.reduce(
    (sum, ing) => sum + ing.current_stock * ing.cost_per_unit,
    0,
  );
  const lowStockCount = ingredients.filter(
    (ing) => ing.current_stock > 0 && ing.current_stock < ing.min_threshold,
  ).length;
  const outOfStockCount = ingredients.filter(
    (ing) => ing.current_stock <= 0,
  ).length;

  const filtered = ingredients.filter((ing) => {
    const matchesSearch = ing.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCat =
      categoryFilter === 'all' || ing.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 min-h-full">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Package2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase text-foreground">
              Gestion des Ingrédients
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Suivez vos stocks en temps réel, gérez les fiches de composition de vos plats et anticipez les ruptures.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchIngredients}
            title="Rafraîchir"
            className="h-9 w-9 flex items-center justify-center rounded-md border border-border hover:bg-accent transition-colors text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="h-9 flex items-center gap-2 px-3 rounded-md border border-border text-xs font-semibold hover:bg-accent transition-colors text-muted-foreground">
            <Upload className="h-3.5 w-3.5" />
            Importer CSV
          </button>
          <button
            onClick={openAdd}
            className="h-9 flex items-center gap-2 px-4 rounded-md bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter un Ingrédient
          </button>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Ingrédients',
            value: ingredients.length,
            color: 'text-foreground',
            icon: <Layers className="h-4 w-4 text-muted-foreground" />,
          },
          {
            label: 'Stocks Faibles',
            value: lowStockCount,
            color: 'text-orange-400',
            icon: <TrendingDown className="h-4 w-4 text-orange-400/60" />,
          },
          {
            label: 'Périmés (3J)',
            value: outOfStockCount,
            color: 'text-red-400',
            icon: <AlertTriangle className="h-4 w-4 text-red-400/60" />,
          },
          {
            label: 'Valeur du Stock',
            value: `${totalValue.toLocaleString('fr-FR')} F`,
            color: 'text-primary',
            large: true,
            icon: <DollarSign className="h-4 w-4 text-primary/60" />,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              {s.icon}
            </div>
            <p className={`font-black ${s.large ? 'text-2xl' : 'text-3xl'} ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Ingredients table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Table toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Liste des Ingrédients
          </p>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-9 pr-3 rounded-md border border-border bg-background text-xs text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground w-44"
              />
            </div>
            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as IngredientCategory | 'all')
              }
              className="h-8 px-2 rounded-md border border-border bg-background text-xs text-foreground outline-none focus:border-primary transition-colors cursor-pointer appearance-none pr-6"
            >
              <option value="all">Toutes</option>
              {(Object.entries(CATEGORY_LABELS) as [IngredientCategory, string][]).map(
                ([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Package2 className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">Aucun ingrédient trouvé.</p>
            {ingredients.length === 0 && (
              <button
                onClick={openAdd}
                className="mt-3 text-xs text-primary hover:underline"
              >
                + Ajouter votre premier ingrédient
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    '#',
                    'Nom',
                    'Catégorie',
                    'Stock Actuel',
                    'Seuil Min',
                    'Coût/U',
                    'Statut',
                    'Actions',
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((ing, idx) => {
                  const badge = stockBadge(ing);
                  return (
                    <tr
                      key={ing.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {ing.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                            CATEGORY_PILL_CLS[ing.category] ??
                            'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {CATEGORY_LABELS[ing.category] ?? ing.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {ing.current_stock}{' '}
                        <span className="text-muted-foreground text-xs">
                          {ing.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                        {ing.min_threshold}{' '}
                        <span className="text-xs">{ing.unit}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {ing.cost_per_unit.toLocaleString('fr-FR')}{' '}
                        <span className="text-muted-foreground text-xs">F</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(ing)}
                            title="Modifier"
                            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-primary/10 text-primary transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(ing)}
                            title="Supprimer"
                            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-red-500/10 text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Dialog ── */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Dialog header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Package2 className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  {editingItem ? "Modifier l'Ingrédient" : 'Ajouter un Ingrédient'}
                </h2>
              </div>
              <button
                onClick={closeDialog}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground text-lg leading-none transition-colors"
              >
                ×
              </button>
            </div>

            {/* Dialog body */}
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <FieldLabel required>Nom de l'Ingrédient</FieldLabel>
                <input
                  type="text"
                  placeholder="ex: Steak Haché, Sauce Tomate"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
                />
              </div>

              {/* Unit + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel required>Unité de Mesure</FieldLabel>
                  <select
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        unit: e.target.value as IngredientUnit,
                      }))
                    }
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                  >
                    {(
                      Object.entries(UNIT_LABELS) as [IngredientUnit, string][]
                    ).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel required>Catégorie</FieldLabel>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        category: e.target.value as IngredientCategory,
                      }))
                    }
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                  >
                    {(
                      Object.entries(CATEGORY_LABELS) as [
                        IngredientCategory,
                        string,
                      ][]
                    ).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stock Initial + Seuil */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Stock Initial</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.current_stock}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        current_stock: Number(e.target.value),
                      }))
                    }
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <FieldLabel>Seuil d'Alerte Minimum</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.min_threshold}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        min_threshold: Number(e.target.value),
                      }))
                    }
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* Cost */}
              <div>
                <FieldLabel required>Coût Unitaire (CFA)</FieldLabel>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={form.cost_per_unit}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        cost_per_unit: Number(e.target.value),
                      }))
                    }
                    className="w-full h-10 rounded-lg border border-border bg-background px-3 pr-8 text-sm text-foreground outline-none focus:border-primary transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    F
                  </span>
                </div>
              </div>
            </div>

            {/* Dialog footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-muted/20">
              <button
                onClick={closeDialog}
                className="h-9 px-4 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="h-9 px-6 rounded-md bg-primary text-primary-foreground text-sm font-bold uppercase tracking-wide hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


