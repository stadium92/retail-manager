import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { Store } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Truck, Briefcase, FileText, WifiOff } from 'lucide-react';
import { FichiersClientsModule } from '@/components/worker/Modules/FichiersClientsModule';
import { FichiersFournisseursModule } from '@/components/worker/Modules/FichiersFournisseursModule';
import { FichiersServicesClientsModule } from '@/components/worker/Modules/FichiersServicesClientsModule';
import { FicheProduitsModule } from '@/components/worker/Modules/FicheProduitsModule';

export default function FilesPage() {
  const { t } = useTranslation();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('menu');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const loadStores = async () => {
      const { data } = await OfflineStoreService.getStores();
      setStores(data || []);
    };
    loadStores();
    
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const currentStoreId = selectedStore === 'all' ? stores[0]?.id : selectedStore;

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
      {isOffline && (
        <div className="flex items-center gap-2 p-3 bg-amber-100 text-amber-800 rounded-lg">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm">{t('common.offline')}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('menu.files.title') || 'Fichiers'}</h1>
          <p className="text-muted-foreground">{t('menu.files.subtitle') || 'Gestion des tiers'}</p>
        </div>
        <Select value={selectedStore} onValueChange={setSelectedStore}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('sidebar.stores')} />
          </SelectTrigger>
          <SelectContent>
            {stores.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!currentStoreId ? (
        <div className="p-8 text-center text-muted-foreground">
            {t('common.loading')}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
                <TabsTrigger value="menu" className="gap-2"><FileText className="h-4 w-4"/> Menu</TabsTrigger>
                <TabsTrigger value="clients" className="gap-2"><Users className="h-4 w-4"/> {t('menu.files.clients')}</TabsTrigger>
                <TabsTrigger value="suppliers" className="gap-2"><Truck className="h-4 w-4"/> {t('menu.files.suppliers')}</TabsTrigger>
                <TabsTrigger value="services" className="gap-2"><Briefcase className="h-4 w-4"/> {t('menu.files.clientServices')}</TabsTrigger>
            </TabsList>

            <TabsContent value="menu" className="h-[600px]">
                <Card className="h-full">
                    <CardContent className="p-0 h-full">
                        <FicheProduitsModule storeId={currentStoreId} />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="clients">
                <Card>
                    <CardContent className="p-0">
                        <FichiersClientsModule storeId={currentStoreId} />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="suppliers">
                <Card>
                    <CardContent className="p-0">
                        <FichiersFournisseursModule storeId={currentStoreId} />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="services">
                <Card>
                    <CardContent className="p-0">
                        <FichiersServicesClientsModule storeId={currentStoreId} />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      )}
    </div>
  );
}