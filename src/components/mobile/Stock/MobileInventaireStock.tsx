import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { OfflineDataService } from '@/services/OfflineDataService';
import { ArrowLeft, Search, Package, Plus, Minus, Save, RefreshCw } from 'lucide-react';

interface MobileInventaireStockProps {
  onBack: () => void;
}

export function MobileInventaireStock({ onBack }: MobileInventaireStockProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatCurrency } = useFormatters();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track adjustments: { productId: physicalQty }
  const [inventoryChanges, setInventoryChanges] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    OfflineAuthService.getOfflineSession().then(session => {
      if (session?.user?.user_metadata?.store_id) {
        setStoreId(session.user.user_metadata.store_id);
        loadInventory(session.user.user_metadata.store_id);
      }
    });
  }, []);

  const loadInventory = async (sid: string) => {
    setLoading(true);
    try {
      const res = await OfflineInventoryService.getInventory(sid);
      setProducts(res?.data || []);
    } catch (err) {
      console.error(err);
      toast({ title: t('common.error'), description: 'Erreur lors du chargement de l\'inventaire', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = Array.isArray(products) ? products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const updatePhysicalStock = (productId: string, val: number) => {
    setInventoryChanges(prev => ({
      ...prev,
      [productId]: Math.max(0, val)
    }));
  };

  const handleValidateInventory = async () => {
    const changeIds = Object.keys(inventoryChanges);
    if (changeIds.length === 0) return toast({ title: 'Info', description: 'Aucune modification à enregistrer.' });
    
    setIsSaving(true);
    try {
      for (const [id, qty] of Object.entries(inventoryChanges)) {
        await OfflineDataService.updateProductStock(storeId, id, qty, 'Inventaire');
      }
      toast({ title: t('common.success'), description: 'Inventaire mis à jour avec succès' });
      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'inventory' } }));
      setInventoryChanges({});
      await loadInventory(storeId);
    } catch (error) {
      toast({ title: t('common.error'), description: 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const changesCount = Object.keys(inventoryChanges).length;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] font-sans text-white">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
              <Package className="w-4 h-4 text-rs-surface-tint" />
            </div>
            <h1 className="text-lg font-bold text-white uppercase tracking-wider">Inventaire Physique</h1>
          </div>
          
          <button 
            onClick={handleValidateInventory}
            disabled={isSaving || changesCount === 0}
            className="flex items-center gap-2 bg-rs-surface-tint hover:bg-rs-primary-fixed disabled:opacity-40 disabled:pointer-events-none px-4 py-2 rounded-xl text-white font-bold text-xs uppercase tracking-wide active:scale-95 transition-all shadow-lg"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Sauver ({changesCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher article à inventorier..."
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
            <span>Chargement des stocks...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-rs-on-surface-variant">
            <Package className="h-12 w-12 mx-auto text-rs-on-surface-variant opacity-40 mb-3" />
            <p>Aucun produit dans le stock.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredProducts.map(p => {
              const currentVal = inventoryChanges[p.id] !== undefined ? inventoryChanges[p.id] : p.quantity;
              const diff = currentVal - p.quantity;
              return (
                <div 
                  key={p.id}
                  className="bg-[#141414] border border-rs-surface-container-highest rounded-2xl p-4 flex flex-col gap-3 shadow-md"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-base truncate">{p.name}</h3>
                      <p className="text-xs text-rs-on-surface-variant uppercase tracking-wider mt-0.5">
                        Sys: {p.quantity} {p.unit_type || 'pcs'}
                      </p>
                    </div>
                    
                    {/* Stepper Input */}
                    <div className="flex items-center gap-1.5 bg-rs-surface-container border border-rs-surface-container-highest rounded-xl p-1 shrink-0">
                      <button 
                        onClick={() => updatePhysicalStock(p.id, currentVal - 1)}
                        className="w-8 h-8 rounded-lg hover:bg-rs-surface-container-highest flex items-center justify-center active:scale-90 transition-transform"
                      >
                        <Minus className="w-4 h-4 text-rs-on-surface" />
                      </button>
                      <input 
                        type="number"
                        value={currentVal}
                        onChange={e => updatePhysicalStock(p.id, parseInt(e.target.value) || 0)}
                        className="w-12 text-center bg-transparent font-mono font-bold text-sm text-white focus:outline-none"
                      />
                      <button 
                        onClick={() => updatePhysicalStock(p.id, currentVal + 1)}
                        className="w-8 h-8 rounded-lg hover:bg-rs-surface-container-highest flex items-center justify-center active:scale-90 transition-transform"
                      >
                        <Plus className="w-4 h-4 text-rs-on-surface" />
                      </button>
                    </div>
                  </div>

                  {/* Diff indicator */}
                  {diff !== 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-rs-surface-container/30 text-xs">
                      <span className="text-rs-on-surface-variant">Écart de stock:</span>
                      <span className={`font-mono font-bold ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {diff > 0 ? '+' : ''}{diff} {p.unit_type || 'pcs'} ({formatCurrency(diff * (p.unit_price || p.price || 0))})
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
