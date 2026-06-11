const handleScannerInput = (e: any) => {
      const code = e.detail?.code;
      if (code && isDialogOpen) {
        if (registrationMode === 'single') {
          setFormData(prev => ({ ...prev, barcode: code }));
          setTimeout(() => document.getElementById('product-name-single')?.focus(), 50);
        } else {
          // If in multi-mode, update the currently open item or the last item
          let targetIdx = -1;
          setMultiItems(prev => {
            const newItems = [...prev];
            const openIndex = newItems.findIndex(i => i.isOpen);
            if (openIndex >= 0) {
              newItems[openIndex] = { ...newItems[openIndex], barcode: code };
              targetIdx = openIndex;
            } else if (newItems.length > 0) {
              newItems[newItems.length - 1] = { ...newItems[newItems.length - 1], barcode: code };
              targetIdx = newItems.length - 1;
            }
            return newItems;
          });
          if (targetIdx !== -1) {
            setTimeout(() => document.getElementById(`product-name-${targetIdx}`)?.focus(), 50);
          }
        }
        toast.success(t('scanner.codeScanned') || 'Code scanned');
      }
    };
    window.addEventListener('scanner-input', handleScannerInput);
    return () => window.removeEventListener('scanner-input', handleScannerInput);
  }, [isDialogOpen, t, registrationMode]);

    useEffect(() => {
    if (storeId) {
      fetchData();
    }

    