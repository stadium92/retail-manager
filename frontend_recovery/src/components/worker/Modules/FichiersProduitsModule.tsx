import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Edit2, Trash2, Package, Barcode, RefreshCw } from 'lucide-react';
import { getDataClient } from '@/lib/dataClient';
import { useMasterDataStore, ProductMaster } from '@/stores/useMasterDataStore';
import { toast } from '@/hooks/use-toast';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useTranslation } from 'react-i18next';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { cn } from '@/lib/utils';

interface FichiersProduitsModuleProps {
  storeId: string;
  isMasterView?: boolean;
}

export function FichiersProduitsModule({ storeId, isMasterView }: FichiersProduitsModuleProps) {
  const { t } = useTranslation();
  const { supabase } = getDataClient();
  const { products, setProducts, families, setFamilies, setSuppliers, setLoading } = useMasterDataStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialFormState = {
    name: '',
    sku: '',
    barcode: '',
    description: '',
    purchase_price: 0 as number | string,
    selling_price_detail: 0 as number | string,
    selling_price_2: 0 as number | string,
    selling_price_3: 0 as number | string,
    selling_price_4: 0 as number | string,
    selling_price_wholesale: 0 as number | string,
    selling_price_ht: 0 as number | string,
    selling_price_ttc: 0 as number | string,
    min_stock_alert: 10 as number | string,
    unit_type: 'Pièce',
    family_id: '',
    brand: '',
    aisle: '',
    preferred_supplier_id: '',
    packaging: '1',
    reorder_quantity: 0 as number | string,
    expiry_date: '',
    image_url: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (storeId) {
      fetchData();
    }
  };

  const handleNumBlur = (field: keyof typeof initialFormState, index?: number) => () => {
    if (index !== undefined) {
        setMultiItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: item[field] === '' ? 0 : item[field] } : item));
    } else {
        setFormData(f => ({ ...f, [field]: f[field] === '' ? 0 : f[field] }));
    }
  };

  const updateMultiItemField = (index: number, field: keyof typeof initialFormState, val: any) => {
    setMultiItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
  };

  const addMultiItemRow = () => {
    setMultiItems(prev => [
        ...prev.map(item => ({ ...item, isOpen: false })),
        { ...initialFormState, id: crypto.randomUUID(), isOpen: true }
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
          purchase_price: item.cost,
          selling_price_detail: item.price,
          selling_price_2: item.selling_price_2,
          selling_price_3: item.selling_price_3,
          selling_price_4: item.selling_price_4,
          selling_price_wholesale: item.wholesale_price_ttc,
          selling_price_ht: item.wholesale_price_ht,
          selling_price_ttc: item.wholesale_price_ttc,
          min_stock_alert: item.low_stock_threshold,
          current_stock: item.quantity,
          unit_type: item.unit_type || 'Pièce',
          family_id: item.category_id,
          brand: item.brand || '',
          packaging: item.packaging || '1',
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

      const { data: suppliers } = await (supabase as any).from('suppliers').select('*').eq('store_id', storeId).order('name');
      if (suppliers) setSuppliers(suppliers);
    } catch (err) {
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleNumChange = (field: keyof typeof initialFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(f => ({ ...f, [field]: val === '' ? '' : Number(val) }));
  };

  const handleNumBlur = (field: keyof typeof initialFormState) => () => {
    if (formData[field] === '') {
      setFormData(f => ({ ...f, [field]: 0 }));
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

  const handleSave = async () => {
    if (isSaving) return;
    if (!formData.name.trim()) return toast({ title: t('common.error'), description: t('inventory.fields.nameRequired'), variant: 'destructive' });

    setIsSaving(true);
    
    // Scaling logic for storage
    const packSize = getPackSize(formData.packaging);
    const isPack = isBoxUnit(formData.unit_type);
    
    const scaleP = (v: any) => isPack && packSize > 1 ? (Number(v) || 0) / packSize : (Number(v) || 0);
    const scaleQ = (v: any) => isPack && packSize > 1 ? (Number(v) || 0) * packSize : (Number(v) || 0);

    const productData = {
      name: formData.name.trim(),
      sku: formData.sku.trim() || undefined,
      price: scaleP(formData.selling_price_detail),
      selling_price_2: scaleP(formData.selling_price_2),
      selling_price_3: scaleP(formData.selling_price_3),
      selling_price_4: scaleP(formData.selling_price_4),
      wholesale_price_ht: scaleP(formData.selling_price_ht),
      wholesale_price_ttc: scaleP(formData.selling_price_ttc),
      cost: scaleP(formData.purchase_price),
      quantity: editingProduct ? editingProduct.current_stock : scaleQ(formData.reorder_quantity),
      low_stock_threshold: scaleQ(formData.min_stock_alert),
      store_id: storeId,
      category_id: formData.family_id || null,
      packaging: formData.packaging || '1',
      unit_type: formData.unit_type || 'Pièce',
      brand: formData.brand || undefined,
      aisle: formData.aisle || undefined,
      expiry_date: formData.expiry_date || undefined,
      reorder_quantity: scaleQ(formData.reorder_quantity),
      description: formData.description || undefined,
      image_url: formData.image_url || undefined,
    };

    try {
      const res = editingProduct 
        ? await OfflineInventoryService.updateItem(editingProduct.id, productData)
        : await OfflineInventoryService.createItem(productData);

      if (res.error) throw res.error;

      toast({ title: t('common.success'), description: t('inventory.productSaved') });
      await fetchData();
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (p: ProductMaster) => {
    setEditingProduct(p);
    
    // Reverse scaling for UI display
    const packSize = getPackSize(p.packaging || '1');
    const isPack = isBoxUnit(p.unit_type || 'Pièce');
    const scale = (v: any) => isPack && packSize > 1 ? (Number(v) * packSize) : Number(v);
    const scaleQty = (v: any) => isPack && packSize > 1 ? (Number(v) / packSize) : Number(v);
    
    setFormData({
      name: p.name,
      sku: p.sku || '',
      barcode: p.barcode || '',
      description: p.description || '',
      purchase_price: scale(p.purchase_price),
      selling_price_detail: scale(p.selling_price_detail),
      selling_price_2: scale(p.selling_price_2 || 0),
      selling_price_3: scale(p.selling_price_3 || 0),
      selling_price_4: scale(p.selling_price_4 || 0),
      selling_price_wholesale: scale(p.selling_price_wholesale || 0),
      selling_price_ht: scale(p.selling_price_ht || 0),
      selling_price_ttc: scale(p.selling_price_ttc || 0),
      min_stock_alert: scaleQty(p.min_stock_alert || 10),
      unit_type: p.unit_type || 'Pièce',
      family_id: p.family_id || '',
      brand: p.brand || '',
      aisle: p.aisle || '',
      preferred_supplier_id: p.preferred_supplier_id || '',
      packaging: p.packaging || '1',
      reorder_quantity: scaleQty(p.current_stock),
      expiry_date: p.expiry_date || '',
      image_url: p.image_url || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('inventory.deleteConfirm'))) return;
    try {
      const { error } = await OfflineInventoryService.deleteItem(id);
      if (error) throw error;
      deleteProduct(id);
      toast({ title: t('common.success') });
      await fetchData();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const marginPercent = Number(formData.selling_price_detail) > 0 && Number(formData.purchase_price) > 0
    ? (((Number(formData.selling_price_detail) - Number(formData.purchase_price)) / Number(formData.purchase_price)) * 100).toFixed(1)
    : '0';

  const filteredProducts = products.filter(p => {
    const mSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const mFamily = selectedFamily === 'all' || (p.family_id && p.family_id === selectedFamily);
    return mSearch && mFamily;
  });

  const renderProductFields = (data: typeof initialFormState, update: (field: keyof typeof initialFormState, val: any) => void, index?: number) => {
    const margin = Number(data.selling_price_detail) > 0 && Number(data.purchase_price) > 0
        ? (((Number(data.selling_price_detail) - Number(data.purchase_price)) / Number(data.purchase_price)) * 100).toFixed(1)
        : '0';

    return (
        <>
            {/* Column 1: General */}
            <div className="space-y-6 border-r pr-6">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {t('inventory.sectionIdentification')}
                </h3>
                <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="font-bold">{t('inventory.fields.name')} *</Label>
                    <Input value={data.name} onChange={e => update('name', e.target.value)} required className="h-12 text-lg font-semibold bg-muted/20" placeholder="ex: Coca Cola 1.5L" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.sku')}</Label>
                    <Input value={data.sku} onChange={e => update('sku', e.target.value)} className="h-10 font-mono" placeholder="REF-001" />
                    </div>
                    <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.barcode')}</Label>
                    <div className="flex gap-2">
                        <Input value={data.barcode} onChange={e => update('barcode', e.target.value)} className="h-10 font-mono" placeholder="12345678" />
                        <Button type="button" variant="outline" size="icon" onClick={() => update('barcode', `PRD${Date.now().toString(36).toUpperCase()}`)} className="h-10 w-10 shrink-0"><Barcode className="h-4 w-4" /></Button>
                    </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-primary">{t('inventory.fields.family')}</Label>
                    <Select value={data.family_id} onValueChange={v => update('family_id', v)}>
                    <SelectTrigger className="h-10 bg-primary/5 border-primary/20"><SelectValue placeholder={t('inventory.fields.selectFamily')} /></SelectTrigger>
                    <SelectContent>
                        {families.map(fam => <SelectItem key={fam.id} value={fam.id}>{fam.name}</SelectItem>)}
                    </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.brand')}</Label>
                    <Input value={data.brand} onChange={e => update('brand', e.target.value)} className="h-10" />
                </div>
                </div>
            </div>

            {/* Column 2: Pricing */}
            <div className="space-y-6 border-r px-6">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                    {t('inventory.sectionPrices')}
                </h3>
                <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-sm font-black text-primary uppercase tracking-wider">{t('inventory.fields.price1Detail')} *</Label>
                    <div className="relative">
                    <Input type="number" value={data.selling_price_detail} onChange={handleNumChange('selling_price_detail', index)} onBlur={handleNumBlur('selling_price_detail', index)} required className="h-14 text-2xl font-black border-primary/40 bg-primary/5 pl-4 pr-12 text-primary" />
                    <span className="absolute right-4 top-4 font-black text-primary/40 text-xl">F</span>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.price2Discount')}</Label>
                    <Input type="number" value={data.selling_price_2} onChange={handleNumChange('selling_price_2', index)} onBlur={handleNumBlur('selling_price_2', index)} className="h-10" />
                    </div>
                    <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.price3Bulk')}</Label>
                    <Input type="number" value={data.selling_price_3} onChange={handleNumChange('selling_price_3', index)} onBlur={handleNumBlur('selling_price_3', index)} className="h-10" />
                    </div>
                    <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.price4Resale')}</Label>
                    <Input type="number" value={data.selling_price_4} onChange={handleNumChange('selling_price_4', index)} onBlur={handleNumBlur('selling_price_4', index)} className="h-10" />
                    </div>
                </div>
                <div className="space-y-2 pt-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.purchasePrice')}</Label>
                    <div className="relative">
                    <Input type="number" value={data.purchase_price} onChange={handleNumChange('purchase_price', index)} onBlur={handleNumBlur('purchase_price', index)} className="h-10 font-bold bg-muted/30" />
                    <span className="absolute right-3 top-2.5 text-muted-foreground text-xs font-bold">F</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-danger">{t('inventory.fields.wholesalePriceHT')}</Label>
                    <Input type="number" value={data.selling_price_ht} onChange={handleNumChange('selling_price_ht', index)} onBlur={handleNumBlur('selling_price_ht', index)} className="h-10 border-danger/20" />
                    </div>
                    <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-danger">{t('inventory.fields.wholesalePriceTTC')}</Label>
                    <Input type="number" value={data.selling_price_ttc} onChange={handleNumChange('selling_price_ttc', index)} onBlur={handleNumBlur('selling_price_ttc', index)} className="h-10 border-danger/20 font-bold" />
                    </div>
                </div>
                <div className="p-6 rounded-2xl bg-success/5 border border-success/10 mt-4 shadow-inner">
                    <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest text-success/60">{t('menu.program.calculatedMargin')}:</span>
                    <span className="text-3xl font-black text-success">{margin}%</span>
                    </div>
                </div>
                </div>
            </div>

            {/* Column 3: Logistics */}
            <div className="space-y-6 pl-6">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {t('inventory.sectionLogistics')}
                </h3>
                <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('menu.program.unit')}</Label>
                    <Select value={data.unit_type} onValueChange={v => update('unit_type', v)}>
                        <SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="Pièce">{t('inventory.unitTypes.piece')}</SelectItem>
                        <SelectItem value="Carton">{t('inventory.unitTypes.carton')}</SelectItem>
                        <SelectItem value="KG">Kilogramme (KG)</SelectItem>
                        <SelectItem value="Litre">Litre (L)</SelectItem>
                        <SelectItem value="Paquet">Paquet</SelectItem>
                        <SelectItem value="Sac">Sac</SelectItem>
                        </SelectContent>
                    </Select>
                    </div>
                    <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-primary">{t('inventory.fields.packaging')}</Label>
                    <Input value={data.packaging} onChange={e => update('packaging', e.target.value)} placeholder="Ex: 12" className="h-10 font-bold border-primary/20" />
                    </div>
                </div>
                <div className="space-y-2 bg-primary/5 p-3 rounded-lg border border-primary/10">
                    <Label className="text-xs font-black uppercase text-primary flex items-center gap-2">
                        <Package className="h-3 w-3" />
                        Sous-Conditionnement
                    </Label>
                    <Input 
                        value={data.sub_packaging || ''} 
                        onChange={e => update('sub_packaging', e.target.value)} 
                        placeholder="Ex: 10" 
                        className="h-9 font-bold bg-white" 
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.minStock')}</Label>
                    <Input type="number" value={data.min_stock_alert} onChange={handleNumChange('min_stock_alert', index)} onBlur={handleNumBlur('min_stock_alert', index)} className="h-10" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.image')}</Label>
                    <ImageUpload value={data.image_url} onChange={url => update('image_url', url)} />
                </div>
                </div>
            </div>
        </>
    );
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4 bg-[hsl(60,80%,85%)] dark:bg-transparent transition-colors">
      <div className="flex items-center gap-4 bg-card p-3 rounded-xl border border-border/50 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('common.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10 border-none bg-muted/30 focus-visible:ring-primary" />
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedFamily} onValueChange={setSelectedFamily}>
            <SelectTrigger className="w-48 h-10 bg-muted/30 border-none"><SelectValue placeholder={t('inventory.fields.family')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('inventory.allFamilies')}</SelectItem>
              {families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} className="h-10 w-10"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => { setEditingProduct(null); setFormData(initialFormState); setIsDialogOpen(true); }} className="h-10 px-6 font-bold"><Plus className="h-4 w-4 mr-2" /> {t('inventory.addItem')}</Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden border-border/50 shadow-sm">
        <CardContent className="p-0 h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t('inventory.table.name')}</TableHead>
                <TableHead>{t('inventory.table.sku')}</TableHead>
                <TableHead>{t('inventory.fields.family')}</TableHead>
                <TableHead className="text-right">{t('inventory.fields.purchasePriceShort')}</TableHead>
                <TableHead className="text-right">{t('inventory.fields.retailPriceShort')}</TableHead>
                <TableHead className="text-right">{t('inventory.fields.packaging')}</TableHead>
                <TableHead className="text-right">{t('inventory.table.quantity')}</TableHead>
                <TableHead className="text-center">{t('inventory.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p, i) => {
                const packSize = getPackSize(p.packaging || '1');
                const isBox = isBoxUnit(p.unit_type || 'Pièce');
                const displayPurchasePrice = isBox ? (p.purchase_price * packSize) : p.purchase_price;
                const displayRetailPrice = isBox ? (p.selling_price_detail * packSize) : p.selling_price_detail;

                return (
                  <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium uppercase">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs opacity-60">{p.sku || '-'}</TableCell>
                    <TableCell>{families.find(f => f.id === p.family_id)?.name || '-'}</TableCell>
                    <TableCell className="text-right">{displayPurchasePrice.toLocaleString()} F</TableCell>
                    <TableCell className="text-right font-bold text-primary">{displayRetailPrice.toLocaleString()} F</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{p.packaging || '-'}</TableCell>
                    <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                            <Badge variant={p.current_stock <= (p.min_stock_alert || 0) ? 'destructive' : 'secondary'}>
                                {isBox ? (p.current_stock / packSize).toFixed(1) : p.current_stock} {isBox ? p.unit_type?.toUpperCase() : t('inventory.unitPiece')}
                            </Badge>
                            <span className="text-[8px] opacity-50 mt-0.5">({p.current_stock} {t('inventory.unitPiece')})</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-full w-full h-[95vh] p-0 flex flex-col gap-0 rounded-none sm:rounded-lg sm:max-w-6xl sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl border-primary/20">
          <DialogHeader className="px-6 py-4 border-b bg-card shrink-0">
            <div className="flex items-center justify-between w-full pr-8">
                <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter">
                <Package className="h-6 w-6 text-primary" /> 
                {editingProduct ? t('inventory.editItem') : registrationMode === 'multi' ? "Ajout Multiple d'Articles" : t('inventory.addItem')}
                </DialogTitle>
                {!editingProduct && (
                    <div className="flex items-center gap-3 bg-primary/5 px-4 py-2 rounded-full border border-primary/20">
                        <Label className="text-xs font-black uppercase tracking-widest text-primary/60">Mode Multiple</Label>
                        <Switch 
                            checked={registrationMode === 'multi'} 
                            onCheckedChange={(val) => {
                                setRegistrationMode(val ? 'multi' : 'single');
                                if (val && multiItems.length === 0) {
                                    setMultiItems([{ ...initialFormState, id: crypto.randomUUID(), isOpen: true }]);
                                }
                            }}
                        />
                    </div>
                )}
            </div>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="flex-1 flex flex-col min-h-0 bg-background">
            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">{t('inventory.sectionIdentification')}</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-bold">{t('inventory.fields.name')} *</Label>
                      <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required className="h-12 text-lg font-semibold bg-muted/20" placeholder="ex: Coca Cola 1.5L" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">{t('inventory.fields.sku')}</Label>
                        <Input value={formData.sku} onChange={e => setFormData(f => ({ ...f, sku: e.target.value }))} className="h-10 font-mono" placeholder="REF-001" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">{t('inventory.fields.barcode')}</Label>
                        <div className="flex gap-2">
                          <Input value={formData.barcode} onChange={e => setFormData(f => ({ ...f, barcode: e.target.value }))} className="h-10 font-mono" placeholder="12345678" />
                          <Button type="button" variant="outline" size="icon" onClick={() => setFormData(f => ({ ...f, barcode: `PRD${Date.now().toString(36).toUpperCase()}` }))} className="h-10 w-10 shrink-0"><Barcode className="h-4 w-4" /></Button>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); removeMultiItemRow(item.id); }}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-primary">{t('inventory.fields.family')}</Label>
                      <Select value={formData.family_id} onValueChange={v => setFormData(f => ({ ...f, family_id: v }))}>
                        <SelectTrigger className="h-10 bg-primary/5 border-primary/20"><SelectValue placeholder={t('inventory.fields.selectFamily')} /></SelectTrigger>
                        <SelectContent>{families.map(fam => <SelectItem key={fam.id} value={fam.id}>{fam.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">{t('inventory.fields.brand')}</Label>
                      <Input value={formData.brand} onChange={e => setFormData(f => ({ ...f, brand: e.target.value }))} className="h-10" />
                    </div>
                  </div>
                </div>

                <div className="space-y-6 px-6 border-x">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">{t('inventory.sectionPrices')}</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-primary uppercase tracking-wider">{t('inventory.fields.price1Detail')} *</Label>
                      <div className="relative">
                        <Input type="number" value={formData.selling_price_detail} onChange={handleNumChange('selling_price_detail')} onBlur={handleNumBlur('selling_price_detail')} required className="h-14 text-2xl font-black border-primary/40 bg-primary/5 pl-4 pr-12 text-primary" />
                        <span className="absolute right-4 top-4 font-black text-primary/40 text-xl">F</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.price2Discount')}</Label><Input type="number" value={formData.selling_price_2} onChange={handleNumChange('selling_price_2')} onBlur={handleNumBlur('selling_price_2')} className="h-10" /></div>
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.price3Bulk')}</Label><Input type="number" value={formData.selling_price_3} onChange={handleNumChange('selling_price_3')} onBlur={handleNumBlur('selling_price_3')} className="h-10" /></div>
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.price4Resale')}</Label><Input type="number" value={formData.selling_price_4} onChange={handleNumChange('selling_price_4')} onBlur={handleNumBlur('selling_price_4')} className="h-10" /></div>
                    </div>
                    <div className="space-y-2 pt-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.purchasePrice')}</Label><div className="relative"><Input type="number" value={formData.purchase_price} onChange={handleNumChange('purchase_price')} onBlur={handleNumBlur('purchase_price')} className="h-10 font-bold bg-muted/30" /><span className="absolute right-3 top-2.5 text-muted-foreground text-xs font-bold">F</span></div></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.wholesalePriceHT')}</Label><Input type="number" value={formData.selling_price_ht} onChange={handleNumChange('selling_price_ht')} onBlur={handleNumBlur('selling_price_ht')} className="h-10" /></div>
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.wholesalePriceTTC')}</Label><Input type="number" value={formData.selling_price_ttc} onChange={handleNumChange('selling_price_ttc')} onBlur={handleNumBlur('selling_price_ttc')} className="h-10" /></div>
                    </div>
                    <div className="p-6 rounded-2xl bg-success/5 border border-success/10 mt-4 shadow-inner flex justify-between items-center"><span className="text-xs font-black uppercase tracking-widest text-success/60">{t('menu.program.calculatedMargin')}:</span><span className="text-3xl font-black text-success">{marginPercent}%</span></div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">{t('inventory.sectionLogistics')}</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">{t('menu.program.unit')}</Label>
                        <Select value={formData.unit_type} onValueChange={v => setFormData(f => ({ ...f, unit_type: v }))}>
                          <SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pièce">{t('inventory.unitTypes.piece')}</SelectItem>
                            <SelectItem value="Kg">{t('inventory.unitTypes.kg')}</SelectItem>
                            <SelectItem value="Litre">{t('inventory.unitTypes.litre')}</SelectItem>
                            <SelectItem value="Carton">{t('inventory.unitTypes.carton')}</SelectItem>
                            <SelectItem value="Paquet">Paquet</SelectItem>
                            <SelectItem value="Sachet">Sachet</SelectItem>
                            <SelectItem value="Sac">Sac</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase text-primary">{t('inventory.fields.packaging')}</Label><Input value={formData.packaging} onChange={e => setFormData(f => ({ ...f, packaging: e.target.value }))} placeholder="Ex: 12" className="h-10 font-bold border-primary/20" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs font-black uppercase text-primary">QUANTITÉ INITIALE</Label><Input type="number" value={formData.reorder_quantity} onChange={handleNumChange('reorder_quantity')} className="h-10 font-black bg-primary/5 border-primary/20" /></div>
                      <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.minStock')}</Label><Input type="number" value={formData.min_stock_alert} onChange={handleNumChange('min_stock_alert')} onBlur={handleNumBlur('min_stock_alert')} className="h-10" /></div>
                    </div>
                    <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.image')}</Label><ImageUpload value={formData.image_url} onChange={url => setFormData(f => ({ ...f, image_url: url }))} /></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-card flex justify-end gap-3 shrink-0">
              <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isSaving} className="px-10 font-bold">{isSaving ? t('common.loading') : editingProduct ? t('common.update') : t('inventory.createItem')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
