import { useState, useEffect } from 'react';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { InventoryItem, Store } from '@/types';
import { LocalBridgeSyncService } from '@/services/LocalBridgeSyncService';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Package, AlertTriangle, Search, Download, FileText, FileSpreadsheet, File, ScanBarcode, WifiOff, RefreshCw, Barcode } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExportService } from '@/services/ExportService';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { useSelection } from '@/hooks/useSelection';
import { BarcodeScanner } from '@/components/shared/BarcodeScanner';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { supabase } from '@/integrations/supabase/client';
import { usePurchasingStore } from '@/stores/usePurchasingStore';
import { LocalProductFamily } from '@/services/LocalDatabase';

export default function InventoryPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatCurrency } = useFormatters();
  const { suppliers, fetchSuppliers } = usePurchasingStore();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [families, setFamilies] = useState<LocalProductFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningForSku, setIsScanningForSku] = useState(false);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [serviceKey, setServiceKey] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    price: '',
    wholesale_price: '',
    wholesale_price_ht: '',
    wholesale_price_ttc: '',
    cost: '',
    quantity: '',
    low_stock_threshold: '10',
    store_id: '',
    image_url: '',
    category_id: '',
    supplier_id: '',
    aisle: '',
    brand: '',
    unit_type: 'Pièce',
    packaging: '',
    expiry_date: '',
    reorder_quantity: '',
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleDataUpdated = (e: CustomEvent) => {
      if (e.detail?.type === 'inventory' || e.detail?.type === 'stores') {
        loadData();
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('localDbDataUpdated', handleDataUpdated as EventListener);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('localDbDataUpdated', handleDataUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [inventoryRes, storesRes, familiesRes] = await Promise.all([
      OfflineInventoryService.getInventory(undefined, { notify: false }),
      OfflineStoreService.getStores({ notify: false }),
      OfflineInventoryService.getProductFamilies(),
    ]);

    if (inventoryRes.data && inventoryRes.data.length > 0 && inventoryRes.data[0].store_id) {
       fetchSuppliers(inventoryRes.data[0].store_id);
    } else if (storesRes.data && storesRes.data.length > 0) {
       fetchSuppliers(storesRes.data[0].id);
    }

    if (inventoryRes.error) {
      toast({ title: t('common.error'), variant: 'destructive' });
    } else {
      setItems(inventoryRes.data || []);
    }

    if (familiesRes.data) {
      setFamilies(familiesRes.data);
    }

    let loadedStores = storesRes.data || [];
    if (loadedStores.length === 0) {
      const offlineSession = await OfflineAuthService.getOfflineSession();
      let fallbackStoreId = offlineSession?.user?.user_metadata?.store_id;
      if (fallbackStoreId) {
        loadedStores = [{ id: fallbackStoreId, name: 'My Store (Assigned)' } as Store];
        fetchSuppliers(fallbackStoreId);
      }
    }
    setStores(loadedStores);
    setLoading(false);
  };

  const handleOpenForm = (item?: InventoryItem) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        sku: item.sku || '',
        price: item.price.toString(),
        wholesale_price: item.wholesale_price?.toString() || '',
        wholesale_price_ht: item.wholesale_price_ht?.toString() || '',
        wholesale_price_ttc: item.wholesale_price_ttc?.toString() || '',
        cost: item.cost?.toString() || '',
        quantity: item.quantity.toString(),
        low_stock_threshold: item.low_stock_threshold?.toString() || '10',
        store_id: item.store_id,
        image_url: item.image_url || '',
        category_id: item.category_id || '',
        supplier_id: '',
        aisle: item.aisle || '',
        brand: item.brand || '',
        unit_type: item.unit_type || 'Pièce',
        packaging: item.packaging || '',
        expiry_date: item.expiry_date || '',
        reorder_quantity: item.reorder_quantity?.toString() || '',
      });
    } else {
      setSelectedItem(null);
      setFormData({
        name: '', description: '', sku: '', price: '', wholesale_price: '',
        wholesale_price_ht: '', wholesale_price_ttc: '', cost: '', quantity: '',
        low_stock_threshold: '10', store_id: stores[0]?.id || '', image_url: '',
        category_id: '', supplier_id: '', aisle: '', brand: '', unit_type: 'Pièce',
        packaging: '', expiry_date: '', reorder_quantity: '',
      });
    }
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      description: formData.description || undefined,
      sku: formData.sku || undefined,
      price: parseFloat(formData.price),
      wholesale_price: formData.wholesale_price_ttc ? parseFloat(formData.wholesale_price_ttc) : undefined,
      wholesale_price_ht: formData.wholesale_price_ht ? parseFloat(formData.wholesale_price_ht) : undefined,
      wholesale_price_ttc: formData.wholesale_price_ttc ? parseFloat(formData.wholesale_price_ttc) : undefined,
      cost: formData.cost ? parseFloat(formData.cost) : undefined,
      quantity: parseInt(formData.quantity),
      low_stock_threshold: parseInt(formData.low_stock_threshold),
      store_id: formData.store_id,
      image_url: formData.image_url || undefined,
      category_id: formData.category_id || undefined,
      aisle: formData.aisle || undefined,
      brand: formData.brand || undefined,
      unit_type: formData.unit_type || undefined,
      packaging: formData.packaging || undefined,
      expiry_date: formData.expiry_date || undefined,
      reorder_quantity: formData.reorder_quantity ? parseInt(formData.reorder_quantity) : undefined,
    };

    if (selectedItem) {
      const { error } = await OfflineInventoryService.updateItem(selectedItem.id, data);
      if (error) toast({ title: t('common.error'), variant: 'destructive' });
      else {
        toast({ title: t('common.success') });
        setFormOpen(false);
        loadData();
      }
    } else {
      const { error } = await OfflineInventoryService.createItem(data);
      if (error) toast({ title: t('common.error'), variant: 'destructive' });
      else {
        toast({ title: t('common.success') });
        setFormOpen(false);
        loadData();
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    const { error } = await OfflineInventoryService.deleteItem(selectedItem.id);
    if (!error) {
      toast({ title: t('common.success') });
      loadData();
    }
    setDeleteDialogOpen(false);
  };

  const marginPercent = Number(formData.price) > 0 && Number(formData.cost) > 0 
    ? (((Number(formData.price) - Number(formData.cost)) / Number(formData.cost)) * 100).toFixed(1) 
    : '0';

  const filteredItems = items.filter(item => {
    const mSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const mStore = selectedStoreFilter === 'all' || item.store_id === selectedStoreFilter;
    return mSearch && mStore;
  });

  const selection = useSelection(filteredItems);

  if (loading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('inventory.title')}</h1>
          <p className="text-muted-foreground">{t('inventory.manageInventory')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleOpenForm()}><Plus className="h-4 w-4 mr-2" /> {t('inventory.addItem')}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('inventory.table.name')}</TableHead>
                <TableHead>{t('inventory.table.sku')}</TableHead>
                <TableHead>{t('inventory.table.quantity')}</TableHead>
                <TableHead>{t('inventory.table.price')}</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.sku || '-'}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(Number(item.price))}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenForm(item)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(item); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* COMPACT FULL SCREEN DIALOG */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-full w-full h-[95vh] p-0 flex flex-col gap-0 rounded-none sm:rounded-lg sm:max-w-6xl sm:h-auto sm:max-h-[90vh] overflow-hidden">
          <DialogHeader className="px-6 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Package className="h-6 w-6" /> {selectedItem ? 'Modifier Article' : 'Nouvel Article'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: General */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Général</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nom de l'article *</Label>
                      <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">REF / SKU</Label>
                        <Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Famille</Label>
                        <Select value={formData.category_id} onValueChange={v => setFormData({...formData, category_id: v})}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Choisir" /></SelectTrigger>
                          <SelectContent>{families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Magasin *</Label>
                      <Select value={formData.store_id} onValueChange={v => setFormData({...formData, store_id: v})} required>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Magasin" /></SelectTrigger>
                        <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Marque</Label>
                      <Input value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="min-h-[60px] text-xs" />
                    </div>
                  </div>
                </div>

                {/* Column 2: Pricing */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Prix</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-primary">Prix de Vente (Détail) *</Label>
                      <Input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required className="h-10 font-bold border-primary/40" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Prix d'Achat</Label>
                      <Input type="number" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Prix Gros (HT)</Label>
                        <Input type="number" value={formData.wholesale_price_ht} onChange={e => setFormData({...formData, wholesale_price_ht: e.target.value})} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Prix Gros (TTC)</Label>
                        <Input type="number" value={formData.wholesale_price_ttc} onChange={e => setFormData({...formData, wholesale_price_ttc: e.target.value})} className="h-9" />
                      </div>
                    </div>
                    <div className="p-3 rounded bg-primary/5 border border-primary/10">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Marge:</span>
                        <span className="text-lg font-bold text-primary">{marginPercent}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Stock */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Stock</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantité Actuelle *</Label>
                        <Input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} required className="h-9 font-medium" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Alerte Stock</Label>
                        <Input type="number" value={formData.low_stock_threshold} onChange={e => setFormData({...formData, low_stock_threshold: e.target.value})} className="h-9" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Unité</Label>
                        <Select value={formData.unit_type} onValueChange={v => setFormData({...formData, unit_type: v})}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="Pièce">Pièce</SelectItem><SelectItem value="Kg">Kg</SelectItem><SelectItem value="L">Litre</SelectItem><SelectItem value="Carton">Carton</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cndt.</Label>
                        <Input value={formData.packaging} onChange={e => setFormData({...formData, packaging: e.target.value})} placeholder="Ex: 12" className="h-9" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Date de Péremption</Label>
                      <Input type="date" value={formData.expiry_date} onChange={e => setFormData({...formData, expiry_date: e.target.value})} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Image</Label>
                      <ImageUpload currentImageUrl={formData.image_url} onImageUploaded={url => setFormData({...formData, image_url: url})} onImageRemoved={() => setFormData({...formData, image_url: ''})} folder="inventory" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-4 border-t shrink-0 bg-muted/10">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="h-9">Annuler</Button>
              <Button type="submit" className="h-9 px-8">{selectedItem ? 'Mettre à jour' : 'Enregistrer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={handleDelete} title={t('inventory.deleteTitle')} description={t('inventory.deleteDescription', { name: selectedItem?.name })} variant="destructive" />
    </div>
  );
}