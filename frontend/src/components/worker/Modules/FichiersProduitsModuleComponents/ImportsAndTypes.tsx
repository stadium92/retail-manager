import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ExportService } from '@/services/ExportService';
import { Search, Plus, Edit2, Trash2, Package, Barcode, Minus, ChevronDown, ChevronRight, RefreshCw, X, Download, ReceiptText, Coins, ChefHat, Sliders, Image as ImageIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getDataClient } from '@/lib/dataClient';
import { useMasterDataStore, ProductMaster } from '@/stores/useMasterDataStore';
import { toast } from '@/hooks/use-toast';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useTranslation } from 'react-i18next';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { cn } from '@/lib/utils';
import { ProductLookupDialog } from '../Sales/ProductLookupDialog';
import { MasterPasswordGate } from '@/components/shared/MasterPasswordGate';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecipeBuilder } from '@/components/recipe/RecipeBuilder';

interface FichiersProduitsModuleProps {
  storeId: string;
  isMasterView?: boolean;
}

export function FichiersProduitsModule({ storeId, isMasterView }: FichiersProduitsModuleProps) {
  const { t } = useTranslation();
  const { families, setFamilies, setSuppliers, setLoading, deleteProduct } = useMasterDataStore();
  const [localProducts, setLocalProducts] = useState<ProductMaster[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [lookupTargetIndex, setLookupTargetIndex] = useState<number | null>(null);
  
  const [recipeItems, setRecipeItems] = useState<{ ingredient_id: string; quantity_needed: number; unit: string }[]>([]);
  const [recipeCost, setRecipeCost] = useState(0);
  
  const [editingProduct, setEditingProduct] = useState<ProductMaster | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'single' | 'multi'>('single');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [multiAdvancedOpen, setMultiAdvancedOpen] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'informations' | 'prix' | 'logistique' | 'composition' | 'options'>('informations');

  const initialFormState = {
    name: '', sku: '', barcode: '', description: '',
    purchase_price: 0 as number | string, 
    selling_price_detail: 0 as number | string, 
    selling_price_2: 0 as number | string,
    selling_price_3: 0 as number | string,
    selling_price_4: 0 as number | string,
    selling_price_wholesale: 0 as number | string,
    selling_price_ht: 0 as number | string, 
    selling_price_ttc: 0 as number | string, 
    quantity: 0 as number | string,
    min_stock_alert: 10 as number | string,
    unit_type: 'Pièce', family_id: '', brand: '', aisle: '', preferred_supplier_id: '',
    packaging: '1', reorder_quantity: 0 as number | string, expiry_date: '', image_url: '',
    prep_time_minutes: 0 as number | string,
    is_available: true as boolean,
    allergens: '' as string,
    course_type: 'Main' as string,
    modifiers: '' as string,
  };

  const [formData, setFormData] = useState(initialFormState);


  const [multiItems, setMultiItems] = useState<Array<typeof initialFormState & { id: string; isOpen: boolean }>>([]);

  const fetchData = useCallback(async () => {
    console.log('[FichiersProduits] Fetching data for store:', storeId);
    setLoading(true);
    try {
      const [inventoryRes, familiesRes] = await Promise.all([
        OfflineInventoryService.getInventory(storeId, { notify: false }),
        OfflineInventoryService.getProductFamilies(storeId)
      ]);
      
      console.log('[FichiersProduits] Inventory response:', inventoryRes.data?.length || 0, 'items');

      if (inventoryRes.data) {
        const mapped = inventoryRes.data.map(item => ({
          ...item,
          purchase_price: Number(item.cost || (item as any).cost_price || 0),
          selling_price_detail: Number(item.price || (item as any).unit_price || 0),
          current_stock: Number(item.quantity ?? (item as any).stock ?? (item as any).current_stock ?? 0),
          min_stock_alert: Number(item.low_stock_threshold ?? (item as any).min_quantity ?? 0),
          unit_type: item.unit_type || 'Pièce',
          family_id: item.category_id || (item as any).category || (item as any).family_id,
          brand: item.brand || '',
          packaging: item.packaging || '1',
          aisle: item.aisle || '',
          expiry_date: item.expiry_date,
          store_id: item.store_id,
          image_url: item.image_url,
          prep_time_minutes: Number((item as any).prep_time_minutes || 0),
          is_available: (item as any).is_available !== false && (item as any).is_available !== 0,
          allergens: (item as any).allergens || [],
          course_type: (item as any).course_type || '',
          modifiers: (item as any).modifiers || [],
          created_at: item.created_at,
          updated_at: item.updated_at,
        } as unknown as ProductMaster));
        setLocalProducts(mapped);
      }
      if (familiesRes.data) {
        console.log('[FichiersProduits] Families fetched:', familiesRes.data.length);
        setFamilies(familiesRes.data as any);
      }
    } catch (err) {
      console.error('[FichiersProduits] Fetch error:', err);
      toast({ title: t('common.error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [storeId, t, setFamilies, setLoading]);

  useEffect(() => {
    