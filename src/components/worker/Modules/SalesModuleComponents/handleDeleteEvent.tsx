const handleDeleteEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      const key = e.detail?.key;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) {
        if (!lineItems[rowIndex].productId) return;
        handleDeleteLine(rowIndex);
        setTimeout(() => {
            const store = useNavigationStore.getState();
            let newRow = rowIndex;
            if (key === 'Backspace') newRow = Math.max(0, rowIndex - 1);
            store.setActiveCell({ row: newRow, col: 0 });
            setSelectedIndex(newRow);
        }, 50);
      }
    };
    