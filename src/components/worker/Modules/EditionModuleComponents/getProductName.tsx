const getProductName = (item: any) => {
    if (item.product_name && item.product_name !== 'Unknown') return item.product_name;
    if (item.name && item.name !== 'Unknown') return item.name;
    if (item.current_product_name) return item.current_product_name;
    const fromStore = products.find(p => p.id === (item.product_id || item.id));
    return fromStore?.name || t('common.unknown');
  };

  const workerMap = useMemo(() => {
    const map: Record<string, string> = {};
    
    // 1. Map from global master users (fallback)
    if (masterUsers) {
        masterUsers.forEach(u => {
            map[u.id] = u.full_name || u.email;
        });
    }

    // 2. Map from local module workers (primary)
    if (workers) {
        workers.forEach((worker) => {
          if (worker.user_id) map[worker.user_id] = worker.full_name;
          if (!map[worker.id]) map[worker.id] = worker.full_name; // Fallback to role ID
        });
    }
    return map;
  }, [workers, masterUsers]);

  const loadData = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);

    try {
      // Always fetch workers for mapping - but only update if changed to avoid loop
      const workersRes = await OfflineTeamService.getAllUsers();
      if (workersRes.data) {
        setWorkers(workersRes.data);
        
        // Selective update for global cache
        if (!masterUsers || masterUsers.length === 0) {
          setUsers(workersRes.data.map(u => ({ id: u.id, email: u.email, full_name: u.full_name || u.email })));
        }
      }

      // Always ensure products are loaded for name fallback
      if ((!products || products.length === 0) && !productsLoadedRef.current) {
         productsLoadedRef.current = true;
         const inventoryRes = await OfflineInventoryService.getInventory(storeId);
         // Only update if we actually got items to avoid infinite loop on empty inventory
         
      }

      switch (mode) {
        case 'situation-client':
          // Fetch Clients via OfflineDataService (uses proper auth headers + retry)
          const clientsList = await OfflineDataService.getClients(storeId);
          setClients(clientsList);
          
          if (selectedClientId) {
            const txs = await OfflineDataService.getClientTransactions(storeId, selectedClientId);
            setStatementData(txs);
          }
          break;

        case 'situation-fournisseur':
          const offlineSuppliers = storeSuppliers
            .filter(s => s.store_id === storeId)
            .map(s => ({
              id: s.id,
              name: s.name,
              balance: s.balance,
              phone: s.phone || null,
            }));
          setSuppliers(offlineSuppliers);

          if (selectedSupplierId) {
            const txs = await OfflineDataService.getSupplierTransactions(storeId, selectedSupplierId);
            setStatementData(txs);
          }
          break;

        case 'suivi-ventes-jour':
        case 'suivi-ventes-produit':
        case 'suivi-ventes-factures':
          const salesData = await OfflineDataService.getSales(storeId, dateRange.from, dateRange.to);
          setSales(salesData);
          break;

        case 'suivi-achats-jour':
        case 'suivi-achats-periode':
          const purchaseData = await OfflineDataService.getPurchaseOrders(storeId, dateRange.from, dateRange.to);
          setPurchases(purchaseData);
          break;

        case 'suivi-achats-famille':
          const poItems = await OfflineDataService.getAllPurchaseItems(storeId, dateRange.from, dateRange.to);
          
          const familyMap: Record<string, { total_quantity: number; total_amount: number }> = {};
          (poItems || []).forEach((item: any) => {
            const family = item.category_name || t('common.notClassified');
            if (!familyMap[family]) {
              familyMap[family] = { total_quantity: 0, total_amount: 0 };
            }
            familyMap[family].total_quantity += item.quantity_ordered || 0;
            familyMap[family].total_amount += (item.quantity_ordered * item.unit_cost) || 0;
          });

          const familyData: ProductFamily[] = Object.entries(familyMap)
            .map(([family_name, data]) => ({
              family_name,
              total_quantity: data.total_quantity,
              total_amount: data.total_amount,
            }))
            .sort((a, b) => b.total_amount - a.total_amount);

          setPurchasesByFamily(familyData);
          break;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('common.failedToLoad'));
    }

    setIsLoading(false);
  }, [storeId, mode, dateRange, storeSuppliers, selectedClientId, selectedSupplierId, t, masterUsers, products, setUsers]);

  useEffect(() => {
    loadData();

    // Listen for DB updates to refresh data reactively
    const handleDbUpdate = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'sale' || detail?.type === 'inventory' || detail?.type === 'client' || detail?.type === 'supplier') {
        console.log('[EditionModule] Refreshing data due to DB update event:', detail?.type);
        loadData();
      }
    };

    window.addEventListener('localDbDataUpdated', handleDbUpdate);
    return () => window.removeEventListener('localDbDataUpdated', handleDbUpdate);
  }, [loadData, storeId]);

  const filteredStatement = useMemo(() => {
    return statementData.filter(t => {
      const date = new Date(t.created_at);
      return date >= dateRange.from && date <= dateRange.to;
    });
  }, [statementData, dateRange]);

  const salesByProduct = useMemo(() => {
    const aggregated: Record<string, { name: string; quantity: number; total: number }> = {};
    // Proformas do not count towards actual product sales volume
    sales.filter(s => s.sale_type !== 'proforma').forEach(sale => {
      ((sale.items?.length ? sale.items : sale.sale_items) || []).forEach(item => {
        const name = getProductName(item);
        if (!aggregated[name]) {
          aggregated[name] = { name, quantity: 0, total: 0 };
        }
        aggregated[name].quantity += item.quantity;
        aggregated[name].total += item.total;
      });
    });
    return Object.values(aggregated).sort((a, b) => b.total - a.total);
  }, [sales, t, products]);

  const filteredSales = useMemo(() => 
    sales.filter(s => {
      // Proformas should ONLY appear in the Invoice List (suivi-ventes-factures), not in Daily Sales
      if (mode === 'suivi-ventes-jour' && s.sale_type === 'proforma') return false;

      return !searchQuery || 
        s.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase());
    }), [sales, searchQuery, mode]);

  const filteredSuppliers = useMemo(() =>
    suppliers.filter(s => 
      !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [suppliers, searchQuery]);

  const totalSales = useMemo(() => 
    filteredSales.reduce((sum, s) => sum + s.total_price, 0), [filteredSales]);

  const totalPurchases = useMemo(() =>
    purchases.reduce((sum, p) => sum + p.total_amount, 0), [purchases]);

  