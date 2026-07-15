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

  
  