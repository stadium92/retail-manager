const handleRefresh = (e: any) => {
      if (e.detail?.type === 'inventory') {
        fetchData();
      }
    };

    window.addEventListener('localDbDataUpdated', handleRefresh);
    return () => window.removeEventListener('localDbDataUpdated', handleRefresh);
  }, [storeId, fetchData]);





  const handleNumChange = (field: keyof typeof initialFormState, index?: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const finalVal = val === '' ? '' : Number(val);
    updateField(field, finalVal, index);
  };

  const handleNumBlur = (field: keyof typeof initialFormState, index?: number) => () => {
    if (index !== undefined) {
        setMultiItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: item[field] === '' ? 0 : item[field] } : item));
    } else {
        setFormData(f => ({ ...f, [field]: f[field] === '' ? 0 : f[field] }));
    }
  };

  