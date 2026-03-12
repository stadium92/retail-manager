import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { Store } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getValidUUID } from '@/utils/devMode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Store as StoreIcon, WifiOff, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { useTranslation } from 'react-i18next';
import { useLicense } from '@/contexts/LicenseContext';

export default function StoresPage() {
  const { user } = useAuth();
  const { license } = useLicense();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    image_url: '',
    default_price_tier: '1',
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    setLoading(true);
    const { data, error } = await OfflineStoreService.getStores();
    if (error) {
      toast({
        title: t('common.error'),
        description: t('stores.errors.loadStores'),
        variant: 'destructive',
      });
    } else {
      setStores(data || []);
    }
    setLoading(false);
  };

      const handleOpenForm = (store?: Store) => {
        if (!store) {
          // Check license limit for new stores
          const isActivated = license?.status === 'active';
          if (!isActivated && stores.length >= 2) {
            toast({
              title: "License Limit Reached",
              description: "Trial version is limited to 2 stores. Please activate the application to add more.",
              variant: "destructive",
            });
            return;
          }
          setSelectedStore(null);
          setFormData({ name: '', address: '', phone: '', image_url: '', default_price_tier: '1' });
        } else {
          setSelectedStore(store);
          setFormData({
            name: store.name,
            address: store.address || '',
            phone: store.phone || '',
            image_url: (store as any).image_url || '',
            default_price_tier: (store.default_price_tier || 1).toString(),
          });
        }
        setFormOpen(true);
      };
  const handleCloseForm = () => {
    setFormOpen(false);
    setSelectedStore(null);
    setFormData({ name: '', address: '', phone: '', image_url: '', default_price_tier: '1' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Allow offline creation - use a temporary owner ID if user is not available
    const ownerId = user ? getValidUUID(user.id) : crypto.randomUUID();

    if (selectedStore) {
      // Update - Only send changed fields
      const updates: any = {};
      if (formData.name !== selectedStore.name) updates.name = formData.name;
      if (formData.address !== selectedStore.address) updates.address = formData.address;
      if (formData.phone !== selectedStore.phone) updates.phone = formData.phone;
      if (formData.image_url !== (selectedStore as any).image_url) updates.image_url = formData.image_url;
      if (parseInt(formData.default_price_tier) !== selectedStore.default_price_tier) updates.default_price_tier = parseInt(formData.default_price_tier);
      
      const { error } = await OfflineStoreService.updateStore(selectedStore.id, updates);
      if (error) {
        toast({
          title: t('common.error'),
          description: t('stores.errors.updateStore'),
          variant: 'destructive',
        });
      } else {
        toast({ title: t('common.success'), description: t('stores.success.updateStore') });
        loadStores();
        handleCloseForm();
      }
    } else {
      // Create - Use ownerId from above (handles offline and dev mode)
      console.log('🏪 Stores.tsx - Creating store with:', {
        'user.id (raw)': user?.id || 'offline',
        'owner_id (UUID)': ownerId,
        'isOnline': navigator.onLine,
      });
      
      const storeData: any = {
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        owner_id: ownerId,
        default_price_tier: parseInt(formData.default_price_tier) || 1,
      };
      
      // Only include image_url if it's not empty
      if (formData.image_url) {
        storeData.image_url = formData.image_url;
      }
      
      const { error } = await OfflineStoreService.createStore(storeData);
      if (error) {
        const errorMsg = error?.message || error?.details || t('stores.errors.createStore');
        console.error('🏪 Stores.tsx - Create failed:', error);
        toast({
          title: t('common.error'),
          description: `${errorMsg} (Code: ${error?.code || 'unknown'})`,
          variant: 'destructive',
        });
      } else {
        toast({ title: t('common.success'), description: t('stores.success.createStore') });
        loadStores();
        handleCloseForm();
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedStore) return;

    const { error } = await OfflineStoreService.deleteStore(selectedStore.id);
    if (error) {
      toast({
        title: t('common.error'),
        description: t('stores.errors.deleteStore'),
        variant: 'destructive',
      });
    } else {
      toast({ title: t('common.success'), description: t('stores.success.deleteStore') });
      loadStores();
    }
    setDeleteDialogOpen(false);
    setSelectedStore(null);
  };

  const openDeleteDialog = (store: Store) => {
    setSelectedStore(store);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
      {isOffline && (
        <div className="flex items-center gap-2 p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-lg">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm">{t('common.offlineMode') || 'Offline mode - showing cached data'}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('stores.title')}</h1>
          <p className="text-muted-foreground">{t('stores.manageStores')}</p>
        </div>
        <Button onClick={() => handleOpenForm()}>
          <Plus className="h-4 w-4 mr-2" />
          {t('stores.addStore')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StoreIcon className="h-5 w-5" />
            {t('stores.allStores')}
          </CardTitle>
          <CardDescription>
            {t('stores.totalStores', { count: stores.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <div className="text-center py-12">
              <StoreIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('stores.emptyState')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('stores.table.name')}</TableHead>
                    <TableHead>{t('stores.table.address')}</TableHead>
                    <TableHead>{t('stores.table.phone')}</TableHead>
                    <TableHead>{t('stores.defaultPrice')}</TableHead>
                    <TableHead className="text-right">{t('stores.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell 
                        className="font-medium cursor-pointer hover:underline"
                        onClick={() => navigate(`/master/stores/${store.id}`)}
                      >
                        {store.name}
                      </TableCell>
                      <TableCell>{store.address || '-'}</TableCell>
                      <TableCell>{store.phone || '-'}</TableCell>
                      <TableCell>Tier {store.default_price_tier || 1}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/master/stores/${store.id}`)}
                        >
                          {t('stores.view')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenForm(store)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(store)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedStore ? t('stores.dialog.editTitle') : t('stores.dialog.createTitle')}
            </DialogTitle>
            <DialogDescription>
              {selectedStore
                ? t('stores.dialog.editDescription')
                : t('stores.dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t('stores.fields.name')}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="default_price_tier">{t('stores.defaultPriceTier')}</Label>
                <Select 
                  value={formData.default_price_tier} 
                  onValueChange={(v) => setFormData({ ...formData, default_price_tier: v })}
                >
                  <SelectTrigger id="default_price_tier">
                    <SelectValue placeholder={t('stores.selectTier')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('stores.price1Detail')}</SelectItem>
                    <SelectItem value="2">{t('stores.price2Discount')}</SelectItem>
                    <SelectItem value="3">{t('stores.price3Bulk')}</SelectItem>
                    <SelectItem value="4">{t('stores.price4Resale')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('stores.fields.image')}</Label>
                <ImageUpload
                  currentImageUrl={formData.image_url}
                  onImageUploaded={(url) =>
                    setFormData({ ...formData, image_url: url })
                  }
                  onImageRemoved={() =>
                    setFormData({ ...formData, image_url: '' })
                  }
                  folder="stores"
                />
              </div>
              <div>
                <Label htmlFor="address">{t('stores.fields.address')}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="phone">{t('stores.fields.phone')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                {t('common.cancel')}
              </Button>
              <Button type="submit">
                {selectedStore ? t('common.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('stores.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('stores.deleteDescription', { name: selectedStore?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}