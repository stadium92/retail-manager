const resetForm = () => {
    setFormData(initialFormState);
    setMultiItems([{ ...initialFormState, id: crypto.randomUUID(), isOpen: false }]);
    setEditingProduct(null);
    setRecipeItems([]);
    setRecipeCost(0);
    setShowAdvanced(false);
    setMultiAdvancedOpen({});
    setActiveTab('informations');
  };



  