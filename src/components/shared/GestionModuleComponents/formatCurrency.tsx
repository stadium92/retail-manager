const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' F';
  };

  const lowStockQuery = useStockSearch(storeId, mode === 'tableau-bord' || mode === 'sorties-pertes');
  
  useEffect(() => {
      lowStockQuery.setFilter('low_stock');
  }, []);

  // Loss form state
  const [lossForm, setLossForm] = useState({
    product: null as Product | null,
    quantity: 1 as number | string,
    reason: 'expired' as 'expired' | 'broken' | 'theft' | 'other',
    notes: '',
  });

  const lastRefresh = useRef<number>(0);

  // Listen for online/offline changes and data updates
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    