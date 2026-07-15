const removeMultiItemRow = (id: string) => {
    setMultiItems(prev => prev.filter(item => item.id !== id));
  };

  