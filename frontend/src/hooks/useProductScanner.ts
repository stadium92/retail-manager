import { useCallback, useState } from 'react';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Product } from '@/types';
import { toast } from 'sonner';

export function useProductScanner(storeId: string) {
  const [isScanning, setIsScanning] = useState(false);

  const scanProduct = useCallback(async (code: string): Promise<Product | null> => {
    if (!storeId || !code) return null;
    
    setIsScanning(true);
    try {
      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
      
      if (isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) return null;

        const params = new URLSearchParams({
          store_id: storeId,
          search: code, // Re-using search endpoint which checks sku/barcode
          limit: '1'
        });

        const response = await fetch(`${localBridgeBaseUrl}/rest/v1/products?${params.toString()}`, {
            headers
        });

        if (response.ok) {
            const payload = await response.json();
            const results = Array.isArray(payload) ? payload : payload.data;
            
            // Exact match check (since search is fuzzy)
            const exactMatch = results.find((p: any) => 
                p.barcode?.toLowerCase() === code.toLowerCase() || 
                p.sku?.toLowerCase() === code.toLowerCase()
            );
            
            // Fallback to first result if it's a very strong match or if user accepts fuzzy
            const productData = exactMatch || results[0];

            if (productData) {
                 return {
                    id: productData.id,
                    store_id: productData.store_id,
                    name: productData.name,
                    description: productData.description,
                    sku: productData.sku,
                    barcode: productData.barcode,
                    category: productData.category,
                    unit_price: Number(productData.unit_price) || 0,
                    wholesale_price: Number(productData.wholesale_price) || Number(productData.unit_price) || 0,
                    cost_price: Number(productData.cost_price) || 0,
                    quantity: productData.quantity,
                    min_quantity: productData.min_quantity,
                    image_url: productData.image_url,
                    is_active: true,
                    created_at: productData.created_at,
                    updated_at: productData.updated_at,
                };
            }
        }
      } else {
        // TODO: Implement Supabase online scan
        console.warn("Online scan not implemented yet");
      }
    } catch (error) {
      console.error("Scan error:", error);
      toast.error("Erreur lors du scan");
    } finally {
      setIsScanning(false);
    }
    return null;
  }, [storeId]);

  return {
    scanProduct,
    isScanning
  };
}
