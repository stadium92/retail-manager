import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Search, Plus, Edit2, Trash2, Package, Barcode, Minus, ChevronDown, ChevronRight, RefreshCw, X, Download, ReceiptText, Coins, ChefHat, Sliders, Image as ImageIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getDataClient } from '@/lib/dataClient';
import { useMasterDataStore, ProductMaster } from '@/stores/useMasterDataStore';
import { toast } from '@/hooks/use-toast';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useTranslation } from 'react-i18next';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { cn } from '@/lib/utils';
import { ProductLookupDialog } from '../../Sales/ProductLookupDialog';
import { MasterPasswordGate } from '@/components/shared/MasterPasswordGate';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecipeBuilder } from '@/components/recipe/RecipeBuilder';
import { supabase } from '@/lib/supabase';

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
  
  // Obsolete pendingId and itemType are removed. They are now part of initialFormState.

  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'single' | 'multi'>('single');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [multiAdvancedOpen, setMultiAdvancedOpen] = useState<Record<string, boolean>>({});
  const [selectedMultiItemIndex, setSelectedMultiItemIndex] = useState(0);

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
    prep_time_minutes: 0 as number | string,
    is_available: true as boolean,
    allergens: '' as string,
    course_type: 'Main' as string,
    modifiers: '' as string,
    
    // UI State embedded in items
    _ui_activeTab: 'informations' as 'informations' | 'prix' | 'logistique' | 'composition' | 'options',
    _ui_itemType: 'dish' as 'dish' | 'product',
    _ui_recipeItems: [] as { ingredient_id: string; quantity_needed: number; unit: string }[],
    _ui_recipeCost: 0,
    _ui_pendingId: '',
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
          prep_time_minutes: Number((item as any).prep_time_minutes || 0),
          is_available: (item as any).is_available !== false && (item as any).is_available !== 0,
          allergens: (item as any).allergens || [],
          course_type: (item as any).course_type || '',
          modifiers: (item as any).modifiers || [],
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
          setTimeout(() => document.getElementById('product-name-single')?.focus(), 50);
        } else {
          // If in multi-mode, update the currently open item or the last item
          let targetIdx = -1;
          setMultiItems(prev => {
            const newItems = [...prev];
            const openIndex = newItems.findIndex(i => i.isOpen);
            if (openIndex >= 0) {
              newItems[openIndex] = { ...newItems[openIndex], barcode: code };
              targetIdx = openIndex;
            } else if (newItems.length > 0) {
              newItems[newItems.length - 1] = { ...newItems[newItems.length - 1], barcode: code };
              targetIdx = newItems.length - 1;
            }
            return newItems;
          });
          if (targetIdx !== -1) {
            setTimeout(() => document.getElementById(`product-name-${targetIdx}`)?.focus(), 50);
          }
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
    updateField(field, finalVal, index);
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
    setMultiItems(prev => {
        const lastItem = prev[prev.length - 1] || initialFormState;
        setTimeout(() => setSelectedMultiItemIndex(prev.length), 0);
        return [
            ...prev,
            { 
                ...initialFormState, 
                id: crypto.randomUUID(), 
                _ui_pendingId: crypto.randomUUID(),
                family_id: lastItem.family_id,
                brand: lastItem.brand,
                unit_type: lastItem.unit_type,
                packaging: lastItem.packaging,
                aisle: lastItem.aisle
            }
        ];
    });
  };

  const removeMultiItemRow = (id: string) => {
    setMultiItems(prev => {
        const newItems = prev.filter(item => item.id !== id);
        setTimeout(() => {
            setSelectedMultiItemIndex(curr => Math.min(curr, Math.max(0, newItems.length - 1)));
        }, 0);
        return newItems;
    });
  };

  const resetForm = () => {
    setFormData({ ...initialFormState, _ui_pendingId: crypto.randomUUID() });
    setMultiItems([{ ...initialFormState, id: crypto.randomUUID(), _ui_pendingId: crypto.randomUUID() }]);
    setEditingProduct(null);
    setShowAdvanced(false);
    setMultiAdvancedOpen({});
    setSelectedMultiItemIndex(0);
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
        // GHOST ROW PROTECTION: Filter out rows with no name or zero pricing/stock
        const itemsToSave = (registrationMode === 'single' ? [formData] : multiItems).filter(item => {
            const hasName = !!item.name && item.name.trim().length > 0;
            const hasData = Number(item.purchase_price) > 0 || 
                            Number(item.quantity) > 0 || 
                            !!item.sku || 
                            Number(item.selling_price_detail) > 0 || 
                            Number(item._ui_recipeCost) > 0;
            // In single mode, if they click save, we should process it if it has at least a name
            return registrationMode === 'single' ? hasName : (hasName && hasData);
        });

        if (itemsToSave.length === 0) {
            toast({ title: "Aucun article valide", description: "Veuillez saisir au moins un nom de produit.", variant: "destructive" });
            setIsSaving(false);
            return;
        }

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
            let finalCost = (item._ui_itemType === 'dish')
                ? item._ui_recipeCost
                : (Number(item.purchase_price) || 0);
            let finalQty = Number(registrationMode === 'single' ? item.reorder_quantity : item.quantity) || 0;
            
            if (isBox && packSize > 1) {
                finalPrice = finalPrice / packSize;
                finalCost = finalCost / packSize;
                finalQty = finalQty * packSize;
            }

            const data = {
                name: item.name,
                item_type: item._ui_itemType || 'product',
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
                prep_time_minutes: Number(item.prep_time_minutes) || 0,
                is_available: item.is_available === false ? false : true,
                allergens: typeof item.allergens === 'string' ? item.allergens.split(',').map((x: string) => x.trim()).filter(Boolean) : (item.allergens || []),
                course_type: item.course_type || 'Main',
                modifiers: typeof item.modifiers === 'string' ? item.modifiers.split(',').map((x: string) => x.trim()).filter(Boolean) : (item.modifiers || []),
                store_id: storeId,
            };

            console.log('[FichiersProduits] Payload for service:', data);

            let result;
            if (editingProduct) {
                console.log('[FichiersProduits] Updating existing product:', editingProduct.id);
                result = await OfflineInventoryService.updateItem(editingProduct.id, data);
            } else {
                console.log('[FichiersProduits] Creating new product with pendingId:', item._ui_pendingId);
                result = await OfflineInventoryService.createItem({ ...data, id: item._ui_pendingId });
            }

            if (result.error) {
                console.error('[FichiersProduits] Service error:', result.error);
                throw result.error;
            }
            console.log('[FichiersProduits] Save successful for item:', item.name);

            // Save recipe composition links — use pendingId for new items
            if (item._ui_itemType === 'dish') {
                const dishId = editingProduct?.id ?? item._ui_pendingId;
                const dc = getDataClient();
                if (dc.isLocalFirst) {
                    await OfflineAuthService.localBridgeRequest('/rest/v1/recipes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            dish_id: dishId,
                            items: item._ui_recipeItems || [],
                        }),
                    });
                } else {
                    // Delete existing recipe composition for this dish
                    const { error: delErr } = await supabase
                        .from('dish_recipes')
                        .delete()
                        .eq('dish_id', dishId);
                    if (delErr) throw delErr;

                    // Insert new recipe items
                    if (item._ui_recipeItems && item._ui_recipeItems.length > 0) {
                        const now = new Date().toISOString();
                        const insertPayload = item._ui_recipeItems.map((recipeItem: any) => ({
                            id: crypto.randomUUID(),
                            dish_id: dishId,
                            ingredient_id: recipeItem.ingredient_id,
                            quantity_needed: Number(recipeItem.quantity_needed),
                            unit: recipeItem.unit,
                            created_at: now,
                            updated_at: now
                        }));
                        const { error: insErr } = await supabase
                            .from('dish_recipes')
                            .insert(insertPayload);
                        if (insErr) throw insErr;
                    }
                }
            }
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

  const handleEdit = async (p: ProductMaster) => {
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
      prep_time_minutes: p.prep_time_minutes || 0,
      is_available: p.is_available !== false,
      allergens: Array.isArray(p.allergens) ? p.allergens.join(', ') : (typeof p.allergens === 'string' ? p.allergens : ''),
      course_type: p.course_type || 'Main',
      modifiers: Array.isArray(p.modifiers) ? p.modifiers.join(', ') : (typeof p.modifiers === 'string' ? p.modifiers : ''),
      _ui_pendingId: p.id,
      _ui_itemType: (p as any).item_type === 'product' ? 'product' : 'dish',
      _ui_activeTab: 'informations',
    });

    try {
      const dc = getDataClient();
      let items: any[] = [];
      if (dc.isLocalFirst) {
        items = await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/recipes?dish_id=${p.id}`);
      } else {
        const { data, error } = await supabase
          .from('dish_recipes')
          .select('*')
          .eq('dish_id', p.id);
        if (error) throw error;
        items = data || [];
      }
      if (Array.isArray(items)) {
        setFormData(prev => ({
          ...prev,
          _ui_recipeItems: items.map(item => ({
            ingredient_id: item.ingredient_id,
            quantity_needed: Number(item.quantity_needed),
            unit: item.unit,
          }))
        }));
      }
    } catch (err) {
      console.error('Failed to load recipe items:', err);
    }

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

  const renderFullForm = (
    data: typeof initialFormState,
    update: (field: keyof typeof initialFormState, val: any, index?: number) => void,
    index?: number,
    isMultiMode?: boolean
  ) => {
    // Need handleNumChange, handleNumBlur localized
    const handleNumCh = (field: keyof typeof initialFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const finalVal = val === '' ? '' : Number(val);
      update(field, finalVal, index);
    };
    
    const handleNumBl = (field: keyof typeof initialFormState) => () => {
      update(field, data[field] === '' ? 0 : data[field], index);
    };

    return (
      <>        {/* TAB 1: INFORMATIONS */}
        <div className={cn("space-y-6", data._ui_activeTab === 'informations' ? "block" : "hidden")}>
          <p className="djati-section-label">Identification</p>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div className="flex flex-col gap-2 shrink-0">
              <Label className="djati-field-label">{t('inventory.fields.image')}</Label>
              <ImageUpload 
                currentImageUrl={data.image_url} 
                onImageUploaded={url => update('image_url', url, index)} 
                onImageRemoved={() => update('image_url', '', index)} 
                folder="inventory" 
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <Label className="djati-field-label">Nom de l'plats <span className="djati-req">*</span></Label>
                <input 
                  id={`product-name-${index ?? 'single'}`}
                  className="djati-input-field text-lg font-semibold" 
                  type="text" 
                  value={data.name} 
                  onChange={e => update('name', e.target.value, index)} 
                  placeholder="Ex: Burger Maison, Pizza Margherita…"
                  required
                />
              </div>
              <div className="djati-row2" style={{ marginBottom: 0 }}>
                <div>
                  <Label className="djati-field-label">SKU</Label>
                  <input 
                    className="djati-input-field font-mono" 
                    type="text" 
                    value={data.sku} 
                    onChange={e => update('sku', e.target.value, index)} 
                  />
                </div>
                <div>
                  <Label className="djati-field-label">Code-barres</Label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input 
                      className="djati-input-field font-mono" 
                      type="text" 
                      value={data.barcode} 
                      onChange={e => update('barcode', e.target.value, index)} 
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      onClick={() => update('barcode', `PRD${Date.now().toString(36).toUpperCase()}`, index)} 
                      className="h-[36px] w-[36px] shrink-0"
                    >
                      <Barcode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="djati-field-group">
            <Label className="djati-field-label teal">Famille / Catégorie</Label>
            <div className="djati-select-wrap">
              <select 
                className="djati-input-field" 
                value={data.family_id} 
                onChange={e => update('family_id', e.target.value, index)}
              >
                <option value="">Sélectionner une famille</option>
                {families.map(fam => (
                  <option key={fam.id} value={fam.id}>{fam.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="djati-field-group">
            <Label className="djati-field-label">Marque</Label>
            <input 
              className="djati-input-field" 
              type="text" 
              value={data.brand} 
              onChange={e => update('brand', e.target.value, index)} 
            />
          </div>
        </div>

        {/* TAB 2: PRIX & MARGES */}
        <div className={cn("space-y-6", data._ui_activeTab === 'prix' ? "block" : "hidden")}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.08em', marginRight: '8px' }}>Type :</span>
            <button
              type="button"
              onClick={() => update('_ui_itemType', 'dish', index)}
              style={{
                padding: '5px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                background: data._ui_itemType === 'dish' ? 'var(--teal)' : '#e5e7eb',
                color: data._ui_itemType === 'dish' ? '#fff' : '#374151',
              }}
            >
              🍳 Plat Cuisiné
            </button>
            <button
              type="button"
              onClick={() => update('_ui_itemType', 'product', index)}
              style={{
                padding: '5px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: 700,
                border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                background: data._ui_itemType === 'product' ? 'var(--teal)' : '#e5e7eb',
                color: data._ui_itemType === 'product' ? '#fff' : '#374151',
              }}
            >
              📦 Article Direct
            </button>
            <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
              {data._ui_itemType === 'dish' ? 'Coût calculé depuis la composition' : 'Prix d\'achat saisi manuellement'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px' }}>
            <div>
              <p className="djati-section-label">Prix et Marges</p>

              <div className="djati-price-highlight">
                <Label className="djati-field-label teal font-bold">Prix de commandes (Détail) <span className="djati-req">*</span></Label>
                <div className="djati-price-wrap">
                  <input 
                    className="djati-input-field font-black text-lg" 
                    type="number" 
                    value={data.selling_price_detail} 
                    onChange={handleNumCh('selling_price_detail')} 
                    onBlur={handleNumBl('selling_price_detail')}
                    required
                  />
                  <span className="currency">F</span>
                </div>
              </div>

              <div className="djati-row3">
                <div>
                  <Label className="djati-field-label" style={{ fontSize: '9.5px' }}>2ème Prix (Remise)</Label>
                  <div className="djati-price-wrap">
                    <input 
                      className="djati-input-field font-semibold text-center" 
                      type="number" 
                      value={data.selling_price_2} 
                      onChange={handleNumCh('selling_price_2')} 
                      onBlur={handleNumBl('selling_price_2')}
                    />
                    <span className="currency">F</span>
                  </div>
                </div>
                <div>
                  <Label className="djati-field-label" style={{ fontSize: '9.5px' }}>3ème Prix (Gros)</Label>
                  <div className="djati-price-wrap">
                    <input 
                      className="djati-input-field font-semibold text-center" 
                      type="number" 
                      value={data.selling_price_3} 
                      onChange={handleNumCh('selling_price_3')} 
                      onBlur={handleNumBl('selling_price_3')}
                    />
                    <span className="currency">F</span>
                  </div>
                </div>
                <div>
                  <Label className="djati-field-label" style={{ fontSize: '9.5px' }}>4ème Prix (Revente)</Label>
                  <div className="djati-price-wrap">
                    <input 
                      className="djati-input-field font-semibold text-center" 
                      type="number" 
                      value={data.selling_price_4} 
                      onChange={handleNumCh('selling_price_4')} 
                      onBlur={handleNumBl('selling_price_4')}
                    />
                    <span className="currency">F</span>
                  </div>
                </div>
              </div>

              {data._ui_itemType === 'product' ? (
                <div className="djati-field-group">
                  <Label className="djati-field-label">Prix d'achat</Label>
                  <div className="djati-price-wrap">
                    <input 
                      className="djati-input-field" 
                      type="number" 
                      value={data.purchase_price} 
                      onChange={handleNumCh('purchase_price')} 
                      onBlur={handleNumBl('purchase_price')}
                    />
                    <span className="currency">F</span>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--teal-light)', border: '1px solid var(--teal-border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--teal)', marginBottom: '6px' }}>Coût de revient (depuis composition)</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--teal)', fontFamily: 'monospace' }}>{(data._ui_recipeCost || 0).toLocaleString()} F CFA</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Calculé automatiquement depuis l'onglet Composition</div>
                </div>
              )}

              <div className="djati-row2">
                <div>
                  <Label className="djati-field-label red">Prix Gros HT</Label>
                  <div className="djati-price-wrap">
                    <input 
                      className="djati-input-field" 
                      type="number" 
                      value={data.selling_price_ht} 
                      onChange={handleNumCh('selling_price_ht')} 
                      onBlur={handleNumBl('selling_price_ht')}
                    />
                    <span className="currency">F</span>
                  </div>
                </div>
                <div>
                  <Label className="djati-field-label red">Prix Gros TTC</Label>
                  <div className="djati-price-wrap">
                    <input 
                      className="djati-input-field font-bold" 
                      type="number" 
                      value={data.selling_price_ttc} 
                      onChange={handleNumCh('selling_price_ttc')} 
                      onBlur={handleNumBl('selling_price_ttc')}
                    />
                    <span className="currency">F</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="djati-section-label">Résumé Financier</p>
              <div className="djati-cost-card">
                <div className="djati-cost-row">
                  <span className="lbl">Coût ingrédients estimé</span>
                  <span className="val">{(data._ui_recipeCost || 0).toLocaleString()} F</span>
                </div>
                <div className="djati-cost-row">
                  <span className="lbl">Marge brute estimée</span>
                  <span className="val positive">{(Number(data.selling_price_detail) - (data._ui_recipeCost || 0)).toLocaleString()} F</span>
                </div>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--txt-m)', marginTop: '10px', lineHeight: 1.5 }}>
                Calculé automatiquement depuis l'onglet Composition.
              </p>
            </div>
          </div>
        </div>

        {/* TAB 3: LOGISTIQUE */}
        <div className={cn("space-y-6", data._ui_activeTab === 'logistique' ? "block" : "hidden")}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <p className="djati-section-label">Logistique</p>
              <div className="djati-row2">
                <div>
                  <Label className="djati-field-label">Unité</Label>
                  <div className="djati-select-wrap">
                    <select 
                      className="djati-input-field font-bold" 
                      value={data.unit_type} 
                      onChange={e => update('unit_type', e.target.value, index)}
                    >
                      <option value="Pièce">{t('inventory.unitTypes.piece')}</option>
                      <option value="Carton">{t('inventory.unitTypes.carton')}</option>
                      <option value="KG">{t('inventory.unitTypes.kg')}</option>
                      <option value="Litre">{t('inventory.unitTypes.litre')}</option>
                      <option value="Paquet">{t('inventory.unitTypes.paquet')}</option>
                      <option value="Sac">{t('inventory.unitTypes.sac')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="djati-field-label teal">Portion / Pack Size</Label>
                  <input 
                    className="djati-input-field font-bold text-center" 
                    type="text" 
                    value={data.packaging} 
                    onChange={e => update('packaging', e.target.value, index)} 
                  />
                </div>
              </div>
              <div className="djati-row2">
                <div>
                  <Label className="djati-field-label teal">Stock initial (Base Units)</Label>
                  <input 
                    className="djati-input-field font-bold" 
                    type="number" 
                    value={isMultiMode ? data.quantity : data.reorder_quantity} 
                    onChange={handleNumCh(isMultiMode ? 'quantity' : 'reorder_quantity')} 
                    onBlur={handleNumBl(isMultiMode ? 'quantity' : 'reorder_quantity')}
                  />
                </div>
                <div>
                  <Label className="djati-field-label">Stock minimum</Label>
                  <input 
                    className="djati-input-field font-semibold" 
                    type="number" 
                    value={data.min_stock_alert} 
                    onChange={handleNumCh('min_stock_alert')} 
                    onBlur={handleNumBl('min_stock_alert')}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="djati-section-label">Gestion du Stock</p>
              <div className="djati-row2">
                <div>
                  <Label className="djati-field-label">Préparation (Min)</Label>
                  <input 
                    className="djati-input-field font-semibold" 
                    type="number" 
                    value={data.prep_time_minutes} 
                    onChange={handleNumCh('prep_time_minutes')} 
                    onBlur={handleNumBl('prep_time_minutes')}
                  />
                </div>
                <div>
                  <Label className="djati-field-label">Type de plat</Label>
                  <div className="djati-select-wrap">
                    <select 
                      className="djati-input-field font-bold" 
                      value={data.course_type} 
                      onChange={e => update('course_type', e.target.value, index)}
                    >
                      <option value="Starter">Entrée</option>
                      <option value="Main">Plat Principal</option>
                      <option value="Dessert">Dessert</option>
                      <option value="Drink">Boisson</option>
                      <option value="Side">Accompagnement</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="djati-disponible-card">
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#374151', marginBottom: '2px' }}>Disponible</p>
                  <p style={{ fontSize: '12px', color: 'var(--txt-m)' }}>Activer pour la commande</p>
                </div>
                <div 
                  className={cn("djati-toggle", data.is_available && "on")} 
                  onClick={() => update('is_available', !data.is_available, index)}
                />
              </div>
              
              <div className="djati-field-group mt-4">
                <Label className="djati-field-label">Rayon / Allée</Label>
                <input 
                  className="djati-input-field" 
                  type="text" 
                  value={data.aisle} 
                  onChange={e => update('aisle', e.target.value, index)} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* TAB 4: COMPOSITION */}
        <div className={cn("space-y-6", data._ui_activeTab === 'composition' ? "block" : "hidden")}>
          <p className="djati-section-label">Composition du Plat</p>
          <p style={{ fontSize: '13px', color: 'var(--txt-2)', marginBottom: '16px', lineHeight: 1.5 }}>
            Définissez les ingrédients nécessaires pour préparer ce plat.<br/>
            Les stocks seront automatiquement déduits à chaque vente.
          </p>

          <RecipeBuilder
            dishId={(!isMultiMode && editingProduct) ? editingProduct.id : (data._ui_pendingId || crypto.randomUUID())}
            storeId={storeId}
            sellingPrice={Number(data.selling_price_detail) || 0}
            onChange={(items) => update('_ui_recipeItems', items, index)}
            onCostChange={(cost) => update('_ui_recipeCost', cost, index)}
          />
        </div>

        {/* TAB 5: OPTIONS */}
        <div className={cn("space-y-6", data._ui_activeTab === 'options' ? "block" : "hidden")}>
          <p className="djati-section-label">Personnalisation</p>
          <div style={{ maxWidth: '520px' }}>
            <div className="djati-field-group">
              <Label className="djati-field-label">Allergènes (séparés par virgules)</Label>
              <input 
                className="djati-input-field" 
                type="text" 
                value={data.allergens} 
                onChange={e => update('allergens', e.target.value, index)} 
                placeholder="ex: Gluten, Lactose, Arachides"
              />
            </div>
            <div className="djati-field-group">
              <Label className="djati-field-label">Options / Suppléments (séparés par virgules)</Label>
              <textarea 
                className="djati-input-field" 
                rows={3} 
                value={data.modifiers} 
                onChange={e => update('modifiers', e.target.value, index)} 
                placeholder="ex: Sauce piquante, Frites supplémentaires, Double portion"
              />
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
        <DialogContent className="max-w-[960px] w-full h-[660px] p-0 flex flex-col gap-0 overflow-hidden shadow-2xl rounded-xl border border-gray-200 bg-white [&>button]:hidden">
          <div className="djati-modal-wrapper flex flex-col h-full w-full">
            <style>{`
              .djati-modal-wrapper {
                --teal: #00b09b;
                --teal-h: #009688;
                --teal-light: #e6f7f5;
                --teal-border: #53dbc5;
                --red: #ef4444;
                --txt: #111827;
                --txt-2: #6b7280;
                --txt-m: #9ca3af;
                --border: #e5e7eb;
                --surface: #ffffff;
                --surface-l: #f9fafb;
                
                font-family: 'Inter', sans-serif;
                color: var(--txt);
              }

              .djati-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 24px;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
                background: #fff;
              }
              .djati-header-left { display: flex; align-items: center; gap: 10px; }
              .djati-header-center { display: flex; align-items: center; gap: 10px; }
              .djati-header-icon {
                width: 32px; height: 32px;
                background: var(--teal);
                border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
              }
              .djati-header-icon svg { width: 18px; height: 18px; color: #fff; }
              .djati-title { font-size: 18px; font-weight: 600; color: var(--txt); text-transform: uppercase; letter-spacing: .06em; }
              .djati-close { background: none; border: none; cursor: pointer; color: var(--txt-m); padding: 4px; display: flex; border-radius: 4px; }
              .djati-close:hover { color: var(--txt); background: var(--surface-l); }

              /* Toggle switch */
              .djati-toggle {
                width: 44px; height: 24px;
                background: #d1d5db;
                border-radius: 9999px;
                position: relative; cursor: pointer;
                transition: background .2s; flex-shrink: 0;
              }
              .djati-toggle.on { background: var(--teal); }
              .djati-toggle::after {
                content: '';
                width: 18px; height: 18px;
                background: #fff;
                border-radius: 9999px;
                position: absolute; top: 3px; left: 3px;
                transition: transform .2s;
                box-shadow: 0 1px 3px rgba(0,0,0,.2);
              }
              .djati-toggle.on::after { transform: translateX(20px); }
              .djati-mode-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--txt-2); }

              .djati-import-bar {
                display: flex; align-items: center; justify-content: space-between;
                padding: 9px 24px;
                background: var(--surface-l);
                border-bottom: 1px solid var(--border);
                flex-shrink: 0;
              }
              .djati-import-label { display: flex; align-items: center; gap: 7px; color: var(--txt-m); }
              .djati-import-label svg { width: 15px; height: 15px; }
              .djati-import-label span.text { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }

              .djati-tab-bar {
                display: flex; gap: 2px; padding: 10px 24px;
                border-bottom: 1px solid var(--border);
                flex-shrink: 0; background: #fff;
              }
              .djati-tab-btn {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 6px 14px;
                border-radius: 9999px;
                font-size: 13px; font-weight: 500;
                border: none; cursor: pointer;
                background: transparent; color: var(--txt-2);
                transition: all .15s;
                font-family: 'Inter', sans-serif;
              }
              .djati-tab-btn:hover { background: var(--teal-light); color: var(--teal); }
              .djati-tab-btn.active { background: var(--teal); color: #fff; }
              .djati-tab-btn svg { width: 14px; height: 14px; }

              .djati-content { flex: 1; overflow-y: auto; padding: 22px 24px; }

              .djati-footer {
                display: flex; align-items: center; justify-content: flex-end; gap: 10px;
                padding: 13px 24px;
                border-top: 1px solid var(--border);
                background: var(--surface-l);
                flex-shrink: 0;
              }

              .djati-section-label {
                display: flex; align-items: center; gap: 7px;
                font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em;
                color: var(--txt-2); margin-bottom: 14px;
              }
              .djati-section-label::before {
                content: ''; width: 6px; height: 6px; border-radius: 9999px;
                background: var(--teal); flex-shrink: 0;
              }
              .djati-field-label {
                display: block; font-size: 11px; font-weight: 600;
                text-transform: uppercase; letter-spacing: .06em;
                color: #374151; margin-bottom: 4px;
              }
              .djati-field-label.teal { color: var(--teal); }
              .djati-field-label.red { color: var(--red); }
              .djati-req { color: var(--teal); }

              .djati-input-field {
                height: 36px; border-radius: 6px;
                border: 1px solid var(--border);
                background: var(--surface);
                padding: 0 12px; font-size: 14px; color: var(--txt);
                width: 100%; outline: none;
                transition: border-color .15s;
                font-family: 'Inter', sans-serif;
              }
              .djati-input-field:focus { border-color: var(--teal); }
              .djati-input-field::placeholder { color: var(--txt-m); }
              textarea.djati-input-field { height: auto; padding: 8px 12px; resize: vertical; }

              .djati-select-wrap { position: relative; }
              .djati-select-wrap select.djati-input-field {
                appearance: none;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                background-position: right 10px center;
                background-repeat: no-repeat; background-size: 16px;
                padding-right: 32px; cursor: pointer;
              }
              .djati-price-wrap { position: relative; }
              .djati-price-wrap .djati-input-field { padding-right: 22px; }
              .djati-price-wrap .currency {
                position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
                font-size: 14px; color: var(--txt-m); pointer-events: none;
              }

              .djati-field-group { margin-bottom: 14px; }
              .djati-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
              .djati-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }

              .djati-btn-primary {
                background: var(--teal); color: #fff;
                border-radius: 6px; font-size: 13px; font-weight: 600;
                text-transform: uppercase; letter-spacing: .04em;
                padding: 0 22px; height: 38px;
                display: inline-flex; align-items: center; cursor: pointer;
                border: none; transition: background .15s;
                font-family: 'Inter', sans-serif;
              }
              .djati-btn-primary:hover { background: var(--teal-h); }
              .djati-btn-secondary {
                background: transparent; color: #374151;
                border-radius: 6px; font-size: 13px; font-weight: 500;
                padding: 0 16px; height: 38px;
                display: inline-flex; align-items: center; cursor: pointer;
                border: 1px solid var(--border); transition: background .15s;
                font-family: 'Inter', sans-serif;
              }
              .djati-btn-secondary:hover { background: var(--surface-l); }
              .djati-btn-ghost {
                background: none; border: none; cursor: pointer;
                display: inline-flex; align-items: center; gap: 6px;
                font-size: 13px; font-weight: 500; color: var(--teal);
                font-family: 'Inter', sans-serif; padding: 4px 0;
              }
              .djati-btn-ghost:hover { opacity: .8; }
              .djati-btn-ghost svg { width: 16px; height: 16px; }

              .djati-img-upload {
                width: 108px; height: 108px; flex-shrink: 0;
                border: 2px dashed var(--border); border-radius: 8px;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                cursor: pointer; transition: all .15s; background: #fafafa;
                color: var(--txt-m); gap: 4px;
              }
              .djati-img-upload:hover { border-color: var(--teal); background: var(--teal-light); color: var(--teal); }
              .djati-img-upload svg { width: 26px; height: 26px; }
              .djati-img-upload .img-hint { font-size: 10px; text-align: center; line-height: 1.3; padding: 0 6px; }

              .djati-price-highlight {
                background: var(--teal-light); border-radius: 8px;
                padding: 10px 12px; border: 1px solid var(--teal-border);
                margin-bottom: 14px;
              }
              .djati-price-highlight .djati-input-field { background: transparent; border-color: var(--teal-border); }
              .djati-price-highlight .djati-input-field:focus { border-color: var(--teal); }

              .djati-cost-card {
                background: var(--surface-l); border: 1px solid var(--border);
                border-radius: 8px; padding: 14px 16px;
              }
              .djati-cost-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
              .djati-cost-row + .djati-cost-row { border-top: 1px solid var(--border); padding-top: 10px; margin-top: 10px; }
              .djati-cost-row .lbl { color: var(--txt-2); }
              .djati-cost-row .val { font-size: 15px; font-weight: 600; color: var(--txt); }
              .djati-cost-row .val.positive { color: var(--teal); }

              .djati-disponible-card {
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 14px; background: var(--surface-l);
                border: 1px solid var(--border); border-radius: 8px; margin-top: 14px;
              }

              .djati-comp-table { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
              .djati-comp-table table { width: 100%; border-collapse: collapse; }
              .djati-comp-table thead th {
                padding: 8px 12px; font-size: 11px; font-weight: 600;
                text-transform: uppercase; letter-spacing: .06em;
                color: var(--txt-m); background: var(--surface-l);
                border-bottom: 1px solid var(--border); text-align: left;
              }
              .djati-comp-table tbody tr { border-bottom: 1px solid var(--border); }
              .djati-comp-table tbody tr:last-child { border-bottom: none; }
              .djati-comp-table tbody tr:hover { background: #fafafa; }
              .djati-comp-table td { padding: 7px 12px; }
              .djati-drag-handle { color: #d1d5db; cursor: grab; font-size: 18px; line-height: 1; }
              .djati-comp-table .djati-input-field { border-color: transparent; background: transparent; height: 32px; }
              .djati-comp-table .djati-input-field:focus { border-color: var(--border); }
              .djati-comp-table .del-btn {
                background: none; border: none; cursor: pointer;
                color: #d1d5db; display: flex; align-items: center;
                border-radius: 4px; padding: 2px; transition: color .1s;
              }
              .djati-comp-table .del-btn:hover { color: var(--red); }
              .djati-comp-table .del-btn svg { width: 16px; height: 16px; }
              .djati-comp-footer {
                padding: 10px 12px; border-top: 1px solid var(--border);
                background: var(--surface-l); display: flex;
                justify-content: space-between; align-items: center;
              }
              .djati-comp-cost { font-size: 13px; color: var(--txt-2); }
              .djati-comp-cost strong { color: var(--txt); }

              .djati-badge {
                display: inline-flex; align-items: center;
                padding: 2px 8px; border-radius: 9999px;
                font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
              }
              .djati-badge-ok { background: var(--teal-light); color: var(--teal); }
              .djati-badge-low { background: transparent; color: #f97316; border: 1px solid #f97316; }
              .djati-badge-critical { background: transparent; color: var(--red); border: 1px solid var(--red); }
            `}</style>

            {/* ── HEADER ── */}
            <div className="djati-header">
              <div className="djati-header-left">
                {!editingProduct && (
                  <>
                    <span className="djati-mode-label">Mode Multiple</span>
                    <div 
                      className={cn("djati-toggle", registrationMode === 'multi' && "on")}
                      onClick={() => {
                        const val = registrationMode === 'single';
                        setRegistrationMode(val ? 'multi' : 'single');
                        if (val && multiItems.length === 0) addMultiItemRow();
                      }}
                    />
                  </>
                )}
              </div>
              <div className="djati-header-center">
                <div className="djati-header-icon">
                  <Package className="h-[18px] w-[18px] text-white" />
                </div>
                <h2 className="djati-title">
                  {editingProduct ? t('inventory.editItem') : registrationMode === 'multi' ? "AJOUT MULTIPLE" : t('inventory.addItem')}
                </h2>
              </div>
              <button type="button" className="djati-close" onClick={() => setIsDialogOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── IMPORT BAR ── */}
            {!editingProduct && registrationMode === 'single' && (
              <div className="djati-import-bar">
                <div className="djati-import-label">
                  <Search className="h-[15px] w-[15px]" />
                  <span className="text">Importer depuis un plat existant</span>
                </div>
                <button 
                  type="button"
                  className="djati-btn-secondary" 
                  style={{ height: '32px', fontSize: '12px' }}
                  onClick={() => { setLookupTargetIndex(null); setIsLookupOpen(true); }}
                >
                  Choisir l'article
                </button>
              </div>
            )}

            {/* ── TAB BAR FOR BOTH MODES ── */}
            {(() => {
              const activeData = registrationMode === 'single' ? formData : (multiItems[selectedMultiItemIndex] || initialFormState);
              const handleTabChange = (tab: string) => {
                if (registrationMode === 'single') updateField('_ui_activeTab', tab);
                else updateField('_ui_activeTab', tab, selectedMultiItemIndex);
              };

              return (
                <div className="djati-tab-bar">
                  <button
                    type="button"
                    className={cn("djati-tab-btn", activeData._ui_activeTab === 'informations' && "active")}
                    onClick={() => handleTabChange('informations')}
                  >
                    <ReceiptText className="h-3.5 w-3.5" />
                    Informations
                  </button>
                  <button
                    type="button"
                    className={cn("djati-tab-btn", activeData._ui_activeTab === 'prix' && "active")}
                    onClick={() => handleTabChange('prix')}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    Prix &amp; Marges
                  </button>
                  <button
                    type="button"
                    className={cn("djati-tab-btn", activeData._ui_activeTab === 'logistique' && "active")}
                    onClick={() => handleTabChange('logistique')}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Logistique
                  </button>
                  <button
                    type="button"
                    className={cn("djati-tab-btn", activeData._ui_activeTab === 'composition' && "active")}
                    onClick={() => handleTabChange('composition')}
                  >
                    <ChefHat className="h-3.5 w-3.5" />
                    Composition
                  </button>
                  <button
                    type="button"
                    className={cn("djati-tab-btn", activeData._ui_activeTab === 'options' && "active")}
                    onClick={() => handleTabChange('options')}
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    Options
                  </button>
                </div>
              );
            })()}

            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                // Only save if the target wasn't an input (prevent scanner Enter from submitting)
                const target = e.nativeEvent?.target as HTMLElement;
                if (target?.tagName !== 'INPUT') {
                  handleSave(); 
                }
              }} 
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <div className={cn("djati-content", registrationMode === 'multi' && "p-0 flex flex-row h-full")}>
                {registrationMode === 'single' ? (
                  renderFullForm(formData, updateField)
                ) : (
                  <>
                    {/* MASTER SIDEBAR */}
                    <div className="w-[280px] flex-shrink-0 border-r bg-muted/5 overflow-y-auto p-4 space-y-3">
                      {multiItems.map((item, index) => (
                        <div 
                          key={item.id} 
                          className={cn(
                            "p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between shadow-sm",
                            index === selectedMultiItemIndex 
                              ? "border-primary bg-primary/5" 
                              : "border-transparent bg-white hover:border-primary/30"
                          )}
                          onClick={() => setSelectedMultiItemIndex(index)}
                        >
                          <div className="flex flex-col flex-1 min-w-0 mr-2">
                            <span className="font-bold text-sm truncate text-foreground">
                              {item.name || `Nouvel article #${index + 1}`}
                            </span>
                            {item.quantity > 0 && (
                              <span className="text-xs text-muted-foreground">Qté: {item.quantity} {item.unit_type === 'piece' ? 'Pce' : 'Ctn'}</span>
                            )}
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" 
                            onClick={(e) => { e.stopPropagation(); removeMultiItemRow(item.id); }}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        type="button" 
                        className="w-full mt-2 border-dashed border-2 border-primary/30 text-primary hover:bg-primary/5 font-semibold" 
                        onClick={addMultiItemRow}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Ajouter un article
                      </Button>
                    </div>

                    {/* DETAIL FORM */}
                    <div className="flex-1 min-w-0 overflow-y-auto p-6 bg-white">
                      {multiItems.length > 0 && multiItems[selectedMultiItemIndex] ? (
                        renderFullForm(
                          multiItems[selectedMultiItemIndex],
                          (field, val, idx) => updateField(field, val, idx),
                          selectedMultiItemIndex,
                          true
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <Package className="h-12 w-12 mb-4 opacity-20" />
                          <p>Aucun article sélectionné</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* ── FOOTER ── */}
              <div className="djati-footer">
                <button type="button" className="djati-btn-secondary" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</button>
                <button type="submit" disabled={isSaving} className="djati-btn-primary">
                  {isSaving ? t('common.loading') : editingProduct ? t('common.update') : registrationMode === 'multi' ? t('inventory.saveMultipleItems', { count: multiItems.length }) : t('inventory.createItem')}
                </button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <ProductLookupDialog open={isLookupOpen} onOpenChange={setIsLookupOpen} storeId={storeId} title={t('purchases.productSearch')} standalone mode="wholesale" onSelect={handleProductSelected} />
    </div>
    </MasterPasswordGate>
  );
}
