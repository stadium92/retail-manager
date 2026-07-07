/**
 * OfflineStoreService - Handles store operations with offline support
 */

import { LocalDatabase, LocalStore } from './LocalDatabase';
import { Store } from '@/types';
import i18n from '@/i18n/config';
import { toast } from '@/hooks/use-toast';
import { storeSchema } from '@/schemas/validation';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';
import { supabase } from '@/lib/supabase';

type TimeoutResult<T> =
  | { timedOut: true; promise: Promise<T> }
  | { timedOut: false; value: T };

async function raceWithSoftTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<TimeoutResult<T>> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<{ __timeout: true }>((resolve) => {
    timeoutId = window.setTimeout(() => resolve({ __timeout: true }), timeoutMs);
  });

  const result = await Promise.race([promise, timeoutPromise]);
  if (timeoutId) window.clearTimeout(timeoutId);

  if ((result as any)?.__timeout) {
    return { timedOut: true, promise };
  }

  return { timedOut: false, value: result as T };
}

function mapLocalStoreToStore(s: LocalStore): Store {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    phone: s.phone,
    owner_id: undefined,
    default_price_tier: s.default_price_tier || 1,
    created_at: s.created_at,
    updated_at: s.updated_at,
  } as Store;
}

export class OfflineStoreService {
  /**
   * Create a store (works offline)
   */
  static async createStore(
    storeData: Omit<Store, 'id' | 'created_at' | 'updated_at'>
  ): Promise<{ data?: Store; error?: any }> {
    const isOnline = navigator.onLine;
    const dataClient = getDataClient();
    const storeId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Skip validation when offline to allow more flexible data entry
    if (isOnline) {
      const validationResult = storeSchema.safeParse(storeData);
      if (!validationResult.success) {
        return { error: { message: validationResult.error.errors[0].message } };
      }
    } else {
      // Basic validation for offline mode - just ensure name exists
      if (!storeData.name || storeData.name.trim().length === 0) {
        return { error: { message: 'Store name is required' } };
      }
    }

    try {
      await LocalDatabase.init();

      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { error: { message: 'LocalBridge session required.' } };
        }

        const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/stores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            name: storeData.name,
            address: storeData.address ?? null,
            phone: storeData.phone ?? null,
            default_price_tier: storeData.default_price_tier || 1,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          return { error: payload };
        }

        const createdAt = payload.created_at || now;
        const updatedAt = payload.updated_at || createdAt;
        const localStore: LocalStore = {
          id: payload.id,
          name: payload.name,
          address: payload.address || undefined,
          city: undefined,
          phone: payload.phone || undefined,
          email: undefined,
          default_price_tier: payload.default_price_tier || 1,
          is_active: true,
          created_at: createdAt,
          updated_at: updatedAt,
          synced: true,
        };
        await LocalDatabase.saveStore(localStore);

        toast({
          title: i18n.t('sync.storeCreated'),
          description: 'Store created in local backend.',
        });

        return {
          data: {
            id: localStore.id,
            name: localStore.name,
            address: localStore.address,
            phone: localStore.phone,
            owner_id: storeData.owner_id,
            created_at: localStore.created_at,
            updated_at: localStore.updated_at,
          } as Store,
        };
      }

      const localStore: LocalStore = {
        id: storeId,
        name: storeData.name,
        address: storeData.address,
        city: undefined,
        phone: storeData.phone,
        email: undefined,
        default_price_tier: storeData.default_price_tier || 1,
        is_active: true,
        created_at: now,
        updated_at: now,
        synced: false,
      };

      // Always save locally first
      await LocalDatabase.saveStore(localStore);

      if (!isOnline) {
        // Queue for later sync
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'store_create',
          data: localStore,
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: i18n.t('sync.storeCreatedOffline'),
          description: i18n.t('sync.willSyncWhenOnline'),
        });

        return {
          data: {
            id: localStore.id,
            name: localStore.name,
            address: localStore.address,
            phone: localStore.phone,
            owner_id: storeData.owner_id,
            created_at: now,
            updated_at: now,
          } as Store,
        };
      }

      // Online Direct Supabase insert when running in Pure Cloud Mode
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const ownerId = storeData.owner_id || user?.id;
        if (!ownerId) {
          throw new Error('No authenticated user found for store creation.');
        }

        const { error: supaErr } = await supabase
          .from('stores')
          .insert({
            id: storeId,
            name: storeData.name,
            address: storeData.address ?? null,
            phone: storeData.phone ?? null,
            owner_id: ownerId,
            default_price_tier: storeData.default_price_tier || 1,
            is_active: true,
            created_at: now,
            updated_at: now
          });
        
        if (supaErr) throw supaErr;

        // First ensure the user has a global master role (store_id IS NULL)
        // so that public.has_role(auth.uid(), 'master') evaluates to true for the RPC
        try {
          const { data: existingRoles } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', ownerId)
            .eq('role', 'master')
            .is('store_id', null);

          if (!existingRoles || existingRoles.length === 0) {
            console.log('[OfflineStoreService] Assigning global master role for first-time store creator:', ownerId);
            const { error: globalRoleErr } = await supabase
              .from('user_roles')
              .insert({
                user_id: ownerId,
                role: 'master',
                store_id: null
              });
            if (globalRoleErr) throw globalRoleErr;
          }
        } catch (roleErr) {
          console.warn('[OfflineStoreService] Failed to insert global master role:', roleErr);
        }

        // Associate user with the new store in user_roles via security definer RPC (bypasses RLS insertion block)
        const { error: roleErr } = await supabase
          .rpc('assign_role_manually', {
            _user_id: ownerId,
            _role: 'master',
            _store_id: storeId
          });

        if (roleErr) {
          console.warn('[OfflineStoreService] Failed to assign master role for store on Supabase:', roleErr);
        }
        
        // Update local status as synced
        localStore.synced = true;
        await LocalDatabase.saveStore(localStore);
      } catch (err) {
        console.error('[OfflineStoreService] Supabase insert failed:', err);
        // Queue for background retry
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'store_create',
          data: localStore,
          timestamp: Date.now(),
          retries: 0,
        });
      }

      toast({
        title: i18n.t('sync.storeCreated'),
        description: 'Store created successfully.',
      });

      return {
        data: {
          id: localStore.id,
          name: localStore.name,
          address: localStore.address,
          phone: localStore.phone,
          owner_id: storeData.owner_id,
          created_at: now,
          updated_at: now,
        } as Store,
      };
    } catch (error) {
      console.error('Create store error:', error);
      return { error: { message: 'Failed to create store' } };
    }
  }

  static async getStore(id: string): Promise<{ data?: Store; error?: any }> {
    try {
      await LocalDatabase.init();
      const localStore = await LocalDatabase.getStore(id);
      
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        if (!navigator.onLine && localStore) {
          return { data: mapLocalStoreToStore(localStore) };
        }
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/stores/${id}`, { headers });
          if (response.ok) {
            const data = await response.json();
            return { data: data as Store };
          }
        }
        if (localStore) return { data: mapLocalStoreToStore(localStore) };
        return { error: new Error('Store not found') };
      }

      if (localStore) {
        return { data: mapLocalStoreToStore(localStore) };
      }

      // Online direct fetch if running in cloud and not found in local cache
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (data && !error) {
          await LocalDatabase.saveStore({
            id: data.id,
            name: data.name,
            address: data.address || undefined,
            city: data.city || undefined,
            phone: data.phone || undefined,
            email: data.email || undefined,
            default_price_tier: data.default_price_tier || 1,
            is_active: data.is_active !== false,
            created_at: data.created_at,
            updated_at: data.updated_at,
            synced: true
          });
          return { data: data as Store };
        }
      }

      return { error: new Error('Store not found') };
    } catch (error) {
      console.error('getStore error:', error);
      return { error };
    }
  }

  /**
   * Get all stores (merges local and remote)
   */
  static async getStores(
    options?: { notify?: boolean; timeoutMs?: number }
  ): Promise<{ data?: Store[]; error?: any }> {
    try {
      await LocalDatabase.init();
      const localStores = await LocalDatabase.getAllStores();
      const localAsStores = localStores.map(mapLocalStoreToStore);

      const dataClient = getDataClient();
      
      // Pure Cloud mode online fetching
      if (!dataClient.isLocalFirst && navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('stores')
            .select('*')
            .order('name');
          
          if (error) throw error;
          
          if (data) {
            await this.cacheRemoteStores(data, localStores);
            return { data: data.map(s => ({
              id: s.id,
              name: s.name,
              address: s.address || undefined,
              phone: s.phone || undefined,
              owner_id: s.owner_id || undefined,
              default_price_tier: s.default_price_tier || 1,
              created_at: s.created_at,
              updated_at: s.updated_at,
            })) };
          }
        } catch (e) {
          console.warn('[OfflineStoreService] Failed to fetch stores from Supabase:', e);
        }
      }

      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { data: localAsStores };
        }
        const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/stores`, { headers });
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          return { data: localAsStores, error: payload };
        }

        await this.cacheRemoteStores(payload || [], localStores);
        const unsyncedLocalIds = new Set(localStores.filter((s) => !s.synced).map((s) => s.id));
        const mergedById = new Map<string, Store>();
        for (const s of localAsStores) mergedById.set(s.id, s);
        for (const s of payload || []) {
          if (!unsyncedLocalIds.has(s.id)) mergedById.set(s.id, s as Store);
        }

        const merged = Array.from(mergedById.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return { data: merged };
      }

      // Pure Cloud mode fallback: return local stores
      return { data: localAsStores };
    } catch (error) {
      console.error('Get stores error:', error);
      return { error };
    }
  }

  private static async cacheRemoteStores(remoteStores: any[], localStores: LocalStore[]) {
    for (const store of remoteStores || []) {
      const existingLocal = localStores.find((ls) => ls.id === store.id);
      // Never overwrite local unsynced edits
      if (existingLocal && !existingLocal.synced) continue;

      await LocalDatabase.saveStore({
        id: store.id,
        name: store.name,
        address: store.address || undefined,
        city: store.city || undefined,
        phone: store.phone || undefined,
        email: store.email || undefined,
        default_price_tier: store.default_price_tier || 1,
        is_active: store.is_active ?? true,
        created_at: store.created_at,
        updated_at: store.updated_at || store.created_at,
        synced: true,
      });
    }
  }

  /**
   * Update a store (works offline)
   */
  static async updateStore(
    id: string,
    updates: Partial<Store>
  ): Promise<{ data?: Store; error?: any }> {
    try {
      await LocalDatabase.init();
      const now = new Date().toISOString();
      const dataClient = getDataClient();

      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { error: { message: 'LocalBridge session required.' } };
        }

        const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/stores/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            name: updates.name,
            address: updates.address ?? null,
            phone: updates.phone ?? null,
            default_price_tier: updates.default_price_tier,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          return { error: payload };
        }

        const localStore: LocalStore = {
          id: payload.id,
          name: payload.name,
          address: payload.address || undefined,
          city: undefined,
          phone: payload.phone || undefined,
          email: undefined,
          default_price_tier: payload.default_price_tier || 1,
          is_active: true,
          created_at: payload.created_at || now,
          updated_at: payload.updated_at || now,
          synced: true,
        };
        await LocalDatabase.saveStore(localStore);

        return { data: payload as Store };
      }

      // Get existing local store or create from updates
      let localStore = await LocalDatabase.getStore(id);
      
      if (localStore) {
        localStore = {
          ...localStore,
          name: updates.name ?? localStore.name,
          address: updates.address ?? localStore.address,
          phone: updates.phone ?? localStore.phone,
          default_price_tier: updates.default_price_tier ?? localStore.default_price_tier,
          updated_at: now,
          synced: false,
        };
      } else {
        localStore = {
          id,
          name: updates.name || '',
          address: updates.address,
          city: undefined,
          phone: updates.phone,
          email: undefined,
          default_price_tier: updates.default_price_tier ?? 1,
          is_active: true,
          created_at: now,
          updated_at: now,
          synced: false,
        };
      }

      await LocalDatabase.saveStore(localStore);

      if (!navigator.onLine) {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'store_update',
          data: localStore,
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: i18n.t('sync.storeUpdatedOffline'),
          description: i18n.t('sync.willSyncWhenOnline'),
        });
      } else {
        // Direct online update
        try {
          const { error } = await supabase
            .from('stores')
            .update({
              name: localStore.name,
              address: localStore.address ?? null,
              phone: localStore.phone ?? null,
              default_price_tier: localStore.default_price_tier,
              updated_at: now
            })
            .eq('id', id);
          if (error) throw error;
          
          localStore.synced = true;
          await LocalDatabase.saveStore(localStore);
        } catch (err) {
          console.error('[OfflineStoreService] Supabase update failed:', err);
          await LocalDatabase.addToSyncQueue({
            id: crypto.randomUUID(),
            type: 'store_update',
            data: localStore,
            timestamp: Date.now(),
            retries: 0,
          });
        }
      }

      return { 
        data: {
          id: localStore.id,
          name: localStore.name,
          address: localStore.address,
          phone: localStore.phone,
          owner_id: undefined,
          default_price_tier: localStore.default_price_tier,
          created_at: localStore.created_at,
          updated_at: localStore.updated_at,
        } as Store 
      };
    } catch (error) {
      console.error('Update store error:', error);
      return { error: { message: 'Failed to update store' } };
    }
  }

  static async deleteStore(id: string): Promise<{ error?: any }> {
    try {
      await LocalDatabase.init();
      await LocalDatabase.deleteStore(id);

      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { error: { message: 'LocalBridge session required.' } };
        }
        const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/stores/${id}`, {
          method: 'DELETE',
          headers,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          return { error: payload };
        }
        return {};
      }

      return {};
    } catch (error) {
      return { error };
    }
  }
}
