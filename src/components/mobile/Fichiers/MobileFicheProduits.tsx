import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { ArrowLeft, Search, UtensilsCrossed, Package, Edit, Check, AlertTriangle } from 'lucide-react';

interface MobileFicheProduitsProps {
  onBack: () => void;
}

export function MobileFicheProduits({ onBack }: MobileFicheProduitsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatCurrency } = useFormatters();

  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('');

  useEffect(() => {
    OfflineAuthService.getOfflineSession().then(session => {
      if (session?.user?.user_metadata?.store_id) {
        setStoreId(session.user.user_metadata.store_id);
        loadProducts(session.user.user_metadata.store_id);
      }
    });
  }, []);

  const loadProducts = async (sid: string) => {
    setLoading(true);
    try {
      const data = await OfflineInventoryService.getInventory(sid);
      setProducts(data || []);
    } catch (err) {
      console.error(err);
      toast({ title: t('common.error'), description: 'Erreur lors du chargement du menu', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] font-sans text-white">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
            <UtensilsCrossed className="w-4 h-4 text-rs-surface-tint" />
          </div>
          <h1 className="text-lg font-bold text-white uppercase tracking-wider">Menu / Produits</h1>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un plat ou article..."
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
            <span>Chargement des articles...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-rs-on-surface-variant">
            <Package className="h-12 w-12 mx-auto text-rs-on-surface-variant opacity-40 mb-3" />
            <p>Aucun produit trouvé.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredProducts.map(product => {
              const isLowStock = product.quantity <= (product.low_stock_threshold || 10);
              return (
                <div 
                  key={product.id}
                  className="bg-[#141414] border border-rs-surface-container-highest rounded-2xl p-4 flex flex-col gap-3 shadow-md"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-base truncate">{product.name}</h3>
                      <p className="text-xs text-rs-on-surface-variant uppercase tracking-wider mt-0.5">
                        {product.category || product.category_name || 'Général'}
                      </p>
                    </div>
                    <span className="font-mono text-base font-bold text-rs-surface-tint">
                      {formatCurrency(product.price || product.unit_price || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-rs-surface-container/30 text-xs">
                    <div className="flex items-center gap-1.5 text-rs-on-surface">
                      <span className="font-semibold">Stock:</span>
                      <span className={`font-mono font-bold ${isLowStock ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {product.quantity} {product.unit_type || 'pcs'}
                      </span>
                      {isLowStock && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                    </div>

                    <div className="text-rs-on-surface-variant font-mono">
                      Type: {product.item_type || 'standard'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
