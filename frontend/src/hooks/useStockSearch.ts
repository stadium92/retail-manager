import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Product } from '@/types';

interface StockSearchResult {
  data: Product[];
  total: number;
}

export type StockFilter = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';

export function useStockSearch(storeId: string, enabled: boolean = true) {
  const queryClient = useQueryClient();
  
  // Listen for local DB updates to invalidate search cache
  useEffect(() => {
    const handleRefresh = (e: any) => {
      if (e.detail?.type === 'inventory' || e.detail?.type === 'product' || e.detail?.type === 'sale') {
        console.log('[useStockSearch] Event received:', e.detail?.type, '- Invalidating stock-search cache');
        queryClient.invalidateQueries({ queryKey: ['stock-search'] });
      }
    };
    window.addEventListener('localDbDataUpdated', handleRefresh);
    return () => window.removeEventListener('localDbDataUpdated', handleRefresh);
  }, [queryClient]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [page, setPage] = useState(1);
  const limit = 50;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search change
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const query = useQuery<StockSearchResult>({
    queryKey: ['stock-search', storeId, debouncedSearch, filter, page],
    queryFn: async () => {
      if (!storeId) return { data: [], total: 0 };

      const { isLocalFirst } = getDataClient();
      const params = new URLSearchParams({
        store_id: storeId,
        limit: limit.toString(),
        page: page.toString(),
      });

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      
      if (filter !== 'all') {
        params.append('filter', filter);
      }

      if (isLocalFirst) {
        console.log('[useStockSearch] Fetching from bridge for store:', storeId, 'search:', debouncedSearch);
        try {
            const payload = await OfflineAuthService.localBridgeRequest<any>(`/rest/v1/products?${params.toString()}`, { method: 'GET' });
            
            const rawData = Array.isArray(payload) ? payload : payload.data || [];
            
            const mappedData = rawData.map((p: any) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                barcode: p.barcode || p.sku,
                unit_price: p.unit_price || p.price || 0,
                cost_price: p.cost_price || p.cost || 0,
                wholesale_price: p.wholesale_price_ttc || p.wholesale_price || 0,
                wholesale_price_ht: p.wholesale_price_ht || 0,
                wholesale_price_ttc: p.wholesale_price_ttc || 0,
                selling_price_2: p.selling_price_2 || 0,
                selling_price_3: p.selling_price_3 || 0,
                selling_price_4: p.selling_price_4 || 0,
                quantity: p.quantity ?? p.stock ?? 0,
                min_quantity: p.min_quantity || p.low_stock_threshold || 0,
                packaging: p.packaging || '1',
                unit_type: p.unit_type || 'Piece',
                category_id: p.category || p.category_id,
                category_name: p.category_name ?? null,
                store_id: p.store_id
            }));

            return { 
                data: mappedData, 
                total: payload.total || mappedData.length 
            };
        } catch (e) {
            console.error('[useStockSearch] Bridge fetch failed:', e);
            throw e;
        }
      }

      // OFFLINE WEB FALLBACK (IndexedDB) - only if NOT local-first
      if (!isLocalFirst) {
        const { LocalDatabase } = await import('@/services/LocalDatabase');
        await LocalDatabase.init();
        let allItems = await LocalDatabase.getInventory(storeId);

        // Apply Search
        if (debouncedSearch) {
            const lowerQ = debouncedSearch.toLowerCase();
            allItems = allItems.filter(p => 
                (p.product_name && p.product_name.toLowerCase().includes(lowerQ)) ||
                (p.sku && p.sku.toLowerCase().includes(lowerQ)) ||
                (p.barcode && p.barcode.toLowerCase().includes(lowerQ))
            );
        }

        // Apply Filter
        if (filter === 'out_of_stock') {
            allItems = allItems.filter(p => (p.quantity || 0) <= 0);
        } else if (filter === 'low_stock') {
            allItems = allItems.filter(p => (p.quantity || 0) <= (p.reorder_quantity || p.low_stock_threshold || 10) && (p.quantity || 0) > 0);
        } else if (filter === 'in_stock') {
            allItems = allItems.filter(p => (p.quantity || 0) > 0);
        }

        const total = allItems.length;
        
        // Pagination
        const from = (page - 1) * limit;
        const paginatedItems = allItems.slice(from, from + limit);

        const mappedData = paginatedItems.map((p: any) => ({
          id: p.id,
          name: p.product_name || p.name,
          sku: p.sku,
          barcode: p.barcode || p.sku,
          unit_price: p.price || p.unit_price || 0,
          cost_price: p.cost || p.cost_price || 0,
          wholesale_price: p.wholesale_price_ttc || p.wholesale_price || 0,
          wholesale_price_ht: p.wholesale_price_ht || 0,
          wholesale_price_ttc: p.wholesale_price_ttc || 0,
          selling_price_2: p.selling_price_2 || 0,
          selling_price_3: p.selling_price_3 || 0,
          selling_price_4: p.selling_price_4 || 0,
          quantity: p.quantity ?? p.stock ?? 0,
          min_quantity: p.reorder_quantity || p.min_quantity || 0,
          packaging: p.packaging || '1',
          unit_type: p.unit_type || 'Piece',
          category_id: p.category || p.category_id,
          category_name: p.category_name ?? null,
          store_id: p.store_id
        }));

        return { data: mappedData, total };
      }

      return { data: [], total: 0 };
    },
    enabled: enabled && !!storeId,
    // Was 0 ("always fetch fresh") - typing a query, backspacing, and
    // retyping it refired the identical HTTP request each time. 15s of
    // staleness is invisible at a till, and real changes invalidate through
    // the localDbDataUpdated listener above anyway.
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  return {
    search,
    setSearch,
    filter,
    setFilter,
    page,
    setPage,
    limit,
    results: query.data?.data || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
