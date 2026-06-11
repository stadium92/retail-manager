const handleDataUpdated = (e: CustomEvent) => {
      // 1. Check type
if (e.detail?.type !== 'sales' && e.detail?.type !== 'sale' && e.detail?.type !== 'inventory' && e.detail?.type !== 'product') return;
      
      // 2. Check storeId (if provided in event) to only refresh what's relevant
      if (e.detail?.storeId && e.detail.storeId !== storeId) return;

      // 3. Throttle: Only allow one refresh every 2 seconds to stop jittering loops
      const now = Date.now();
      if (now - lastRefresh.current < 2000) return;
      lastRefresh.current = now;

      console.log(`[GestionModule] Throttled refresh triggered for store: ${storeId || 'ALL'}`);
      fetchData();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('localDbDataUpdated', handleDataUpdated as EventListener);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('localDbDataUpdated', handleDataUpdated as EventListener);
    };
  }, [storeId, dateRange]);

  // Fetch data - uses local sources
  const fetchData = useCallback(async () => {
    // If we're in Worker mode, storeId is required. 
    // In Master mode, storeId can be empty string (All Stores).
    // We only return if storeId is strictly undefined (not yet initialized).
    if (storeId === undefined) return;
    setIsLoading(true);

    try {
      const from = dateRange?.from || startOfDay(new Date());
      const to = dateRange?.to || endOfDay(new Date());

      console.log(`[GestionModule] Fetching data for store: ${storeId || 'ALL'}`);

      const analyticsData = await OfflineDataService.getDashboardAnalytics(storeId, from, to);
      if (analyticsData) {
        setAnalytics(analyticsData);
      }

      const salesData = await OfflineDataService.getSales(storeId, from, to);
      setSales(salesData);

      const movementsData = await OfflineDataService.getStockMovements(storeId);
      setMovements(movementsData.movements || []);

      const entries: CashEntry[] = [];
      
      salesData.forEach(sale => {
        const isCredit = sale.payment_method === 'credit';
        entries.push({
          id: sale.id,
          type: isCredit ? 'out' : 'in', // Display logic for journal
          description: `${isCredit ? '[CRÉDIT] ' : ''}Vente ${sale.invoice_number || sale.id.slice(0, 8)}`,
          amount: sale.total_price,
          date: sale.created_at,
          category: isCredit ? t('menu.program.creditSale') : t('sidebar.sales'),
          isCredit,
          method: sale.payment_method
        } as any);
      });

      // Fetch Supplier Payments (Out)
      const payments = await OfflineDataService.getSupplierPayments(storeId, from);
      payments.forEach(payment => {
        if (new Date(payment.date) <= to) {
          entries.push({
            id: payment.id,
            type: 'out',
            description: `Paiement ${payment.supplier_name}`,
            amount: payment.amount,
            date: payment.date,
            category: t('menu.program.supplierPayment'),
          });
        }
      });

      // Fetch Petty Cash Transactions
      const cashTxs = await OfflineDataService.getCashTransactions(storeId, from);
      cashTxs.forEach(tx => {
        if (new Date(tx.date) <= to) {
          entries.push({
            id: tx.id,
            type: tx.type,
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
            category: tx.category,
          });
        }
      });

      // Calculate Running Balance
      // Sort ascending to calculate, then flip back for display
      const sortedAsc = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let currentBalance = 0;
      const entriesWithBalance = sortedAsc.map(e => {
        if (e.type === 'in' && !(e as any).isCredit) {
          currentBalance += e.amount;
        } else if (e.type === 'out' && !(e as any).isCredit) {
          currentBalance -= e.amount;
        }
        return { ...e, runningBalance: currentBalance };
      });

      setCashEntries(entriesWithBalance.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));

      // Fetch table metrics
      try {
        const dc = getDataClient();
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers && storeId) {
          const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/tables_layout?store_id=${storeId}`, { headers });
          if (res.ok) {
            const tbls = await res.json();
            if (Array.isArray(tbls)) {
              setTableMetrics({
                total: tbls.length,
                occupied: tbls.filter((t: any) => t.status === 'occupied').length
              });
            }
          }
        }
      } catch (err) {
        console.error('[GestionModule] Failed to fetch tables layout:', err);
      }
    } catch (error) {
      console.error('[GestionModule] Error fetching data:', error);
      toast.error(t('common.failedToLoad'));
    }

    setIsLoading(false);
  }, [storeId, t, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecordPettyCash = async () => {
    const amount = parseFloat(pettyCashForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('common.error'));
      return;
    }

    const success = await OfflineDataService.createCashTransaction({
      store_id: storeId,
      type: 'out',
      amount,
      category: pettyCashForm.category,
      description: pettyCashForm.description || t('analytics.miscellaneousExpense'),
    });

    if (success) {
      toast.success(t('common.success'));
      setIsPettyCashOpen(false);
      setPettyCashForm({ amount: '', category: 'petty_cash', description: '' });
      fetchData();
    } else {
      toast.error(t('common.error'));
    }
  };

  // Calculate KPIs
  const kpis = useMemo(() => {
    // Only count non-credit entries as "Income" for actual Cash balance
    const cashTotal = cashEntries
      .filter(e => e.type === 'in' && (e as any).method === 'cash')
      .reduce((sum, e) => sum + e.amount, 0);

    const cardTotal = cashEntries
      .filter(e => e.type === 'in' && (e as any).method === 'card')
      .reduce((sum, e) => sum + e.amount, 0);

    const mobileTotal = cashEntries
      .filter(e => e.type === 'in' && (e as any).method === 'mobile')
      .reduce((sum, e) => sum + e.amount, 0);
      
    const totalExpenses = cashEntries
      .filter(e => e.type === 'out' && !(e as any).isCredit)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalCreditSales = cashEntries
      .filter(e => (e as any).isCredit)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalRevenue = cashTotal + cardTotal + mobileTotal;
    const netCash = totalRevenue - totalExpenses;
    const orderCount = sales.length;
    
    // Profit based on price - cost
    const totalProfit = sales.reduce((sum, sale) => {
      const saleItems = (sale.items?.length ? sale.items : sale.sale_items) || [];
      // This is an estimate as items might not have cost_price directly
      // In a full implementation, we'd join with products table or look up cost
      return sum + (sale.total_price * 0.25); // Default 25% margin estimate
    }, 0);

    // Restaurant-specific calculations
    const dineInSales = sales.filter((s: any) => s.order_type === 'dine_in');
    const takeawaySales = sales.filter((s: any) => s.order_type === 'takeaway');
    const deliverySales = sales.filter((s: any) => s.order_type === 'delivery');
    
    const coversCount = dineInSales.reduce((sum, s) => {
      const items = (s.items?.length ? s.items : s.sale_items) || [];
      return sum + items.reduce((iSum: number, item: any) => iSum + (Number(item.quantity) || 1), 0);
    }, 0);

    const salesWithPrep = sales.filter((s: any) => Number(s.estimated_prep_time) > 0);
    const avgPrepTime = salesWithPrep.length > 0
      ? salesWithPrep.reduce((sum, s) => sum + Number(s.estimated_prep_time), 0) / salesWithPrep.length
      : 12; // default 12 minutes

    return { 
      totalRevenue, 
      totalExpenses, 
      netCash, 
      orderCount, 
      totalProfit, 
      totalCreditSales,
      cashTotal,
      cardTotal,
      mobileTotal,
      coversCount,
      avgPrepTime,
      dineInCount: dineInSales.length,
      takeawayCount: takeawaySales.length,
      deliveryCount: deliverySales.length
    };
  }, [cashEntries, sales]);

  // Category breakdown for pie chart
  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    sales.forEach(sale => {
const items = (sale.items?.length ? sale.items : (sale.sale_items?.length ? sale.sale_items : []));
            items.forEach((item: any) => {
              const cat = item.category_name || item.category || t('common.other');
              categories[cat] = (categories[cat] || 0) + (item.total || item.lineTotal || 0);
      });
    });
    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [sales, t]);

  // Weekly revenue data
  const weeklyRevenue = useMemo(() => {
    if (analytics?.weekly_revenue) {
      return analytics.weekly_revenue.map(d => ({
        date: format(new Date(d.date), 'EEE', { locale: getLocale() }),
        revenue: d.revenue
      }));
    }
    return [];
  }, [analytics, i18n.language]);

  // Top selling products
  const topProducts = useMemo(() => {
    if (analytics?.top_products?.length) {
      return analytics.top_products.map(p => ({
        name: p.name,
        qty: p.quantity,
        revenue: p.revenue
      }));
    }
    const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales.forEach(sale => {
const items = (sale.items?.length ? sale.items : sale.sale_items) || [];
            items.forEach((item: any) => {
              const name = item.product_name || item.productName || item.designation || 'Unknown';
              if (!productSales[name]) {
                productSales[name] = { name, qty: 0, revenue: 0 };
        }
        productSales[name].qty += Number(item.quantity || 0);
        productSales[name].revenue += Number(item.total || item.lineTotal || 0);
      });
    });
    return Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales, analytics]);

          const stockHealthData = useMemo(() => {
          if (analytics?.stock_health) {
            return [
              { name: t('inventory.inStock'), value: analytics.stock_health.ok, color: '#00FF66' },
              { name: t('inventory.lowStock'), value: analytics.stock_health.low, color: '#FFD700' },
              { name: t('inventory.outOfStock'), value: analytics.stock_health.out, color: '#FF6B6B' },
            ].filter(d => d.value > 0);
          }
          // Fallback to computing from current view if analytics missing
          return [];
        }, [analytics, t]);

  // Handle loss recording - works offline
  const handleRecordLoss = async () => {
    if (!lossForm.product || lossForm.quantity <= 0) {
      toast.error(t('worker.sales.addAtLeastOne'));
      return;
    }

    try {
      const newQuantity = Math.max(0, lossForm.product.quantity - lossForm.quantity);
      await OfflineDataService.updateProductStock(storeId, lossForm.product.id, newQuantity, `Perte: ${lossForm.reason}`);
      toast.success(t('common.success'));
      setLossForm({ product: null, quantity: 1, reason: 'expired', notes: '' });
      lowStockQuery.refetch();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const OfflineIndicator = () => isOffline ? (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-warning/20 text-warning text-xs">
      <WifiOff className="h-3 w-3" />
      <span>{t('common.offline')}</span>
    </div>
  ) : null;

  