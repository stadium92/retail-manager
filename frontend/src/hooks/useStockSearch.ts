import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Product } from '@/types';

interface StockSearchResult {
  data: Product[];
  total: number;
}

export type StockFilter = 'all' | 'in_stock' | 'out_of_stock' | 'low_stock';

export function useStockSearch(storeId: string, enabled: boolean = true) {
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

  const query = useQuery({
    queryKey: ['stock-search', storeId, debouncedSearch, filter, page],
    queryFn: async () => {
      if (!storeId) return { data: [], total: 0 };

      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
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
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');

        const response = await smartFetch(`${localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, {
          headers,
        });

        if (!response.ok) {
            throw new Error('Stock search failed');
        }
        
        const payload = await response.json();
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
            store_id: p.store_id
        }));

        return { 
            data: mappedData, 
            total: payload.total || mappedData.length 
        };
      }
      
      return { data: [], total: 0 }; 
    },
    enabled: enabled && !!storeId,
    staleTime: 1000 * 60, // 1 minute cache
    keepPreviousData: true,
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
