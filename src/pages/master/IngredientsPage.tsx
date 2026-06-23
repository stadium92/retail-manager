import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Package, Search, Plus, Trash2, Edit3, AlertTriangle, History,
  TrendingUp, RefreshCw, FileSpreadsheet, ArrowLeftRight, FlameKindling
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { Ingredient, StockDashboard } from '@/types/ingredients';
import { PortionsGauge } from '@/components/stock/PortionsGauge';
import { PerishableAlertCard } from '@/components/stock/PerishableAlertCard';
import { toast } from 'sonner';

// ─── Movement type helpers ────────────────────────────────────────────────────
interface IngredientMovement {
  id: string;
  ingredient_id: string;
  movement_type: 'deduction' | 'restock' | 'waste' | 'adjustment';
  quantity_delta: number;
  related_dish_id?: string | null;
  order_id?: string | null;
  dish_name?: string | null;
  note?: string | null;
  created_at: string;
}

const movementTypeLabel: Record<IngredientMovement['movement_type'], { label: string; color: string }> = {
  deduction: { label: 'Déduction vente', color: 'bg-blue-500' },
  restock:   { label: 'Réappro.',         color: 'bg-emerald-500' },
  waste:     { label: 'Déchet',           color: 'bg-red-500' },
  adjustment:{ label: 'Ajustement',       color: 'bg-amber-500' },
};
// ─────────────────────────────────────────────────────────────────────────────

export function IngredientsPage() {
  const { t } = useTranslation();
  const { selectedStoreIds } = useMasterDashboardStore();
  const { stores, setStores } = useMasterDataStore();
  const [localStoreId, setLocalStoreId] = useState<string>('');

  // Load stores on mount if empty
  useEffect(() => {
    const loadStores = async () => {
      if (stores.length === 0) {
        console.log('[IngredientsPage] Stores empty in store, loading via OfflineStoreService...');
        try {
          const res = await OfflineStoreService.getStores({ notify: false });
          if (res.data) {
            console.log('[IngredientsPage] Loaded stores successfully:', res.data.length);
            setStores(res.data);
          }
        } catch (error) {
          console.error('[IngredientsPage] Failed to load stores:', error);
        }
      }
    };
    loadStores();
  }, [stores, setStores]);

  useEffect(() => {
    console.log('[IngredientsPage] selectedStoreIds changed:', selectedStoreIds, 'stores count:', stores.length);
    if (stores.length > 0) {
      const validSelectedIds = selectedStoreIds.filter(id => stores.some(s => s.id === id));
      if (validSelectedIds.length === 1) {
        setLocalStoreId(validSelectedIds[0]);
      } else {
        if (!localStoreId || !stores.some(s => s.id === localStoreId)) {
          setLocalStoreId(stores[0].id);
        }
      }
    }
  }, [selectedStoreIds, stores, localStoreId]);

  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<StockDashboard>({
    ingredients: [],
    portions_remaining: [],
    expiring_soon: [],
    low_stock: [],
  });

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Ingredient Form Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    unit: 'g' as 'g' | 'kg' | 'ml' | 'L' | 'pcs',
    category: 'perishable' as 'perishable' | 'dry' | 'liquid' | 'condiment',
    current_stock: 0,
    min_threshold: 0,
    cost_per_unit: 0,
    expiry_date: '',
  });
  const [saving, setSaving] = useState(false);

  // Restock Modal
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Ingredient | null>(null);
  const [restockQty, setRestockQty] = useState(0);
  const [restockNote, setRestockNote] = useState('');
  const [restocking, setRestocking] = useState(false);

  // Waste Modal
  const [isWasteOpen, setIsWasteOpen] = useState(false);
  const [wasteTarget, setWasteTarget] = useState<Ingredient | null>(null);
  const [wasteQty, setWasteQty] = useState(0);
  const [wasteNote, setWasteNote] = useState('');
  const [loggingWaste, setLoggingWaste] = useState(false);

  // Movements History Modal
  const [isMovementsOpen, setIsMovementsOpen] = useState(false);
  const [movementsTarget, setMovementsTarget] = useState<Ingredient | null>(null);
  const [movements, setMovements] = useState<IngredientMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const fetchDashboard = async () => {
    console.log('[IngredientsPage] fetchDashboard executing for store:', localStoreId);
    if (!localStoreId) {
      console.warn('[IngredientsPage] No localStoreId resolved, skipping fetch');
      return;
    }
    setLoading(true);
    try {
      const res = await OfflineAuthService.localBridgeRequest<StockDashboard>(
        `/rest/v1/stock/dashboard?store_id=${localStoreId}`,
        { method: 'GET' }
      );
      console.log('[IngredientsPage] fetchDashboard response ingredients:', res?.ingredients?.length || 0);
      if (res) setDashboardData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      toast.error('Erreur de chargement du tableau de bord');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [localStoreId]);

  // Total stock value
  const stockValue = useMemo(() => {
    return dashboardData.ingredients.reduce((sum, ing) => sum + (ing.current_stock * ing.cost_per_unit), 0);
  }, [dashboardData.ingredients]);

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return dashboardData.ingredients.filter(ing => {
      const matchesSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || ing.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [dashboardData.ingredients, searchQuery, categoryFilter]);

  // Open create/edit modal
  const handleOpenForm = (ing: Ingredient | null = null) => {
    if (ing) {
      setEditingIngredient(ing);
      setFormState({
        name: ing.name,
        unit: ing.unit,
        category: ing.category,
        current_stock: ing.current_stock,
        min_threshold: ing.min_threshold,
        cost_per_unit: ing.cost_per_unit,
        expiry_date: ing.expiry_date ? ing.expiry_date.split('T')[0] : '',
      });
    } else {
      setEditingIngredient(null);
      setFormState({
        name: '',
        unit: 'g',
        category: 'perishable',
        current_stock: 0,
        min_threshold: 0,
        cost_per_unit: 0,
        expiry_date: '',
      });
    }
    setIsFormOpen(true);
  };

  // Submit ingredient form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localStoreId) return;

    setSaving(true);
    try {
      const payload = {
        ...formState,
        store_id: localStoreId,
        expiry_date: formState.expiry_date || null,
      };

      if (editingIngredient) {
        await OfflineAuthService.localBridgeRequest<Ingredient>(
          `/rest/v1/ingredients/${editingIngredient.id}`,
          { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        toast.success('Ingrédient mis à jour avec succès');
      } else {
        await OfflineAuthService.localBridgeRequest<Ingredient>(
          '/rest/v1/ingredients',
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        toast.success('Ingrédient créé avec succès');
      }
      setIsFormOpen(false);
      fetchDashboard();
    } catch (err) {
      console.error('Save ingredient error:', err);
      toast.error('Une erreur est survenue lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // Delete ingredient
  const handleDeleteIngredient = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet ingrédient ? Cela supprimera également ses liaisons de recette.')) return;
    try {
      await OfflineAuthService.localBridgeRequest(`/rest/v1/ingredients/${id}`, { method: 'DELETE' });
      toast.success('Ingrédient supprimé');
      fetchDashboard();
    } catch (err) {
      console.error('Delete ingredient error:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Open restock modal
  const handleOpenRestock = (ing: Ingredient) => {
    setRestockTarget(ing);
    setRestockQty(0);
    setRestockNote('');
    setIsRestockOpen(true);
  };

  // Submit Restock
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget || restockQty <= 0) return;
    setRestocking(true);
    try {
      await OfflineAuthService.localBridgeRequest(
        `/rest/v1/ingredients/${restockTarget.id}/restock`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: restockQty, note: restockNote || undefined }) }
      );
      toast.success('Réapprovisionnement enregistré');
      setIsRestockOpen(false);
      fetchDashboard();
    } catch (err) {
      console.error('Restock error:', err);
      toast.error('Erreur de réapprovisionnement');
    } finally {
      setRestocking(false);
    }
  };

  // Open waste modal
  const handleOpenWaste = (ing: Ingredient) => {
    setWasteTarget(ing);
    setWasteQty(0);
    setWasteNote('');
    setIsWasteOpen(true);
  };

  // Submit Waste
  const handleWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteTarget || wasteQty <= 0) return;
    setLoggingWaste(true);
    try {
      await OfflineAuthService.localBridgeRequest(
        `/rest/v1/ingredients/${wasteTarget.id}/waste`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: wasteQty, note: wasteNote || undefined }) }
      );
      toast.success(`Déchet enregistré : -${wasteQty} ${wasteTarget.unit}`);
      setIsWasteOpen(false);
      fetchDashboard();
    } catch (err) {
      console.error('Waste log error:', err);
      toast.error('Erreur lors de l\'enregistrement du déchet');
    } finally {
      setLoggingWaste(false);
    }
  };

  // Open movements history modal and fetch
  const handleOpenMovements = async (ing: Ingredient) => {
    setMovementsTarget(ing);
    setMovements([]);
    setIsMovementsOpen(true);
    setLoadingMovements(true);
    try {
      const res = await OfflineAuthService.localBridgeRequest<IngredientMovement[]>(
        `/rest/v1/ingredients/${ing.id}/movements?limit=100`,
        { method: 'GET' }
      );
      setMovements(res ?? []);
    } catch (err) {
      console.error('Movements fetch error:', err);
      toast.error('Impossible de charger l\'historique');
    } finally {
      setLoadingMovements(false);
    }
  };

  // Import CSV placeholder
  const handleCSVImport = () => {
    toast.info('Fonctionnalité d\'importation CSV bientôt disponible');
  };

  const getStatusBadge = (ing: Ingredient) => {
    const stock = ing.current_stock;
    const threshold = ing.min_threshold;
    if (stock <= 0)         return <Badge className="bg-red-500 text-white border-none font-bold text-[9px] tracking-wider">RUPTURE</Badge>;
    if (stock < threshold)  return <Badge className="bg-amber-500 text-white border-none font-bold text-[9px] tracking-wider">FAIBLE</Badge>;
    return <Badge variant="outline" className="text-gray-500 border-gray-200 font-bold text-[9px] tracking-wider">🟢 OK</Badge>;
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'perishable':  return <Badge className="bg-orange-500 text-white border-none text-[8px] uppercase tracking-widest font-black">Périssable</Badge>;
      case 'dry':         return <Badge className="bg-blue-500 text-white border-none text-[8px] uppercase tracking-widest font-black">Épicerie</Badge>;
      case 'liquid':      return <Badge className="bg-cyan-500 text-white border-none text-[8px] uppercase tracking-widest font-black">Liquide</Badge>;
      case 'condiment':   return <Badge className="bg-purple-500 text-white border-none text-[8px] uppercase tracking-widest font-black">Condiment</Badge>;
      default:            return <Badge variant="outline">{category}</Badge>;
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6 bg-background">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            Gestion des Ingrédients
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivez vos stocks en temps réel, gérez les fiches de composition de vos plats et anticipez les ruptures.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selectedStoreIds.length !== 1 && stores.length > 1 && (
            <Select value={localStoreId} onValueChange={setLocalStoreId}>
              <SelectTrigger className="w-56 h-10 border-2 font-bold uppercase text-[10px] tracking-wider bg-card">
                <SelectValue placeholder="Choisir un restaurant" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={handleCSVImport} className="h-10 uppercase font-black text-[10px] tracking-wider gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Importer CSV
          </Button>
          <Button variant="outline" onClick={fetchDashboard} className="h-10 px-3 border-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => handleOpenForm()} className="h-10 px-6 bg-primary text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 gap-2">
            <Plus className="h-4 w-4" /> Ajouter un ingrédient
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 shadow-sm bg-card hover:border-primary/20 transition-all">
          <CardContent className="p-5 flex flex-col justify-between h-[110px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Ingrédients</span>
            <span className="text-3xl font-black text-foreground font-mono">{dashboardData.ingredients.length}</span>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-sm bg-card hover:border-amber-500/20 transition-all">
          <CardContent className="p-5 flex flex-col justify-between h-[110px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stocks Faibles</span>
            <span className="text-3xl font-black text-amber-500 font-mono">{dashboardData.low_stock.length}</span>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-sm bg-card hover:border-red-500/20 transition-all">
          <CardContent className="p-5 flex flex-col justify-between h-[110px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Périmés (3j)</span>
            <span className="text-3xl font-black text-red-500 font-mono">{dashboardData.expiring_soon.length}</span>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-sm bg-card hover:border-teal/20 transition-all">
          <CardContent className="p-5 flex flex-col justify-between h-[110px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valeur du Stock</span>
            <span className="text-3xl font-black text-teal font-mono">{stockValue.toLocaleString()} F</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Main Content: Gauges & Table */}
        <div className="xl:col-span-2 space-y-6">
          {/* Portions gauge table */}
          <Card className="border-2 shadow-sm">
            <CardHeader className="border-b bg-muted/10 py-4 px-6">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Portions Restantes par Plat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {dashboardData.portions_remaining.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-4">
                  Aucune fiche technique de composition définie.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[280px] overflow-y-auto">
                  {dashboardData.portions_remaining.map(item => (
                    <PortionsGauge
                      key={item.dish_id}
                      dishName={item.dish_name}
                      maxPortions={item.max_portions}
                      limitingIngredient={item.limiting_ingredient}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ingredients Listing Table */}
          <Card className="border-2 shadow-sm">
            <CardHeader className="border-b bg-muted/10 py-4 px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Liste des Ingrédients
              </CardTitle>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 border-none bg-muted/30 font-bold uppercase text-[10px] tracking-widest"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-36 h-9 border-none bg-muted/30 font-bold uppercase text-[10px] tracking-wider">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="perishable">Périssables</SelectItem>
                    <SelectItem value="dry">Épicerie</SelectItem>
                    <SelectItem value="liquid">Liquides</SelectItem>
                    <SelectItem value="condiment">Condiments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto max-h-[450px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 border-b">
                  <TableRow>
                    <TableHead className="w-12 text-center text-[9px] font-black uppercase tracking-widest">#</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Nom</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Catégorie</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Stock Actuel</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Seuil Min</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Coût/U</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Péremption</TableHead>
                    <TableHead className="text-center text-[9px] font-black uppercase tracking-widest">Statut</TableHead>
                    <TableHead className="text-center text-[9px] font-black uppercase tracking-widest">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIngredients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                        Aucun ingrédient trouvé.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredIngredients.map((ing, i) => (
                      <TableRow key={ing.id} className="group hover:bg-muted/20 border-b">
                        <TableCell className="text-center text-muted-foreground text-xs font-mono font-bold">{i + 1}</TableCell>
                        <TableCell className="font-bold text-foreground text-sm">{ing.name}</TableCell>
                        <TableCell>{getCategoryBadge(ing.category)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-sm text-foreground">{ing.current_stock} {ing.unit}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground text-xs">{ing.min_threshold} {ing.unit}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-teal">{ing.cost_per_unit.toLocaleString()} F</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ing.expiry_date ? new Date(ing.expiry_date).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-center">{getStatusBadge(ing)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Restock */}
                            <Button variant="outline" size="icon" onClick={() => handleOpenRestock(ing)} className="h-8 w-8 text-teal border-teal/20 hover:bg-teal hover:text-white" title="Réapprovisionner">
                              <ArrowLeftRight className="h-4 w-4" />
                            </Button>
                            {/* Log Waste */}
                            <Button variant="outline" size="icon" onClick={() => handleOpenWaste(ing)} className="h-8 w-8 text-red-500 border-red-200 hover:bg-red-500 hover:text-white" title="Déclarer un déchet">
                              <FlameKindling className="h-4 w-4" />
                            </Button>
                            {/* History */}
                            <Button variant="outline" size="icon" onClick={() => handleOpenMovements(ing)} className="h-8 w-8 text-purple-500 border-purple-200 hover:bg-purple-500 hover:text-white" title="Historique des mouvements">
                              <History className="h-4 w-4" />
                            </Button>
                            {/* Edit */}
                            <Button variant="outline" size="icon" onClick={() => handleOpenForm(ing)} className="h-8 w-8 border-primary/20 hover:bg-primary hover:text-white" title="Modifier">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            {/* Delete */}
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteIngredient(ing.id)} className="h-8 w-8 text-red-500 hover:bg-red-500/10" title="Supprimer">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Expiring Side Panel */}
        <div className="space-y-6">
          <Card className="border-2 shadow-sm">
            <CardHeader className="border-b bg-muted/10 py-4 px-6 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Alertes Péremption
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {dashboardData.expiring_soon.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-4">
                  Aucune alerte de péremption imminente.
                </div>
              ) : (
                dashboardData.expiring_soon.map(ing => (
                  <PerishableAlertCard
                    key={ing.id}
                    ingredientName={ing.name}
                    expiryDate={ing.expiry_date}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── CREATE / EDIT INGREDIENT DIALOG ─────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-[500px] border-4 border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              {editingIngredient ? 'Modifier l\'ingrédient' : 'Ajouter un ingrédient'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-black uppercase">Nom de l'ingrédient *</Label>
                <Input required value={formState.name} onChange={e => setFormState({ ...formState, name: e.target.value })} placeholder="ex: Steak Haché, Sauce Tomate" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase">Unité de mesure *</Label>
                <Select value={formState.unit} onValueChange={v => setFormState({ ...formState, unit: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Label className="text-xs font-black uppercase">Catégorie *</Label>
                <Select value={formState.category} onValueChange={v => setFormState({ ...formState, category: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="perishable">Périssable</SelectItem>
                    <SelectItem value="dry">Épicerie Sèche</SelectItem>
                    <SelectItem value="liquid">Liquide</SelectItem>
                    <SelectItem value="condiment">Condiment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase">Stock Initial</Label>
                <Input type="number" step="any" value={formState.current_stock} onChange={e => setFormState({ ...formState, current_stock: Number(e.target.value) })} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase">Seuil d'alerte minimum</Label>
                <Input type="number" step="any" value={formState.min_threshold} onChange={e => setFormState({ ...formState, min_threshold: Number(e.target.value) })} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase">Coût unitaire (CFA) *</Label>
                <Input type="number" required value={formState.cost_per_unit} onChange={e => setFormState({ ...formState, cost_per_unit: Number(e.target.value) })} className="font-mono font-bold" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase">Date de Péremption</Label>
                <Input type="date" value={formState.expiry_date} onChange={e => setFormState({ ...formState, expiry_date: e.target.value })} />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saving} className="bg-primary text-white font-black uppercase tracking-widest text-[10px]">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── RESTOCK DIALOG ────────────────────────────────────────────────────── */}
      <Dialog open={isRestockOpen} onOpenChange={setIsRestockOpen}>
        <DialogContent className="max-w-[400px] border-4 border-teal/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6 text-teal" />
              Réapprovisionner Stock
            </DialogTitle>
          </DialogHeader>

          {restockTarget && (
            <form onSubmit={handleRestockSubmit} className="space-y-4 pt-2">
              <div className="bg-muted/20 p-3 rounded-xl border border-muted-foreground/10 flex justify-between items-center text-xs">
                <span className="font-bold text-foreground">{restockTarget.name}</span>
                <span className="font-mono text-muted-foreground font-bold">Stock actuel : {restockTarget.current_stock} {restockTarget.unit}</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase">Quantité à ajouter ({restockTarget.unit}) *</Label>
                <Input
                  type="number" step="any" required
                  value={restockQty || ''}
                  onChange={e => setRestockQty(Number(e.target.value))}
                  className="font-mono text-lg font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase">Note / Commentaire</Label>
                <Input placeholder="ex: Livraison fournisseur, ajustement" value={restockNote} onChange={e => setRestockNote(e.target.value)} />
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsRestockOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={restocking} className="bg-teal text-white font-black uppercase tracking-widest text-[10px]">
                  {restocking ? 'Chargement...' : 'Confirmer'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── WASTE DIALOG ──────────────────────────────────────────────────────── */}
      <Dialog open={isWasteOpen} onOpenChange={setIsWasteOpen}>
        <DialogContent className="max-w-[400px] border-4 border-red-300/40">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <FlameKindling className="h-6 w-6 text-red-500" />
              Déclarer un Déchet / Perte
            </DialogTitle>
          </DialogHeader>

          {wasteTarget && (
            <form onSubmit={handleWasteSubmit} className="space-y-4 pt-2">
              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-200/40 flex justify-between items-center text-xs">
                <span className="font-bold text-foreground">{wasteTarget.name}</span>
                <span className="font-mono text-muted-foreground font-bold">Stock actuel : {wasteTarget.current_stock} {wasteTarget.unit}</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase text-red-600">Quantité perdue ({wasteTarget.unit}) *</Label>
                <Input
                  type="number" step="any" required
                  value={wasteQty || ''}
                  onChange={e => setWasteQty(Number(e.target.value))}
                  className="font-mono text-lg font-bold border-red-200 focus:ring-red-400"
                  max={wasteTarget.current_stock}
                />
                {wasteQty > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Stock après déclaration : <span className="font-bold text-red-500">{Math.max(0, wasteTarget.current_stock - wasteQty).toFixed(2)} {wasteTarget.unit}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase">Cause / Note</Label>
                <Input placeholder="ex: Périmé, renversé, erreur de prep..." value={wasteNote} onChange={e => setWasteNote(e.target.value)} />
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsWasteOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={loggingWaste} className="bg-red-500 text-white font-black uppercase tracking-widest text-[10px]">
                  {loggingWaste ? 'Enregistrement...' : 'Confirmer le déchet'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MOVEMENTS HISTORY DIALOG ─────────────────────────────────────────── */}
      <Dialog open={isMovementsOpen} onOpenChange={setIsMovementsOpen}>
        <DialogContent className="max-w-[700px] max-h-[85vh] border-4 border-purple-200/40 flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <History className="h-6 w-6 text-purple-500" />
              Historique — {movementsTarget?.name}
            </DialogTitle>
            {movementsTarget && (
              <p className="text-xs text-muted-foreground mt-1">
                Stock actuel : <span className="font-bold">{movementsTarget.current_stock} {movementsTarget.unit}</span>
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-2">
            {loadingMovements ? (
              <div className="flex justify-center items-center py-12 text-muted-foreground text-sm">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Chargement...
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Aucun mouvement enregistré pour cet ingrédient.
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 border-b">
                  <TableRow>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Date</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Type</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Quantité</TableHead>
                    <TableHead className="text-[9px] font-black uppercase tracking-widest">Plat / Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map(mv => {
                    const typeInfo = movementTypeLabel[mv.movement_type] ?? { label: mv.movement_type, color: 'bg-gray-400' };
                    const isNegative = mv.quantity_delta < 0;
                    return (
                      <TableRow key={mv.id} className="border-b hover:bg-muted/10">
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {new Date(mv.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${typeInfo.color} text-white border-none text-[8px] uppercase tracking-widest font-black`}>
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold text-sm ${isNegative ? 'text-red-500' : 'text-emerald-500'}`}>
                          {isNegative ? '' : '+'}{mv.quantity_delta.toFixed(2)} {movementsTarget?.unit}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {mv.dish_name ? <span className="font-bold text-foreground mr-1">{mv.dish_name}</span> : null}
                          {mv.note}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsMovementsOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default IngredientsPage;
