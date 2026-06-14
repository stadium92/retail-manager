import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { OfflineTeamService } from '@/services/OfflineTeamService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { useAuth } from '@/contexts/AuthContext';
import { Store } from '@/types';
import { 
  Store as StoreIcon, 
  MapPin, 
  Phone, 
  Users, 
  Package, 
  TrendingUp, 
  Plus, 
  ArrowLeft, 
  Edit, 
  Trash2, 
  ShieldAlert, 
  Check, 
  ChevronRight,
  Search,
  ShoppingCart,
  AlertTriangle
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MobileRestaurantsProps {
  onBack: () => void;
}

export function MobileRestaurants({ onBack }: MobileRestaurantsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatCurrency } = useFormatters();

  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeDetails, setStoreDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');

  // Form states
  const [formOpen, setFormOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    image_url: '',
    default_price_tier: '1',
  });

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    setLoading(true);
    const { data, error } = await OfflineStoreService.getStores();
    if (error) {
      toast({
        title: t('common.error'),
        description: t('stores.errors.loadStores'),
        variant: 'destructive',
      });
    } else {
      const list = data || [];
      // Load inventory count for each store in list
      const storesWithCounts = await Promise.all(list.map(async (store) => {
        try {
          const { data: inventory } = await OfflineInventoryService.getInventory(store.id);
          return {
            ...store,
            itemCount: inventory?.length || 0
          };
        } catch (e) {
          return {
            ...store,
            itemCount: 0
          };
        }
      }));
      setStores(storesWithCounts || []);
    }
    setLoading(false);
  };

  const loadStoreDetails = async (storeId: string) => {
    setDetailsLoading(true);
    try {
      const { data: store } = await OfflineStoreService.getStore(storeId);
      const { data: allWorkers } = await OfflineTeamService.getWorkers();
      const workers = (allWorkers || []).filter(w => w.store_id === storeId);
      
      const { data: inventory } = await OfflineInventoryService.getInventory(storeId);
      const sales = await OfflineSalesService.getSales(storeId);
      const metrics = await OfflineSalesService.getSaleMetrics(storeId);
      
      const lowStockCount = inventory?.filter(item => item.quantity <= (item.low_stock_threshold || 10)).length || 0;
      const totalInventoryValue = inventory?.reduce((sum, item) => 
        sum + ((item.price || item.unit_price || 0) * (item.quantity || 0)), 0
      ) || 0;
      
      setStoreDetails({
        store,
        workers,
        lowStockCount,
        metrics: {
          ...metrics,
          totalInventoryValue
        },
        inventoryCount: inventory?.length || 0,
        inventory: inventory || [],
        recentSales: sales.slice(0, 15) || []
      });
    } catch (err) {
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSelectStore = (store: Store) => {
    setSelectedStore(store);
    setInventorySearch('');
    loadStoreDetails(store.id);
  };

  const handleOpenForm = (store?: Store) => {
    if (!store) {
      setEditingStore(null);
      setFormData({ name: '', address: '', phone: '', image_url: '', default_price_tier: '1' });
    } else {
      setEditingStore(store);
      setFormData({
        name: store.name,
        address: store.address || '',
        phone: store.phone || '',
        image_url: (store as any).image_url || '',
        default_price_tier: (store.default_price_tier || 1).toString(),
      });
    }
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ownerId = user?.id || crypto.randomUUID();

    if (editingStore) {
      const updates = {
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        default_price_tier: parseInt(formData.default_price_tier) || 1,
      };
      const { error } = await OfflineStoreService.updateStore(editingStore.id, updates);
      if (error) {
        toast({ title: t('common.error'), description: t('stores.errors.updateStore'), variant: 'destructive' });
      } else {
        toast({ title: t('common.success'), description: t('stores.success.updateStore') });
        loadStores();
        if (selectedStore?.id === editingStore.id) {
          loadStoreDetails(editingStore.id);
        }
        setFormOpen(false);
      }
    } else {
      const storeData = {
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        owner_id: ownerId,
        default_price_tier: parseInt(formData.default_price_tier) || 1,
      };
      const { error } = await OfflineStoreService.createStore(storeData);
      if (error) {
        toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
      } else {
        toast({ title: t('common.success'), description: t('stores.success.createStore') });
        loadStores();
        setFormOpen(false);
      }
    }
  };

  const handleDelete = async (storeId: string) => {
    if (!confirm("Voulez-vous supprimer ce restaurant ?")) return;
    const { error } = await OfflineStoreService.deleteStore(storeId);
    if (error) {
      toast({ title: t('common.error'), description: t('stores.errors.deleteStore'), variant: 'destructive' });
    } else {
      toast({ title: t('common.success'), description: t('stores.success.deleteStore') });
      setSelectedStore(null);
      loadStores();
    }
  };

  if (selectedStore) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] font-sans text-white">
        <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => setSelectedStore(null)} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate uppercase tracking-wider">{selectedStore.name}</h1>
            <p className="text-xs text-rs-on-surface-variant">Détails du Restaurant</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => handleOpenForm(selectedStore)} className="p-2 rounded-full hover:bg-rs-surface-container-highest text-rs-surface-tint">
              <Edit className="w-5 h-5" />
            </button>
            <button onClick={() => handleDelete(selectedStore.id)} className="p-2 rounded-full hover:bg-rs-surface-container-highest text-red-500">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {detailsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-rs-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-[32px] text-rs-surface-tint mb-2">refresh</span>
              <span>Chargement...</span>
            </div>
          ) : storeDetails ? (
            <Tabs defaultValue="info" className="w-full space-y-4">
              <TabsList className="grid w-full grid-cols-4 bg-[#141414] border border-rs-surface-container-highest rounded-xl p-1 h-11">
                <TabsTrigger value="info" className="text-xs font-semibold text-white/70 data-[state=active]:bg-rs-surface-tint data-[state=active]:text-white rounded-lg">Général</TabsTrigger>
                <TabsTrigger value="workers" className="text-xs font-semibold text-white/70 data-[state=active]:bg-rs-surface-tint data-[state=active]:text-white rounded-lg">Personnel</TabsTrigger>
                <TabsTrigger value="inventory" className="text-xs font-semibold text-white/70 data-[state=active]:bg-rs-surface-tint data-[state=active]:text-white rounded-lg">Inventaire</TabsTrigger>
                <TabsTrigger value="sales" className="text-xs font-semibold text-white/70 data-[state=active]:bg-rs-surface-tint data-[state=active]:text-white rounded-lg">Ventes</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                {/* Info Cards */}
                <section className="bg-[#141414] border border-rs-surface-container-highest rounded-2xl p-4 space-y-3">
                  <h2 className="text-sm font-bold text-rs-surface-tint uppercase tracking-wider">Fiche d'information</h2>
                  <div className="space-y-2 text-sm">
                    {storeDetails.store?.address && (
                      <div className="flex items-start gap-2.5 text-rs-on-surface">
                        <MapPin className="w-4 h-4 text-rs-surface-tint shrink-0 mt-0.5" />
                        <span>{storeDetails.store.address}</span>
                      </div>
                    )}
                    {storeDetails.store?.phone && (
                      <div className="flex items-center gap-2.5 text-rs-on-surface">
                        <Phone className="w-4 h-4 text-rs-surface-tint shrink-0" />
                        <span>{storeDetails.store.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 text-rs-on-surface">
                      <Check className="w-4 h-4 text-rs-surface-tint shrink-0" />
                      <span>Tarif par défaut : Tier {storeDetails.store?.default_price_tier || 1}</span>
                    </div>
                  </div>
                </section>

                 {/* Metrics Grid */}
                <section className="grid grid-cols-2 gap-3">
                  <div className="bg-[#141414] border border-rs-surface-container-highest p-4 rounded-2xl flex flex-col gap-1 shadow">
                    <TrendingUp className="w-5 h-5 text-emerald-400 mb-1" />
                    <span className="text-[10px] text-rs-on-surface-variant uppercase tracking-wider">Aujourd'hui</span>
                    <span className="text-base font-bold font-mono text-white truncate">
                      {formatCurrency(storeDetails.metrics?.todaySales || 0)}
                    </span>
                  </div>
                  <div className="bg-[#141414] border border-rs-surface-container-highest p-4 rounded-2xl flex flex-col gap-1 shadow">
                    <TrendingUp className="w-5 h-5 text-teal-400 mb-1" />
                    <span className="text-[10px] text-rs-on-surface-variant uppercase tracking-wider">Cette Semaine</span>
                    <span className="text-base font-bold font-mono text-white truncate">
                      {formatCurrency(storeDetails.metrics?.weekSales || 0)}
                    </span>
                  </div>
                  <div className="bg-[#141414] border border-rs-surface-container-highest p-4 rounded-2xl flex flex-col gap-1 shadow">
                    <Package className="w-5 h-5 text-blue-400 mb-1" />
                    <span className="text-[10px] text-rs-on-surface-variant uppercase tracking-wider">Valeur Stock</span>
                    <span className="text-base font-bold font-mono text-white truncate">
                      {formatCurrency(storeDetails.metrics?.totalInventoryValue || 0)}
                    </span>
                  </div>
                  <div className="bg-[#141414] border border-rs-surface-container-highest p-4 rounded-2xl flex flex-col gap-1 shadow">
                    <AlertTriangle className={`w-5 h-5 mb-1 ${storeDetails.lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <span className="text-[10px] text-rs-on-surface-variant uppercase tracking-wider">Alertes Stock</span>
                    <span className="text-base font-bold font-mono text-white truncate">
                      {storeDetails.lowStockCount} articles
                    </span>
                  </div>
                </section>

                {/* Warnings */}
                {storeDetails.lowStockCount > 0 && (
                  <div className="bg-red-950/20 border border-red-800/40 p-3 rounded-xl flex items-center gap-3 text-red-200">
                    <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                    <div className="text-xs">
                      <p className="font-bold">{storeDetails.lowStockCount} Articles en Alerte Stock</p>
                      <p className="text-red-300/80">Le niveau de stock est inférieur au seuil d'alerte.</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="workers" className="space-y-3">
                <h3 className="text-sm font-bold text-rs-surface-tint uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Personnel affecté ({storeDetails.workers.length})
                </h3>
                {storeDetails.workers.length === 0 ? (
                  <p className="text-xs text-rs-on-surface-variant py-2">Aucun personnel affecté.</p>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {storeDetails.workers.map((worker: any) => (
                      <div key={worker.id} className="flex justify-between items-center p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate text-white">{worker.full_name}</p>
                          <p className="text-xs text-rs-on-surface-variant truncate">{worker.email}</p>
                        </div>
                        <span className="text-[10px] uppercase bg-rs-surface-tint/25 text-rs-surface-tint px-2 py-1 rounded-full font-bold">
                          {worker.sub_role || worker.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="inventory" className="space-y-3">
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Rechercher un article..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="w-full h-11 bg-rs-surface-container border border-rs-surface-container-highest rounded-xl pl-10 pr-4 text-xs focus:outline-none text-white placeholder-rs-on-surface-variant/50"
                  />
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-rs-on-surface-variant/60" />
                </div>
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {(storeDetails.inventory || [])
                    .filter((item: any) => item.name?.toLowerCase().includes(inventorySearch.toLowerCase()))
                    .map((item: any) => {
                      const isLowStock = item.quantity <= (item.low_stock_threshold || 10);
                      const itemVal = (item.price || item.unit_price || 0) * (item.quantity || 0);
                      return (
                        <div key={item.id} className="p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest flex flex-col gap-2 shadow">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-semibold text-white">{item.name}</p>
                              <p className="text-[10px] text-rs-on-surface-variant uppercase tracking-wider mt-0.5">
                                {item.category || 'Général'} {item.sku && `• SKU: ${item.sku}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold font-mono ${isLowStock ? 'text-amber-400' : 'text-white'}`}>
                                {item.quantity} {item.unit_type || item.unit || 'pcs'}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center border-t border-rs-surface-container/30 pt-2 text-xs">
                            <span className="text-rs-on-surface-variant font-mono">
                              P.U: {formatCurrency(item.price || item.unit_price || 0)}
                            </span>
                            <div className="flex items-center gap-2">
                              {isLowStock && (
                                <span className="bg-amber-500/20 text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/20 uppercase">
                                  Alerte
                                </span>
                              )}
                              <span className="font-bold text-rs-surface-tint font-mono">
                                Val: {formatCurrency(itemVal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </TabsContent>

              <TabsContent value="sales" className="space-y-3">
                <h3 className="text-sm font-bold text-rs-surface-tint uppercase tracking-wider flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Ventes Récentes
                </h3>
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {storeDetails.recentSales.length === 0 ? (
                    <p className="text-xs text-rs-on-surface-variant py-2">Aucune vente récente.</p>
                  ) : (
                    storeDetails.recentSales.map((sale: any) => (
                      <div key={sale.id} className="p-3 rounded-xl bg-[#141414] border border-rs-surface-container-highest flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-white font-mono">{sale.invoice_number || 'Facture'}</p>
                          <p className="text-xs text-rs-on-surface-variant">{sale.customer_name || 'Client Anonyme'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-rs-surface-tint font-mono">{formatCurrency(sale.total_price || 0)}</p>
                          <p className="text-[10px] text-rs-on-surface-variant font-mono">{new Date(sale.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : null}
        </main>

        {/* Edit Dialog inside details */}
        <Sheet open={formOpen} onOpenChange={setFormOpen}>
          <SheetContent side="bottom" className="h-[90%] bg-[#141414] text-white border-t border-rs-surface-container-highest rounded-t-2xl p-6 dark">
            <SheetHeader className="text-left mb-6">
              <SheetTitle className="text-xl font-bold text-rs-surface-tint">Modifier le Restaurant</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du Restaurant</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="bg-rs-surface-container border-rs-surface-container-highest text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_price_tier">Tarification par défaut</Label>
                <Select value={formData.default_price_tier} onValueChange={v => setFormData({ ...formData, default_price_tier: v })}>
                  <SelectTrigger id="default_price_tier" className="bg-rs-surface-container border-rs-surface-container-highest text-white">
                    <SelectValue placeholder="Choisir tarif" />
                  </SelectTrigger>
                  <SelectContent className="bg-rs-surface-container border-rs-surface-container-highest text-white">
                    <SelectItem value="1">Prix 1 - Détail</SelectItem>
                    <SelectItem value="2">Prix 2 - Discount</SelectItem>
                    <SelectItem value="3">Prix 3 - Gros (Wholesale)</SelectItem>
                    <SelectItem value="4">Prix 4 - Revendeur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="bg-rs-surface-container border-rs-surface-container-highest text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="bg-rs-surface-container border-rs-surface-container-highest text-white" />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1 border-rs-surface-container-highest text-white hover:bg-rs-surface-container">Annuler</Button>
                <Button type="submit" className="flex-1 bg-rs-surface-tint hover:bg-rs-primary-fixed text-white font-bold">Mettre à jour</Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] font-sans text-white">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-4 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
            <StoreIcon className="w-4 h-4 text-rs-surface-tint" />
          </div>
          <h1 className="text-lg font-bold text-white uppercase tracking-wider">Restaurants</h1>
        </div>
        <button onClick={() => handleOpenForm()} className="w-10 h-10 rounded-full bg-rs-surface-tint hover:bg-rs-primary-fixed flex items-center justify-center text-white active:scale-95 transition-transform shadow-lg">
          <Plus className="w-6 h-6" />
        </button>
      </header>

      {/* Main Stores List */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-rs-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[32px] text-rs-surface-tint mb-2">refresh</span>
            <span>Chargement des restaurants...</span>
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-20 text-rs-on-surface-variant">
            <StoreIcon className="h-12 w-12 mx-auto text-rs-on-surface-variant opacity-40 mb-3" />
            <p>Aucun restaurant disponible.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {stores.map(store => (
              <div 
                key={store.id}
                onClick={() => handleSelectStore(store)}
                className="bg-[#141414] border border-rs-surface-container-highest rounded-2xl p-4 flex justify-between items-center active:bg-rs-surface-container-low transition-all shadow-md"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="font-bold text-white text-base truncate">{store.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-rs-on-surface-variant truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{store.address || 'Aucune adresse renseignée'}</span>
                  </div>
                  {store.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-rs-on-surface-variant">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{store.phone}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0 ml-4">
                  <span className="text-xs uppercase bg-rs-surface-tint/15 text-rs-surface-tint font-bold px-2 py-0.5 rounded-full">
                    {store.itemCount || 0} Articles
                  </span>
                  <span className="text-[10px] uppercase bg-neutral-800 text-neutral-300 font-semibold px-2 py-0.5 rounded-full">
                    Tier {store.default_price_tier || 1}
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-60 ml-2 text-rs-on-surface-variant" />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Dialog */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="bottom" className="h-[90%] bg-[#141414] text-white border-t border-rs-surface-container-highest rounded-t-2xl p-6 dark">
          <SheetHeader className="text-left mb-6">
            <SheetTitle className="text-xl font-bold text-rs-surface-tint">Ajouter un Restaurant</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Nom du Restaurant</Label>
              <Input id="new-name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="bg-rs-surface-container border-rs-surface-container-highest text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-default_price_tier">Tarification par défaut</Label>
              <Select value={formData.default_price_tier} onValueChange={v => setFormData({ ...formData, default_price_tier: v })}>
                <SelectTrigger id="new-default_price_tier" className="bg-rs-surface-container border-rs-surface-container-highest text-white">
                  <SelectValue placeholder="Choisir tarif" />
                </SelectTrigger>
                <SelectContent className="bg-rs-surface-container border-rs-surface-container-highest text-white">
                  <SelectItem value="1">Prix 1 - Détail</SelectItem>
                  <SelectItem value="2">Prix 2 - Discount</SelectItem>
                  <SelectItem value="3">Prix 3 - Gros (Wholesale)</SelectItem>
                  <SelectItem value="4">Prix 4 - Revendeur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-address">Adresse</Label>
              <Input id="new-address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="bg-rs-surface-container border-rs-surface-container-highest text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-phone">Téléphone</Label>
              <Input id="new-phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="bg-rs-surface-container border-rs-surface-container-highest text-white" />
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1 border-rs-surface-container-highest text-white hover:bg-rs-surface-container">Annuler</Button>
              <Button type="submit" className="flex-1 bg-rs-surface-tint hover:bg-rs-primary-fixed text-white font-bold">Enregistrer</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
