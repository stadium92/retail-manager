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

  