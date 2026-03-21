import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ExportService } from '@/services/ExportService';
import { Search, Plus, Edit2, Trash2, Package, Barcode, Minus, ChevronDown, ChevronRight, RefreshCw, X, Download } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getDataClient } from '@/lib/dataClient';
import { useMasterDataStore, ProductMaster } from '@/stores/useMasterDataStore';
import { toast } from '@/hooks/use-toast';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useTranslation } from 'react-i18next';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { cn } from '@/lib/utils';
import { ProductLookupDialog } from '../Sales/ProductLookupDialog';
import { MasterPasswordGate } from '@/components/shared/MasterPasswordGate';

interface FichiersProduitsModuleProps {
  storeId: string;
  isMasterView?: boolean;
}

export function FichiersProduitsModule({ storeId, isMasterView }: FichiersProduitsModuleProps) {
  const { t } = useTranslation();
  const { families, setFamilies, setSuppliers, setLoading, deleteProduct } = useMasterDataStore();
  const [localProducts, setLocalProducts] = useState<ProductMaster[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [lookupTargetIndex, setLookupTargetIndex] = useState<number | null>(null);
  
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'single' | 'multi'>('single');

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

  const fetchData = useCallback(async () => {
    console.log('[FichiersProduits] Fetching data for store:', storeId);
    setLoading(true);
    try {
      const [inventoryRes, familiesRes] = await Promise.all([
        OfflineInventoryService.getInventory(storeId, { notify: false }),
        OfflineInventoryService.getProductFamilies(storeId)
      ]);
      
      console.log('[FichiersProduits] Inventory response:', inventoryRes.data?.length || 0, 'items');

      if (inventoryRes.data) {
        const mapped = inventoryRes.data.map(item => ({
          ...item,
          purchase_price: Number(item.cost || (item as any).cost_price || 0),
          selling_price_detail: Number(item.price || (item as any).unit_price || 0),
          current_stock: Number(item.quantity ?? (item as any).stock ?? (item as any).current_stock ?? 0),
          min_stock_alert: Number(item.low_stock_threshold ?? (item as any).min_quantity ?? 0),
          unit_type: item.unit_type || 'Pièce',
          family_id: item.category_id || (item as any).category || (item as any).family_id,
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
      if (familiesRes.data) {
        console.log('[FichiersProduits] Families fetched:', familiesRes.data.length);
        setFamilies(familiesRes.data as any);
      }
    } catch (err) {
      console.error('[FichiersProduits] Fetch error:', err);
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [storeId, t, setFamilies, setLoading]);

  useEffect(() => {
    const handleScannerInput = (e: any) => {
      const code = e.detail?.code;
      if (code && isDialogOpen) {
        if (registrationMode === 'single') {
          setFormData(prev => ({ ...prev, barcode: code }));
        } else {
          // If in multi-mode, update the currently open item or the last item
          setMultiItems(prev => {
            const newItems = [...prev];
            const openIndex = newItems.findIndex(i => i.isOpen);
            if (openIndex >= 0) {
              newItems[openIndex] = { ...newItems[openIndex], barcode: code };
            } else if (newItems.length > 0) {
              newItems[newItems.length - 1] = { ...newItems[newItems.length - 1], barcode: code };
            }
            return newItems;
          });
        }
        toast.success(t('scanner.codeScanned') || 'Code scanned');
      }
    };
    window.addEventListener('scanner-input', handleScannerInput);
    return () => window.removeEventListener('scanner-input', handleScannerInput);
  }, [isDialogOpen, t, registrationMode]);

    useEffect(() => {
    if (storeId) {
      fetchData();
    }

    const handleRefresh = (e: any) => {
      if (e.detail?.type === 'inventory') {
        fetchData();
      }
    };

    window.addEventListener('localDbDataUpdated', handleRefresh);
    return () => window.removeEventListener('localDbDataUpdated', handleRefresh);
  }, [storeId, fetchData]);





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
    const scaleFields = (item: any, newUnit: string) => {
        const packSize = getPackSize(item.packaging);
        const isNewUnitBox = isBoxUnit(newUnit);
        const isOldUnitBox = isBoxUnit(item.unit_type);

        const formatValue = (num: number) => Number(Number(num).toFixed(4));

        if (isNewUnitBox !== isOldUnitBox && packSize > 1) {
            const multiplier = isNewUnitBox ? packSize : (1 / packSize);
            return {
                ...item,
                unit_type: newUnit,
                purchase_price: formatValue(Number(item.purchase_price || 0) * multiplier),
                selling_price_detail: formatValue(Number(item.selling_price_detail || 0) * multiplier),
                selling_price_2: formatValue(Number(item.selling_price_2 || 0) * multiplier),
                selling_price_3: formatValue(Number(item.selling_price_3 || 0) * multiplier),
                selling_price_4: formatValue(Number(item.selling_price_4 || 0) * multiplier),
                selling_price_ht: formatValue(Number(item.selling_price_ht || 0) * multiplier),
                selling_price_ttc: formatValue(Number(item.selling_price_ttc || 0) * multiplier),
                quantity: formatValue(Number(item.quantity || 0) / multiplier),
                reorder_quantity: formatValue(Number(item.reorder_quantity || 0) / multiplier),
                min_stock_alert: formatValue(Number(item.min_stock_alert || 0) / multiplier),
            };
        }
        return { ...item, [field]: val };
    };

    if (index !== undefined) {
        setMultiItems(prev => prev.map((item, i) => {
            if (i !== index) return item;
            if (field === 'unit_type') return scaleFields(item, val);
            return { ...item, [field]: val };
        }));
    } else {
        setFormData(f => {
            if (field === 'unit_type') return scaleFields(f, val) as typeof f;
            return { ...f, [field]: val };
        });
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

  const resetForm = () => {
    setFormData(initialFormState);
    setMultiItems([{ ...initialFormState, id: crypto.randomUUID(), isOpen: false }]);
    setEditingProduct(null);
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
    console.log('[FichiersProduits] handleSave triggered. Mode:', registrationMode);
    setIsSaving(true);
    try {
        const itemsToSave = registrationMode === 'single' ? [formData] : multiItems;
        console.log('[FichiersProduits] Items to save:', itemsToSave.length);
        
        for (const item of itemsToSave) {
            console.log('[FichiersProduits] Processing item:', item.name);

            let finalFamilyId = item.family_id;
            // Only try to create if it's not empty and we can't find an existing ID or exact name match
            if (item.family_id) {
                const existing = families.find(f => f.id === item.family_id || f.name.toLowerCase() === item.family_id.toLowerCase());
                if (existing) {
                    finalFamilyId = existing.id;
                } else {
                    console.log('[FichiersProduits] Creating new family on the fly:', item.family_id);
                    try {
                        const dc = getDataClient();
                        const headers = await OfflineAuthService.getAuthHeaders() || {};
                        const famRes = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/product_families`, {
                            method: 'POST',
                            headers: { ...headers, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name: item.family_id, store_id: storeId })
                        });
                        if (famRes.ok) {
                            const newFam = await famRes.json();
                            finalFamilyId = newFam.id;
                            // Optimistically add to state so subsequent items find it
                            families.push(newFam);
                        }
                    } catch(e) {
                        console.error("Failed to create family", e);
                    }
                }
            }

            const packSize = getPackSize(item.packaging);
            const isBox = isBoxUnit(item.unit_type);
            
            let finalPrice = Number(item.selling_price_detail) || 0;
            let finalCost = Number(item.purchase_price) || 0;
            let finalQty = Number(registrationMode === 'single' ? item.reorder_quantity : item.quantity) || 0;
            
            if (isBox && packSize > 1) {
                finalPrice = finalPrice / packSize;
                finalCost = finalCost / packSize;
                finalQty = finalQty * packSize;
            }

            const data = {
                name: item.name,
                sku: item.sku || undefined,
                barcode: item.barcode || undefined,
                description: item.description || undefined,
                unit_price: finalPrice,
                cost_price: finalCost,
                selling_price_2: item.selling_price_2 ? Number(item.selling_price_2) / (isBox ? packSize : 1) : undefined,
                selling_price_3: item.selling_price_3 ? Number(item.selling_price_3) / (isBox ? packSize : 1) : undefined,
                selling_price_4: item.selling_price_4 ? Number(item.selling_price_4) / (isBox ? packSize : 1) : undefined,
                wholesale_price_ht: item.selling_price_ht ? Number(item.selling_price_ht) / (isBox ? packSize : 1) : undefined,
                wholesale_price_ttc: item.selling_price_ttc ? Number(item.selling_price_ttc) / (isBox ? packSize : 1) : undefined,
                wholesale_price: item.selling_price_ttc ? Number(item.selling_price_ttc) / (isBox ? packSize : 1) : undefined,
                quantity: finalQty,
                min_quantity: Number(item.min_stock_alert) || 0,
                low_stock_threshold: Number(item.min_stock_alert) || 0,
                unit_type: item.unit_type,
                packaging: item.packaging,
                category: finalFamilyId || undefined,
                brand: item.brand || undefined,
                aisle: item.aisle || undefined,
                image_url: item.image_url || undefined,
                store_id: storeId,
            };

            console.log('[FichiersProduits] Payload for service:', data);

            let result;
            if (editingProduct) {
                console.log('[FichiersProduits] Updating existing product:', editingProduct.id);
                result = await OfflineInventoryService.updateItem(editingProduct.id, data);
            } else {
                console.log('[FichiersProduits] Creating new product...');
                result = await OfflineInventoryService.createItem(data);
            }

            if (result.error) {
                console.error('[FichiersProduits] Service error:', result.error);
                throw result.error;
            }
            console.log('[FichiersProduits] Save successful for item:', item.name);
        }

        toast({ title: t('common.success') });
        window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'product' } }));
        setIsDialogOpen(false);
        await fetchData();
    } catch (err: any) {
        console.error('[FichiersProduits] Global save catch:', err);
        toast({ title: t('common.error'), description: err.message || t('common.error'), variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleEdit = (p: ProductMaster) => {
    setEditingProduct(p);
    setRegistrationMode('single');
    const packSize = getPackSize(p.packaging || '1');
    const isBox = isBoxUnit(p.unit_type || 'Pièce');
    const scale = (val: any) => isBox && packSize > 1 ? (Number(val) * packSize) : Number(val);
    
    setFormData({
      ...initialFormState,
      name: p.name, sku: p.sku || '', barcode: p.barcode || '', description: p.description || '',
      purchase_price: scale(p.purchase_price),
      selling_price_detail: scale(p.selling_price_detail),
      selling_price_2: scale(p.selling_price_2),
      selling_price_3: scale(p.selling_price_3),
      selling_price_4: scale(p.selling_price_4),
      selling_price_ht: scale(p.wholesale_price_ht),
      selling_price_ttc: scale(p.wholesale_price_ttc),
      reorder_quantity: isBox ? (p.current_stock / packSize) : p.current_stock,
      min_stock_alert: isBox ? ((p.min_stock_alert || 0) / packSize) : (p.min_stock_alert || 0),
      unit_type: p.unit_type || 'Pièce',
      family_id: p.family_id || '', brand: p.brand || '', aisle: p.aisle || '',
      packaging: p.packaging || '1',
      expiry_date: p.expiry_date || '', image_url: p.image_url || '',
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
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleProductSelected = (product: any) => {
    const pData = {
        name: product.name,
        sku: product.sku || '',
        purchase_price: product.cost_price || 0,
        selling_price_detail: product.unit_price || 0,
        selling_price_2: product.selling_price_2 || 0,
        selling_price_3: product.selling_price_3 || 0,
        selling_price_4: product.selling_price_4 || 0,
        selling_price_ht: product.wholesale_price_ht || 0,
        selling_price_ttc: product.wholesale_price_ttc || 0,
        unit_type: product.unit_type || 'Pièce',
        family_id: product.category_id || '',
        packaging: product.packaging || '1',
    };

    if (lookupTargetIndex !== null) {
        setMultiItems(prev => prev.map((item, i) => i === lookupTargetIndex ? { ...item, ...pData } : item));
    } else {
        setFormData(f => ({ ...f, ...pData }));
    }
    setIsLookupOpen(false);
  };

  
  const handleExport = (type: 'soft' | 'full') => {
    if (localProducts.length === 0) {
      toast.error(t('common.noData'));
      return;
    }

    let dataToExport = [];
    if (type === 'soft') {
      dataToExport = localProducts.map(p => ({
        Name: p.name,
        SKU: p.sku || '',
        Barcode: p.barcode || '',
        Packaging: p.packaging || '',
        UnitType: p.unit_type || ''
      }));
    } else {
      dataToExport = localProducts.map(p => ({
        Name: p.name,
        SKU: p.sku || '',
        Barcode: p.barcode || '',
        Category: p.category_name || '',
        Quantity: p.quantity,
        MinQuantity: p.min_quantity,
        CostPrice: p.cost_price,
        RetailPrice: p.unit_price,
        WholesalePrice: p.wholesale_price,
        SellingPrice2: p.selling_price_2,
        SellingPrice3: p.selling_price_3,
        SellingPrice4: p.selling_price_4,
        Packaging: p.packaging,
        UnitType: p.unit_type
      }));
    }
    ExportService.exportToCSV(dataToExport, `inventory_export_${type}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const filteredProducts = useMemo(() => {
    return localProducts.filter(p => {
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
                    <span className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">{t('inventory.importFromExisting')}</span>
                </div>
                <Button variant="outline" size="sm" type="button" onClick={() => { setLookupTargetIndex(index ?? null); setIsLookupOpen(true); }} className="h-8 uppercase font-black text-[10px] tracking-widest px-4 border-primary/20 hover:bg-primary hover:text-white">Choisir l'article</Button>
            </div>

            <div className="space-y-6 border-r pr-6">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />{t('inventory.sectionIdentification')}
                </h3>
                <div className="space-y-4">
                    <div className="space-y-2"><Label className="font-bold">{t('inventory.fields.name')} *</Label><Input value={data.name} onChange={e => update('name', e.target.value)} required className="h-12 text-lg font-semibold bg-muted/20" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase">{t('inventory.fields.sku')}</Label>
                          <Input 
                            value={data.sku} 
                            onChange={e => update('sku', e.target.value)} 
                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                            className="h-10 font-mono" 
                          />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">{t('inventory.fields.barcode')}</Label>
                            <div className="flex gap-2">
                              <Input 
                                value={data.barcode} 
                                onChange={e => update('barcode', e.target.value)} 
                                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                className="h-10 font-mono" 
                              />
                              <Button type="button" variant="outline" size="icon" onClick={() => update('barcode', `PRD${Date.now().toString(36).toUpperCase()}`)} className="h-10 w-10 shrink-0">
                                <Barcode className="h-4 w-4" />
                              </Button>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-primary">{t('inventory.fields.family')}</Label>
                        <div className="relative">
                          <Input 
                              list={`families-list-${index ?? 'single'}`}
                              value={data.family_id} 
                              onChange={e => update('family_id', e.target.value, index)} 
                              placeholder={t('inventory.fields.selectFamily')}
                              className="h-10 bg-primary/5 border-primary/20 pr-8 font-bold"
                          />
                          <datalist id={`families-list-${index ?? 'single'}`}>
                              {families.map(fam => <option key={fam.id} value={fam.name} />)}
                          </datalist>
                          <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-primary/40 pointer-events-none" />
                        </div>
                    </div>
                    <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.brand')}</Label><Input value={data.brand} onChange={e => update('brand', e.target.value)} className="h-10" /></div>
                </div>
            </div>

            <div className="space-y-6 border-r px-6">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />{t('inventory.sectionPrices')}
                </h3>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-black text-primary uppercase tracking-wider">{t('inventory.fields.price1Detail')} *</Label>
                        <div className="relative"><Input type="number" value={data.selling_price_detail} onChange={handleNumChange('selling_price_detail', index)} onBlur={handleNumBlur('selling_price_detail', index)} required className="h-14 text-2xl font-black border-primary/40 bg-primary/5 pl-4 pr-12 text-primary" /><span className="absolute right-4 top-4 font-black text-primary/40 text-xl">F</span></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.price2Discount')}</Label><Input type="number" value={data.selling_price_2} onChange={handleNumChange('selling_price_2', index)} onBlur={handleNumBlur('selling_price_2', index)} className="h-10" /></div>
                        <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.price3Bulk')}</Label><Input type="number" value={data.selling_price_3} onChange={handleNumChange('selling_price_3', index)} onBlur={handleNumBlur('selling_price_3', index)} className="h-10" /></div>
                        <div className="space-y-2"><Label className="text-xs font-bold uppercase">{t('inventory.fields.price4Resale')}</Label><Input type="number" value={data.selling_price_4} onChange={handleNumChange('selling_price_4', index)} onBlur={handleNumBlur('selling_price_4', index)} className="h-10" /></div>
                    </div>
                    <div className="space-y-2 pt-2">
                        <Label className="text-xs font-bold uppercase">{t('inventory.fields.purchasePrice')}</Label>
                        <div className="relative"><Input type="number" value={data.purchase_price} onChange={handleNumChange('purchase_price', index)} onBlur={handleNumBlur('purchase_price', index)} className="h-10 font-bold bg-muted/30" /><span className="absolute right-3 top-2.5 text-muted-foreground text-xs font-bold">F</span></div></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-xs font-black uppercase text-danger">{t('inventory.fields.wholesalePriceHT')}</Label><Input type="number" value={data.selling_price_ht} onChange={handleNumChange('selling_price_ht', index)} onBlur={handleNumBlur('selling_price_ht', index)} className="h-10 border-danger/20" /></div>
                        <div className="space-y-2"><Label className="text-xs font-black uppercase text-danger">{t('inventory.fields.wholesalePriceTTC')}</Label><Input type="number" value={data.selling_price_ttc} onChange={handleNumChange('selling_price_ttc', index)} onBlur={handleNumBlur('selling_price_ttc', index)} className="h-10 border-danger/20 font-bold" /></div>
                    </div>
                    <div className="p-6 rounded-2xl bg-success/5 border border-success/10 mt-4 shadow-inner flex justify-between items-center"><span className="text-xs font-black uppercase tracking-widest text-success/60">{t('menu.program.calculatedMargin')}:</span><span className="text-3xl font-black text-success">{margin}%</span></div>
                </div>
            </div>

            <div className="space-y-6 pl-6">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />{t('inventory.sectionLogistics')}
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
                                    <SelectItem value="KG">{t('inventory.unitTypes.kg')}</SelectItem>
                                    <SelectItem value="Litre">{t('inventory.unitTypes.litre')}</SelectItem>
                                    <SelectItem value="Paquet">{t('inventory.unitTypes.paquet')}</SelectItem>
                                    <SelectItem value="Sac">{t('inventory.unitTypes.sac')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2"><Label className="text-xs font-bold uppercase text-primary">{t('inventory.fields.packaging')}</Label><Input value={data.packaging} onChange={e => update('packaging', e.target.value)} placeholder={t('inventory.fields.packagingPlaceholder')} className="h-10 font-bold border-primary/20" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-xs font-black uppercase text-primary">{registrationMode === 'single' ? t('inventory.fields.initialQuantity') : t('inventory.fields.quantity')}</Label><Input type="number" value={registrationMode === 'single' ? data.reorder_quantity : data.quantity} onChange={handleNumChange(registrationMode === 'single' ? 'reorder_quantity' : 'quantity', index)} className="h-10 font-black bg-primary/5 border-primary/20" /></div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase">{t('inventory.fields.minStock')}</Label>
                          <Input 
                            type="number" 
                            value={data.min_stock_alert} 
                            onChange={(e) => {
                              const v = e.target.value;
                              update('min_stock_alert', v === '' ? '' : Number(v), index);
                            }} 
                            className="h-10 border-primary/20 font-bold" 
                          />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">{t('inventory.fields.image')}</Label>
                        <ImageUpload currentImageUrl={data.image_url} onImageUploaded={url => update('image_url', url)} onImageRemoved={() => update('image_url', '')} folder="inventory" />
                    </div>
                </div>
            </div>
        </>
    );
  };

  return (
    <MasterPasswordGate moduleName={t('menu.files.products')}>
    <div className={cn("h-full flex flex-col p-4 gap-4 transition-colors", !isMasterView && "bg-[hsl(60,80%,85%)]", "dark:bg-transparent")}>
      <div className="flex items-center gap-4 bg-card p-3 rounded-xl border-2 border-border/50 shadow-lg">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder={t('common.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-10 border-none bg-muted/30 font-black uppercase tracking-tighter" /></div>
        <div className="flex items-center gap-2">
            <Select value={selectedFamily} onValueChange={setSelectedFamily}><SelectTrigger className="w-48 h-10 bg-muted/30 border-none font-black uppercase text-[10px] tracking-widest"><SelectValue placeholder={t('inventory.fields.family')} /></SelectTrigger><SelectContent><SelectItem value="all">{t('inventory.allFamilies')}</SelectItem>{families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select>
            
            {isMasterView && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 border-2 gap-2">
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('soft')}>
                    Soft Export (No Prices)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('full')}>
                    Full Export
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" size="icon" onClick={fetchData} className="h-10 w-10 border-2"><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="h-10 px-6 font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" />{t('inventory.addItem')}</Button>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden border-2 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardContent className="p-0 h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-md border-b-2">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center font-black uppercase tracking-widest text-[9px]">#</TableHead>
                <TableHead className="font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.table.name')}</TableHead>
                <TableHead className="font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.table.sku')}</TableHead>
                <TableHead className="font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.fields.family')}</TableHead>
                <TableHead className="text-right font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.fields.purchasePriceShort')}</TableHead>
                <TableHead className="text-right font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.fields.retailPriceShort')}</TableHead>
                <TableHead className="text-right font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.fields.packaging')}</TableHead>
                <TableHead className="text-right font-black uppercase tracking-[0.2em] text-[9px]">{t('inventory.table.quantity')}</TableHead>
                <TableHead className="text-center font-black uppercase tracking-[0.2em] text-[9px]">{t('common.status')}</TableHead>
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
                    <TableRow key={p.id} className="group transition-colors border-b hover:bg-muted/30">
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
        <DialogContent className="max-w-full w-full h-[95vh] p-0 flex flex-col gap-0 rounded-none sm:rounded-2xl sm:max-w-6xl sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl border-4 border-primary/20">
          <DialogHeader className="px-6 py-4 border-b bg-card shrink-0">
            <div className="flex items-center gap-6">
                {!editingProduct && (
                    <div className="flex items-center gap-3 bg-primary/5 px-4 py-2 rounded-full border-2 border-primary/20">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">MODE MULTIPLE</Label>
                        <Switch checked={registrationMode === 'multi'} onCheckedChange={(val) => { setRegistrationMode(val ? 'multi' : 'single'); if (val && multiItems.length === 0) addMultiItemRow(); }} />
                    </div>
                )}
                <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase tracking-tighter">
                    <Package className="h-7 w-7 text-primary" />
                    {editingProduct ? t('inventory.editItem') : registrationMode === 'multi' ? "AJOUT MULTIPLE" : t('inventory.addItem')}
                </DialogTitle>
            </div>
          </DialogHeader>
          
          <form onSubmit={(e) => { 
        e.preventDefault(); 
        // Only save if the target wasn't an input (prevent scanner Enter from submitting)
        const target = e.nativeEvent?.target as HTMLElement;
        if (target?.tagName !== 'INPUT') {
            handleSave(); 
        }
    }} className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {registrationMode === 'single' ? (
                <div className="p-8">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                    {renderProductFields(formData, (field, val) => updateField(field, val))}
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {multiItems.map((item, index) => (
                    <Card key={item.id} className={cn("border-4 transition-all overflow-hidden cursor-pointer", item.isOpen ? "border-primary shadow-2xl scale-[1.01]" : "border-muted/60 shadow-md hover:border-primary/40 hover:bg-muted/10")}>
                      <div className="flex items-center justify-between p-4" onClick={() => toggleMultiItemRow(item.id)}>
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg bg-primary/10 text-primary transition-transform", item.isOpen && "rotate-180")}>
                            {item.isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                          <span className="font-black uppercase tracking-widest text-sm text-primary/80">{item.name || `NOUVEL ARTICLE #${index + 1}`}</span>
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
              <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isSaving} className="px-12 font-black uppercase tracking-widest text-xs h-12 shadow-xl shadow-primary/30">
                {isSaving ? t('common.loading') : editingProduct ? t('common.update') : registrationMode === 'multi' ? t('inventory.saveMultipleItems', { count: multiItems.length }) : t('inventory.createItem')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ProductLookupDialog open={isLookupOpen} onOpenChange={setIsLookupOpen} storeId={storeId} title={t('purchases.productSearch')} standalone mode="wholesale" onSelect={handleProductSelected} />
    </div>
    </MasterPasswordGate>
  );
}
