import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Phone, MapPin, Navigation, CheckCircle2, Package, Truck, Map } from 'lucide-react';
import { OfflineIndicator } from '@/components/shared/OfflineIndicator';
import { DelivererBottomNavigation } from './BottomNavigation';
import { lazy, Suspense } from 'react';

// Dynamically import DeliveryMap to avoid SSR issues with Leaflet
const DeliveryMap = lazy(() => import('../Map/DeliveryMap').then(module => ({ default: module.DeliveryMap })));
import { OfflineManager } from '@/services/OfflineManager';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

// Local type for deliveries (simplified)
interface DeliveryData {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address: string;
  status: string;
  notes?: string;
  delivered_at?: string;
}

export function DelivererDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [deliveries, setDeliveries] = useState<DeliveryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('deliveries');
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

  const useLocalBridge = true;

  const localBridgeRequest = async <T,>(path: string, init: RequestInit = {}) => {
    if (!useLocalBridge) {
      throw new Error('LocalBridge mode is not enabled.');
    }
    const headers = await OfflineAuthService.getAuthHeaders();
    if (!headers) {
      throw new Error('LocalBridge session expired. Please sign in again.');
    }
    const response = await fetch(`${localBridgeBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...headers,
      },
    });
    let payload: any = null;
    if (response.status !== 204) {
      try {
        payload = await response.json();
      } catch (error) {
        // ignore
      }
    }
    if (!response.ok) {
      const message = payload?.message || 'LocalBridge request failed';
      throw new Error(message);
    }
    return payload as T;
  };

  useEffect(() => {
    console.log('DelivererDashboard: Component mounted', { user: user?.id });
    fetchDeliveries();
    setupRealtime();
    setupAutoSync();
  }, [user, useLocalBridge]);

  const setupAutoSync = () => {
    const syncHandlers = {
      delivery_update: async (data: any) => {
        await localBridgeRequest(`/rest/v1/deliveries/${data.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data.updates),
        });
        return true;
      },
    };
    OfflineManager.setupAutoSync(syncHandlers);
  };

  const setupRealtime = () => {
    // Realtime subscriptions removed (supabase client deleted).
    // Deliveries are refreshed via polling or manual refresh.
    return;
  };

  const fetchDeliveries = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      if (useLocalBridge) {
        const params = new URLSearchParams();
        params.set('deliverer_id', user.id);
        const data = await localBridgeRequest<DeliveryData[]>(`/rest/v1/deliveries?${params.toString()}`);
        setDeliveries(data || []);
        return;
      }

      // Non-local-bridge fallback removed; deliveries default to empty
      setDeliveries([]);
    } catch (error) {
      console.error('Unexpected error fetching deliveries:', error);
      toast({
        title: t('common.error'),
        description: t('deliverer.dashboard.errors.unexpected'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (deliveryId: string, newStatus: string) => {
    setUpdating(deliveryId);

    const updates: any = {
      status: newStatus,
    };

    if (newStatus === 'delivered') {
      updates.delivered_at = new Date().toISOString();
    }

    try {
      if (useLocalBridge) {
        await localBridgeRequest(`/rest/v1/deliveries/${deliveryId}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        toast({
          title: t('deliverer.dashboard.statusUpdated'),
          description: t('deliverer.dashboard.statusMarked', { status: t(`deliveries.${newStatus}`) }),
        });
        await fetchDeliveries();
      } else {
        // Queue for offline sync
        OfflineManager.addToQueue('delivery_update', {
          id: deliveryId,
          updates,
        });
        
        toast({
          title: t('deliverer.dashboard.queued'),
          description: t('deliverer.dashboard.queuedDescription'),
        });
        
        // Optimistically update local state
        setDeliveries(prev => prev.map(d => 
          d.id === deliveryId ? { ...d, ...updates } : d
        ));
      }
    } catch (error: any) {
      console.error('Error updating delivery status:', error);
      toast({
        title: t('common.error'),
        description: error?.message || t('deliverer.dashboard.errors.updateFailed'),
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const openNavigation = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  const handleLogout = async () => {
    await OfflineAuthService.signOut();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{t('deliverer.dashboard.loading')}</p>
      </div>
    );
  }

  const todayDeliveries = deliveries.filter(d => d.status !== 'delivered');
  const completedToday = deliveries.filter(d => {
    if (d.status !== 'delivered' || !d.delivered_at) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(d.delivered_at) >= today;
  });

  // Map for DeliveryMap component
  const deliveriesForMap = todayDeliveries.map(d => ({
    ...d,
    status: d.status as 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled',
    customer_name: d.customer_name || '',
    customer_phone: d.customer_phone || '',
    store_id: '',
    created_at: '',
    updated_at: '',
  }));

  return (
    <div className="min-h-screen bg-background pb-24 mobile-container">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('deliverer.dashboard.title')}</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              {t('auth.signOut')}
            </Button>
          </div>
          <div className="mt-4">
            <OfflineIndicator
              syncHandlers={{
                delivery_update: async (data: any) => {
                  await localBridgeRequest(`/rest/v1/deliveries/${data.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data.updates),
                  });
                  return true;
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Summary and Deliveries */}
      <div className="container mx-auto px-4 py-6 safe-area-bottom">
        <Tabs defaultValue="deliveries" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="deliveries">
              <Package className="h-4 w-4 mr-2" />
              {t('deliverer.dashboard.tabs.deliveries')}
            </TabsTrigger>
            <TabsTrigger value="map">
              <Map className="h-4 w-4 mr-2" />
              {t('deliverer.dashboard.tabs.map')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deliveries" className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Truck className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{todayDeliveries.length}</p>
                  <p className="text-sm text-muted-foreground">{t('deliverer.dashboard.active')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                  <p className="text-2xl font-bold">{completedToday.length}</p>
                  <p className="text-sm text-muted-foreground">{t('deliverer.dashboard.completedToday')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Deliveries List */}
            {todayDeliveries.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('deliverer.dashboard.noActive')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">{t('deliverer.dashboard.activeDeliveries')}</h2>
                {todayDeliveries.map(delivery => (
                  <Card key={delivery.id}>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-lg">{delivery.customer_name || 'Customer'}</p>
                          <Badge className="mt-1">
                            {t(`deliveries.${delivery.status}`)}
                          </Badge>
                        </div>
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={() => window.open(`tel:${delivery.customer_phone}`)}
                          className="min-h-[48px]"
                        >
                          <Phone className="h-5 w-5 mr-2" />
                          {t('deliverer.dashboard.call')}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                          <p className="text-sm">{delivery.delivery_address}</p>
                        </div>
                        {delivery.notes && (
                          <p className="text-sm text-muted-foreground border-l-2 pl-3">
                            {delivery.notes}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => openNavigation(delivery.delivery_address)}
                          size="lg"
                          className="min-h-[48px] text-base"
                        >
                          <Navigation className="h-5 w-5 mr-2" />
                          {t('deliverer.dashboard.navigate')}
                        </Button>
                        {delivery.status === 'assigned' && (
                          <Button
                            onClick={() => updateStatus(delivery.id, 'in_transit')}
                            disabled={updating === delivery.id}
                            size="lg"
                            className="min-h-[48px] text-base"
                          >
                            <Truck className="h-5 w-5 mr-2" />
                            {t('deliverer.dashboard.pickUp')}
                          </Button>
                        )}
                        {delivery.status === 'in_transit' && (
                          <Button
                            onClick={() => updateStatus(delivery.id, 'delivered')}
                            disabled={updating === delivery.id}
                            size="lg"
                            className="min-h-[48px] text-base"
                          >
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                            {t('deliverer.dashboard.complete')}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="space-y-6">
            <Suspense fallback={<div className="text-center py-12"><p className="text-muted-foreground">{t('deliverer.dashboard.loadingMap')}</p></div>}>
              <DeliveryMap 
                deliveries={deliveriesForMap}
              />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile Bottom Navigation */}
      <DelivererBottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
