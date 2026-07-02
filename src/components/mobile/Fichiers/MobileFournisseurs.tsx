import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { ArrowLeft, Search, User, Phone, MapPin, Plus, Edit, Trash2, Check, DollarSign } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MobileFournisseursProps {
  onBack: () => void;
}

export function MobileFournisseurs({ onBack }: MobileFournisseursProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatCurrency } = useFormatters();

  const { suppliers, setSuppliers, addSupplier, updateSupplier, deleteSupplier } = useMasterDataStore();
  const [storeId, setStoreId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Form states
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    default_purchase_type: 'cost',
  });

  useEffect(() => {
    OfflineAuthService.getOfflineSession().then(session => {
      const sid = session?.roles?.find(r => r.store_id)?.store_id || session?.user?.user_metadata?.store_id;
      if (sid) {
        setStoreId(sid);
        loadSuppliers(sid);
      }
    });
  }, []);

  const loadSuppliers = async (sid: string) => {
    setLoading(true);
    try {
      const { getDataClient } = await import('@/lib/dataClient');
      const { OfflineAuthService: authService } = await import('@/services/OfflineAuthService');
      const dc = getDataClient();
      const headers = await authService.getAuthHeaders();
      
      const res = await fetch(
        `${dc.localBridgeBaseUrl}/rest/v1/suppliers?${new URLSearchParams({ store_id: sid }).toString()}`,
        { headers }
      );
      if (!res.ok) throw new Error('Error loading suppliers');
      const data = await res.json();
      setSuppliers(data || []);
    } catch (err) {
      console.error(err);
      toast({ title: t('common.error'), description: 'Erreur lors du chargement des fournisseurs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [suppliers, searchQuery]);

  const handleOpenForm = (supplier?: any) => {
    if (!supplier) {
      setEditingSupplier(null);
      setFormData({ name: '', phone: '', address: '', default_purchase_type: 'cost' });
    } else {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        default_purchase_type: supplier.default_purchase_type || 'cost',
      });
    }
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { getDataClient } = await import('@/lib/dataClient');
      const { OfflineAuthService: authService } = await import('@/services/OfflineAuthService');
      const dc = getDataClient();
      const headers = await authService.getAuthHeaders();

      const payload = {
        store_id: storeId,
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        default_purchase_type: formData.default_purchase_type,
      };

      if (editingSupplier) {
        const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/suppliers/${editingSupplier.id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        updateSupplier(editingSupplier.id, updated);
        toast({ title: t('common.success'), description: 'Fournisseur mis à jour' });
      } else {
        const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/suppliers`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, code: `SUP-${Date.now().toString().slice(-6)}` }),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        addSupplier(created);
        toast({ title: t('common.success'), description: 'Fournisseur créé' });
      }
      setFormOpen(false);
    } catch (err) {
      toast({ title: t('common.error'), description: 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer ce fournisseur ?')) return;
    try {
      const { getDataClient } = await import('@/lib/dataClient');
      const { OfflineAuthService: authService } = await import('@/services/OfflineAuthService');
      const dc = getDataClient();
      const headers = await authService.getAuthHeaders();

      const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/suppliers/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error();
      deleteSupplier(id);
      toast({ title: t('common.success'), description: 'Fournisseur supprimé' });
    } catch (err) {
      toast({ title: t('common.error'), description: 'Impossible de supprimer le fournisseur', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[64px] font-sans text-white">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container-highest px-4 py-4 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-rs-surface-container-highest text-white active:scale-95 transition-transform">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-8 h-8 rounded bg-rs-surface-tint/20 flex items-center justify-center">
            <User className="w-4 h-4 text-rs-surface-tint" />
          </div>
          <h1 className="text-lg font-bold text-white uppercase tracking-wider">Fournisseurs</h1>
        </div>
        <button onClick={() => handleOpenForm()} className="w-10 h-10 rounded-full bg-rs-surface-tint hover:bg-rs-primary-fixed flex items-center justify-center text-white active:scale-95 transition-transform shadow-lg">
          <Plus className="w-6 h-6" />
        </button>
      </header>

      {/* Search & List */}
      <div className="px-4 py-3 bg-[#141414] border-b border-rs-surface-container-highest">
        <div className="relative">
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, téléphone, code..."
            className="w-full h-11 bg-rs-surface-container border border-rs-surface-container-highest rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-rs-surface-tint text-white placeholder-rs-on-surface-variant/50"
          />
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-rs-on-surface-variant/60" />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-rs-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[32px] text-rs-surface-tint mb-2">refresh</span>
            <span>Chargement des fournisseurs...</span>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-20 text-rs-on-surface-variant">
            <User className="h-12 w-12 mx-auto text-rs-on-surface-variant opacity-40 mb-3" />
            <p>Aucun fournisseur trouvé.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredSuppliers.map(supplier => (
              <div 
                key={supplier.id}
                className="bg-[#141414] border border-rs-surface-container-highest rounded-2xl p-4 flex flex-col gap-3 shadow-md"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base truncate">{supplier.name}</h3>
                      <span className="text-[10px] font-mono text-rs-surface-tint bg-rs-surface-tint/15 px-1.5 py-0.5 rounded font-semibold shrink-0">
                        {supplier.code}
                      </span>
                    </div>
                    {supplier.phone && (
                      <div className="flex items-center gap-1 text-xs text-rs-on-surface-variant mt-1.5">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex items-center gap-1 text-xs text-rs-on-surface-variant mt-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{supplier.address}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleOpenForm(supplier)} className="p-2 rounded-full hover:bg-rs-surface-container text-rs-surface-tint">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(supplier.id)} className="p-2 rounded-full hover:bg-rs-surface-container text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-rs-surface-container/30 text-xs">
                  <div className="flex items-center gap-1 text-rs-on-surface">
                    <Check className="w-4 h-4 text-rs-surface-tint" />
                    <span>Tarif d'achat : <span className="font-semibold uppercase text-rs-surface-tint">{supplier.default_purchase_type || 'coût'}</span></span>
                  </div>
                  <div className="text-right">
                    <span className="text-rs-on-surface-variant">Solde dû: </span>
                    <span className={`font-mono font-bold ${supplier.balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {formatCurrency(supplier.balance || 0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Sheet Form */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent side="bottom" className="h-[90%] bg-[#141414] text-white border-t border-rs-surface-container-highest rounded-t-2xl p-6 dark">
          <SheetHeader className="text-left mb-6">
            <SheetTitle className="text-xl font-bold text-rs-surface-tint">
              {editingSupplier ? 'Modifier le Fournisseur' : 'Ajouter un Fournisseur'}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sup-name">Nom complet / Entreprise</Label>
              <Input id="sup-name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="bg-rs-surface-container border-rs-surface-container-highest text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-phone">Téléphone</Label>
              <Input id="sup-phone" type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="bg-rs-surface-container border-rs-surface-container-highest text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-address">Adresse</Label>
              <Input id="sup-address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="bg-rs-surface-container border-rs-surface-container-highest text-white" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-purch-type">Type de prix d'achat par défaut</Label>
              <Select value={formData.default_purchase_type} onValueChange={v => setFormData({ ...formData, default_purchase_type: v })}>
                <SelectTrigger id="sup-purch-type" className="bg-rs-surface-container border-rs-surface-container-highest text-white">
                  <SelectValue placeholder="Choisir le type" />
                </SelectTrigger>
                <SelectContent className="bg-rs-surface-container border-rs-surface-container-highest text-white">
                  <SelectItem value="cost">Prix de Revient (Coût)</SelectItem>
                  <SelectItem value="wholesale">Tarif Gros (Selling 3 / Wholesale)</SelectItem>
                  <SelectItem value="resale">Tarif Revendeur (Selling 4)</SelectItem>
                  <SelectItem value="discount">Tarif Discount (Selling 2)</SelectItem>
                </SelectContent>
              </Select>
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
