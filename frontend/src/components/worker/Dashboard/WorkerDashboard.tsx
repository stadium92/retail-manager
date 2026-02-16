import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TodaySummary } from './TodaySummary';
import { SalesEntryForm } from '../Sales/SalesEntryForm';
import { InventoryQuickView } from '../Inventory/InventoryQuickView';
import { DeliveryStatusView } from '../Deliveries/DeliveryStatusView';
import { OfflineIndicator } from '@/components/shared/OfflineIndicator';
import { WorkerBottomNavigation } from './BottomNavigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ShoppingCart, Truck } from 'lucide-react';
import { OfflineManager } from '@/services/OfflineManager';
import { SalesService } from '@/services/SalesService';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';

export function WorkerDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('sales');

  useEffect(() => {
    console.log('WorkerDashboard: Component mounted', { user: user?.id });
    
    // Setup auto-sync for offline transactions
    const syncHandlers = {
      sale: async (data: {
        store_id: string;
        worker_id: string;
        total_price: number;
        sale_type: 'detail' | 'gros' | 'proforma';
        payment_method?: 'cash' | 'card' | 'credit';
        customer_name?: string;
        customer_phone?: string;
      }) => {
        const result = await SalesService.createSale({ ...data, sale_type: data.sale_type || 'detail' });
        return !result.error;
      },
    };
    OfflineManager.setupAutoSync(syncHandlers);
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-background mobile-container">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('worker.dashboard.title')}</h1>
              <p className="text-sm text-muted-foreground">
                {user?.email}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              {t('auth.signOut')}
            </Button>
          </div>
          <div className="mt-4">
            <OfflineIndicator
              syncHandlers={{
                sale: async (data: {
                  store_id: string;
                  worker_id: string;
                  total_price: number;
                  sale_type: 'detail' | 'gros' | 'proforma';
                  payment_method?: 'cash' | 'card' | 'credit';
                  customer_name?: string;
                  customer_phone?: string;
                }) => {
                  const result = await SalesService.createSale({ ...data, sale_type: data.sale_type || 'detail' });
                  return !result.error;
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-24 safe-area-bottom">
        <TodaySummary />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">{t('worker.dashboard.tabs.sales')}</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">{t('worker.dashboard.tabs.inventory')}</span>
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">{t('worker.dashboard.tabs.deliveries')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-6">
            <SalesEntryForm />
          </TabsContent>

          <TabsContent value="inventory" className="mt-6">
            <InventoryQuickView />
          </TabsContent>

          <TabsContent value="deliveries" className="mt-6">
            <DeliveryStatusView />
          </TabsContent>
        </Tabs>
      </main>

      {/* Mobile Bottom Navigation */}
      <WorkerBottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
