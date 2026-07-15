const getLocale = () => {
    if (i18n.language === 'fr' || i18n.language === 'bm') return fr;
    return enUS;
  };

  const storeSuppliers = useMasterDataStore(state => state.suppliers);
  // Subscribe to products store for fallback
  const products = useMasterDataStore(state => state.products);
  
  const masterUsers = useMasterDataStore(state => state.users);
  const setUsers = useMasterDataStore(state => state.setUsers);

  const productsLoadedRef = useRef(false);

  // Helper to resolve product name
  