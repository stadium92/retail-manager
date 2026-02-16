import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Product } from '@/types';

interface SearchResult {
  data: Product[];
  total: number;
}

export function useProductSearch(storeId: string, enabled: boolean = true) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: ['products-search', storeId, debouncedSearch],
    queryFn: async () => {
      if (!storeId) return { data: [], total: 0 };

      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
      const params = new URLSearchParams({
        store_id: storeId,
        limit: '50',
      });

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      } else {
        // Initial load or empty search - just get first page
        params.append('page', '1');
      }

      // TODO: Handle online mode (Supabase) if needed, but for now 
      // we prioritize the memory fix which implies hitting LocalBridge
      // or a similar optimized endpoint.
      
      if (isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');

        const response = await fetch(`${localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, {
          headers,
        });

        if (!response.ok) {
            throw new Error('Search failed');
        }
        
        const payload = await response.json();
        
        // Handle both array (legacy) and object (new pagination) responses
        if (Array.isArray(payload)) {
            return { data: payload, total: payload.length };
        }
        return payload as SearchResult;
      }
      
      // Fallback for Online Mode (mocking pagination or using Supabase text search)
      // Ideally Supabase logic would also be paginated.
      return { data: [], total: 0 }; 
    },
    enabled: enabled && !!storeId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return {
    search,
    setSearch,
    results: query.data?.data || [],
    isLoading: query.isLoading,
    total: query.data?.total || 0,
  };
}
