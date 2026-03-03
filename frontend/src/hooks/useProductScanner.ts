import { useCallback, useState } from 'react';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Product } from '@/types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function useProductScanner(storeId: string) {
  const [isScanning, setIsScanning] = useState(false);
  const { t } = useTranslation();

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
            const results = Array.isArray(payload) ? payload : (payload.data || []);
            
            if (results.length === 0) return null;

            const normalizedCode = code.trim().toLowerCase();

            // Exact match check
            const exactMatch = results.find((p: any) => 
                (p.barcode && p.barcode.trim().toLowerCase() === normalizedCode) || 
                (p.sku && p.sku.trim().toLowerCase() === normalizedCode)
            );
            
            // Fallback to first result
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
                    wholesale_price_ht: Number(productData.wholesale_price_ht) || 0,
                    selling_price_2: Number(productData.selling_price_2) || 0,
                    selling_price_3: Number(productData.selling_price_3) || 0,
                    selling_price_4: Number(productData.selling_price_4) || 0,
                    cost_price: Number(productData.cost_price) || 0,
                    quantity: productData.quantity,
                    min_quantity: productData.min_quantity,
                    unit_type: productData.unit_type || 'Piece',
                    packaging: productData.packaging || '1',
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
      toast.error(t('scanner.scanError'));
    } finally {
      setIsScanning(false);
    }
    return null;
  }, [storeId, t]);

  return {
    scanProduct,
    isScanning
  };
}
