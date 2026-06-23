import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Truck, Phone, MapPin, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';

interface DeliveryData {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address: string;
  status: string;
  notes?: string;
  deliverer_id?: string;
}

export function DeliveryStatusView() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [deliveries, setDeliveries] = useState<DeliveryData[]>([]);
  const [loading, setLoading] = useState(true);
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

  const useLocalBridge = isLocalFirst;

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
    fetchDeliveries();
  }, [user, useLocalBridge]);

  const fetchDeliveries = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      if (useLocalBridge) {
        const params = new URLSearchParams();
        const storeId = user?.user_metadata?.store_id;
        if (storeId) {
          params.set('store_id', storeId);
        } else {
          return;
        }
        const data = await localBridgeRequest<DeliveryData[]>(`/rest/v1/deliveries?${params.toString()}`);
        setDeliveries(data || []);
        return;
      }

      // Non-local-bridge fallback: no remote client available
      console.log('Deliveries: local bridge not enabled, skipping fetch');
      setDeliveries([]);
    } catch (error) {
      console.error('Unexpected error fetching deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      pending: 'secondary',
      assigned: 'default',
      in_transit: 'default',
      delivered: 'default',
      cancelled: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const filterByStatus = (status?: string) => {
    if (!status) return deliveries;
    return deliveries.filter(d => d.status === status);
  };

  const renderDeliveryCard = (delivery: DeliveryData) => (
    <Card key={delivery.id}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-medium">{delivery.customer_name || 'Customer'}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {delivery.customer_phone || 'No phone'}
              </p>
            </div>
            {getStatusBadge(delivery.status)}
          </div>

          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>{delivery.delivery_address}</span>
            </p>

            {delivery.deliverer_id && (
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Deliverer assigned</span>
                </div>
              </div>
            )}

            {!delivery.deliverer_id && delivery.status === 'pending' && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs pt-2 border-t">
                <Clock className="h-3 w-3" />
                <span>{t('worker.deliveries.awaitingAssignment')}</span>
              </div>
            )}
          </div>

          {delivery.notes && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              {t('worker.deliveries.note')}: {delivery.notes}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('worker.deliveries.loading')}
      </div>
    );
  }

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('worker.deliveries.noDeliveries')}
      </div>
    );
  }

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="all">{t('worker.deliveries.all')}</TabsTrigger>
        <TabsTrigger value="pending">{t('worker.deliveries.pending')}</TabsTrigger>
        <TabsTrigger value="in_transit">{t('worker.deliveries.inTransit')}</TabsTrigger>
        <TabsTrigger value="delivered">{t('worker.deliveries.delivered')}</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="space-y-3 mt-4">
        {deliveries.map(renderDeliveryCard)}
      </TabsContent>

      <TabsContent value="pending" className="space-y-3 mt-4">
        {filterByStatus('pending').map(renderDeliveryCard)}
      </TabsContent>

      <TabsContent value="in_transit" className="space-y-3 mt-4">
        {filterByStatus('in_transit').map(renderDeliveryCard)}
      </TabsContent>

      <TabsContent value="delivered" className="space-y-3 mt-4">
        {filterByStatus('delivered').map(renderDeliveryCard)}
      </TabsContent>
    </Tabs>
  );
}
