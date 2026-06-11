const handleCaptureKeystroke = (e: any) => {};

    window.addEventListener('nav-delete-row', handleDeleteEvent);
    window.addEventListener('nav-toggle-packing', handleToggleEvent);
    window.addEventListener('nav-open-search', handleSearchEvent);
    window.addEventListener('nav-adjust-quantity', handleAdjustQtyEvent);
    window.addEventListener('nav-adjust-price', handleAdjustPriceEvent);
    window.addEventListener('nav-next-row', handleNextRowEvent);
    window.addEventListener('scanner-input', (e: any) => handleHardwareScanRef.current(e));
    window.addEventListener('nav-pay-shortcut', () => openPaymentRef.current());
    window.addEventListener('nav-search-shortcut', () => setIsProductLookupOpen(true));
    window.addEventListener('nav-save-shortcut', () => handleSaveProformaRef.current());
    window.addEventListener('nav-capture-keystroke', handleCaptureKeystroke);
    
    return () => {
      window.removeEventListener('nav-delete-row', handleDeleteEvent);
      window.removeEventListener('nav-toggle-packing', handleToggleEvent);
      window.removeEventListener('nav-open-search', handleSearchEvent);
      window.removeEventListener('nav-adjust-quantity', handleAdjustQtyEvent);
      window.removeEventListener('nav-adjust-price', handleAdjustPriceEvent);
      window.removeEventListener('nav-next-row', handleNextRowEvent);
      window.removeEventListener('scanner-input', (e: any) => handleHardwareScanRef.current(e));
      window.removeEventListener('nav-pay-shortcut', () => openPaymentRef.current());
      window.removeEventListener('nav-search-shortcut', () => setIsProductLookupOpen(true));
      window.removeEventListener('nav-save-shortcut', () => handleSaveProformaRef.current());
      window.removeEventListener('nav-capture-keystroke', handleCaptureKeystroke);
    };
  }, [lineItems, handleDeleteLine, handleToggleUnit, handleQuantityChange, handleDesignationChange, handlePriceChange, mode, updateSession]);

  useEffect(() => {
    