const handleAdjustQtyEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      const delta = e.detail?.delta;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) {
        const currentQty = Number(lineItems[rowIndex].quantity) || 0;
        handleQuantityChange(rowIndex, Math.max(1, currentQty + delta));
      }
    };
    