import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Edit2, Trash2, Package, Barcode, History } from 'lucide-react';
import { getDataClient } from '@/lib/dataClient';
import { useMasterDataStore, ProductMaster, Supplier } from '@/stores/useMasterDataStore';
import { toast } from '@/hooks/use-toast';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useTranslation } from 'react-i18next';
import { ImageUpload } from '@/components/shared/ImageUpload';

interface FichiersProduitsModuleProps {
  storeId: string;
}

export function FichiersProduitsModule({ storeId }: FichiersProduitsModuleProps) {
  const { t } = useTranslation();
  const { supabase } = getDataClient();
  const { products, setProducts, families, setFamilies, setSuppliers, setLoading } = useMasterDataStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '', sku: '', barcode: '', description: '',
    purchase_price: 0, selling_price_detail: 0, selling_price_wholesale: 0,
    selling_price_ht: 0, selling_price_ttc: 0, min_stock_alert: 10,
    unit_type: 'Pièce', family_id: '', brand: '', aisle: '', preferred_supplier_id: '',
    packaging: '', reorder_quantity: 0, expiry_date: '', image_url: '',
  });

  useEffect(() => {
    if (storeId) {
      fetchData();
    }
  }, [storeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Use the unified service that handles both Online and LocalBridge modes
      const [inventoryRes, familiesRes] = await Promise.all([
        OfflineInventoryService.getInventory(storeId, { notify: false }),
        OfflineInventoryService.getProductFamilies(storeId)
      ]);

      if (inventoryRes.data) {
        // Map InventoryItem to ProductMaster
        const mapped: ProductMaster[] = inventoryRes.data.map(item => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          barcode: item.sku,
          description: item.description,
          purchase_price: item.cost,
          selling_price_detail: item.price,
          selling_price_wholesale: item.wholesale_price_ttc,
          selling_price_ht: item.wholesale_price_ht,
          selling_price_ttc: item.wholesale_price_ttc,
          min_stock_alert: item.low_stock_threshold,
          current_stock: item.quantity,
          unit_type: item.unit_type || 'Pièce',
          family_id: item.category_id,
          brand: item.brand || '',
          packaging: item.packaging || '',
          aisle: item.aisle || '',
          expiry_date: item.expiry_date,
          store_id: item.store_id,
          image_url: item.image_url,
          created_at: item.created_at,
          updated_at: item.updated_at,
        } as unknown as ProductMaster));
        setProducts(mapped);
      }

      if (familiesRes.data) {
        setFamilies(familiesRes.data as any);
      }

      // Fetch suppliers separately
      const { data: suppliers } = await (supabase as any).from('suppliers').select('*').eq('store_id', storeId).order('name');
      if (suppliers) setSuppliers(suppliers);

    } catch (err) {
      console.error('Failed to fetch data:', err);
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!formData.name.trim()) return toast({ title: 'Erreur', description: 'Le nom est requis', variant: 'destructive' });

    setIsSaving(true);
    const productData = {
      name: formData.name.trim(),
      sku: formData.sku.trim() || undefined,
      price: Number(formData.selling_price_detail) || 0,
      wholesale_price_ht: Number(formData.selling_price_ht) || 0,
      wholesale_price_ttc: Number(formData.selling_price_ttc) || 0,
      cost: Number(formData.purchase_price) || 0,
      quantity: editingProduct ? editingProduct.current_stock : 0,
      low_stock_threshold: Number(formData.min_stock_alert) || 10,
      store_id: storeId,
      category_id: formData.family_id || undefined,
      packaging: formData.packaging || undefined,
      unit_type: formData.unit_type || 'Pièce',
      brand: formData.brand || undefined,
      aisle: formData.aisle || undefined,
      expiry_date: formData.expiry_date || undefined,
      reorder_quantity: Number(formData.reorder_quantity) || 0,
      description: formData.description || undefined,
      image_url: formData.image_url || undefined,
    };

    try {
      let res;
      if (editingProduct) {
        res = await OfflineInventoryService.updateItem(editingProduct.id, productData);
      } else {
        res = await OfflineInventoryService.createItem(productData);
      }

      if (res.error) throw res.error;

      toast({ title: 'Succès', description: 'Produit enregistré.' });
      await fetchData();
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (p: ProductMaster) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku || '',
      barcode: p.barcode || '',
      description: p.description || '',
      purchase_price: p.purchase_price || 0,
      selling_price_detail: p.selling_price_detail || 0,
      selling_price_wholesale: p.selling_price_wholesale || 0,
      selling_price_ht: p.selling_price_ht || 0,
      selling_price_ttc: p.selling_price_ttc || 0,
      min_stock_alert: p.min_stock_alert || 10,
      unit_type: p.unit_type || 'Pièce',
      family_id: p.family_id || '',
      brand: p.brand || '',
      aisle: p.aisle || '',
      preferred_supplier_id: p.preferred_supplier_id || '',
      packaging: p.packaging || '',
      reorder_quantity: p.reorder_quantity || 0,
      expiry_date: p.expiry_date || '',
      image_url: p.image_url || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    try {
      const { error } = await OfflineInventoryService.deleteItem(id);
      if (error) throw error;
      toast({ title: 'Produit supprimé' });
      await fetchData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '', sku: '', barcode: '', description: '',
      purchase_price: 0, selling_price_detail: 0, selling_price_wholesale: 0,
      selling_price_ht: 0, selling_price_ttc: 0, min_stock_alert: 10,
      unit_type: 'Pièce', family_id: '', brand: '', aisle: '', preferred_supplier_id: '',
      packaging: '', reorder_quantity: 0, expiry_date: '', image_url: '',
    });
  };

  const generateBarcode = () => setFormData(f => ({ ...f, barcode: `PRD${Date.now().toString(36).toUpperCase()}` }));

  const marginPercent = formData.purchase_price > 0
    ? (((formData.selling_price_detail - formData.purchase_price) / formData.purchase_price) * 100).toFixed(1)
    : '0';

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const mSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const mFamily = selectedFamily === 'all' || p.family_id === selectedFamily;
      return mSearch && mFamily;
    });
  }, [products, searchQuery, selectedFamily]);

  return (
    <div className="h-full flex flex-col p-4 gap-4 bg-background">
      {/* Search Header */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('common.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={selectedFamily} onValueChange={setSelectedFamily}>
          <SelectTrigger className="w-48 h-10"><SelectValue placeholder="Famille" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les familles</SelectItem>
            {families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="h-10 px-6"><Plus className="h-4 w-4 mr-2" /> Produit</Button>
      </div>

      {/* Table */}
      <Card className="flex-1 overflow-hidden border-border/50">
        <CardContent className="p-0 h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Famille</TableHead>
                <TableHead className="text-right">Prix Achat</TableHead>
                <TableHead className="text-right">Prix Détail</TableHead>
                <TableHead className="text-right">Packaging</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p, i) => (
                <TableRow key={p.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium text-primary">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.sku || '-'}</TableCell>
                  <TableCell>{families.find(f => f.id === p.family_id)?.name || '-'}</TableCell>
                  <TableCell className="text-right">{(p.purchase_price || 0).toLocaleString()} F</TableCell>
                  <TableCell className="text-right font-bold text-primary">{(p.selling_price_detail || 0).toLocaleString()} F</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{p.packaging || '-'}</TableCell>
                  <TableCell className="text-right"><Badge variant={p.current_stock <= (p.min_stock_alert || 0) ? 'destructive' : 'secondary'}>{p.current_stock}</Badge></TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    Aucun article trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Product Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-full w-full h-[95vh] p-0 flex flex-col gap-0 rounded-none sm:rounded-lg sm:max-w-6xl sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b bg-card shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Package className="h-6 w-6 text-primary" /> {editingProduct ? 'Modifier Produit' : 'Nouveau Produit'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex-1 flex flex-col min-h-0 bg-background">
            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Column 1: General */}
                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">Identification</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-bold">Nom du Produit *</Label>
                      <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required className="h-12 text-lg font-semibold bg-muted/20" placeholder="ex: Coca Cola 1.5L" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">REF / SKU</Label>
                        <Input value={formData.sku} onChange={e => setFormData(f => ({ ...f, sku: e.target.value }))} className="h-10 font-mono" placeholder="REF-001" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Code Barre</Label>
                        <div className="flex gap-2">
                          <Input value={formData.barcode} onChange={e => setFormData(f => ({ ...f, barcode: e.target.value }))} className="h-10 font-mono" placeholder="12345678" />
                          <Button type="button" variant="outline" size="icon" onClick={generateBarcode} className="h-10 w-10 shrink-0"><Barcode className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-primary">Famille / Catégorie</Label>
                      <Select value={formData.family_id} onValueChange={v => setFormData(f => ({ ...f, family_id: v }))}>
                        <SelectTrigger className="h-10 bg-primary/5 border-primary/20"><SelectValue placeholder="Choisir une famille" /></SelectTrigger>
                        <SelectContent>
                          {families.map(fam => <SelectItem key={fam.id} value={fam.id}>{fam.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">Marque</Label>
                      <Input value={formData.brand} onChange={e => setFormData(f => ({ ...f, brand: e.target.value }))} className="h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">Description</Label>
                      <Input value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} className="h-10" />
                    </div>
                  </div>
                </div>

                {/* Column 2: Pricing */}
                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">Prix et Marges</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-black text-primary uppercase tracking-wider">Prix de Vente (Détail) *</Label>
                      <div className="relative">
                        <Input type="number" value={formData.selling_price_detail} onChange={e => setFormData(f => ({ ...f, selling_price_detail: Number(e.target.value) }))} required className="h-14 text-2xl font-black border-primary/40 bg-primary/5 pl-4 pr-12 text-primary" />
                        <span className="absolute right-4 top-4 font-black text-primary/40 text-xl">F</span>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-bold uppercase">Prix d'Achat</Label>
                      <div className="relative">
                        <Input type="number" value={formData.purchase_price} onChange={e => setFormData(f => ({ ...f, purchase_price: Number(e.target.value) }))} className="h-10 font-bold bg-muted/30" />
                        <span className="absolute right-3 top-2.5 text-muted-foreground text-xs font-bold">F</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Prix Gros (HT)</Label>
                        <Input type="number" value={formData.selling_price_ht} onChange={e => setFormData(f => ({ ...f, selling_price_ht: Number(e.target.value) }))} className="h-10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Prix Gros (TTC)</Label>
                        <Input type="number" value={formData.selling_price_ttc} onChange={e => setFormData(f => ({ ...f, selling_price_ttc: Number(e.target.value) }))} className="h-10" />
                      </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-success/5 border border-success/10 mt-4 shadow-inner">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-widest text-success/60">Marge calculée:</span>
                        <span className="text-3xl font-black text-success">{marginPercent}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Stock & More */}
                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">Logistique</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Unité</Label>
                        <Select value={formData.unit_type} onValueChange={v => setFormData(f => ({ ...f, unit_type: v }))}>
                          <SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pièce">Pièce</SelectItem>
                            <SelectItem value="Kg">Kg</SelectItem>
                            <SelectItem value="L">Litre</SelectItem>
                            <SelectItem value="Carton">Carton</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-primary">Conditionnement</Label>
                        <Input value={formData.packaging} onChange={e => setFormData(f => ({ ...f, packaging: e.target.value }))} placeholder="Ex: 12" className="h-10 font-bold border-primary/20" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Seuil Alerte</Label>
                        <Input type="number" value={formData.min_stock_alert} onChange={e => setFormData(f => ({ ...f, min_stock_alert: Number(e.target.value) }))} className="h-10 text-danger font-bold" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">Rayon</Label>
                        <Input value={formData.aisle} onChange={e => setFormData(f => ({ ...f, aisle: e.target.value }))} className="h-10" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">Date de Péremption</Label>
                      <Input type="date" value={formData.expiry_date} onChange={e => setFormData(f => ({ ...f, expiry_date: e.target.value }))} className="h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">Image du Produit</Label>
                      <ImageUpload currentImageUrl={formData.image_url} onImageUploaded={url => setFormData(f => ({ ...f, image_url: url }))} onImageRemoved={() => setFormData(f => ({ ...f, image_url: '' }))} folder="inventory" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-muted/10 flex justify-end gap-4 shrink-0">
              <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)} className="h-12 px-10 font-bold uppercase tracking-widest text-xs">Annuler</Button>
              <Button type="submit" disabled={isSaving} className="h-12 px-12 font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-primary/20">{isSaving ? 'Chargement...' : editingProduct ? 'Mettre à jour' : 'Enregistrer le produit'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}