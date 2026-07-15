import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { 
  ArrowLeft, Search, UtensilsCrossed, Package, Edit2, Trash2, 
  AlertTriangle, Plus, RefreshCw, Check, Image as ImageIcon, Tag, Clock, Layers, Save, Boxes 
} from 'lucide-react';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RecipeBuilder } from '@/components/recipe/RecipeBuilder';

interface MobileFicheProduitsProps {
  onBack: () => void;
  storeId?: string;
}

export function MobileFicheProduits({ onBack, storeId: propStoreId }: MobileFicheProduitsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatCurrency } = useFormatters();

  const [products, setProducts] = useState<any[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [packSearchQuery, setPackSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Gallery view filter
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'dish' | 'product' | 'pack'>('all');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [formTab, setFormTab] = useState<'info' | 'prices' | 'stock' | 'composition'>('info');

  const initialFormState = {
    name: '',
    item_type: 'product' as 'product' | 'dish' | 'pack',
    family_id: '',
    unit_price: '' as string | number,
    selling_price_2: '' as string | number,
    selling_price_3: '' as string | number,
    selling_price_4: '' as string | number,
    cost_price: '' as string | number,
    quantity: '' as string | number,
    min_quantity: '10' as string | number,
    unit_type: 'Pièce',
    packaging: '1',
    prep_time_minutes: '0' as string | number,
    image_url: '',
    pack_items: [] as string[],
    recipe_items: [] as { ingredient_id: string; quantity_needed: number; unit: string }[],
    recipe_cost: 0,
    pending_id: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (propStoreId) {
      setStoreId(propStoreId);
      loadProducts(propStoreId);
      loadFamilies(propStoreId);
    } else {
      OfflineAuthService.getOfflineSession().then(session => {
        const resolvedStoreId = session?.roles?.find(r => r.store_id)?.store_id || session?.user?.user_metadata?.store_id;
        if (resolvedStoreId) {
          setStoreId(resolvedStoreId);
          loadProducts(resolvedStoreId);
          loadFamilies(resolvedStoreId);
        }
      });
    }

    // Listen for custom search event
    const handleSearchUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      if (customEvent.detail && typeof customEvent.detail.query === 'string') {
        setSearchQuery(customEvent.detail.query);
      }
    };
    window.addEventListener('worker-product-search-update', handleSearchUpdate);

    // Check initial local storage if any
    const storedSearch = localStorage.getItem('worker_product_search_query');
    if (storedSearch) {
      setSearchQuery(storedSearch);
      localStorage.removeItem('worker_product_search_query'); // consume it
    }

    return () => {
      window.removeEventListener('worker-product-search-update', handleSearchUpdate);
    };
  }, [propStoreId]);

  const loadProducts = async (sid: string) => {
    setLoading(true);
    try {
      const res = await OfflineInventoryService.getInventory(sid);
      const mapped = (res?.data || []).map(item => {
        let parsed = [];
        if (item.pack_items) {
          try {
            parsed = typeof item.pack_items === 'string' ? JSON.parse(item.pack_items) : item.pack_items;
          } catch(e) {
            console.error('Failed to parse pack_items', e);
          }
        }
        return { ...item, pack_items: parsed };
      });
      setProducts(mapped);
    } catch (err) {
      console.error(err);
      toast({ title: t('common.error'), description: 'Erreur lors du chargement du menu', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadFamilies = async (sid: string) => {
    try {
      const res = await OfflineInventoryService.getProductFamilies(sid);
      setFamilies(res?.data || []);
    } catch (err) {
      console.error('Failed to load families:', err);
    }
  };

  const getPackSize = (pStr: string | number | undefined) => {
    if (!pStr) return 1;
    const match = String(pStr).match(/(\d+)/);
    return match ? parseInt(match[1]) : 1;
  };

  const isBoxUnit = (unit: string) => {
    const u = (unit || '').toLowerCase();
    return ['carton', 'box', 'pack', 'paquet', 'sachet', 'sac'].includes(u);
  };

  const handleEdit = useCallback(async (p: any) => {
    setEditingProduct(p);
    setPackSearchQuery('');
    const packSize = getPackSize(p.packaging || '1');
    const isBox = isBoxUnit(p.unit_type || 'Pièce');
    const scale = (val: any) => isBox && packSize > 1 ? (Number(val) * packSize) : Number(val);

    let recipeItems: any[] = [];
    if (p.item_type === 'dish') {
      try {
        const items = await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/recipes?dish_id=${p.id}`);
        if (Array.isArray(items)) {
          recipeItems = items.map(item => ({
            ingredient_id: item.ingredient_id,
            quantity_needed: Number(item.quantity_needed),
            unit: item.unit,
          }));
        }
      } catch (err) {
        console.error('Failed to load recipe items:', err);
      }
    }

    setFormData({
      name: p.name || '',
      item_type: p.item_type || 'product',
      family_id: p.category_id || p.category || '',
      unit_price: scale(p.price || p.unit_price || 0),
      selling_price_2: scale(p.selling_price_2 || 0),
      selling_price_3: scale(p.selling_price_3 || 0),
      selling_price_4: scale(p.selling_price_4 || 0),
      cost_price: scale(p.cost || p.cost_price || 0),
      quantity: isBox ? (p.quantity / packSize) : p.quantity,
      min_quantity: isBox ? ((p.low_stock_threshold || 0) / packSize) : (p.low_stock_threshold || p.min_quantity || 0),
      unit_type: p.unit_type || 'Pièce',
      packaging: p.packaging || '1',
      prep_time_minutes: p.prep_time_minutes || 0,
      image_url: p.image_url || '',
      pack_items: p.pack_items || [],
      recipe_items: recipeItems,
      recipe_cost: 0, // calculated dynamically by RecipeBuilder on render
      pending_id: p.id,
    });
    setFormTab('info');
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cet article ?')) return;
    try {
      const { error } = await OfflineInventoryService.deleteItem(id);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== id));
      toast({ title: t('common.success'), description: 'Produit supprimé avec succès' });
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  }, [t, toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: 'Erreur', description: 'Le nom du produit est requis.', variant: 'destructive' });
      return;
    }
    if (formData.item_type === 'pack' && formData.pack_items.length === 0) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner au moins un article pour le pack.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);

    try {
      const packSize = getPackSize(formData.packaging);
      const isBox = isBoxUnit(formData.unit_type);

      let finalPrice = Number(formData.unit_price) || 0;
      let finalCost = formData.item_type === 'dish' ? (formData.recipe_cost || 0) : (Number(formData.cost_price) || 0);
      let finalQty = Number(formData.quantity) || 0;

      if (formData.item_type !== 'pack' && isBox && packSize > 1) {
        finalPrice = finalPrice / packSize;
        finalCost = finalCost / packSize;
        finalQty = finalQty * packSize;
      }

      const payload = {
        name: formData.name,
        item_type: formData.item_type,
        unit_price: finalPrice,
        cost_price: formData.item_type === 'pack' ? 0 : finalCost,
        selling_price_2: formData.selling_price_2 ? Number(formData.selling_price_2) / (isBox ? packSize : 1) : undefined,
        selling_price_3: formData.selling_price_3 ? Number(formData.selling_price_3) / (isBox ? packSize : 1) : undefined,
        selling_price_4: formData.selling_price_4 ? Number(formData.selling_price_4) / (isBox ? packSize : 1) : undefined,
        quantity: formData.item_type === 'pack' ? 0 : finalQty,
        min_quantity: formData.item_type === 'pack' ? 0 : (Number(formData.min_quantity) || 0),
        low_stock_threshold: formData.item_type === 'pack' ? 0 : (Number(formData.min_quantity) || 0),
        unit_type: formData.item_type === 'pack' ? 'Pièce' : formData.unit_type,
        packaging: formData.item_type === 'pack' ? '1' : formData.packaging,
        category: formData.family_id || undefined,
        image_url: formData.image_url || undefined,
        prep_time_minutes: formData.item_type === 'dish' ? (Number(formData.prep_time_minutes) || 0) : 0,
        is_available: true,
        pack_items: formData.item_type === 'pack' ? formData.pack_items : [],
        store_id: storeId,
      };

      let result;
      const itemId = editingProduct?.id ?? (formData.pending_id || crypto.randomUUID());
      if (editingProduct) {
        result = await OfflineInventoryService.updateItem(editingProduct.id, payload);
      } else {
        result = await OfflineInventoryService.createItem({ ...payload, id: itemId });
      }

      if (result.error) throw result.error;

      // Save recipe items if it is a dish
      if (formData.item_type === 'dish') {
        await OfflineAuthService.localBridgeRequest('/rest/v1/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dish_id: itemId,
            items: formData.recipe_items || [],
          }),
        });
      }

      toast({ title: t('common.success'), description: 'Enregistrement réussi' });
      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'product' } }));
      setIsFormOpen(false);
      setEditingProduct(null);
      await loadProducts(storeId);
    } catch (err: any) {
      console.error(err);
      toast({ title: t('common.error'), description: err.message || 'Erreur de sauvegarde', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return Array.isArray(products) ? products.filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category_name || families.find(f => f.id === (p.category_id || p.category))?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      if (activeTypeFilter === 'all') return matchesSearch;
      if (activeTypeFilter === 'dish') return matchesSearch && p.item_type === 'dish';
      if (activeTypeFilter === 'product') return matchesSearch && (p.item_type === 'product' || !p.item_type);
      if (activeTypeFilter === 'pack') return matchesSearch && p.item_type === 'pack';
      return matchesSearch;
    }) : [];
  }, [products, searchQuery, activeTypeFilter, families]);

  const selectableItems = useMemo(() => {
    return products.filter(p => p.item_type !== 'pack' && p.id !== editingProduct?.id);
  }, [products, editingProduct?.id]);

  if (isFormOpen) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] font-sans text-white overflow-hidden animate-in fade-in-50 duration-200">
        {/* Form Header */}
        <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setIsFormOpen(false);
                setEditingProduct(null);
              }} 
              type="button"
              className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-white uppercase tracking-wider">
              {editingProduct ? 'Modifier' : 'Ajouter'} {formData.item_type === 'pack' ? 'Pack' : formData.item_type === 'dish' ? 'Plat' : 'Produit'}
            </h1>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            type="button"
            className="flex items-center gap-2 bg-rs-surface-tint hover:bg-rs-primary-fixed disabled:opacity-40 px-4 py-2 rounded-xl text-white font-bold text-xs uppercase tracking-wide active:scale-95 transition-all shadow-lg"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Enregistrer</span>
          </button>
        </header>

        {/* Tab Selector */}
        <style>{`
          .no-scrollbar::-webkit-scrollbar {
            display: none !important;
          }
          .no-scrollbar {
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
        `}</style>
        <div className="flex-shrink-0 flex gap-2 p-4 bg-[#141414]/50 border-b border-[#262626] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setFormTab('info')}
            className={`flex-grow-0 shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wide ${formTab === 'info' ? 'bg-rs-secondary text-rs-on-secondary shadow-md' : 'bg-rs-surface-container border border-[#262626] text-rs-on-surface'}`}
          >
            Général
          </button>
          <button
            type="button"
            onClick={() => setFormTab('prices')}
            className={`flex-grow-0 shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wide ${formTab === 'prices' ? 'bg-rs-secondary text-rs-on-secondary shadow-md' : 'bg-rs-surface-container border border-[#262626] text-rs-on-surface'}`}
          >
            Prix & Marges
          </button>
          {formData.item_type !== 'pack' && (
            <button
              type="button"
              onClick={() => setFormTab('stock')}
              className={`flex-grow-0 shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wide ${formTab === 'stock' ? 'bg-rs-secondary text-rs-on-secondary shadow-md' : 'bg-rs-surface-container border border-[#262626] text-rs-on-surface'}`}
            >
              Stock & Logistique
            </button>
          )}
          {formData.item_type === 'dish' && (
            <button
              type="button"
              onClick={() => setFormTab('composition')}
              className={`flex-grow-0 shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wide ${formTab === 'composition' ? 'bg-rs-secondary text-rs-on-secondary shadow-md' : 'bg-rs-surface-container border border-[#262626] text-rs-on-surface'}`}
            >
              Composition
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-6">
          {formTab === 'info' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 shrink-0 items-center justify-center bg-[#141414] border border-[#262626] rounded-2xl p-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-rs-on-surface-variant">Image</Label>
                <ImageUpload 
                  currentImageUrl={formData.image_url} 
                  onImageUploaded={url => setFormData(prev => ({ ...prev, image_url: url }))} 
                  onImageRemoved={() => setFormData(prev => ({ ...prev, image_url: '' }))} 
                  folder="inventory" 
                  className="w-full flex flex-col items-center justify-center"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-type">Type</Label>
                <div className="grid grid-cols-3 gap-2 bg-[#141414] p-1 border border-[#262626] rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, item_type: 'product' }));
                      if (formTab === 'composition') setFormTab('info');
                    }}
                    className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${formData.item_type === 'product' ? 'bg-rs-surface-tint text-white shadow-md' : 'text-rs-on-surface-variant'}`}
                  >
                    📦 Article
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, item_type: 'dish' }));
                    }}
                    className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${formData.item_type === 'dish' ? 'bg-rs-surface-tint text-white shadow-md' : 'text-rs-on-surface-variant'}`}
                  >
                    🍳 Plat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, item_type: 'pack' }));
                      if (formTab === 'stock' || formTab === 'composition') setFormTab('info');
                    }}
                    className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${formData.item_type === 'pack' ? 'bg-rs-surface-tint text-white shadow-md' : 'text-rs-on-surface-variant'}`}
                  >
                    🎒 Pack
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-name">Nom <span className="text-rs-surface-tint">*</span></Label>
                <Input
                  id="product-name"
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={formData.item_type === 'pack' ? "Ex: Pack Famille, Combo Midi..." : "Ex: Burger Maison, Coca Cola..."}
                  className="bg-rs-surface-container border-[#262626] text-white"
                  required
                />
              </div>

              {formData.item_type !== 'pack' && (
                <div className="space-y-2">
                  <Label htmlFor="family-select">Famille / Catégorie</Label>
                  <select
                    id="family-select"
                    value={formData.family_id}
                    onChange={e => setFormData(prev => ({ ...prev, family_id: e.target.value }))}
                    className="w-full h-10 px-3 bg-rs-surface-container border border-[#262626] rounded-md text-sm text-white focus:outline-none focus:ring-1 focus:ring-rs-surface-tint"
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {families.map(fam => (
                      <option key={fam.id} value={fam.id}>{fam.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Items List inside Pack Form */}
              {formData.item_type === 'pack' && (
                <div className="space-y-2 pt-2">
                  <Label className="text-sm font-bold text-rs-on-surface-variant flex items-center gap-1.5 justify-between">
                    <div className="flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-rs-surface-tint" />
                      <span>Contenu du Pack ({formData.pack_items.length} article{formData.pack_items.length !== 1 ? 's' : ''})</span>
                    </div>
                  </Label>
                  
                  {/* Search Bar for Selectable Items */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={packSearchQuery}
                      onChange={e => setPackSearchQuery(e.target.value)}
                      placeholder="Rechercher un plat ou article..."
                      className="w-full h-9 bg-rs-surface-container border border-[#262626] rounded-xl pl-9 pr-3 text-xs focus:outline-none focus:border-rs-surface-tint text-white placeholder-rs-on-surface-variant/50"
                    />
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-rs-on-surface-variant/60" />
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-[#262626] rounded-xl p-3 bg-[#141414] space-y-2">
                    {selectableItems.length === 0 ? (
                      <p className="text-center text-xs text-rs-on-surface-variant py-4">Aucun article disponible.</p>
                    ) : (() => {
                      const filteredList = selectableItems.filter(item =>
                        item.name?.toLowerCase().includes(packSearchQuery.toLowerCase())
                      );
                      if (filteredList.length === 0) {
                        return <p className="text-center text-xs text-rs-on-surface-variant py-4">Aucun article ne correspond à votre recherche.</p>;
                      }
                      return filteredList.map(item => {
                        const isChecked = formData.pack_items.includes(item.id);
                        return (
                          <label key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-rs-surface-container/50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const nextItems = isChecked
                                  ? formData.pack_items.filter(id => id !== item.id)
                                  : [...formData.pack_items, item.id];
                                setFormData(prev => ({ ...prev, pack_items: nextItems }));
                              }}
                              className="w-4 h-4 text-rs-surface-tint border-[#262626] rounded focus:ring-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{item.name}</p>
                              <p className="text-[10px] text-rs-on-surface-variant uppercase font-mono">
                                {item.item_type === 'dish' ? '🍳 Plat' : '📦 Article'}
                              </p>
                            </div>
                            <span className="text-xs text-rs-surface-tint font-mono font-bold">
                              {formatCurrency(item.price || item.unit_price || 0)}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {formTab === 'prices' && (
            <div className="space-y-4">
              <div className="bg-[#141414] border border-[#262626] p-4 rounded-xl space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="unit-price" className="text-rs-surface-tint font-bold">Prix du Pack / Article (Détail) *</Label>
                  <div className="relative">
                    <Input
                      id="unit-price"
                      type="number"
                      value={formData.unit_price}
                      onChange={e => setFormData(prev => ({ ...prev, unit_price: e.target.value }))}
                      className="bg-rs-surface-container border-[#262626] text-white font-mono text-base font-bold pr-12"
                      placeholder="0"
                      required
                    />
                    <span className="absolute right-4 top-2 text-rs-on-surface-variant font-bold">F</span>
                  </div>
                </div>

                {formData.item_type === 'product' && (
                  <div className="space-y-2">
                    <Label htmlFor="cost-price">Coût d'achat (Revient)</Label>
                    <div className="relative">
                      <Input
                        id="cost-price"
                        type="number"
                        value={formData.cost_price}
                        onChange={e => setFormData(prev => ({ ...prev, cost_price: e.target.value }))}
                        className="bg-rs-surface-container border-[#262626] text-white font-mono pr-12"
                        placeholder="0"
                      />
                      <span className="absolute right-4 top-2 text-rs-on-surface-variant">F</span>
                    </div>
                  </div>
                )}

                {formData.item_type === 'dish' && (
                  <div className="bg-[#1e1e1e] border border-[#262626] rounded-xl p-4 mt-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-rs-surface-tint mb-1">Coût de revient estimé</div>
                    <div className="text-xl font-black text-white font-mono">{Number(formData.recipe_cost || 0).toLocaleString()} F</div>
                    <div className="text-[9px] text-rs-on-surface-variant mt-1">Calculé automatiquement depuis la composition</div>
                  </div>
                )}
              </div>

              {formData.item_type !== 'pack' && (
                <div className="bg-[#141414]/50 border border-[#262626] p-4 rounded-xl space-y-4">
                  <Label className="text-xs uppercase font-bold text-rs-on-surface-variant">Tarifs secondaires</Label>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="selling-price-2" className="text-[10px] text-rs-on-surface-variant uppercase">Remise (P2)</Label>
                      <Input
                        id="selling-price-2"
                        type="number"
                        value={formData.selling_price_2}
                        onChange={e => setFormData(prev => ({ ...prev, selling_price_2: e.target.value }))}
                        className="bg-rs-surface-container border-[#262626] text-white text-xs font-mono text-center opacity-80"
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="selling-price-3" className="text-[10px] text-rs-on-surface-variant uppercase">Gros (P3)</Label>
                      <Input
                        id="selling-price-3"
                        type="number"
                        value={formData.selling_price_3}
                        onChange={e => setFormData(prev => ({ ...prev, selling_price_3: e.target.value }))}
                        className="bg-rs-surface-container border-[#262626] text-white text-xs font-mono text-center opacity-80"
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="selling-price-4" className="text-[10px] text-rs-on-surface-variant uppercase">Revente (P4)</Label>
                      <Input
                        id="selling-price-4"
                        type="number"
                        value={formData.selling_price_4}
                        onChange={e => setFormData(prev => ({ ...prev, selling_price_4: e.target.value }))}
                        className="bg-rs-surface-container border-[#262626] text-white text-xs font-mono text-center opacity-80"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {formTab === 'stock' && formData.item_type !== 'pack' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Stock initial</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={e => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                    className="bg-rs-surface-container border-[#262626] text-white font-mono"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-quantity">Alerte stock min</Label>
                  <Input
                    id="min-quantity"
                    type="number"
                    value={formData.min_quantity}
                    onChange={e => setFormData(prev => ({ ...prev, min_quantity: e.target.value }))}
                    className="bg-rs-surface-container border-[#262626] text-white font-mono"
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit-type">Unité</Label>
                  <select
                    id="unit-type"
                    value={formData.unit_type}
                    onChange={e => setFormData(prev => ({ ...prev, unit_type: e.target.value }))}
                    className="w-full h-10 px-3 bg-rs-surface-container border border-[#262626] rounded-md text-sm text-white focus:outline-none focus:ring-1 focus:ring-rs-surface-tint"
                  >
                    <option value="Pièce">Pièce</option>
                    <option value="Portion">Portion</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="Litre">Litre</option>
                    <option value="Sac">Sac</option>
                    <option value="Carton">Carton</option>
                    <option value="Boîte">Boîte</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="packaging">Conditionnement</Label>
                  <Input
                    id="packaging"
                    type="text"
                    value={formData.packaging}
                    onChange={e => setFormData(prev => ({ ...prev, packaging: e.target.value }))}
                    className="bg-rs-surface-container border-[#262626] text-white"
                    placeholder="Ex: 1 ou Box of 12"
                  />
                </div>
              </div>

              {formData.item_type === 'dish' && (
                <div className="space-y-2">
                  <Label htmlFor="prep-time">Temps de préparation (minutes)</Label>
                  <div className="relative">
                    <Input
                      id="prep-time"
                      type="number"
                      value={formData.prep_time_minutes}
                      onChange={e => setFormData(prev => ({ ...prev, prep_time_minutes: e.target.value }))}
                      className="bg-rs-surface-container border-[#262626] text-white font-mono pr-20"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-2 text-rs-on-surface-variant text-xs">min</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {formTab === 'composition' && formData.item_type === 'dish' && (
            <div className="space-y-4">
              <div className="bg-[#141414] border border-[#262626] p-4 rounded-xl space-y-4">
                <Label className="text-sm font-bold text-rs-on-surface-variant flex items-center gap-1.5">
                  <UtensilsCrossed className="w-4 h-4 text-rs-surface-tint" />
                  <span>Composition du Plat (Recette)</span>
                </Label>
                <p className="text-xs text-rs-on-surface-variant leading-relaxed">
                  Définissez les ingrédients nécessaires pour préparer ce plat. Les stocks seront automatiquement déduits à chaque vente.
                </p>
                <div className="bg-[#1a1a1a] rounded-xl border border-[#262626] overflow-x-auto text-black p-1">
                  <RecipeBuilder
                    dishId={editingProduct ? editingProduct.id : formData.pending_id}
                    storeId={storeId}
                    sellingPrice={Number(formData.unit_price) || 0}
                    onChange={(items) => setFormData(prev => ({ ...prev, recipe_items: items }))}
                    onCostChange={(cost) => setFormData(prev => ({ ...prev, recipe_cost: cost }))}
                  />
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] font-sans text-white">
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-rs-surface-tint" />
            </div>
            <h1 className="text-lg font-bold text-white uppercase tracking-wider">Menu & Plats</h1>
          </div>
          <button
            onClick={() => {
              setFormData({
                ...initialFormState,
                pending_id: crypto.randomUUID()
              });
              setEditingProduct(null);
              setPackSearchQuery('');
              setFormTab('info');
              setIsFormOpen(true);
            }}
            className="flex items-center gap-1.5 bg-rs-surface-tint hover:bg-rs-primary-fixed px-3 py-2 rounded-xl text-white font-bold text-xs uppercase tracking-wide active:scale-95 transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un plat, article ou pack..."
            className="w-full h-11 bg-rs-surface-container border border-rs-surface-container-highest rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-rs-surface-tint text-white placeholder-rs-on-surface-variant/50"
          />
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-rs-on-surface-variant/60" />
        </div>

        {/* Type Category Switcher (Tabs) */}
        <div className="flex gap-1.5 mt-3 pt-1 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTypeFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all uppercase shrink-0 ${activeTypeFilter === 'all' ? 'bg-rs-surface-tint text-white shadow-sm' : 'bg-rs-surface-container border border-[#262626] text-rs-on-surface-variant'}`}
          >
            Tout ({products.length})
          </button>
          <button
            onClick={() => setActiveTypeFilter('dish')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all uppercase shrink-0 flex items-center gap-1 ${activeTypeFilter === 'dish' ? 'bg-rs-surface-tint text-white shadow-sm' : 'bg-rs-surface-container border border-[#262626] text-rs-on-surface-variant'}`}
          >
            🍳 Plats ({products.filter(p => p.item_type === 'dish').length})
          </button>
          <button
            onClick={() => setActiveTypeFilter('product')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all uppercase shrink-0 flex items-center gap-1 ${activeTypeFilter === 'product' ? 'bg-rs-surface-tint text-white shadow-sm' : 'bg-rs-surface-container border border-[#262626] text-rs-on-surface-variant'}`}
          >
            📦 Articles ({products.filter(p => p.item_type === 'product' || !p.item_type).length})
          </button>
          <button
            onClick={() => setActiveTypeFilter('pack')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all uppercase shrink-0 flex items-center gap-1 ${activeTypeFilter === 'pack' ? 'bg-rs-surface-tint text-white shadow-sm' : 'bg-rs-surface-container border border-[#262626] text-rs-on-surface-variant'}`}
          >
            🎒 Packs ({products.filter(p => p.item_type === 'pack').length})
          </button>
        </div>
      </header>

      {/* Gallery Grid */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-rs-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[32px] text-rs-surface-tint mb-2">refresh</span>
            <span>Chargement du menu...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-rs-on-surface-variant">
            <Package className="h-12 w-12 mx-auto text-rs-on-surface-variant opacity-40 mb-3" />
            <p>Aucun produit trouvé.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-8">
            {filteredProducts.map(product => {
              const categoryName = families.find(f => f.id === (product.category_id || product.category))?.name || 'Général';
              return (
                <ProductCard 
                  key={product.id}
                  product={product}
                  categoryName={categoryName}
                  formatCurrency={formatCurrency}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

interface ProductCardProps {
  product: any;
  categoryName: string;
  formatCurrency: (val: any) => string;
  onEdit: (p: any) => void;
  onDelete: (id: string) => void;
}

const ProductCard = React.memo(function ProductCard({
  product,
  categoryName,
  formatCurrency,
  onEdit,
  onDelete
}: ProductCardProps) {
  const isLowStock = product.item_type !== 'pack' && product.quantity <= (product.low_stock_threshold || 10);
  
  let typeBadgeColor = 'bg-[#1e1a0acc] text-amber-400'; // Plat
  let typeLabel = '🍳 Plat';
  if (product.item_type === 'pack') {
    typeBadgeColor = 'bg-[#1b132ccc] text-purple-400';
    typeLabel = '🎒 Pack';
  } else if (product.item_type === 'product' || !product.item_type) {
    typeBadgeColor = 'bg-[#0f1b22cc] text-sky-400';
    typeLabel = '📦 Article';
  }

  return (
    <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden flex flex-col relative shadow-md">
      <div className="relative aspect-square w-full bg-gradient-to-br from-[#1c1c1c] to-[#262626] flex items-center justify-center overflow-hidden border-b border-[#262626]">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name} 
            className="object-cover w-full h-full" 
          />
        ) : (
          <div className="text-rs-on-surface-variant opacity-30 animate-pulse">
            {product.item_type === 'dish' ? (
              <UtensilsCrossed className="w-12 h-12 text-rs-surface-tint" />
            ) : product.item_type === 'pack' ? (
              <Boxes className="w-12 h-12 text-rs-surface-tint" />
            ) : (
              <Package className="w-12 h-12 text-rs-surface-tint" />
            )}
          </div>
        )}

        {product.item_type !== 'pack' && (
          <div className="absolute top-2 left-2 bg-[#0a0a0acc] backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider text-rs-surface-tint">
            {categoryName}
          </div>
        )}

        <div className={`absolute bottom-2 left-2 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${typeBadgeColor}`}>
          {typeLabel}
        </div>

        <div className="absolute top-2 right-2 flex gap-1.5 z-10">
          <button 
            onClick={() => onEdit(product)}
            className="w-7 h-7 rounded-full bg-[#0a0a0acc] backdrop-blur-sm flex items-center justify-center hover:bg-rs-surface-container-highest text-emerald-400 active:scale-90 transition-transform"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => onDelete(product.id)}
            className="w-7 h-7 rounded-full bg-[#0a0a0acc] backdrop-blur-sm flex items-center justify-center hover:bg-rs-surface-container-highest text-red-400 active:scale-90 transition-transform"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1 justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-white text-xs leading-tight line-clamp-2">{product.name}</h3>
        </div>

        <div className="space-y-1">
          <div className="font-mono text-sm font-black text-rs-surface-tint">
            {formatCurrency(product.price || product.unit_price || 0)}
          </div>

          <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-[#262626] text-rs-on-surface-variant">
            {product.item_type === 'pack' ? (
              <div className="flex items-center gap-1 font-semibold text-purple-400">
                <Boxes className="w-3.5 h-3.5" />
                <span>{product.pack_items?.length || 0} articles</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 font-mono">
                <span className={`w-1.5 h-1.5 rounded-full ${isLowStock ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <span className={isLowStock ? 'text-amber-400 font-bold' : 'text-emerald-400 font-semibold'}>
                  {product.quantity} {product.unit_type || 'pcs'}
                </span>
              </div>
            )}
            {isLowStock && <AlertTriangle className="w-3 h-3 text-amber-400" />}
          </div>
        </div>
      </div>
    </div>
  );
});
