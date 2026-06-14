import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { ArrowLeft, Search, FlaskConical, Plus, Edit3, AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

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
        ? `/rest/v1/stock/restock` 
        : `/rest/v1/stock/waste`;
      
      const payload = {
        ingredient_id: selectedIngredient.id,
        quantity: qty,
        note: actionNote,
        store_id: storeId
      };

      await OfflineAuthService.localBridgeRequest(endpoint, {
        method: 'POST',
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
          <h1 className="text-lg font-bold text-white uppercase tracking-wider">Ingrédients</h1>
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
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-base truncate">{ing.name}</h3>
                      <p className="text-xs text-rs-on-surface-variant uppercase tracking-wider mt-0.5">
                        {ing.category || 'perishable'}
                      </p>
                    </div>
                    <span className={`font-mono text-base font-bold ${isLowStock ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {ing.current_stock} {ing.unit}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2.5 border-t border-rs-surface-container/30 text-xs">
                    <div className="flex items-center gap-1">
                      {isLowStock ? (
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Stock Bas
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold">Stock Normal</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleOpenAction('restock', ing)}
                        className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-lg font-bold border border-emerald-500/30 active:scale-95 transition-all"
                      >
                        + Appro
                      </button>
                      <button 
                        onClick={() => handleOpenAction('waste', ing)}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg font-bold border border-red-500/30 active:scale-95 transition-all"
                      >
                        🗑️ Déchet
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
                className="bg-rs-surface-container border-rs-surface-container-highest text-white" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action-note">Note / Commentaire</Label>
              <Input 
                id="action-note" 
                value={actionNote} 
                onChange={e => setActionNote(e.target.value)} 
                className="bg-rs-surface-container border-rs-surface-container-highest text-white" 
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setActionType(null)} className="flex-1 border-rs-surface-container-highest text-white hover:bg-rs-surface-container">Annuler</Button>
              <Button type="submit" disabled={isProcessing} className={`flex-1 ${actionType === 'restock' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white font-bold`}>
                {isProcessing ? 'Enregistrement...' : 'Valider'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
