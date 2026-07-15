const addMultiItemRow = () => {
    setMultiItems(prev => {
        // FIELD INHERITANCE: New rows copy Family, Brand, and Unit from the previous row
        const lastItem = prev.length > 0 ? prev[prev.length - 1] : formData;
        
        return [
            ...prev.map(item => ({ ...item, isOpen: false })),
            { 
                ...initialFormState, 
                id: crypto.randomUUID(), 
                isOpen: true,
                family_id: lastItem.family_id,
                brand: lastItem.brand,
                unit_type: lastItem.unit_type,
                packaging: lastItem.packaging,
                aisle: lastItem.aisle
            }
        ];
    });
  };

  