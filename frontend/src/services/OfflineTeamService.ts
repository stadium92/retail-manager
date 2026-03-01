/**
 * OfflineTeamService - Handles team/worker operations with offline support
 */

import { LocalDatabase, LocalUser, LocalRole } from './LocalDatabase';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/types';
import { toast } from '@/hooks/use-toast';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';
import { SupabaseProvisioningService } from './SupabaseProvisioningService';
import i18n from '@/i18n/config';

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: AppRole;
  store_id?: string;
  store_name?: string;
  vehicle_type?: string;
  is_active: boolean;
  created_at: string;
  sales_count?: number;
  total_revenue?: number;
  deliveries_completed?: number;
  deliveries_total?: number;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'worker' | 'deliverer';
  store_id?: string;
  store_name?: string;
  vehicle_type?: string;
}

export class OfflineTeamService {
  /**
   * Create a worker/deliverer (works offline)
   */
  static async createUser(
    payload: CreateUserPayload
  ): Promise<{ data?: any; error?: any }> {
    const dataClient = getDataClient();
    if (dataClient.isLocalFirst) {
      return this.createUserViaLocalBridge(payload);
    }

    const isOnline = navigator.onLine;
    const userId = crypto.randomUUID();
    const roleId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      await LocalDatabase.init();

      // Create local user
      const localUser: LocalUser = {
        id: userId,
        email: payload.email,
        password_hash: LocalDatabase.hashPassword(payload.password),
        full_name: payload.full_name,
        phone: payload.phone,
        created_at: now,
        updated_at: now,
        synced: false,
        is_active: true,
      };

      await LocalDatabase.saveUser(localUser);

      // Create local role
      const localRole: LocalRole = {
        id: roleId,
        user_id: userId,
        role: payload.role as 'master' | 'worker' | 'deliverer',
        store_id: payload.store_id,
        created_at: now,
        synced: false,
      };

      await LocalDatabase.saveRole(localRole);

      if (!isOnline) {
        // Queue for later sync
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'user_create',
          data: {
            email: payload.email,
            password: payload.password,
            fullName: payload.full_name,
            phone: payload.phone,
            role: payload.role,
            storeId: payload.store_id,
            vehicleType: payload.vehicle_type,
            localUserId: userId,
            localRoleId: roleId,
          },
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: payload.role === 'worker' ? i18n.t('sync.workerCreatedOffline') : i18n.t('sync.delivererCreatedOffline'),
          description: i18n.t('sync.willSyncWhenOnline'),
        });

        return {
          data: {
            success: true,
            user: {
              id: userId,
              email: payload.email,
              full_name: payload.full_name,
              role: payload.role,
              store_id: payload.store_id,
            },
          },
        };
      }

      // Try to sync immediately if online
      const provisionResult = await SupabaseProvisioningService.provisionUser({
        email: payload.email,
        password: payload.password,
        full_name: payload.full_name,
        phone: payload.phone,
        role: payload.role,
        store_id: payload.store_id,
        vehicle_type: payload.vehicle_type,
      });

      if (!provisionResult.success) {
        // Queue for later sync
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'user_create',
          data: {
            email: payload.email,
            password: payload.password,
            fullName: payload.full_name,
            phone: payload.phone,
            role: payload.role,
            storeId: payload.store_id,
            vehicleType: payload.vehicle_type,
            localUserId: userId,
            localRoleId: roleId,
          },
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: payload.role === 'worker' ? i18n.t('sync.workerCreatedLocally') : i18n.t('sync.delivererCreatedLocally'),
          description: i18n.t('sync.serverSyncFailed'),
          variant: 'destructive',
        });

        return {
          data: {
            success: true,
            user: {
              id: userId,
              email: payload.email,
              full_name: payload.full_name,
              role: payload.role,
              store_id: payload.store_id,
            },
          },
        };
      }

      // Mark as synced
      localUser.synced = true;
      localRole.synced = true;
      await LocalDatabase.saveUser(localUser);
      await LocalDatabase.saveRole(localRole);

      toast({
        title: payload.role === 'worker' ? i18n.t('sync.workerCreated') : i18n.t('sync.delivererCreated'),
        description: i18n.t('sync.createdAndSynced'),
      });

      return { data: { success: true, user: { id: provisionResult.userId || userId } } };
    } catch (error) {
      console.error('Create user error:', error);
      return { error: { message: 'Failed to create user' } };
    }
  }

  /**
   * Get all users (for name mapping)
   */
  static async getAllUsers(): Promise<{ data?: TeamMember[]; error?: any }> {
    const dataClient = getDataClient();
    if (dataClient.isLocalFirst) {
      try {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/users`, { headers });
          if (response.ok) {
            const users = await response.json();
            return {
              data: users.map((u: any) => ({
                id: u.id, // User ID
                user_id: u.id, // Same
                email: u.email,
                full_name: u.full_name,
                role: 'worker', // Dummy role, we just need names
                is_active: true,
                created_at: u.created_at
              }))
            };
          }
        }
      } catch (e) {
        console.error('Failed to fetch all users:', e);
      }
    }
    return { data: [] };
  }

  /**
   * Get all workers (merges local and remote)
   */
  static async getWorkers(): Promise<{ data?: TeamMember[]; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        return this.getWorkersViaLocalBridge();
      }

      await LocalDatabase.init();

      // Get local users and roles
      const localUsers = await LocalDatabase.getAllUsers();
      const localRoles = await LocalDatabase.getAllRoles();
      const localStores = await LocalDatabase.getAllStores();

      // Filter to workers only
      const workerRoles = localRoles.filter(r => r.role === 'worker');

      const localWorkers: TeamMember[] = workerRoles
        .filter(role => !role.synced) // Only include unsynced local workers
        .map(role => {
          const user = localUsers.find(u => u.id === role.user_id);
          const store = role.store_id ? localStores.find(s => s.id === role.store_id) : undefined;

          return {
            id: role.id,
            user_id: role.user_id,
            email: user?.email || '',
            full_name: user?.full_name || 'Unknown',
            phone: user?.phone,
            role: 'worker' as AppRole,
            store_id: role.store_id,
            store_name: store?.name,
            is_active: true,
            created_at: role.created_at,
            sales_count: 0,
            total_revenue: 0,
          };
        });

      if (!navigator.onLine) {
        // Also include synced workers from local cache
        const syncedWorkers: TeamMember[] = workerRoles
          .filter(role => role.synced)
          .map(role => {
            const user = localUsers.find(u => u.id === role.user_id);
            const store = role.store_id ? localStores.find(s => s.id === role.store_id) : undefined;

            return {
              id: role.id,
              user_id: role.user_id,
              email: user?.email || '',
              full_name: user?.full_name || 'Unknown',
              phone: user?.phone,
              role: 'worker' as AppRole,
              store_id: role.store_id,
              store_name: store?.name,
              is_active: true,
              created_at: role.created_at,
              sales_count: 0,
              total_revenue: 0,
            };
          });

        return { data: [...localWorkers, ...syncedWorkers] };
      }

      // Fetch from server
      const { data: remoteWorkerRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'worker');

      if (rolesError) {
        console.error('Failed to fetch remote workers:', rolesError);
        return { data: localWorkers };
      }

      if (!remoteWorkerRoles || remoteWorkerRoles.length === 0) {
        return { data: localWorkers };
      }

      const userIds = remoteWorkerRoles.map(r => r.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      // Get stores
      const storeIds = remoteWorkerRoles.filter(r => r.store_id).map(r => r.store_id!);
      let storesMap: Record<string, string> = {};

      if (storeIds.length > 0) {
        const { data: stores } = await supabase
          .from('stores')
          .select('id, name')
          .in('id', storeIds);

        if (stores) {
          storesMap = stores.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {});
        }
      }

      // Get sales data
      const { data: sales } = await supabase
        .from('sales')
        .select('worker_id, total_price')
        .in('worker_id', userIds);

      const salesByWorker = (sales || []).reduce((acc, sale) => {
        const workerId = sale.worker_id;
        if (!workerId) return acc;
        if (!acc[workerId]) {
          acc[workerId] = { count: 0, total: 0 };
        }
        acc[workerId].count++;
        acc[workerId].total += sale.total_price || 0;
        return acc;
      }, {} as Record<string, { count: number; total: number }>);

      // Cache remote data locally
      for (const role of remoteWorkerRoles) {
        const profile = profiles?.find(p => p.id === role.user_id);
        if (profile) {
          // Check if user exists locally to preserve password hash
          const existingUser = await LocalDatabase.getUser(profile.id);

          await LocalDatabase.saveUser({
            id: profile.id,
            email: profile.email || '',
            password_hash: existingUser?.password_hash || '',
            full_name: profile.full_name || '',
            phone: profile.phone,
            created_at: profile.created_at || new Date().toISOString(),
            updated_at: profile.updated_at || new Date().toISOString(),
            synced: true,
            is_active: true // Remote users default to true unless we fetch status from profile
          });
        }
        await LocalDatabase.saveRole({
          id: role.id,
          user_id: role.user_id,
          role: 'worker',
          store_id: role.store_id || undefined,
          created_at: role.created_at,
          synced: true,
        });
      }

      // Build remote workers list
      const remoteWorkers: TeamMember[] = remoteWorkerRoles.map(role => {
        const profile = profiles?.find(p => p.id === role.user_id);
        const salesData = salesByWorker[role.user_id] || { count: 0, total: 0 };
        // Ideally we fetch is_active from profile if it exists on remote
        // For now we assume active if they exist remotely
        const user = localUsers.find(u => u.id === role.user_id);

        return {
          id: role.id,
          user_id: role.user_id,
          email: profile?.email || '',
          full_name: profile?.full_name || 'Unknown',
          phone: profile?.phone,
          role: 'worker' as AppRole,
          store_id: role.store_id || undefined,
          store_name: role.store_id ? storesMap[role.store_id] : undefined,
          is_active: user ? user.is_active : true,
          created_at: role.created_at,
          sales_count: salesData.count,
          total_revenue: salesData.total,
        };
      });

      // Merge: unsynced local + remote
      const remoteIds = new Set(remoteWorkers.map(w => w.id));
      const merged = [
        ...localWorkers.filter(w => !remoteIds.has(w.id)),
        ...remoteWorkers,
      ];

      return { data: merged };
    } catch (error) {
      console.error('Get workers error:', error);
      return { error };
    }
  }

  /**
   * Update a user's active status
   */
  static async updateUserStatus(userId: string, isActive: boolean): Promise<{ success: boolean; error?: any }> {
    try {
      await LocalDatabase.init();
      const user = await LocalDatabase.getUser(userId);

      if (!user) {
        return { success: false, error: { message: 'User not found locally' } };
      }

      // Update local immediately
      user.is_active = isActive;
      user.synced = false; // Mark needs sync
      await LocalDatabase.saveUser(user);

      if (!navigator.onLine) {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'user_update',
          data: { id: userId, is_active: isActive },
          timestamp: Date.now(),
          retries: 0
        });

        toast({
          title: isActive ? i18n.t('sync.accountEnabledOffline') : i18n.t('sync.accountDisabledOffline'),
          description: i18n.t('sync.changeWillSync')
        });
        return { success: true };
      }

      // Sync specific status update if online
      // Since we don't have a direct "update status" API yet on Supabase schemas in this conversation,
      // we'll primarily rely on the LocalBridge/Queue sync or a specific edge function if needed.
      // For now, we queue it to ensure it hits our sync logic.

      await LocalDatabase.addToSyncQueue({
        id: crypto.randomUUID(),
        type: 'user_update',
        data: { id: userId, is_active: isActive },
        timestamp: Date.now(),
        retries: 0
      });

      // Trigger standard sync logic if we had a dedicated "SyncService" call here
      // But adding to queue + local update is sufficient for "Local First" pattern

      toast({
        title: isActive ? i18n.t('sync.accountEnabled') : i18n.t('sync.accountDisabled'),
        description: i18n.t('sync.userStatusUpdated'),
      });

      return { success: true };

    } catch (error) {
      console.error('Error updating user status:', error);
      return { success: false, error };
    }
  }

  /**
   * Get all deliverers (merges local and remote)
   */
  static async getDeliverers(): Promise<{ data?: TeamMember[]; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        return this.getDeliverersViaLocalBridge();
      }

      await LocalDatabase.init();

      const localUsers = await LocalDatabase.getAllUsers();
      const localRoles = await LocalDatabase.getAllRoles();

      const delivererRoles = localRoles.filter(r => r.role === 'deliverer');

      const localDeliverers: TeamMember[] = delivererRoles
        .filter(role => !role.synced)
        .map(role => {
          const user = localUsers.find(u => u.id === role.user_id);

          return {
            id: role.id,
            user_id: role.user_id,
            email: user?.email || '',
            full_name: user?.full_name || 'Unknown',
            phone: user?.phone,
            role: 'deliverer' as AppRole,
            store_id: role.store_id,
            is_active: true,
            created_at: role.created_at,
            deliveries_total: 0,
            deliveries_completed: 0,
          };
        });

      if (!navigator.onLine) {
        const syncedDeliverers: TeamMember[] = delivererRoles
          .filter(role => role.synced)
          .map(role => {
            const user = localUsers.find(u => u.id === role.user_id);

            return {
              id: role.id,
              user_id: role.user_id,
              email: user?.email || '',
              full_name: user?.full_name || 'Unknown',
              phone: user?.phone,
              role: 'deliverer' as AppRole,
              store_id: role.store_id,
              is_active: true,
              created_at: role.created_at,
              deliveries_total: 0,
              deliveries_completed: 0,
            };
          });

        return { data: [...localDeliverers, ...syncedDeliverers] };
      }

      // Fetch from server (similar pattern as getWorkers)
      const { data: remoteDelivererRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'deliverer');

      if (rolesError) {
        return { data: localDeliverers };
      }

      if (!remoteDelivererRoles || remoteDelivererRoles.length === 0) {
        return { data: localDeliverers };
      }

      const userIds = remoteDelivererRoles.map(r => r.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('deliverer_id, status');

      const deliveriesByUser = (deliveries || []).reduce((acc, d) => {
        const delivererId = d.deliverer_id;
        if (!delivererId) return acc;
        if (!acc[delivererId]) {
          acc[delivererId] = { total: 0, completed: 0 };
        }
        acc[delivererId].total++;
        if (d.status === 'delivered') {
          acc[delivererId].completed++;
        }
        return acc;
      }, {} as Record<string, { total: number; completed: number }>);

      // Cache locally
      for (const role of remoteDelivererRoles) {
        const profile = profiles?.find(p => p.id === role.user_id);
        if (profile) {
          // Check if user exists locally to preserve password hash
          const existingUser = await LocalDatabase.getUser(profile.id);

          await LocalDatabase.saveUser({
            id: profile.id,
            email: profile.email || '',
            password_hash: existingUser?.password_hash || '',
            full_name: profile.full_name || '',
            phone: profile.phone,
            created_at: profile.created_at || new Date().toISOString(),
            updated_at: profile.updated_at || new Date().toISOString(),
            synced: true,
            is_active: true,
          });
        }
        await LocalDatabase.saveRole({
          id: role.id,
          user_id: role.user_id,
          role: 'deliverer',
          store_id: role.store_id || undefined,
          created_at: role.created_at,
          synced: true,
        });
      }

      const remoteDeliverers: TeamMember[] = remoteDelivererRoles.map(role => {
        const profile = profiles?.find(p => p.id === role.user_id);
        const deliveryData = deliveriesByUser[role.user_id] || { total: 0, completed: 0 };

        return {
          id: role.id,
          user_id: role.user_id,
          email: profile?.email || '',
          full_name: profile?.full_name || 'Unknown',
          phone: profile?.phone,
          role: 'deliverer' as AppRole,
          store_id: role.store_id || undefined,
          is_active: true,
          created_at: role.created_at,
          deliveries_total: deliveryData.total,
          deliveries_completed: deliveryData.completed,
        };
      });

      const remoteIds = new Set(remoteDeliverers.map(d => d.id));
      const merged = [
        ...localDeliverers.filter(d => !remoteIds.has(d.id)),
        ...remoteDeliverers,
      ];

      return { data: merged };
    } catch (error) {
      console.error('Get deliverers error:', error);
      return { error };
    }
  }

  private static async getDeliverersViaLocalBridge(): Promise<{ data?: TeamMember[]; error?: any }> {
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) {
        return { error: { message: 'LocalBridge session expired. Please sign in again.' } };
      }

      const baseUrl = getDataClient().localBridgeBaseUrl;
      const [rolesRes, usersRes, statsRes] = await Promise.all([
        smartFetch(`${baseUrl}/rest/v1/user_roles?role=deliverer`, { headers }),
        smartFetch(`${baseUrl}/rest/v1/users`, { headers }),
        smartFetch(`${baseUrl}/rest/v1/deliverer_stats`, { headers }),
      ]);

      const roles = rolesRes.ok ? await rolesRes.json() : null;
      const users = usersRes.ok ? await usersRes.json() : null;
      const stats = statsRes.ok ? await statsRes.json() : {};

      if (!rolesRes.ok || !usersRes.ok || !statsRes.ok) {
        const message = 'Failed to fetch deliverers from LocalBridge';
        return { error: { message } };
      }

      const deliverers: TeamMember[] = (roles || []).map((role: any) => {
        const user = (users || []).find((u: any) => u.id === role.user_id);
        const statsEntry = stats?.[role.user_id] || { total: 0, completed: 0 };

        return {
          id: role.id,
          user_id: role.user_id,
          email: user?.email || '',
          full_name: user?.full_name || 'Unknown',
          phone: user?.phone || undefined,
          role: 'deliverer' as AppRole,
          store_id: role.store_id || undefined,
          is_active: true,
          created_at: role.created_at,
          deliveries_total: statsEntry.total || 0,
          deliveries_completed: statsEntry.completed || 0,
        };
      });

      return { data: deliverers };
    } catch (error) {
      console.error('LocalBridge getDeliverers error:', error);
      return { error };
    }
  }

  private static async getWorkersViaLocalBridge(): Promise<{ data?: TeamMember[]; error?: any }> {
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) {
        return { error: { message: 'LocalBridge session expired. Please sign in again.' } };
      }

      const baseUrl = getDataClient().localBridgeBaseUrl;
      const [rolesRes, usersRes, storesRes, salesRes] = await Promise.all([
        smartFetch(`${baseUrl}/rest/v1/user_roles?role=worker`, { headers }),
        smartFetch(`${baseUrl}/rest/v1/users`, { headers }),
        smartFetch(`${baseUrl}/rest/v1/stores`, { headers }),
        smartFetch(`${baseUrl}/rest/v1/sales`, { headers }),
      ]);

      const roles = rolesRes.ok ? await rolesRes.json() : null;
      const users = usersRes.ok ? await usersRes.json() : null;
      const stores = storesRes.ok ? await storesRes.json() : null;
      const sales = salesRes.ok ? await salesRes.json() : [];

      if (!rolesRes.ok || !usersRes.ok || !storesRes.ok || !salesRes.ok) {
        const message = 'Failed to fetch workers from LocalBridge';
        return { error: { message } };
      }

      const salesByWorker = (sales || []).reduce((acc: Record<string, { count: number; total: number }>, sale: any) => {
        const workerId = sale.worker_id;
        if (!workerId) return acc;
        if (!acc[workerId]) acc[workerId] = { count: 0, total: 0 };
        acc[workerId].count += 1;
        acc[workerId].total += Number(sale.total_price || 0);
        return acc;
      }, {});

      const workers: TeamMember[] = (roles || []).map((role: any) => {
        const user = (users || []).find((u: any) => u.id === role.user_id);
        const store = (stores || []).find((s: any) => s.id === role.store_id);
        const salesData = salesByWorker[role.user_id] || { count: 0, total: 0 };

        return {
          id: role.id,
          user_id: role.user_id,
          email: user?.email || '',
          full_name: user?.full_name || 'Unknown',
          phone: user?.phone || undefined,
          role: 'worker' as AppRole,
          store_id: role.store_id || undefined,
          store_name: store?.name,
          is_active: true,
          created_at: role.created_at,
          sales_count: salesData.count,
          total_revenue: salesData.total,
        };
      });

      return { data: workers };
    } catch (error) {
      console.error('LocalBridge getWorkers error:', error);
      return { error };
    }
  }

  private static async createUserViaLocalBridge(
    payload: CreateUserPayload
  ): Promise<{ data?: any; error?: any }> {
    const headers = await OfflineAuthService.getAuthHeaders();
    if (!headers) {
      const message = 'Local admin session required to create team members offline.';
      toast({
        title: 'Authorization Required',
        description: message,
        variant: 'destructive',
      });
      return { error: { message } };
    }

    const baseUrl = getDataClient().localBridgeBaseUrl;
    try {
      const response = await smartFetch(`${baseUrl}/auth/workers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          full_name: payload.full_name,
          role: payload.role === 'deliverer' ? 'deliverer' : 'worker',
          store_id: payload.store_id,
          store_name: payload.store_name,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || 'LocalBridge worker creation failed');
      }

      await LocalDatabase.init();
      const createdAt = body.created_at || new Date().toISOString();
      const userId = body.id || crypto.randomUUID();
      const roleId = body.role_id || crypto.randomUUID();

      const localUser: LocalUser = {
        id: userId,
        email: payload.email,
        password_hash: LocalDatabase.hashPassword(payload.password),
        full_name: payload.full_name,
        phone: payload.phone,
        created_at: createdAt,
        updated_at: createdAt,
        synced: true,
        is_active: true,
      };

      const localRole: LocalRole = {
        id: roleId,
        user_id: userId,
        role: payload.role as 'master' | 'worker' | 'deliverer',
        store_id: body.store_id || payload.store_id,
        created_at: createdAt,
        synced: true,
      };

      await LocalDatabase.saveUser(localUser);
      await LocalDatabase.saveRole(localRole);

      toast({
        title: payload.role === 'worker' ? i18n.t('sync.workerCreated') : i18n.t('sync.delivererCreated'),
        description: i18n.t('sync.storedLocalBackend'),
      });

      return {
        data: {
          success: true,
          user: {
            id: userId,
            email: payload.email,
            full_name: payload.full_name,
            role: payload.role,
            store_id: body.store_id || payload.store_id,
          },
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create user on LocalBridge';
      console.error('LocalBridge createUser error:', error);
      toast({
        title: i18n.t('sync.localBridgeError'),
        description: message,
        variant: 'destructive',
      });
      return { error: { message } };
    }
  }

  /**
   * Delete a team member (works offline)
   */
  static async deleteMember(
    roleId: string,
    userId: string
  ): Promise<{ success: boolean; error?: any }> {
    const isOnline = navigator.onLine;

    try {
      await LocalDatabase.init();

      // Delete from local database immediately
      await LocalDatabase.deleteRole(roleId);
      await LocalDatabase.deleteUser(userId);

      if (!isOnline) {
        // Queue for later sync
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'user_delete',
          data: { roleId, userId },
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: i18n.t('sync.memberDeletedOffline'),
          description: i18n.t('sync.willSyncWhenOnline'),
        });

        return { success: true };
      }

      // Try to sync immediately if online
      // Delete role first
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (roleError) {
        console.error('Failed to delete role from server:', roleError);
        // Queue for later sync
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'user_delete',
          data: { roleId, userId },
          timestamp: Date.now(),
          retries: 0,
        });

        return { success: true };
      }

      // Note: We don't delete the user from auth here as that requires admin privileges
      // The user will be orphaned but that's acceptable for this use case

      toast({
        title: i18n.t('sync.memberDeleted'),
        description: i18n.t('sync.memberRemoved'),
      });

      return { success: true };
    } catch (error) {
      console.error('Delete member error:', error);
      return { success: false, error };
    }
  }

  /**
   * Get stores (merges local and remote for team assignment)
   */
  static async getStores(): Promise<{ data?: any[]; error?: any }> {
    try {
      await LocalDatabase.init();
      const localStores = await LocalDatabase.getAllStores();

      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { data: localStores };
        }
        const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/stores`, { headers });
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          return { data: localStores, error: payload };
        }

        for (const store of payload || []) {
          const existingLocal = localStores.find(s => s.id === store.id);
          if (existingLocal && !existingLocal.synced) continue;

          await LocalDatabase.saveStore({
            id: store.id,
            name: store.name,
            address: store.address || undefined,
            city: undefined,
            phone: store.phone || undefined,
            email: undefined,
            is_active: true,
            created_at: store.created_at,
            updated_at: store.updated_at || store.created_at,
            synced: true,
          });
        }

        const unsyncedLocalIds = new Set(localStores.filter(s => !s.synced).map(s => s.id));
        const mergedById = new Map();
        for (const s of localStores) mergedById.set(s.id, s);
        for (const s of payload || []) {
          if (!unsyncedLocalIds.has(s.id)) mergedById.set(s.id, s);
        }

        return { data: Array.from(mergedById.values()) };
      }

      if (!navigator.onLine) {
        return { data: localStores };
      }

      // Fetch from server
      const { data: remoteStores, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');

      if (error) {
        console.error('Failed to fetch remote stores:', error);
        return { data: localStores };
      }

      // Cache remote stores locally
      for (const store of remoteStores || []) {
        const existingLocal = localStores.find(s => s.id === store.id);
        if (existingLocal && !existingLocal.synced) continue;

        await LocalDatabase.saveStore({
          id: store.id,
          name: store.name,
          address: store.address || undefined,
          city: undefined,
          phone: store.phone || undefined,
          email: undefined,
          is_active: true,
          created_at: store.created_at,
          updated_at: store.updated_at || store.created_at,
          synced: true,
        });
      }

      // Merge local unsynced with remote
      const unsyncedLocalIds = new Set(localStores.filter(s => !s.synced).map(s => s.id));
      const mergedById = new Map();
      for (const s of localStores) mergedById.set(s.id, s);
      for (const s of remoteStores || []) {
        if (!unsyncedLocalIds.has(s.id)) mergedById.set(s.id, s);
      }

      return { data: Array.from(mergedById.values()) };
    } catch (error) {
      console.error('Get stores error:', error);
      return { error };
    }
  }
}
