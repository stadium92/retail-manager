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
      if (!storeId) {
        console.warn('[useProductSearch] No storeId provided');
        return { data: [], total: 0 };
      }

      console.log('[useProductSearch] Searching for:', debouncedSearch, 'in store:', storeId);

      const { isLocalFirst, localBridgeBaseUrl, supabase } = getDataClient();
      
      if (isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
            console.warn('[useProductSearch] Not authenticated for local bridge');
            throw new Error('Not authenticated');
        }

        const params = new URLSearchParams({
          store_id: storeId,
          limit: '50',
        });

        if (debouncedSearch) {
          params.append('search', debouncedSearch);
        } else {
          params.append('page', '1');
        }

        const url = `${localBridgeBaseUrl}/rest/v1/products?${params.toString()}`;
        console.log('[useProductSearch] Requesting:', url);

        const response = await smartFetch(url, {
          headers,
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => 'No body');
            console.error('[useProductSearch] Search failed:', response.status, errBody);
            throw new Error('Search failed');
        }
        
        const payload = await response.json();
        console.log('[useProductSearch] Payload received:', Array.isArray(payload) ? `Array(${payload.length})` : 'Object');
        
        let data: any[] = [];
        let total = 0;

        if (Array.isArray(payload)) {
            data = payload;
            total = payload.length;
        } else {
            data = payload.data || [];
            total = payload.total || data.length;
        }

        // Apply robust mapping to bridge data too
        const mappedData = data.map((p: any) => ({
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
            quantity: p.quantity || 0,
            min_quantity: p.min_quantity || p.low_stock_threshold || 0,
            packaging: p.packaging || '1',
            unit_type: p.unit_type || 'Piece',
            category_id: p.category || p.category_id,
            store_id: p.store_id
        }));

        return { data: mappedData, total };
      }
      
      // Master / Online Mode: Fetch from Supabase
      console.log('[useProductSearch] Fetching from Supabase...');
      let q = (supabase as any).from('products').select('*', { count: 'exact' });
      
      if (storeId && storeId !== 'all') {
        q = q.eq('store_id', storeId);
      }
      
      if (debouncedSearch) {
        q = q.or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%`);
      }
      
      const { data, count, error } = await q.range(0, 49).order('name');
      
      if (error) {
        console.error('[useProductSearch] Supabase error:', error);
        throw error;
      }
      
      return { 
        data: (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.sku,
            unit_price: p.unit_price || p.price || 0,
            cost_price: p.cost_price || p.cost || 0,
            wholesale_price: p.wholesale_price_ttc || p.wholesale_price || 0,
            wholesale_price_ht: p.wholesale_price_ht || 0,
            wholesale_price_ttc: p.wholesale_price_ttc || 0,
            selling_price_2: p.selling_price_2 || 0,
            selling_price_3: p.selling_price_3 || 0,
            selling_price_4: p.selling_price_4 || 0,
            quantity: p.quantity || 0,
            min_quantity: p.min_quantity || 0,
            packaging: p.packaging || '1',
            unit_type: p.unit_type || 'Piece',
            category_id: p.category || p.category_id,
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
