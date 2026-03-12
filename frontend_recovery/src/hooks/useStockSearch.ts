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

        const response = await fetch(`${localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, {
          headers,
        });

        if (!response.ok) {
            throw new Error('Stock search failed');
        }
        
        const payload = await response.json();
        
        if (Array.isArray(payload)) {
            return { data: payload, total: payload.length };
        }
        return payload as StockSearchResult;
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
