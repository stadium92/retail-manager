import { useState, useEffect, useMemo, useRef } from 'react';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { InventoryItem, Store } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';
import { FichiersProduitsModule } from '@/components/worker/Modules/FichiersProduitsModule';
import { ValorisationStock } from '@/components/worker/Modules/Stock/ValorisationStock';
import { RefreshCw, Package, Database, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InventoryPage() {
  const { t } = useTranslation();
  const { selectedStoreIds, isAllStoresSelected, version } = useMasterDashboardStore();
  const { stores, setStores } = useMasterDataStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list');

  // Initial store load
  useEffect(() => {
    const initStores = async () => {
      if (stores.length === 0) {
        const res = await OfflineStoreService.getStores({ notify: false });
        if (res.data) setStores(res.data);
      }
      setLoading(false);
    };
    initStores();
  }, []);

  const activeStoreIds = useMemo(() => {
    return isAllStoresSelected 
      ? (stores?.map(s => s.id) || [])
      : selectedStoreIds;
  }, [isAllStoresSelected, stores, selectedStoreIds, version]);

  useEffect(() => {
    if (formData.store_id) {
        const loadFamilies = async () => {
            const { data } = await OfflineInventoryService.getProductFamilies(formData.store_id);
            if (data) setFamilies(data);
        };
        loadFamilies();
    }
  }, [formData.store_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const storesRes = await OfflineStoreService.getStores({ notify: false });
      const allStores = storesRes.data || [];
      setStores(allStores);

      const activeStoreIds = isAllStoresSelected 
        ? allStores.map(s => s.id)
        : selectedStoreIds;

      const inventoryPromises = activeStoreIds.map(sid => OfflineInventoryService.getInventory(sid, { notify: false }));
      const results = await Promise.all(inventoryPromises);
      
      const allItems: InventoryItem[] = [];
      results.forEach(res => {
        if (res.data) allItems.push(...res.data);
      });

      setItems(allItems);

      const familiesRes = await OfflineInventoryService.getProductFamilies();
      if (familiesRes.data) {
        setFamilies(familiesRes.data);
      }

      if (activeStoreIds.length > 0) {
        fetchSuppliers(activeStoreIds[0]);
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (item?: InventoryItem) => {
    if (item) {
      setSelectedItem(item);
      
      // Fix: If unit is Carton/Box/Paquet/Sachet/Sac, inflate values for display
      const packaging = parseInt(item.packaging || '1') || 1;
      const unit = item.unit_type || 'Pièce';
      const isPack = ['carton', 'box', 'pack', 'paquet', 'sachet', 'sac'].includes(unit.toLowerCase());
      
      const scale = (val: number | undefined) => (isPack && packaging > 1 && val) ? (val * packaging).toString() : val?.toString() || '';
      const scaleQty = (val: number) => (isPack && packaging > 1) ? (val / packaging).toString() : val.toString();

      setFormData({
        name: item.name,
        description: item.description || '',
        sku: item.sku || '',
        price: scale(item.price),
        selling_price_2: scale(item.selling_price_2),
        selling_price_3: scale(item.selling_price_3),
        selling_price_4: scale(item.selling_price_4),
        wholesale_price: scale(item.wholesale_price),
        wholesale_price_ht: scale(item.wholesale_price_ht),
        wholesale_price_ttc: scale(item.wholesale_price_ttc),
        cost: scale(item.cost),
        quantity: scaleQty(item.quantity),
        low_stock_threshold: scaleQty(item.low_stock_threshold || 10),
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
        name: '', description: '', sku: '', price: '', 
        selling_price_2: '', selling_price_3: '', selling_price_4: '',
        wholesale_price: '',
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
    
    let finalQuantity = parseFloat(formData.quantity) || 0;
    let price = parseFloat(formData.price);
    let selling_price_2 = formData.selling_price_2 ? parseFloat(formData.selling_price_2) : undefined;
    let selling_price_3 = formData.selling_price_3 ? parseFloat(formData.selling_price_3) : undefined;
    let selling_price_4 = formData.selling_price_4 ? parseFloat(formData.selling_price_4) : undefined;
    let wholesale_price_ttc = formData.wholesale_price_ttc ? parseFloat(formData.wholesale_price_ttc) : undefined;
    let wholesale_price_ht = formData.wholesale_price_ht ? parseFloat(formData.wholesale_price_ht) : undefined;
    let cost = formData.cost ? parseFloat(formData.cost) : undefined;

    // Fix: If unit is Carton/Box/Paquet/Sachet/Sac, convert the input quantity AND prices to Base Units (Pieces) for storage
    const packaging = parseInt(formData.packaging) || 1;
    const unit = formData.unit_type || 'Pièce';
    const isPack = ['carton', 'box', 'pack', 'paquet', 'sachet', 'sac'].includes(unit.toLowerCase());
    
    if (isPack && packaging > 1) {
      finalQuantity = finalQuantity * packaging;
      
      // Convert prices to per-piece
      if (price > 0) price = price / packaging;
      if (selling_price_2 && selling_price_2 > 0) selling_price_2 = selling_price_2 / packaging;
      if (selling_price_3 && selling_price_3 > 0) selling_price_3 = selling_price_3 / packaging;
      if (selling_price_4 && selling_price_4 > 0) selling_price_4 = selling_price_4 / packaging;
      if (wholesale_price_ttc && wholesale_price_ttc > 0) wholesale_price_ttc = wholesale_price_ttc / packaging;
      if (wholesale_price_ht && wholesale_price_ht > 0) wholesale_price_ht = wholesale_price_ht / packaging;
      if (cost && cost > 0) cost = cost / packaging;
    }

    const data = {
      name: formData.name,
      description: formData.description || undefined,
      sku: formData.sku || undefined,
      price: price,
      selling_price_2: selling_price_2,
      selling_price_3: selling_price_3,
      selling_price_4: selling_price_4,
      wholesale_price: wholesale_price_ttc,
      wholesale_price_ht: wholesale_price_ht,
      wholesale_price_ttc: wholesale_price_ttc,
      cost: cost,
      quantity: finalQuantity,
      low_stock_threshold: parseInt(formData.low_stock_threshold),
      store_id: formData.store_id,
      image_url: formData.image_url || undefined,
      category_id: formData.category_id || undefined,
      supplier_id: formData.supplier_id || undefined,
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
      setItems(prev => prev.filter(i => i.id !== selectedItem.id)); // Optimistic update
      loadData();
    } else {
      toast({ title: t('common.error'), description: error.message || 'Delete failed', variant: 'destructive' });
    }
    setDeleteDialogOpen(false);
  };

  const marginPercent = Number(formData.price) > 0 && Number(formData.cost) > 0 
    ? (((Number(formData.price) - Number(formData.cost)) / Number(formData.cost)) * 100).toFixed(1) 
    : '0';

  const filteredItems = items.filter(item => {
    const mSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                   (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const mStore = selectedStoreFilter === 'all' || item.store_id === selectedStoreFilter;
    return mSearch && mStore;
  });

  const storeMap = useMemo(() => {
    const map: Record<string, string> = {};
    stores.forEach(s => {
      map[s.id] = s.name;
    });
    return map;
  }, [stores]);

  const exportLabels = {
    name: t('inventory.table.name'),
    sku: t('inventory.table.sku'),
    quantity: t('inventory.table.quantity'),
    price: t('inventory.table.price'),
    cost: t('inventory.fields.purchasePrice'),
    threshold: t('inventory.fields.lowStockThreshold'),
    store: t('sidebar.stores'),
    description: t('inventory.fields.description'),
    packaging: t('inventory.fields.packaging'),
    unit: t('menu.program.unit'),
    wholesaleHT: "Prix Gros HT",
    discount: "Prix Remise",
    wholesale: "Prix en gros",
    resale: "Prix Revente",
    value: t('inventory.table.value')
  };

  const selection = useSelection(filteredItems);

  if (loading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('inventory.title')}</h1>
          <p className="text-muted-foreground">{t('inventory.manageInventory')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t('common.search')} 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                {t('export.title')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  const exportData = ExportService.formatInventoryForExport(filteredItems, storeMap, exportLabels);
                  ExportService.exportToCSV(exportData, 'inventory');
                  toast({ title: t('export.success') });
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                {t('export.csv')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const exportData = ExportService.formatInventoryForExport(filteredItems, storeMap, exportLabels);
                  ExportService.exportToExcel(exportData, 'inventory', t('inventory.title'));
                  toast({ title: t('export.success') });
                }}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t('export.excel')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const exportData = ExportService.formatInventoryForExport(filteredItems, storeMap, exportLabels);
                  const columns = [
                    { header: exportLabels.name, dataKey: exportLabels.name },
                    { header: exportLabels.sku, dataKey: exportLabels.sku },
                    { header: exportLabels.store, dataKey: exportLabels.store },
                    { header: exportLabels.unit, dataKey: exportLabels.unit },
                    { header: exportLabels.packaging, dataKey: exportLabels.packaging },
                    { header: exportLabels.quantity, dataKey: exportLabels.quantity },
                    { header: exportLabels.price, dataKey: exportLabels.price },
                    { header: exportLabels.discount, dataKey: exportLabels.discount },
                    { header: exportLabels.wholesale, dataKey: exportLabels.wholesale },
                    { header: exportLabels.wholesaleHT, dataKey: exportLabels.wholesaleHT },
                    { header: exportLabels.resale, dataKey: exportLabels.resale },
                    { header: exportLabels.value, dataKey: exportLabels.value },
                  ];
                  ExportService.exportToPDF(exportData, 'inventory', t('inventory.title'), columns);
                  toast({ title: t('export.success') });
                }}
              >
                <File className="h-4 w-4 mr-2" />
                {t('export.pdf')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => handleOpenForm()}><Plus className="h-4 w-4 mr-2" /> {t('inventory.addItem')}</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between bg-card/50 p-1 rounded-xl border border-border/50 backdrop-blur-sm shadow-sm">
            <TabsList className="bg-transparent border-none">
                <TabsTrigger value="list" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all px-6">
                    <Package className="h-3.5 w-3.5 mr-2" />
                    Inventaire Global
                </TabsTrigger>
                <TabsTrigger value="valuation" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase tracking-widest text-[10px] rounded-lg transition-all px-6">
                    <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                    Valorisation
                </TabsTrigger>
            </TabsList>
        </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4">
          <TabsTrigger value="list">{t('menu.program.inventory')}</TabsTrigger>
          <TabsTrigger value="valuation">{t('menu.program.valuation')}</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('inventory.table.name')}</TableHead>
                    <TableHead>{t('inventory.table.sku')}</TableHead>
                    <TableHead>Magasin</TableHead>
                    <TableHead>{t('menu.program.unit')}</TableHead>
                    <TableHead>{t('inventory.fields.packaging')}</TableHead>
                    <TableHead>{t('inventory.table.quantity')}</TableHead>
                    <TableHead>{t('inventory.table.price')}</TableHead>
                    <TableHead>{t('inventory.fields.wholesalePriceShort')}</TableHead>
                    <TableHead className="text-right">{t('inventory.table.value')}</TableHead>
                    <TableHead className="text-right">{t('inventory.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => {
                    const packaging = parseInt(item.packaging || '1') || 1;
                    const unit = item.unit_type || 'Pièce';
                    const isPack = ['carton', 'box', 'pack', 'paquet', 'sachet', 'sac'].includes(unit.toLowerCase());
                    const displayPrice = isPack && packaging > 1 ? Number(item.price || 0) * packaging : Number(item.price || 0);
                    const displayWholesale = isPack && packaging > 1 ? Number(item.wholesale_price_ht || 0) * packaging : Number(item.wholesale_price_ht || 0);

                    return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sku || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {stores.find(s => s.id === item.store_id)?.name || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.unit_type || '-'}</TableCell>
                      <TableCell>{item.packaging || '-'}</TableCell>
                      <TableCell>
                        {item.quantity && isPack && packaging > 1 
                          ? `${(item.quantity / packaging).toFixed(2)} (${item.quantity} ${t('inventory.unitPiece')})`
                          : item.quantity
                        }
                      </TableCell>
                      <TableCell>{formatCurrency(displayPrice)}</TableCell>
                      <TableCell>{formatCurrency(displayWholesale)}</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(Number(item.quantity || 0) * Number(item.price || 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenForm(item)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(item); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="valuation">
          <ValorisationStock storeId={selectedStoreFilter === 'all' ? '' : selectedStoreFilter} />
        </TabsContent>
      </Tabs>

      {/* COMPACT FULL SCREEN DIALOG */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-full w-full h-[95vh] p-0 flex flex-col gap-0 rounded-none sm:rounded-lg sm:max-w-6xl sm:h-auto sm:max-h-[90vh] overflow-hidden">
          <DialogHeader className="px-6 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Package className="h-6 w-6" /> {selectedItem ? t('inventory.editItem') : t('inventory.addItem')}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: General */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">{t('inventory.sectionIdentification')}</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('inventory.fields.name')} *</Label>
                      <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('inventory.fields.sku')}</Label>
                        <Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('inventory.fields.family')}</Label>
                        <Select value={formData.category_id} onValueChange={v => setFormData({...formData, category_id: v})}>
                          <SelectTrigger className="h-9"><SelectValue placeholder={t('inventory.fields.selectFamily')} /></SelectTrigger>
                          <SelectContent>{families.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('inventory.fields.store')} *</Label>
                      <Select value={formData.store_id} onValueChange={v => setFormData({...formData, store_id: v})} required>
                        <SelectTrigger className="h-9"><SelectValue placeholder={t('inventory.selectStore')} /></SelectTrigger>
                        <SelectContent>{stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('inventory.fields.brand')}</Label>
                      <Input value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('inventory.fields.description')}</Label>
                      <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="min-h-[60px] text-xs" />
                    </div>
                  </div>
                </div>

                {/* Column 2: Pricing */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">{t('inventory.sectionPrices')}</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-primary">{t('inventory.fields.price1Detail')} *</Label>
                      <Input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required className="h-10 font-bold border-primary/40" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('inventory.fields.price2Discount')}</Label>
                        <Input type="number" value={formData.selling_price_2} onChange={e => setFormData({...formData, selling_price_2: e.target.value})} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('inventory.fields.price3Bulk')}</Label>
                        <Input type="number" value={formData.selling_price_3} onChange={e => setFormData({...formData, selling_price_3: e.target.value})} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('inventory.fields.price4Resale')}</Label>
                        <Input type="number" value={formData.selling_price_4} onChange={e => setFormData({...formData, selling_price_4: e.target.value})} className="h-9" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('inventory.fields.purchasePrice')}</Label>
                      <Input type="number" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="h-9" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('inventory.fields.wholesalePriceHT')}</Label>
                        <Input type="number" value={formData.wholesale_price_ht} onChange={e => setFormData({...formData, wholesale_price_ht: e.target.value})} className="h-9" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('inventory.fields.wholesalePriceTTC')}</Label>
                        <Input type="number" value={formData.wholesale_price_ttc} onChange={e => setFormData({...formData, wholesale_price_ttc: e.target.value})} className="h-9" />
                      </div>
                    </div>
                    <div className="p-3 rounded bg-primary/5 border border-primary/10">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">{t('menu.program.calculatedMargin')}:</span>
                        <span className="text-lg font-bold text-primary">{marginPercent}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Stock */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">{t('inventory.sectionStock')}</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('inventory.fields.quantity')} *</Label>
                        <Input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} required className="h-9 font-medium" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('inventory.fields.lowStockThreshold')}</Label>
                        <Input type="number" value={formData.low_stock_threshold} onChange={e => setFormData({...formData, low_stock_threshold: e.target.value})} className="h-9" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('menu.program.unit')}</Label>
                        <Select value={formData.unit_type} onValueChange={v => setFormData({...formData, unit_type: v})}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pièce">{t('inventory.unitTypes.piece')}</SelectItem>
                            <SelectItem value="Kg">{t('inventory.unitTypes.kg')}</SelectItem>
                            <SelectItem value="L">{t('inventory.unitTypes.litre')}</SelectItem>
                            <SelectItem value="Carton">{t('inventory.unitTypes.carton')}</SelectItem>
                            <SelectItem value="Paquet">Paquet</SelectItem>
                            <SelectItem value="Sachet">Sachet</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('inventory.fields.packaging')}</Label>
                        <Input value={formData.packaging} onChange={e => setFormData({...formData, packaging: e.target.value})} placeholder="Ex: 12" className="h-9" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('inventory.fields.expiryDate')}</Label>
                      <Input type="date" value={formData.expiry_date} onChange={e => setFormData({...formData, expiry_date: e.target.value})} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('inventory.fields.image')}</Label>
                      <ImageUpload currentImageUrl={formData.image_url} onImageUploaded={url => setFormData({...formData, image_url: url})} onImageRemoved={() => setFormData({...formData, image_url: ''})} folder="inventory" />
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-20 bg-muted/20 rounded-3xl border-2 border-dashed border-border/50 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-black uppercase tracking-widest text-xs">{t('common.selectStore')}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="valuation" className="mt-0">
          {activeStoreIds.length > 0 ? (
            activeStoreIds.map(sid => (
              <div key={`val-store-${sid}`} className="space-y-3 mb-10">
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2 px-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {stores.find(s => s.id === sid)?.name || t('common.unknown')}
                </h2>
                <ValorisationStock storeId={sid} />
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-muted-foreground">{t('common.selectStore')}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
