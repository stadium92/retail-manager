import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { Delivery, DeliveryStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useDeliveryRealtime(storeId?: string) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
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

    if (useLocalBridge) {
      return;
    }

    const channel = supabase
      .channel('deliveries-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: storeId ? `store_id=eq.${storeId}` : undefined,
        },
        (payload) => {
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, useLocalBridge]);

  const fetchDeliveries = async () => {
    try {
      if (useLocalBridge) {
        try {
          const params = new URLSearchParams();
          if (storeId) params.set('store_id', storeId);
          const data = await localBridgeRequest<Delivery[]>(
            `/rest/v1/deliveries?${params.toString()}`
          );
          setDeliveries(
            (data || []).map(d => ({
              ...d,
              status: d.status as DeliveryStatus,
            }))
          );
          return;
        } catch (error) {
          if (!navigator.onLine) {
            setDeliveries([]);
            return;
          }
          // Fall back to Supabase when online
        }
      }

      let query = supabase
        .from('deliveries')
        .select('*')
        .order('created_at', { ascending: false });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Map to ensure proper typing of status
      const typedDeliveries: Delivery[] = (data || []).map(d => ({
        ...d,
        status: d.status as DeliveryStatus,
      }));
      
      setDeliveries(typedDeliveries);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      if (!useLocalBridge) {
        toast({
          title: 'Error',
          description: 'Failed to load deliveries',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      const newDelivery: Delivery = {
        ...newRecord,
        status: newRecord.status as DeliveryStatus,
      };
      setDeliveries((prev) => [newDelivery, ...prev]);
      toast({
        title: 'New Delivery',
        description: `New delivery for ${newRecord.customer_name}`,
      });
    } else if (eventType === 'UPDATE') {
      const updatedDelivery: Delivery = {
        ...newRecord,
        status: newRecord.status as DeliveryStatus,
      };
      setDeliveries((prev) =>
        prev.map((d) => (d.id === newRecord.id ? updatedDelivery : d))
      );

      if (oldRecord.status !== newRecord.status) {
        const statusMessages: Record<string, string> = {
          assigned: 'Delivery assigned',
          in_transit: 'Delivery in transit',
          delivered: 'Delivery completed!',
          cancelled: 'Delivery cancelled',
        };

        toast({
          title: statusMessages[newRecord.status] || 'Delivery updated',
          description: `${newRecord.customer_name} - ${newRecord.delivery_address}`,
        });

        if (newRecord.status === 'delivered') {
          playNotificationSound();
        }
      }
    } else if (eventType === 'DELETE') {
      setDeliveries((prev) => prev.filter((d) => d.id !== oldRecord.id));
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuAze/bfjAFHm7A7+OZRAY' );
    audio.play().catch(() => {});
  };

  return { deliveries, loading, refetch: fetchDeliveries };
}
