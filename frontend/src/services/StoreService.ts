import { supabase } from '@/integrations/supabase/client';
import { Store } from '@/types';
import { storeSchema, storeUpdateSchema } from '@/schemas/validation';
import { OfflineStoreService } from './OfflineStoreService';

export class StoreService {
  static async getStores(): Promise<{ data?: Store[]; error?: any }> {
    // Use offline-capable service
    return OfflineStoreService.getStores();
  }

  static async getStore(id: string): Promise<{ data?: Store; error?: any }> {
    try {
      // Try local first
      const { LocalDatabase } = await import('./LocalDatabase');
      await LocalDatabase.init();
      const localStore = await LocalDatabase.getStore(id);
      
      if (!navigator.onLine && localStore) {
        return { 
          data: {
            id: localStore.id,
            name: localStore.name,
            address: localStore.address,
            phone: localStore.phone,
            owner_id: undefined,
            created_at: localStore.created_at,
            updated_at: localStore.updated_at,
          } as Store 
        };
      }

      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single();

      if (error && localStore) {
        return { 
          data: {
            id: localStore.id,
            name: localStore.name,
            address: localStore.address,
            phone: localStore.phone,
            owner_id: undefined,
            created_at: localStore.created_at,
            updated_at: localStore.updated_at,
          } as Store 
        };
      }

      return { data: data || undefined, error };
    } catch (error) {
      return { error };
    }
  }

  static async createStore(store: Omit<Store, 'id' | 'created_at' | 'updated_at'>): Promise<{ data?: Store; error?: any }> {
    // Use offline-capable service
    return OfflineStoreService.createStore(store);
  }

  static async updateStore(id: string, updates: Partial<Store>): Promise<{ data?: Store; error?: any }> {
    // Use offline-capable service
    return OfflineStoreService.updateStore(id, updates);
  }

  static async deleteStore(id: string): Promise<{ error?: any }> {
    return OfflineStoreService.deleteStore(id);
  }
}
