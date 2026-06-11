const handleToggleEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) handleToggleUnit(rowIndex);
    };
    