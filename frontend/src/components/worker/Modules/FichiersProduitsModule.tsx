import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Edit2, Trash2, Package, Barcode, Minus, ChevronDown, ChevronRight, Copy, CheckSquare, Square, RefreshCw, Layers, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { getDataClient } from '@/lib/dataClient';
import { useMasterDataStore, ProductMaster } from '@/stores/useMasterDataStore';
import { toast } from '@/hooks/use-toast';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useTranslation } from 'react-i18next';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { cn } from '@/lib/utils';
import { ProductLookupDialog } from '../Sales/ProductLookupDialog';
import { Product } from '@/types';

interface FichiersProduitsModuleProps {
  storeId: string;
  isMasterView?: boolean;
}

export function FichiersProduitsModule({ storeId, isMasterView }: FichiersProduitsModuleProps) {
  const { t } = useTranslation();
  const { supabase } = getDataClient();
  const { families, setFamilies, setSuppliers, setLoading, deleteProduct } = useMasterDataStore();
  const [localProducts, setLocalProducts] = useState<ProductMaster[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkEditDialogOpen, setIsBulkEditDialogOpen] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [lookupTargetIndex, setLookupTargetIndex] = useState<number | null>(null);
  
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'single' | 'multi'>('single');
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const initialFormState = {
    name: '', sku: '', barcode: '', description: '',
    purchase_price: 0 as number | string, 
    selling_price_detail: 0 as number | string, 
    selling_price_2: 0 as number | string,
    selling_price_3: 0 as number | string,
    selling_price_4: 0 as number | string,
    selling_price_wholesale: 0 as number | string,
    selling_price_ht: 0 as number | string, 
    selling_price_ttc: 0 as number | string, 
    quantity: 0 as number | string,
    min_stock_alert: 10 as number | string,
    unit_type: 'Pièce', family_id: '', brand: '', aisle: '', preferred_supplier_id: '',
    packaging: '1', reorder_quantity: 0 as number | string, expiry_date: '', image_url: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [multiItems, setMultiItems] = useState<Array<typeof initialFormState & { id: string; isOpen: boolean }>>([]);
  const [bulkEditData, setBulkEditData] = useState<Partial<typeof initialFormState>>({});

  const resetForm = () => {
    setEditingProduct(null);
    setFormData(initialFormState);
    setRegistrationMode('single');
    setMultiItems([{ ...initialFormState, id: crypto.randomUUID(), isOpen: false }]);
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

  // UI Event Handlers
  const handleNumChange = (field: keyof typeof initialFormState, index?: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const finalVal = val === '' ? '' : Number(val);
    if (index !== undefined) {
        setMultiItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: finalVal } : item));
    } else {
        setFormData(f => ({ ...f, [field]: finalVal }));
    }
  };

  const handleNumBlur = (field: keyof typeof initialFormState, index?: number) => () => {
    if (index !== undefined) {
        setMultiItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: item[field] === '' ? 0 : item[field] } : item));
    } else {
        setFormData(f => ({ ...f, [field]: f[field] === '' ? 0 : f[field] }));
    }
  };

  const updateField = (field: keyof typeof initialFormState, val: any, index?: number) => {
    if (index !== undefined) {
        setMultiItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
    } else {
        setFormData(f => ({ ...f, [field]: val }));
    }
  };

  const addMultiItemRow = () => {
    setMultiItems(prev => [
        ...prev.map(item => ({ ...item, isOpen: false })),
        { ...initialFormState, id: crypto.randomUUID(), isOpen: false }
    ]);
  };

  const removeMultiItemRow = (id: string) => {
    setMultiItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleMultiItemRow = (id: string) => {
    setMultiItems(prev => prev.map(item => ({
        ...item,
        isOpen: item.id === id ? !item.isOpen : false
    })));
  };

  useEffect(() => {
    if (storeId) fetchData();

    const handleDbUpdate = (e: any) => {
      if (e.detail?.type === 'inventory') {
        fetchData();
      }
    };
    window.addEventListener('localDbDataUpdated', handleDbUpdate);
    return () => window.removeEventListener('localDbDataUpdated', handleDbUpdate);
  }, [storeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [inventoryRes, familiesRes] = await Promise.all([
        OfflineInventoryService.getInventory(storeId, { notify: false }),
        OfflineInventoryService.getProductFamilies(storeId)
      ]);
      if (inventoryRes.data) {
        const mapped: ProductMaster[] = inventoryRes.data.map(item => ({
          ...item,
          purchase_price: (item as any).cost_price ?? 0,
          selling_price_detail: (item as any).unit_price ?? 0,
          selling_price_2: (item as any).selling_price_2 ?? 0,
          selling_price_3: (item as any).selling_price_3 ?? 0,
          selling_price_4: (item as any).selling_price_4 ?? 0,
          selling_price_wholesale: (item as any).wholesale_price_ttc ?? 0,
          selling_price_ht: (item as any).wholesale_price_ht ?? 0,
          selling_price_ttc: (item as any).wholesale_price_ttc ?? 0,
          min_stock_alert: (item as any).low_stock_threshold ?? (item as any).min_quantity ?? 0,
          current_stock: (item as any).quantity ?? 0,
          unit_type: item.unit_type || 'Pièce',
          family_id: (item as any).category_id,
          brand: item.brand || '',
          packaging: item.packaging || '1',
          aisle: item.aisle || '',
          expiry_date: item.expiry_date,
          store_id: item.store_id,
          image_url: item.image_url,
          created_at: item.created_at,
          updated_at: item.updated_at,
        } as unknown as ProductMaster));
        setLocalProducts(mapped);
      }
      if (familiesRes.data) setFamilies(familiesRes.data as any);
      const { data: suppliers } = await (supabase as any).from('suppliers').select('*').eq('store_id', storeId).order('name');
      if (suppliers) setSuppliers(suppliers);
    } catch (err) {
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * NORMALIZATION LOGIC: 
   * Converts UI values (which might be in Boxes) back to Pieces for DB Storage
   */
  const mapFormDataToData = (fd: typeof initialFormState) => {
    const isBox = isBoxUnit(fd.unit_type);
    const packSize = getPackSize(fd.packaging || '1');

    const normalizePrice = (p: any) => {
        const num = Number(p) || 0;
        return isBox && packSize > 1 ? num / packSize : num;
    };

    const normalizeQty = (q: any) => {
        const num = Number(q) || 0;
        return isBox && packSize > 1 ? num * packSize : num;
    };

    return {
      name: fd.name.trim(),
      sku: fd.sku.trim() || undefined,
      price: normalizePrice(fd.selling_price_detail),
      selling_price_2: normalizePrice(fd.selling_price_2),
      selling_price_3: normalizePrice(fd.selling_price_3),
      selling_price_4: normalizePrice(fd.selling_price_4),
      wholesale_price_ht: normalizePrice(fd.selling_price_ht),
      wholesale_price_ttc: normalizePrice(fd.selling_price_ttc),
      cost: normalizePrice(fd.purchase_price),
      quantity: normalizeQty(fd.quantity),
      min_quantity: normalizeQty(fd.min_stock_alert),
      low_stock_threshold: normalizeQty(fd.min_stock_alert),
      store_id: storeId,
      category_id: fd.family_id || null,
      packaging: fd.packaging || '1',
      unit_type: fd.unit_type || 'Pièce',
      brand: fd.brand || undefined,
      aisle: fd.aisle || undefined,
      expiry_date: fd.expiry_date || undefined,
      reorder_quantity: normalizeQty(fd.reorder_quantity),
      description: fd.description || undefined,
      image_url: fd.image_url || undefined,
    };
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (registrationMode === 'single') {
        if (!formData.name.trim()) return toast({ title: t('common.error'), description: t('inventory.fields.nameRequired'), variant: 'destructive' });
        setIsSaving(true);
        try {
            const productData = mapFormDataToData(formData);
            const res = editingProduct ? await OfflineInventoryService.updateItem(editingProduct.id, productData) : await OfflineInventoryService.createItem(productData);
            if (res.error) throw res.error;
            toast({ title: t('common.success') });
            setIsDialogOpen(false);
            await fetchData();
        } catch (err: any) {
            toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    } else {
        if (multiItems.length === 0) return toast({ title: t('common.error'), description: "Ajoutez au moins un article", variant: 'destructive' });
        if (multiItems.some(item => !item.name.trim())) return toast({ title: t('common.error'), description: t('inventory.fields.nameRequired'), variant: 'destructive' });
        setIsSaving(true);
        try {
            for (const item of multiItems) {
                const res = await OfflineInventoryService.createItem(mapFormDataToData(item));
                if (res.error) throw res.error;
            }
            toast({ title: t('common.success'), description: `${multiItems.length} articles créés` });
            setIsDialogOpen(false);
            await fetchData();
        } catch (err: any) {
            toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
        for (const id of selectedIds) {
            await OfflineInventoryService.updateItem(id, bulkEditData as any);
        }
        toast({ title: t('common.success'), description: `${selectedIds.length} articles mis à jour` });
        setIsBulkEditDialogOpen(false);
        setSelectedIds([]);
        await fetchData();
    } catch (err: any) {
        toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleProductSelected = (product: any) => {
    const pData = {
        name: product.name,
        sku: product.sku || '',
        description: product.description || '',
        purchase_price: product.cost_price || product.purchase_price || 0,
        selling_price_detail: product.unit_price || product.selling_price_detail || 0,
        selling_price_2: product.selling_price_2 || 0,
        selling_price_3: product.selling_price_3 || 0,
        selling_price_4: product.selling_price_4 || 0,
        selling_price_ht: product.wholesale_price_ht || 0,
        selling_price_ttc: product.wholesale_price_ttc || 0,
        unit_type: product.unit_type || 'Pièce',
        family_id: product.category_id || product.family_id || '',
        packaging: product.packaging || '1',
        quantity: 0
    };

    if (lookupTargetIndex !== null) {
        updateField('name', pData.name, lookupTargetIndex);
        updateField('sku', pData.sku, lookupTargetIndex);
        updateField('purchase_price', pData.purchase_price, lookupTargetIndex);
        updateField('selling_price_detail', pData.selling_price_detail, lookupTargetIndex);
        updateField('selling_price_2', pData.selling_price_2, lookupTargetIndex);
        updateField('selling_price_3', pData.selling_price_3, lookupTargetIndex);
        updateField('selling_price_4', pData.selling_price_4, lookupTargetIndex);
        updateField('selling_price_ht', pData.selling_price_ht, lookupTargetIndex);
        updateField('selling_price_ttc', pData.selling_price_ttc, lookupTargetIndex);
        updateField('unit_type', pData.unit_type, lookupTargetIndex);
        updateField('family_id', pData.family_id, lookupTargetIndex);
        updateField('packaging', pData.packaging, lookupTargetIndex);
    } else {
        setFormData(f => ({ ...f, ...pData }));
    }
    setIsLookupOpen(false);
  };

  const handleEdit = (p: ProductMaster) => {
    setEditingProduct(p);
    setRegistrationMode('single');
    const packSize = getPackSize(p.packaging || '1');
    const isBox = isBoxUnit(p.unit_type || 'Pièce');
    const scale = (val: any) => isBox && packSize > 1 ? (Number(val) * packSize) : Number(val);
    const scaleQty = (val: any) => isBox && packSize > 1 ? (Number(val) / packSize) : Number(val);

    setFormData({
      name: p.name, sku: p.sku || '', barcode: p.barcode || '', description: p.description || '',
      purchase_price: scale(p.purchase_price), 
      selling_price_detail: scale(p.selling_price_detail),
      selling_price_2: scale(p.selling_price_2), 
      selling_price_3: scale(p.selling_price_3),
      selling_price_4: scale(p.selling_price_4), 
      selling_price_wholesale: scale(p.selling_price_wholesale),
      selling_price_ht: scale(p.selling_price_ht), 
      selling_price_ttc: scale(p.selling_price_ttc),
      quantity: scaleQty(p.current_stock),
      min_stock_alert: scaleQty(p.min_stock_alert), 
      unit_type: p.unit_type || 'Pièce',
      family_id: p.family_id || '', brand: p.brand || '', aisle: p.aisle || '',
      preferred_supplier_id: p.preferred_supplier_id || '', packaging: p.packaging || '1',
      reorder_quantity: scaleQty(p.reorder_quantity), expiry_date: p.expiry_date || '', image_url: p.image_url || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('inventory.deleteConfirm'))) return;
    try {
      const { error } = await OfflineInventoryService.deleteItem(id);
      if (error) throw error;
      setLocalProducts(prev => prev.filter(p => p.id !== id));
      toast({ title: t('common.success') });
      await fetchData();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(t('inventory.bulkDeleteConfirm', { count: selectedIds.length }))) return;
    setIsSaving(true);
    try {
        for (const id of selectedIds) await OfflineInventoryService.deleteItem(id);
        toast({ title: t('common.success'), description: `${selectedIds.length} articles supprimés` });
        setSelectedIds([]);
        await fetchData();
    } catch (err: any) {
        toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return localProducts.filter(p => {
      if (!p || !p.name) return false;
      const mSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const mFamily = selectedFamily === 'all' || (p.family_id && p.family_id === selectedFamily);
      return mSearch && mFamily;
    });
  }, [localProducts, searchQuery, selectedFamily]);

  const renderProductFields = (data: typeof initialFormState, update: (field: keyof typeof initialFormState, val: any) => void, index?: number) => {
    const margin = Number(data.selling_price_detail) > 0 && Number(data.purchase_price) > 0
        ? (((Number(data.selling_price_detail) - Number(data.purchase_price)) / Number(data.purchase_price)) * 100).toFixed(1)
        : '0';

    return (
        <>
            <div className="col-span-full mb-6 bg-muted/30 p-4 rounded-xl border-2 border-dashed border-muted flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Search className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Importer depuis un article existant</span>
                </div>
                <Button variant="outline" size="sm" type="button" onClick={() => { setLookupTargetIndex(index ?? null); setIsLookupOpen(true); }} className="h-8 uppercase font-black text-[10px] tracking-widest px-4 border-primary/20 hover:bg-primary hover:text-white">Choisir l'article</Button>
            </div>

            <div className="space-y-6 border-r pr-6">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />{t('inventory.sectionIdentification')}
                </h3>
                <div className="space-y-4">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">{t('inventory.fields.name')} *</Label><Input value={data.name} onChange={e => update('name', e.target.value)} required className="h-12 text-lg font-black uppercase tracking-tighter bg-muted/20 border-2" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">{t('inventory.fields.sku')}</Label><Input value={data.sku} onChange={e => update('sku', e.target.value)} className="h-10 font-mono border-2" /></div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest">{t('inventory.fields.barcode')}</Label>
                            <div className="flex gap-2"><Input value={data.barcode} onChange={e => update('barcode', e.target.value)} className="h-10 font-mono border-2" /><Button type="button" variant="outline" size="icon" onClick={() => update('barcode', `PRD${Date.now().toString(36).toUpperCase()}`)} className="h-10 w-10 shrink-0 border-2"><Barcode className="h-4 w-4" /></Button></div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">{t('inventory.fields.family')}</Label>
                        <Select value={data.family_id} onValueChange={v => update('family_id', v)}><SelectTrigger className="h-10 border-2 bg-primary/5"><SelectValue placeholder={t('inventory.fields.selectFamily')} /></SelectTrigger><SelectContent>{families.map(fam => <SelectItem key={fam.id} value={fam.id}>{fam.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">{t('inventory.fields.brand')}</Label><Input value={data.brand} onChange={e => update('brand', e.target.value)} className="h-10 border-2" /></div>
                </div>
            </div>

            <div className="space-y-6 border-r px-6">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />{t('inventory.sectionPrices')}
                </h3>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-primary uppercase tracking-widest">{t('inventory.fields.price1Detail')} *</Label>
                        <div className="relative"><Input type="number" value={data.selling_price_detail} onChange={handleNumChange('selling_price_detail', index)} onBlur={handleNumBlur('selling_price_detail', index)} required className="h-14 text-2xl font-black border-2 border-primary/40 bg-primary/5 pl-4 pr-12 text-primary" /><span className="absolute right-4 top-4 font-black text-primary/40 text-xl">F</span></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">{t('inventory.fields.price2Discount')}</Label><Input type="number" value={data.selling_price_2} onChange={handleNumChange('selling_price_2', index)} onBlur={handleNumBlur('selling_price_2', index)} className="h-10 border-2" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">{t('inventory.fields.price3Bulk')}</Label><Input type="number" value={data.selling_price_3} onChange={handleNumChange('selling_price_3', index)} onBlur={handleNumBlur('selling_price_3', index)} className="h-10 border-2" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">{t('inventory.fields.price4Resale')}</Label><Input type="number" value={data.selling_price_4} onChange={handleNumChange('selling_price_4', index)} onBlur={handleNumBlur('selling_price_4', index)} className="h-10 border-2" /></div>
                    </div>
                    <div className="space-y-2 pt-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest">{t('inventory.fields.purchasePrice')}</Label>
                        <div className="relative"><Input type="number" value={data.purchase_price} onChange={handleNumChange('purchase_price', index)} onBlur={handleNumBlur('purchase_price', index)} className="h-10 font-black border-2 bg-muted/30" /><span className="absolute right-3 top-2.5 text-muted-foreground text-xs font-black">F</span></div></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-danger">{t('inventory.fields.wholesalePriceHT')}</Label><Input type="number" value={data.selling_price_ht} onChange={handleNumChange('selling_price_ht', index)} onBlur={handleNumBlur('selling_price_ht', index)} className="h-10 border-2 border-danger/20" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-danger">{t('inventory.fields.wholesalePriceTTC')}</Label><Input type="number" value={data.selling_price_ttc} onChange={handleNumChange('selling_price_ttc', index)} onBlur={handleNumBlur('selling_price_ttc', index)} className="h-10 border-2 border-danger/20 font-black" /></div>
                    </div>
                    <div className="p-6 rounded-2xl bg-success/5 border-2 border-success/10 mt-4 shadow-inner flex justify-between items-center"><span className="text-[10px] font-black uppercase tracking-widest text-success/60">{t('menu.program.calculatedMargin')}:</span><span className="text-3xl font-black text-success">{margin}%</span></div>
                </div>
            </div>

            <div className="space-y-6 pl-6">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />{t('inventory.sectionLogistics')}
                </h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest">{t('menu.program.unit')}</Label>
                            <Select value={data.unit_type} onValueChange={v => updateField('unit_type', v, index)}>
                                <SelectTrigger className="h-10 font-black border-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Pièce">{t('inventory.unitTypes.piece')}</SelectItem>
                                    <SelectItem value="Carton">{t('inventory.unitTypes.carton')}</SelectItem>
                                    <SelectItem value="KG">{t('inventory.unitTypes.kg')}</SelectItem>
                                    <SelectItem value="Litre">{t('inventory.unitTypes.litre')}</SelectItem>
                                    <SelectItem value="Paquet">{t('inventory.unitTypes.paquet')}</SelectItem>
                                    <SelectItem value="Sac">{t('inventory.unitTypes.sac')}</SelectItem>
                                    <SelectItem value="Sachet">Sachet</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">{t('inventory.fields.packaging')}</Label><Input value={data.packaging} onChange={e => updateField('packaging', e.target.value, index)} className="h-10 font-black border-2 border-primary/20" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">{t('inventory.fields.quantity')}</Label><Input type="number" value={data.quantity} onChange={handleNumChange('quantity', index)} onBlur={handleNumBlur('quantity', index)} className="h-10 font-black bg-primary/5 border-2 border-primary/20" /></div>
                        <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">{t('inventory.fields.minStock')}</Label><Input type="number" value={data.min_stock_alert} onChange={handleNumChange('min_stock_alert', index)} onBlur={handleNumBlur('min_stock_alert', index)} className="h-10 border-2" /></div>
                    </div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">{t('inventory.fields.image')}</Label><ImageUpload value={data.image_url} onChange={url => updateField('image_url', url, index)} /></div>
                </div>
            </div>
        </>
    );
  };

  return (
    <div className={cn("h-full flex flex-col p-4 gap-4 transition-colors", !isMasterView && "bg-[hsl(60,80%,85%)]", "dark:bg-transparent")}>
      <div className="flex items-center gap-4 bg-card p-3 rounded-xl border-2 border-border/50 shadow-lg">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder={t('common.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10 border-none bg-muted/30 font-black uppercase tracking-tighter" /></div>
        <div className="flex items-center gap-2">
            <Select value={selectedFamily} onValueChange={setSelectedFamily}><SelectTrigger className="w-48 h-10 bg-muted/30 border-none font-black uppercase text-[10px] tracking-widest"><SelectValue placeholder={t('inventory.fields.family')} /></SelectTrigger><SelectContent><SelectItem value="all">{t('inventory.allFamilies')}</SelectItem>{families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" size="icon" onClick={fetchData} className="h-10 w-10 border-2"><RefreshCw className="h-4 w-4" /></Button>
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                    <Button variant="outline" onClick={() => setIsBulkEditDialogOpen(true)} className="h-10 px-4 border-2 border-primary text-primary hover:bg-primary/5 font-black uppercase text-[10px] tracking-widest"><Layers className="h-4 w-4 mr-2" />MODIFIER ({selectedIds.length})</Button>
                    <Button variant="destructive" onClick={handleBulkDelete} className="h-10 px-4 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-danger/20"><Trash2 className="h-4 w-4 mr-2" />SUPPRIMER</Button>
                </div>
            )}
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="h-10 px-6 font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" />{t('inventory.addItem')}</Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden border-2 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardContent className="p-0 h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-md border-b-2">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center"><Checkbox checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0} onCheckedChange={(val) => setSelectedIds(val ? filteredProducts.map(p => p.id) : [])} /></TableHead>
                <TableHead className="w-12 text-center font-black uppercase tracking-widest text-[9px]">#</TableHead>
                <TableHead className="font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.table.name')}</TableHead>
                <TableHead className="font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.table.sku')}</TableHead>
                <TableHead className="font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.fields.family')}</TableHead>
                <TableHead className="text-right font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.fields.purchasePriceShort')}</TableHead>
                <TableHead className="text-right font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.fields.retailPriceShort')}</TableHead>
                <TableHead className="text-right font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.fields.packaging')}</TableHead>
                <TableHead className="text-right font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.table.quantity')}</TableHead>
                <TableHead className="text-center font-black uppercase tracking-[0.2em] text-[9px]">STATUS</TableHead>
                <TableHead className="text-center font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p, i) => {
                const packSize = getPackSize(p.packaging || '1');
                const isBox = isBoxUnit(p.unit_type || 'Pièce');
                const purchasePrice = Number(p.purchase_price || 0);
                const retailPrice = Number(p.selling_price_detail || 0);
                const displayPurchasePrice = isBox && packSize > 1 ? (purchasePrice * packSize) : purchasePrice;
                const displayRetailPrice = isBox && packSize > 1 ? (retailPrice * packSize) : retailPrice;
                return (
                    <TableRow key={p.id} className={cn("group transition-colors border-b", selectedIds.includes(p.id) ? "bg-primary/10" : "hover:bg-muted/30")}>
                        <TableCell className="text-center"><Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => setSelectedIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])} /></TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs font-mono font-black">{i + 1}</TableCell>
                        <TableCell className="font-black uppercase text-primary tracking-tighter text-sm">{p.name}</TableCell>
                        <TableCell className="font-mono text-[10px] font-black opacity-40">{p.sku || '-'}</TableCell>
                        <TableCell className="text-[10px] font-black uppercase tracking-widest">{families.find(f => f.id === p.family_id)?.name || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-[11px] font-black">{displayPurchasePrice?.toLocaleString() || '0'} F</TableCell>
                        <TableCell className="text-right font-black text-primary text-sm">{displayRetailPrice?.toLocaleString() || '0'} F</TableCell>
                        <TableCell className="text-right text-[10px] font-black text-muted-foreground">{p.packaging || '-'}</TableCell>
                        <TableCell className="text-right"><div className="flex flex-col items-end"><Badge variant={p.current_stock <= (p.min_stock_alert || 0) ? 'destructive' : 'secondary'} className="font-mono font-black text-[10px]">{isBox && packSize > 1 ? (p.current_stock / packSize).toFixed(1) : p.current_stock} {isBox && packSize > 1 ? p.unit_type?.toUpperCase() : t('inventory.unitPiece')}</Badge><span className="text-[8px] font-black text-muted-foreground mt-0.5 opacity-50">({p.current_stock} {t('inventory.unitPiece')})</span></div></TableCell>
                        <TableCell className="text-center">{p.current_stock <= (p.min_stock_alert || 0) ? (<Badge className="bg-danger text-white border-none font-black text-[8px] tracking-widest animate-pulse">STOCK FAIBLE</Badge>) : (<Badge variant="outline" className="text-success border-success/20 font-black text-[8px] tracking-widest opacity-50">OK</Badge>)}</TableCell>
                        <TableCell className="text-center"><div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="secondary" size="icon" onClick={() => handleEdit(p)} className="h-8 w-8 shadow-sm border-2"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                    </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-full w-full h-[95vh] p-0 flex flex-col gap-0 rounded-none sm:rounded-2xl sm:max-w-6xl sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl border-4 border-primary/20 [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-full [&>button]:border-2 [&>button]:right-6 [&>button]:top-4 [&>button]:transition-all [&>button:hover]:bg-destructive [&>button:hover]:text-white [&>button:hover]:rotate-90 [&>button]:bg-card [&>button]:flex [&>button]:items-center [&>button]:justify-center">
          <DialogHeader className="px-6 py-4 border-b bg-card shrink-0">
            <div className="flex items-center gap-6">
                {!editingProduct && (
                    <div className="flex items-center gap-3 bg-primary/5 px-4 py-2 rounded-full border-2 border-primary/20">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">MODE MULTIPLE</Label>
                        <Switch checked={registrationMode === 'multi'} onCheckedChange={(val) => setRegistrationMode(val ? 'multi' : 'single')} />
                    </div>
                )}
                <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tighter">
                    <Package className="h-7 w-7 text-primary" />
                    {editingProduct ? t('inventory.editItem') : registrationMode === 'multi' ? "AJOUT MULTIPLE" : t('inventory.addItem')}
                </DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {registrationMode === 'single' ? (
                <div className="p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                    {renderProductFields(formData, (field, val) => setFormData(f => ({ ...f, [field]: val })))}
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {multiItems.map((item, index) => (
                    <Card key={item.id} className={cn("border-4 transition-all overflow-hidden", item.isOpen ? "border-primary shadow-2xl scale-[1.01]" : "border-border/40 opacity-60")}>
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30" onClick={() => toggleMultiItemRow(item.id)}>
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg bg-primary/10 text-primary transition-transform", item.isOpen && "rotate-180")}>
                            {item.isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                          <span className="font-black uppercase tracking-widest text-sm">{item.name || `NOUVEL ARTICLE #${index + 1}`}</span>
                          {Number(item.selling_price_detail) > 0 && <Badge variant="outline" className="font-black font-mono">{item.selling_price_detail} F</Badge>}
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); removeMultiItemRow(item.id); }}>
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                      {item.isOpen && (
                        <div className="p-8 border-t-2 bg-muted/5">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                            {renderProductFields(item, (field, val) => updateField(field, val, index), index)}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                  <div className="flex justify-start pt-2">
                    <Button variant="outline" type="button" className="h-20 border-dashed border-4 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary font-black uppercase tracking-[0.4em] gap-3 px-12 rounded-2xl" onClick={addMultiItemRow}>
                      <Plus className="h-6 w-6" />AJOUTER UN ARTICLE AU LOT
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-6 border-t-4 bg-card flex justify-end items-center gap-6 shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsDialogOpen(false)} 
                className="rounded-full border-2 h-12 w-12 hover:bg-destructive hover:text-destructive-foreground hover:scale-110 transition-all duration-300 group border-border/40 flex items-center justify-center"
              >
                <X className="h-6 w-6 group-hover:rotate-90 transition-transform" />
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="px-12 font-black uppercase tracking-widest text-xs h-12 shadow-xl shadow-primary/30">
                {isSaving ? t('common.loading') : editingProduct ? t('common.update') : registrationMode === 'multi' ? `ENREGISTRER LES ${multiItems.length} ARTICLES` : t('inventory.createItem')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkEditDialogOpen} onOpenChange={setIsBulkEditDialogOpen}>
        <DialogContent className="max-w-2xl border-4 border-primary/20"><DialogHeader><DialogTitle className="font-black uppercase tracking-[0.2em] text-xl">MODIFICATION GROUPÉE ({selectedIds.length})</DialogTitle></DialogHeader><div className="grid gap-6 py-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">FAMILLE / CATÉGORIE</Label><Select onValueChange={v => setBulkEditData({...bulkEditData, family_id: v})}><SelectTrigger className="h-12 border-2"><SelectValue placeholder="Changer la famille..." /></SelectTrigger><SelectContent>{families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">MARQUE</Label><Input onChange={e => setBulkEditData({...bulkEditData, brand: e.target.value})} className="h-12 border-2" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">RAYON</Label><Input onChange={e => setBulkEditData({...bulkEditData, aisle: e.target.value})} className="h-12 border-2" /></div></div><div className="p-6 bg-warning/5 border-2 border-warning/20 rounded-2xl"><p className="text-[10px] font-black text-warning uppercase mb-4 tracking-widest italic">ATTENTION: LES PRIX MODIFIÉS ÉCRASERONT LES ANCIENS.</p><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">PRIX D'ACHAT</Label><Input type="number" onChange={e => setBulkEditData({...bulkEditData, purchase_price: Number(e.target.value)})} className="h-12 border-2" /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest text-primary">PRIX DE VENTE (DÉTAIL)</Label><Input type="number" onChange={e => setBulkEditData({...bulkEditData, selling_price_detail: Number(e.target.value)})} className="h-12 border-2 border-primary/20" /></div></div></div></div><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setIsBulkEditDialogOpen(false)} className="font-black uppercase tracking-widest text-[10px] border-2">ANNULER</Button><Button onClick={handleBulkUpdate} disabled={isSaving || Object.keys(bulkEditData).length === 0} className="font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">APPLIQUER LA SÉLECTION</Button></DialogFooter></DialogContent>
      </Dialog>

      <ProductLookupDialog open={isLookupOpen} onOpenChange={setIsLookupOpen} storeId={storeId} title="RECHERCHE D'ARTICLES (GLOBAL)" standalone mode="wholesale" onSelect={handleProductSelected} />
    </div>
  );
}
