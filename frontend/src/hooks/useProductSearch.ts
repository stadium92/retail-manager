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

      const { isLocalFirst, localBridgeBaseUrl, supabase } = getDataClient();
      const params = new URLSearchParams({
        store_id: storeId,
        limit: '50',
      });

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      } else {
        params.append('page', '1');
      }

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
        
        if (Array.isArray(payload)) {
            return { data: payload, total: payload.length };
        }
        return payload as SearchResult;
      }
      
      // Master / Online Mode: Fetch from Supabase
      let q = (supabase as any).from('products').select('*', { count: 'exact' });
      
      // If storeId is provided, we can filter, but user requested FULL inventory access for import
      // Actually, for import purposes, we search ALL stores if storeId is 'all' or similar
      // but usually we want to search everything accessible.
      
      if (debouncedSearch) {
        q = q.or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%`);
      }
      
      const { data, count, error } = await q.range(0, 49).order('name');
      
      if (error) throw error;
      
      return { 
        data: (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.sku,
            unit_price: p.unit_price,
            cost_price: p.cost_price,
            wholesale_price: p.wholesale_price_ttc || p.wholesale_price,
            wholesale_price_ht: p.wholesale_price_ht,
            wholesale_price_ttc: p.wholesale_price_ttc,
            selling_price_2: p.selling_price_2,
            selling_price_3: p.selling_price_3,
            selling_price_4: p.selling_price_4,
            quantity: p.quantity,
            min_quantity: p.min_quantity,
            packaging: p.packaging,
            unit_type: p.unit_type,
            category_id: p.category,
            store_id: p.store_id
        } as any)), 
        total: count || 0 
      }; 
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
