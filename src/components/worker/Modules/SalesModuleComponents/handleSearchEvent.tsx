const handleSearchEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) setInitialSearchQuery(lineItems[rowIndex].designation || '');
      else setInitialSearchQuery('');
      setIsProductLookupOpen(true);
    };
    