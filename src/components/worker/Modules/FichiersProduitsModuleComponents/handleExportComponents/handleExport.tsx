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

  const renderSimplifiedForm = (
    data: typeof initialFormState,
    update: (field: keyof typeof initialFormState, val: any) => void,
    index?: number,
    showAdvancedState?: boolean,
    onToggleAdvanced?: () => void,
    isMultiMode?: boolean
  ) => {
    const margin = Number(data.selling_price_detail) > 0 && Number(data.purchase_price) > 0
      ? (((Number(data.selling_price_detail) - Number(data.purchase_price)) / Number(data.purchase_price)) * 100).toFixed(1)
      : '0';

    return (
      <div className="space-y-6">
        {!editingProduct && (
          <div className="bg-muted/30 p-4 rounded-xl border-2 border-dashed border-muted/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">{t('inventory.importFromExisting')}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              type="button" 
              onClick={() => { setLookupTargetIndex(index ?? null); setIsLookupOpen(true); }} 
              className="h-8 uppercase font-black text-[10px] tracking-widest px-4 border-primary/20 hover:bg-primary hover:text-white"
            >
              Choisir l'article
            </Button>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-bold">{t('inventory.fields.name')} *</Label>
            <Input 
              id={`product-name-${index ?? 'single'}`}
              value={data.name} 
              onChange={e => update('name', e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  document.getElementById(`product-selling-price-${index ?? 'single'}`)?.focus();
                }
              }}
              required 
              className="h-12 text-lg font-semibold bg-muted/20" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-black text-primary uppercase tracking-wider">{t('inventory.fields.price1Detail')} *</Label>
              <div className="relative">
                <Input 
                  id={`product-selling-price-${index ?? 'single'}`}
                  type="number" 
                  value={data.selling_price_detail} 
                  onChange={handleNumChange('selling_price_detail', index)} 
                  onBlur={handleNumBlur('selling_price_detail', index)} 
                  required 
                  className="h-14 text-2xl font-black border-primary/40 bg-primary/5 pl-4 pr-12 text-primary" 
                />
                <span className="absolute right-4 top-4 font-black text-primary/40 text-xl">F</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">{t('inventory.fields.purchasePrice')}</Label>
              <div className="relative">
                <Input 
                  id={`product-purchase-price-${index ?? 'single'}`}
                  type="number" 
                  value={data.purchase_price} 
                  onChange={handleNumChange('purchase_price', index)} 
                  onBlur={handleNumBlur('purchase_price', index)} 
                  className="h-14 text-2xl font-bold bg-muted/20 pl-4 pr-12" 
                />
                <span className="absolute right-4 top-4 text-muted-foreground/40 font-black text-xl">F</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="p-4 rounded-xl bg-success/5 border border-success/10 flex justify-between items-center shadow-inner">
              <span className="text-xs font-black uppercase tracking-widest text-success/60">{t('menu.program.calculatedMargin')}:</span>
              <span className="text-2xl font-black text-success">{margin}%</span>
            </div>

            {!isMultiMode && recipeCost > 0 && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 shadow-inner flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-primary/60">Coût ingrédients estimé:</span>
                  <span className="text-lg font-mono font-black text-primary">{recipeCost.toLocaleString()} F CFA</span>
                </div>
                <div className="flex justify-between items-center border-t border-primary/10 pt-2 mt-1">
                  <span className="text-xs font-black uppercase tracking-widest text-teal/85">Marge brute estimée:</span>
                  <span className="text-lg font-mono font-black text-teal">{(Number(data.selling_price_detail) - recipeCost).toLocaleString()} F CFA</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-primary">{t('inventory.fields.family')}</Label>
              <div className="relative">
                <Input 
                  list={`families-list-${index ?? 'single'}`}
                  value={data.family_id} 
                  onChange={e => update('family_id', e.target.value)} 
                  placeholder={t('inventory.fields.selectFamily')}
                  className="h-10 bg-primary/5 border-primary/20 pr-8 font-bold"
                />
                <datalist id={`families-list-${index ?? 'single'}`}>
                  {families.map(fam => <option key={fam.id} value={fam.name} />)}
                </datalist>
                <ChevronDown className="absolute right-2 top-3 h-4 w-4 text-primary/40 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Type de Plat</Label>
              <Select value={data.course_type} onValueChange={v => update('course_type', v)}>
                <SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Starter">Entrée</SelectItem>
                  <SelectItem value="Main">Plat Principal</SelectItem>
                  <SelectItem value="Dessert">Dessert</SelectItem>
                  <SelectItem value="Drink">Boisson</SelectItem>
                  <SelectItem value="Side">Accompagnement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-primary">
              {editingProduct || isMultiMode ? t('inventory.table.quantity') : t('inventory.fields.initialQuantity')}
            </Label>
            <Input 
              type="number" 
              value={isMultiMode ? data.quantity : data.reorder_quantity} 
              onChange={handleNumChange(isMultiMode ? 'quantity' : 'reorder_quantity', index)} 
              className="h-10 font-black bg-primary/5 border-primary/20" 
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onToggleAdvanced}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity"
          >
            {showAdvancedState ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {showAdvancedState ? "Moins d'options" : "Plus d'options (SKU, prix paliers, allergènes...)"}
          </button>
        </div>

        {showAdvancedState && (
          <div className="space-y-6 pt-4 border-t border-muted-foreground/10 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">{t('inventory.fields.sku')}</Label>
                <Input 
                  value={data.sku} 
                  onChange={e => update('sku', e.target.value)} 
                  className="h-10 font-mono" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">{t('inventory.fields.barcode')}</Label>
                <div className="flex gap-2">
                  <Input 
                    value={data.barcode} 
                    onChange={e => update('barcode', e.target.value)} 
                    className="h-10 font-mono" 
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    onClick={() => update('barcode', `PRD${Date.now().toString(36).toUpperCase()}`)} 
                    className="h-10 w-10 shrink-0"
                  >
                    <Barcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">{t('inventory.fields.brand')}</Label>
                <Input value={data.brand} onChange={e => update('brand', e.target.value)} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase">Rayon/Allée</Label>
                <Input value={data.aisle} onChange={e => update('aisle', e.target.value)} className="h-10" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Prix Spéciaux / Paliers</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">{t('inventory.fields.price2Discount')}</Label>
                  <Input type="number" value={data.selling_price_2} onChange={handleNumChange('selling_price_2', index)} onBlur={handleNumBlur('selling_price_2', index)} className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">{t('inventory.fields.price3Bulk')}</Label>
                  <Input type="number" value={data.selling_price_3} onChange={handleNumChange('selling_price_3', index)} onBlur={handleNumBlur('selling_price_3', index)} className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">{t('inventory.fields.price4Resale')}</Label>
                  <Input type="number" value={data.selling_price_4} onChange={handleNumChange('selling_price_4', index)} onBlur={handleNumBlur('selling_price_4', index)} className="h-10" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Prix de Gros</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">{t('inventory.fields.wholesalePriceHT')}</Label>
                  <Input type="number" value={data.selling_price_ht} onChange={handleNumChange('selling_price_ht', index)} onBlur={handleNumBlur('selling_price_ht', index)} className="h-10 border-danger/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">{t('inventory.fields.wholesalePriceTTC')}</Label>
                  <Input type="number" value={data.selling_price_ttc} onChange={handleNumChange('selling_price_ttc', index)} onBlur={handleNumBlur('selling_price_ttc', index)} className="h-10 border-danger/20 font-bold" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Logistique & Stock</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">{t('menu.program.unit')}</Label>
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
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">{t('inventory.fields.packaging')}</Label>
                  <Input value={data.packaging} onChange={e => update('packaging', e.target.value)} placeholder="1" className="h-10 font-bold border-primary/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">{t('inventory.fields.minStock')}</Label>
                  <Input type="number" value={data.min_stock_alert} onChange={e => update('min_stock_alert', e.target.value === '' ? '' : Number(e.target.value))} className="h-10 border-primary/20 font-bold" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Cuisine & Menu</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase">Temps Prep (min)</Label>
                  <Input type="number" value={data.prep_time_minutes} onChange={handleNumChange('prep_time_minutes', index)} className="h-10 font-bold border-primary/20" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-muted-foreground/10 mt-6">
                  <Label className="text-[10px] font-bold uppercase">Disponible</Label>
                  <Switch checked={!!data.is_available} onCheckedChange={v => update('is_available', v)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Allergènes (séparés par virgules)</Label>
                <Input value={data.allergens} onChange={e => update('allergens', e.target.value)} placeholder="ex: Gluten, Lactose" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Options / Suppléments (séparés par virgules)</Label>
                <Input value={data.modifiers} onChange={e => update('modifiers', e.target.value)} placeholder="ex: Sauce piquante" className="h-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">{t('inventory.fields.image')}</Label>
              <ImageUpload currentImageUrl={data.image_url} onImageUploaded={url => update('image_url', url)} onImageRemoved={() => update('image_url', '')} folder="inventory" />
            </div>

            {!isMultiMode && editingProduct && (
              <div className="space-y-3 pt-4 border-t border-muted-foreground/10">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Recette & Composition</Label>
                <RecipeBuilder
                  dishId={editingProduct.id}
                  storeId={storeId}
                  sellingPrice={Number(data.selling_price_detail) || 0}
                  onChange={(items) => setRecipeItems(items)}
                  onCostChange={(cost) => setRecipeCost(cost)}
                />
              </div>
            )}
          </div>
        )}
      </div>
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
        <DialogContent className="max-w-[960px] w-full h-[660px] p-0 flex flex-col gap-0 overflow-hidden shadow-2xl rounded-xl border border-gray-200 bg-white">
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

            {/* ── TAB BAR ── */}
            {registrationMode === 'single' && (
              <div className="djati-tab-bar">
                <button
                  type="button"
                  className={cn("djati-tab-btn", activeTab === 'informations' && "active")}
                  onClick={() => setActiveTab('informations')}
                >
                  <ReceiptText className="h-3.5 w-3.5" />
                  Informations
                </button>
                <button
                  type="button"
                  className={cn("djati-tab-btn", activeTab === 'prix' && "active")}
                  onClick={() => setActiveTab('prix')}
                >
                  <Coins className="h-3.5 w-3.5" />
                  Prix &amp; Marges
                </button>
                <button
                  type="button"
                  className={cn("djati-tab-btn", activeTab === 'logistique' && "active")}
                  onClick={() => setActiveTab('logistique')}
                >
                  <Package className="h-3.5 w-3.5" />
                  Logistique
                </button>
                <button
                  type="button"
                  className={cn("djati-tab-btn", activeTab === 'composition' && "active")}
                  onClick={() => setActiveTab('composition')}
                >
                  <ChefHat className="h-3.5 w-3.5" />
                  Composition
                </button>
                <button
                  type="button"
                  className={cn("djati-tab-btn", activeTab === 'options' && "active")}
                  onClick={() => setActiveTab('options')}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  Options
                </button>
              </div>
            )}

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
              <div className="djati-content">
                {registrationMode === 'single' ? (
                  <>
                    {/* TAB 1: INFORMATIONS */}
                    <div className={cn("space-y-6", activeTab === 'informations' ? "block" : "hidden")}>
                      <p className="djati-section-label">Identification</p>
                      
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Label className="djati-field-label">{t('inventory.fields.image')}</Label>
                          <ImageUpload 
                            currentImageUrl={formData.image_url} 
                            onImageUploaded={url => updateField('image_url', url)} 
                            onImageRemoved={() => updateField('image_url', '')} 
                            folder="inventory" 
                          />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div>
                            <Label className="djati-field-label">Nom de l'plats <span className="djati-req">*</span></Label>
                            <input 
                              id="product-name-single"
                              className="djati-input-field text-lg font-semibold" 
                              type="text" 
                              value={formData.name} 
                              onChange={e => updateField('name', e.target.value)} 
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
                                value={formData.sku} 
                                onChange={e => updateField('sku', e.target.value)} 
                              />
                            </div>
                            <div>
                              <Label className="djati-field-label">Code-barres</Label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input 
                                  className="djati-input-field font-mono" 
                                  type="text" 
                                  value={formData.barcode} 
                                  onChange={e => updateField('barcode', e.target.value)} 
                                />
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="icon" 
                                  onClick={() => updateField('barcode', `PRD${Date.now().toString(36).toUpperCase()}`)} 
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
                            value={formData.family_id} 
                            onChange={e => updateField('family_id', e.target.value)}
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
                          value={formData.brand} 
                          onChange={e => updateField('brand', e.target.value)} 
                        />
                      </div>
                    </div>

                    {/* TAB 2: PRIX & MARGES */}
                    <div className={cn("space-y-6", activeTab === 'prix' ? "block" : "hidden")}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '20px' }}>
                        <div>
                          <p className="djati-section-label">Prix et Marges</p>

                          <div className="djati-price-highlight">
                            <Label className="djati-field-label teal font-bold">Prix de commandes (Détail) <span className="djati-req">*</span></Label>
                            <div className="djati-price-wrap">
                              <input 
                                className="djati-input-field font-black text-lg" 
                                type="number" 
                                value={formData.selling_price_detail} 
                                onChange={handleNumChange('selling_price_detail')} 
                                onBlur={handleNumBlur('selling_price_detail')}
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
                                  value={formData.selling_price_2} 
                                  onChange={handleNumChange('selling_price_2')} 
                                  onBlur={handleNumBlur('selling_price_2')}
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
                                  value={formData.selling_price_3} 
                                  onChange={handleNumChange('selling_price_3')} 
                                  onBlur={handleNumBlur('selling_price_3')}
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
                                  value={formData.selling_price_4} 
                                  onChange={handleNumChange('selling_price_4')} 
                                  onBlur={handleNumBlur('selling_price_4')}
                                />
                                <span className="currency">F</span>
                              </div>
                            </div>
                          </div>

                          <div className="djati-field-group">
                            <Label className="djati-field-label">Prix d'achat</Label>
                            <div className="djati-price-wrap">
                              <input 
                                className="djati-input-field" 
                                type="number" 
                                value={formData.purchase_price} 
                                onChange={handleNumChange('purchase_price')} 
                                onBlur={handleNumBlur('purchase_price')}
                              />
                              <span className="currency">F</span>
                            </div>
                          </div>

                          <div className="djati-row2">
                            <div>
                              <Label className="djati-field-label red">Prix Gros HT</Label>
                              <div className="djati-price-wrap">
                                <input 
                                  className="djati-input-field" 
                                  type="number" 
                                  value={formData.selling_price_ht} 
                                  onChange={handleNumChange('selling_price_ht')} 
                                  onBlur={handleNumBlur('selling_price_ht')}
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
                                  value={formData.selling_price_ttc} 
                                  onChange={handleNumChange('selling_price_ttc')} 
                                  onBlur={handleNumBlur('selling_price_ttc')}
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
                              <span className="val">{recipeCost.toLocaleString()} F</span>
                            </div>
                            <div className="djati-cost-row">
                              <span className="lbl">Marge brute estimée</span>
                              <span className="val positive">{(Number(formData.selling_price_detail) - recipeCost).toLocaleString()} F</span>
                            </div>
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--txt-m)', marginTop: '10px', lineHeight: 1.5 }}>
                            Calculé automatiquement depuis l'onglet Composition.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* TAB 3: LOGISTIQUE */}
                    <div className={cn("space-y-6", activeTab === 'logistique' ? "block" : "hidden")}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div>
                          <p className="djati-section-label">Logistique</p>
                          <div className="djati-row2">
                            <div>
                              <Label className="djati-field-label">Unité</Label>
                              <div className="djati-select-wrap">
                                <select 
                                  className="djati-input-field font-bold" 
                                  value={formData.unit_type} 
                                  onChange={e => updateField('unit_type', e.target.value)}
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
                                value={formData.packaging} 
                                onChange={e => updateField('packaging', e.target.value)} 
                              />
                            </div>
                          </div>
                          <div className="djati-row2">
                            <div>
                              <Label className="djati-field-label teal">Stock initial (Base Units)</Label>
                              <input 
                                className="djati-input-field font-bold" 
                                type="number" 
                                value={formData.reorder_quantity} 
                                onChange={handleNumChange('reorder_quantity')} 
                                onBlur={handleNumBlur('reorder_quantity')}
                              />
                            </div>
                            <div>
                              <Label className="djati-field-label">Stock minimum</Label>
                              <input 
                                className="djati-input-field font-semibold" 
                                type="number" 
                                value={formData.min_stock_alert} 
                                onChange={handleNumChange('min_stock_alert')} 
                                onBlur={handleNumBlur('min_stock_alert')}
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
                                value={formData.prep_time_minutes} 
                                onChange={handleNumChange('prep_time_minutes')} 
                                onBlur={handleNumBlur('prep_time_minutes')}
                              />
                            </div>
                            <div>
                              <Label className="djati-field-label">Type de plat</Label>
                              <div className="djati-select-wrap">
                                <select 
                                  className="djati-input-field font-bold" 
                                  value={formData.course_type} 
                                  onChange={e => updateField('course_type', e.target.value)}
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
                              className={cn("djati-toggle", formData.is_available && "on")} 
                              onClick={() => updateField('is_available', !formData.is_available)}
                            />
                          </div>
                          
                          <div className="djati-field-group mt-4">
                            <Label className="djati-field-label">Rayon / Allée</Label>
                            <input 
                              className="djati-input-field" 
                              type="text" 
                              value={formData.aisle} 
                              onChange={e => updateField('aisle', e.target.value)} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* TAB 4: COMPOSITION */}
                    <div className={cn("space-y-6", activeTab === 'composition' ? "block" : "hidden")}>
                      <p className="djati-section-label">Composition du Plat</p>
                      <p style={{ fontSize: '13px', color: 'var(--txt-2)', marginBottom: '16px', lineHeight: 1.5 }}>
                        Définissez les ingrédients nécessaires pour préparer ce plat.<br/>
                        Les stocks seront automatiquement déduits à chaque vente.
                      </p>

                      {editingProduct ? (
                        <RecipeBuilder
                          dishId={editingProduct.id}
                          storeId={storeId}
                          sellingPrice={Number(formData.selling_price_detail) || 0}
                          onChange={(items) => setRecipeItems(items)}
                          onCostChange={(cost) => setRecipeCost(cost)}
                        />
                      ) : (
                        <div className="p-8 text-center border-2 border-dashed border-muted rounded-xl text-muted-foreground">
                           Veuillez d'abord enregistrer le plat avant d'ajouter sa recette.
                        </div>
                      )}
                    </div>

                    {/* TAB 5: OPTIONS */}
                    <div className={cn("space-y-6", activeTab === 'options' ? "block" : "hidden")}>
                      <p className="djati-section-label">Personnalisation</p>
                      <div style={{ maxWidth: '520px' }}>
                        <div className="djati-field-group">
                          <Label className="djati-field-label">Allergènes (séparés par virgules)</Label>
                          <input 
                            className="djati-input-field" 
                            type="text" 
                            value={formData.allergens} 
                            onChange={e => updateField('allergens', e.target.value)} 
                            placeholder="ex: Gluten, Lactose, Arachides"
                          />
                        </div>
                        <div className="djati-field-group">
                          <Label className="djati-field-label">Options / Suppléments (séparés par virgules)</Label>
                          <textarea 
                            className="djati-input-field" 
                            rows={3} 
                            value={formData.modifiers} 
                            onChange={e => updateField('modifiers', e.target.value)} 
                            placeholder="ex: Sauce piquante, Frites supplémentaires, Double portion"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    {multiItems.map((item, index) => (
                      <Card key={item.id} className={cn("border-4 transition-all overflow-hidden cursor-pointer", item.isOpen ? "border-primary shadow-2xl scale-[1.01]" : "border-muted/60 shadow-md hover:border-primary/40 hover:bg-muted/10")}>
                        <div className="flex items-center justify-between p-4" onClick={() => toggleMultiItemRow(item.id)}>
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg bg-primary/10 text-primary transition-transform", item.isOpen && "rotate-180")}>
                              {item.isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </div>
                            <span className="font-black uppercase tracking-widest text-sm text-primary/80">{item.name || `NOUVEL ARTICLE #${index + 1}`}</span>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); removeMultiItemRow(item.id); }}>
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                        {item.isOpen && (
                          <div className="p-6 border-t-2 bg-muted/5">
                            {renderSimplifiedForm(
                              item,
                              (field, val) => updateField(field, val, index),
                              index,
                              !!multiAdvancedOpen[item.id],
                              () => setMultiAdvancedOpen(prev => ({ ...prev, [item.id]: !prev[item.id] })),
                              true
                            )}
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
