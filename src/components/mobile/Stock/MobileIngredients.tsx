import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { ArrowLeft, Search, FlaskConical, Plus, Edit3, AlertTriangle, Trash2, ShieldAlert, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MobileIngredientsProps {
  onBack: () => void;
}

export function MobileIngredients({ onBack }: MobileIngredientsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatCurrency } = useFormatters();

  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Restock / Waste Form states
  const [actionType, setActionType] = useState<'restock' | 'waste' | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<any | null>(null);
  const [actionQty, setActionQty] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Add / Edit Form states
  const [formOpen, setFormOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    unit: 'g',
    category: 'perishable',
    current_stock: '0',
    min_threshold: '0',
    cost_per_unit: '0',
    expiry_date: '',
  });

  useEffect(() => {
    OfflineAuthService.getOfflineSession().then(session => {
      if (session?.user?.user_metadata?.store_id) {
        setStoreId(session.user.user_metadata.store_id);
        loadIngredients(session.user.user_metadata.store_id);
      }
    });
  }, []);

  const loadIngredients = async (sid: string) => {
    setLoading(true);
    try {
      const data = await OfflineAuthService.localBridgeRequest<any>(
        `/rest/v1/stock/dashboard?store_id=${sid}`,
        { method: 'GET' }
      );
      setIngredients(data?.ingredients || []);
    } catch (err) {
      console.error(err);
      toast({ title: t('common.error'), description: 'Erreur lors du chargement des ingrédients', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredIngredients = ingredients.filter(ing => 
    ing.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ing.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenAction = (type: 'restock' | 'waste', ing: any) => {
    setActionType(type);
    setSelectedIngredient(ing);
    setActionQty('');
    setActionNote('');
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient || !actionQty) return;
    setIsProcessing(true);

    try {
      const qty = parseFloat(actionQty);
      const endpoint = actionType === 'restock' 
        ? `/rest/v1/ingredients/${selectedIngredient.id}/restock` 
        : `/rest/v1/ingredients/${selectedIngredient.id}/waste`;
      
      const payload = {
        quantity: qty,
        note: actionNote || undefined
      };

      await OfflineAuthService.localBridgeRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      toast({ 
        title: t('common.success'), 
        description: actionType === 'restock' ? 'Ingrédient réapprovisionné' : 'Déchet enregistré' 
      });
      setActionType(null);
      loadIngredients(storeId);
    } catch (err) {
      toast({ title: t('common.error'), description: 'Erreur lors de l\'opération', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenForm = (ing: any = null) => {
    if (ing) {
      setEditingIngredient(ing);
      setFormData({
        name: ing.name || '',
        unit: ing.unit || 'g',
        category: ing.category || 'perishable',
        current_stock: (ing.current_stock ?? 0).toString(),
        min_threshold: (ing.min_threshold ?? 0).toString(),
        cost_per_unit: (ing.cost_per_unit ?? 0).toString(),
        expiry_date: ing.expiry_date ? ing.expiry_date.split('T')[0] : '',
      });
    } else {
      setEditingIngredient(null);
      setFormData({
        name: '',
        unit: 'g',
        category: 'perishable',
        current_stock: '0',
        min_threshold: '0',
        cost_per_unit: '0',
        expiry_date: '',
      });
    }
    setFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;
    setIsProcessing(true);

    try {
      const payload = {
        name: formData.name,
        unit: formData.unit,
        category: formData.category,
        current_stock: parseFloat(formData.current_stock) || 0,
        min_threshold: parseFloat(formData.min_threshold) || 0,
        cost_per_unit: parseFloat(formData.cost_per_unit) || 0,
        expiry_date: formData.expiry_date || null,
        store_id: storeId,
      };

      if (editingIngredient) {
        await OfflineAuthService.localBridgeRequest(
          `/rest/v1/ingredients/${editingIngredient.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );
        toast({ title: t('common.success'), description: 'Ingrédient mis à jour avec succès' });
      } else {
        await OfflineAuthService.localBridgeRequest(
          '/rest/v1/ingredients',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );
        toast({ title: t('common.success'), description: 'Ingrédient créé avec succès' });
      }

      setFormOpen(false);
      loadIngredients(storeId);
    } catch (err) {
      console.error(err);
      toast({ title: t('common.error'), description: 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet ingrédient ?')) return;
    try {
      await OfflineAuthService.localBridgeRequest(`/rest/v1/ingredients/${id}`, { method: 'DELETE' });
      toast({ title: t('common.success'), description: 'Ingrédient supprimé' });
      loadIngredients(storeId);
    } catch (err) {
      console.error(err);
      toast({ title: t('common.error'), description: 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] font-sans text-white">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-rs-surface-tint" />
          </div>
          <h1 className="text-lg font-bold text-white uppercase tracking-wider flex-1">Ingrédients</h1>
          <button onClick={() => handleOpenForm()} className="w-10 h-10 rounded-full bg-rs-surface-tint hover:bg-rs-primary-fixed flex items-center justify-center text-white active:scale-95 transition-transform shadow-lg shrink-0">
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un ingrédient..."
            className="w-full h-11 bg-rs-surface-container border border-rs-surface-container-highest rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-rs-surface-tint text-white placeholder-rs-on-surface-variant/50"
          />
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-rs-on-surface-variant/60" />
        </div>
      </header>

      {/* List */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-rs-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[32px] text-rs-surface-tint mb-2">refresh</span>
            <span>Chargement des ingrédients...</span>
          </div>
        ) : filteredIngredients.length === 0 ? (
          <div className="text-center py-20 text-rs-on-surface-variant">
            <FlaskConical className="h-12 w-12 mx-auto text-rs-on-surface-variant opacity-40 mb-3" />
            <p>Aucun ingrédient disponible.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredIngredients.map(ing => {
              const isLowStock = ing.current_stock <= (ing.min_threshold || 10);
              return (
                <div 
                  key={ing.id}
                  className="bg-[#141414] border border-rs-surface-container-highest rounded-2xl p-4 flex flex-col gap-3 shadow-md"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-white text-base truncate">{ing.name}</h3>
                      <p className="text-xs text-rs-on-surface-variant uppercase tracking-wider mt-0.5 truncate">
                        {ing.category || 'perishable'} {ing.cost_per_unit > 0 && `• ${formatCurrency(ing.cost_per_unit)}/${ing.unit}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0 text-right">
                      <span className={`font-mono text-base font-bold ${isLowStock ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {ing.current_stock} {ing.unit}
                      </span>
                      <span className="text-[10px] text-rs-on-surface-variant font-mono">
                        Seuil: {ing.min_threshold || 0} {ing.unit}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2.5 border-t border-rs-surface-container/30 text-xs">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleOpenAction('restock', ing)}
                        className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg font-bold border border-emerald-500/30 active:scale-95 transition-all text-[11px]"
                      >
                        + Appro
                      </button>
                      <button 
                        onClick={() => handleOpenAction('waste', ing)}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-2.5 py-1 rounded-lg font-bold border border-red-500/30 active:scale-95 transition-all text-[11px]"
                      >
                        🗑️ Déchet
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleOpenForm(ing)}
                        className="p-1.5 rounded-lg bg-rs-surface-container hover:bg-rs-surface-container-highest text-rs-surface-tint border border-rs-surface-container-highest active:scale-95 transition-all"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteIngredient(ing.id)}
                        className="p-1.5 rounded-lg bg-rs-surface-container hover:bg-rs-surface-container-highest text-red-400 border border-rs-surface-container-highest active:scale-95 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Restock/Waste Sheet */}
      <Sheet open={actionType !== null} onOpenChange={() => setActionType(null)}>
        <SheetContent side="bottom" className="h-[70%] bg-[#141414] text-white border-t border-rs-surface-container-highest rounded-t-2xl p-6 dark">
          <SheetHeader className="text-left mb-6">
            <SheetTitle className="text-xl font-bold text-rs-surface-tint">
              {actionType === 'restock' ? 'Réapprovisionner' : 'Enregistrer un Déchet'} : {selectedIngredient?.name}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={handleActionSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="action-qty">Quantité ({selectedIngredient?.unit})</Label>
              <Input 
                id="action-qty" 
                type="number" 
                step="any"
                value={actionQty} 
                onChange={e => setActionQty(e.target.value)} 
                required 
                className="bg-rs-surface-container border-rs-surface-container-highest text-white h-12 text-base" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action-note">Note / Commentaire</Label>
              <Input 
                id="action-note" 
                value={actionNote} 
                onChange={e => setActionNote(e.target.value)} 
                className="bg-rs-surface-container border-rs-surface-container-highest text-white h-12 text-base" 
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setActionType(null)} className="flex-1 border-rs-surface-container-highest text-white hover:bg-rs-surface-container h-12">Annuler</Button>
              <Button type="submit" disabled={isProcessing} className={`flex-1 ${actionType === 'restock' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white font-bold h-12`}>
                {isProcessing ? 'Enregistrement...' : 'Valider'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Add / Edit Form Sheet */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="bottom" className="h-[90%] bg-[#141414] text-white border-t border-rs-surface-container-highest rounded-t-2xl p-6 dark overflow-y-auto">
          <SheetHeader className="text-left mb-6">
            <SheetTitle className="text-xl font-bold text-rs-surface-tint">
              {editingIngredient ? 'Modifier l\'ingrédient' : 'Ajouter un ingrédient'}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'ingrédient</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                required 
                className="bg-rs-surface-container border-rs-surface-container-highest text-white h-12" 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="unit">Unité</Label>
                <Select value={formData.unit} onValueChange={v => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger id="unit" className="bg-rs-surface-container border-rs-surface-container-highest text-white h-12">
                    <SelectValue placeholder="Choisir l'unité" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-rs-surface-container-highest text-white">
                    <SelectItem value="g">Gramme (g)</SelectItem>
                    <SelectItem value="kg">Kilogramme (kg)</SelectItem>
                    <SelectItem value="ml">Millilitre (ml)</SelectItem>
                    <SelectItem value="L">Litre (L)</SelectItem>
                    <SelectItem value="pcs">Pièce (pcs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                  <SelectTrigger id="category" className="bg-rs-surface-container border-rs-surface-container-highest text-white h-12">
                    <SelectValue placeholder="Choisir la catégorie" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-rs-surface-container-highest text-white">
                    <SelectItem value="perishable">Périssable</SelectItem>
                    <SelectItem value="dry">Sec / Épicerie</SelectItem>
                    <SelectItem value="liquid">Liquide</SelectItem>
                    <SelectItem value="condiment">Condiment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label htmlFor="current_stock">Stock Actuel</Label>
                <Input 
                  id="current_stock" 
                  type="number" 
                  step="any"
                  value={formData.current_stock} 
                  onChange={e => setFormData({ ...formData, current_stock: e.target.value })} 
                  required 
                  className="bg-rs-surface-container border-rs-surface-container-highest text-white h-12" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_threshold">Seuil Alerte</Label>
                <Input 
                  id="min_threshold" 
                  type="number" 
                  step="any"
                  value={formData.min_threshold} 
                  onChange={e => setFormData({ ...formData, min_threshold: e.target.value })} 
                  required 
                  className="bg-rs-surface-container border-rs-surface-container-highest text-white h-12" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_per_unit">Coût Unit.</Label>
                <Input 
                  id="cost_per_unit" 
                  type="number" 
                  step="any"
                  value={formData.cost_per_unit} 
                  onChange={e => setFormData({ ...formData, cost_per_unit: e.target.value })} 
                  required 
                  className="bg-rs-surface-container border-rs-surface-container-highest text-white h-12" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry_date">Date d'Expiration (Optionnelle)</Label>
              <Input 
                id="expiry_date" 
                type="date"
                value={formData.expiry_date} 
                onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} 
                className="bg-rs-surface-container border-rs-surface-container-highest text-white h-12" 
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1 border-rs-surface-container-highest text-white hover:bg-rs-surface-container h-12">Annuler</Button>
              <Button type="submit" disabled={isProcessing} className="flex-1 bg-rs-surface-tint hover:bg-rs-primary-fixed text-white font-bold h-12">
                {isProcessing ? 'Enregistrement...' : <><Check className="w-5 h-5 mr-1" /> Enregistrer</>}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
