const toggleMultiItemRow = (id: string) => {
    setMultiItems(prev => prev.map(item => ({
        ...item,
        isOpen: item.id === id ? !item.isOpen : false
    })));
  };

  