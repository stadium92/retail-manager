import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Product } from '@/types';
import { supabase } from '@/lib/supabase';

interface SearchResult {
  data: Product[];
  total: number;
}

export function useProductSearch(storeId: string, enabled: boolean = true) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Listen for local DB updates to invalidate search cache
  useEffect(() => {
    const handleRefresh = (e: any) => {
      if (e.detail?.type === 'inventory' || e.detail?.type === 'product') {
        console.log('[useProductSearch] Invalidating products-search due to DB update');
        queryClient.invalidateQueries({ queryKey: ['products-search'] });
      }
    };
    window.addEventListener('localDbDataUpdated', handleRefresh);
    return () => window.removeEventListener('localDbDataUpdated', handleRefresh);
  }, [queryClient]);

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
      if (!storeId || !debouncedSearch || debouncedSearch.length < 2) {
        return { data: [], total: 0 };
      }

      console.log('[useProductSearch] Searching for:', debouncedSearch, 'in store:', storeId);

      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
      
      if (isLocalFirst) {
        try {
            const headers = await OfflineAuthService.getAuthHeaders();
            if (!headers) {
                console.warn('[useProductSearch] Not authenticated for local bridge');
                throw new Error('Not authenticated');
            }

            const params = new URLSearchParams({
              limit: '50',
            });

            // Always send store_id to prevent backend from defaulting to claims.store_id
            params.append('store_id', storeId || 'all');

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
        } catch (e) {
            console.warn('[useProductSearch] Bridge fetch failed, falling back to local DB', e);
            
            // OFFLINE WEB FALLBACK (IndexedDB)
            const { LocalDatabase } = await import('@/services/LocalDatabase');
            await LocalDatabase.init();
            let allItems = await LocalDatabase.getInventory(storeId && storeId !== 'all' ? storeId : undefined);

            if (debouncedSearch) {
                const lowerQ = debouncedSearch.toLowerCase();
                allItems = allItems.filter(p => 
                    (p.product_name && p.product_name.toLowerCase().includes(lowerQ)) ||
                    (p.sku && p.sku.toLowerCase().includes(lowerQ)) ||
                    (p.barcode && p.barcode.toLowerCase().includes(lowerQ))
                );
            }

            const total = allItems.length;
            const mappedData = allItems.slice(0, 50).map((p: any) => ({
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
                store_id: p.store_id
            }));

            return { data: mappedData, total };
        }
      }
      
      // Pure Cloud mode direct search fallback
      try {
        console.log('[useProductSearch] Cloud Supabase search for:', debouncedSearch);
        let query = supabase
          .from('products')
          .select('*');

        if (storeId && storeId !== 'all') {
          query = query.eq('store_id', storeId);
        }

        if (debouncedSearch) {
          query = query.ilike('name', `%${debouncedSearch}%`);
        }

        const { data, error } = await query.limit(50);
        if (error) throw error;

        const mappedData = (data || []).map((p: any) => ({
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

        return { data: mappedData, total: mappedData.length };
      } catch (e) {
        console.error('[useProductSearch] Cloud Supabase search failed:', e);
        return { data: [], total: 0 };
      }
    },
    enabled: enabled && !!storeId,
    staleTime: 0, // Always fetch fresh data
  });

  return {
    search,
    setSearch,
    results: query.data?.data || [],
    isLoading: query.isLoading || query.isFetching,
    total: query.data?.total || 0,
    refetch: () => query.refetch(),
  };
}
