const handleAdjustPriceEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      const delta = e.detail?.delta;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) {
        const currentPrice = Number(lineItems[rowIndex].unitPrice) || 0;
        handlePriceChange(rowIndex, Math.max(0, currentPrice + (delta * 500)));
      }
    };
    