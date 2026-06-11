const handleNextRowEvent = (e: any) => {
      const { row, forceNew } = e.detail || {};
      const store = useNavigationStore.getState();
      let rowIndex = typeof row === 'number' ? row : (store.activeCell?.row ?? selectedIndex);
      if (rowIndex < 0) rowIndex = lineItems.length - 1;
      if (forceNew || rowIndex >= lineItems.length - 1) {
          const lastItem = lineItems[lineItems.length - 1];
          if (lastItem && !lastItem.productId && !forceNew) {
              store.setActiveCell({ row: lineItems.length - 1, col: 0 });
              store.setMode('hover');
              return;
          }
          const newItem = { id: crypto.randomUUID(), lineNumber: lineItems.length + 1, designation: '', code: '', conditionnement: 1, stock: 0, unitPrice: '', basePrice: 0, quantity: '', discountPercent: '', lineTotal: 0, isBox: false, priceTiers: { 1: 0, 2: 0, 3: 0, 4: 0 } };
          updateSession(mode, { lineItems: [...lineItems, newItem] });
          setTimeout(() => { store.setActiveCell({ row: lineItems.length, col: 0 }); store.setMode('hover'); }, 50);
      } else {
          store.advanceToNextRow();
          store.setMode('hover');
      }
    };
    