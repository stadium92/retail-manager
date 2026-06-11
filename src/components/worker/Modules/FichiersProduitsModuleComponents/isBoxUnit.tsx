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
            const hasData = Number(item.purchase_price) > 0 || Number(item.quantity) > 0 || !!item.sku;
            return hasName && hasData;
        });

        if (itemsToSave.length === 0 && registrationMode === 'multi') {
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
                console.log('[FichiersProduits] Creating new product...');
                result = await OfflineInventoryService.createItem(data);
            }

            if (result.error) {
                console.error('[FichiersProduits] Service error:', result.error);
                throw result.error;
            }
            console.log('[FichiersProduits] Save successful for item:', item.name);

            // Save recipe composition links
            if (registrationMode === 'single' && result.data?.id) {
                await OfflineAuthService.localBridgeRequest('/rest/v1/recipes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dish_id: result.data.id,
                        items: recipeItems,
                    }),
                });
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
    });

    try {
      const items = await OfflineAuthService.localBridgeRequest<any[]>(`/rest/v1/recipes?dish_id=${p.id}`);
      if (Array.isArray(items)) {
        setRecipeItems(items.map(item => ({
          ingredient_id: item.ingredient_id,
          quantity_needed: Number(item.quantity_needed),
          unit: item.unit,
        })));
      } else {
        setRecipeItems([]);
      }
    } catch (err) {
      console.error('Failed to load recipe items:', err);
      setRecipeItems([]);
    }

    setActiveTab('informations');
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

  