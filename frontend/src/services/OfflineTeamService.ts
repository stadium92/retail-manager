/**
 * OfflineTeamService - Handles team/worker operations with offline support
 */

import { LocalDatabase, LocalUser, LocalRole } from './LocalDatabase';
import { AppRole } from '@/types';
import { toast } from '@/hooks/use-toast';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';
import i18n from '@/i18n/config';
import { supabase } from '../lib/supabase';

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: AppRole;
  sub_role?: 'cashier' | null;
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
  sub_role?: 'cashier' | null;
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

      if (isOnline) {
        // Retrieve caller's access token to authenticate with the edge function
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('create-user', {
          body: {
            email: payload.email,
            password: payload.password,
            full_name: payload.full_name,
            phone: payload.phone,
            role: payload.role,
            sub_role: payload.sub_role,
            store_id: payload.store_id,
            vehicle_type: payload.vehicle_type,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (edgeErr || edgeData?.error) {
          const errMessage = edgeErr?.message || edgeData?.error || 'Failed to create user on Supabase';
          console.error('[createUser] Supabase edge function failed:', errMessage);
          return { error: { message: errMessage } };
        }

        const supabaseUser = edgeData.user;
        const newUserId = supabaseUser.id;

        // Save locally
        const localUser: LocalUser = {
          id: newUserId,
          email: payload.email,
          password_hash: '', 
          full_name: payload.full_name,
          phone: payload.phone,
          created_at: now,
          updated_at: now,
          synced: true,
          is_active: true,
        };
        await LocalDatabase.saveUser(localUser);

        const localRole: LocalRole = {
          id: roleId,
          user_id: newUserId,
          role: payload.role as 'master' | 'worker' | 'deliverer',
          sub_role: payload.sub_role,
          store_id: payload.store_id,
          created_at: now,
          synced: true,
        };
        await LocalDatabase.saveRole(localRole);

        toast({
          title: payload.role === 'worker' ? i18n.t('sync.workerCreated') : i18n.t('sync.delivererCreated'),
          description: 'Stored in cloud database',
        });

        return {
          data: {
            success: true,
            user: {
              id: newUserId,
              email: payload.email,
              full_name: payload.full_name,
              role: payload.role,
              sub_role: payload.sub_role,
              store_id: payload.store_id,
            },
          },
        };
      }

      // Create local user (offline fallback)
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
        sub_role: payload.sub_role,
        store_id: payload.store_id,
        created_at: now,
        synced: false,
      };

      await LocalDatabase.saveRole(localRole);

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
          sub_role: payload.sub_role,
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
            sub_role: payload.sub_role,
            store_id: payload.store_id,
          },
        },
      };
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
    let users: any[] = [];

    // 1. Try Local Bridge
    if (dataClient.isLocalFirst) {
      try {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/users`, { headers });
          if (response.ok) {
            users = await response.json();
          }
        }
      } catch (e) {}
    }

    // 2. Fallback to Local Database cache
    if (users.length === 0) {
      await LocalDatabase.init();
      users = await LocalDatabase.getAllUsers();
    }

    return {
      data: users.map((u: any) => ({
        id: u.id,
        user_id: u.id,
        email: u.email || '',
        full_name: u.full_name || u.email || 'Unknown',
        role: 'worker', 
        is_active: u.is_active ?? true,
        created_at: u.created_at
      }))
    };
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

      // ── Cloud (Supabase) path — use get-team edge function (bypasses profiles RLS) ──
      if (navigator.onLine) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;

          if (token) {
            const { data: teamData, error: teamError } = await supabase.functions.invoke('get-team', {
              headers: { Authorization: `Bearer ${token}` }
            });

            if (!teamError && teamData?.workers) {
              return { data: teamData.workers };
            }

            if (teamError) {
              console.warn('[getWorkers] get-team edge function error, falling back to direct table select:', teamError);
              const { data: dbRoles, error: dbRolesError } = await supabase
                .from('user_roles')
                .select('*')
                .in('role', ['worker', 'master']);

              if (!dbRolesError && dbRoles) {
                if (dbRoles.length === 0) {
                  return { data: [] };
                }
                const userIds = dbRoles.map((r: any) => r.user_id);
                const { data: dbProfiles } = await supabase
                  .from('profiles')
                  .select('*')
                  .in('id', userIds);

                const mappedWorkers: TeamMember[] = dbRoles.map((r: any) => {
                  const profile = (dbProfiles || []).find((p: any) => p.id === r.user_id);
                  return {
                    id: r.id,
                    user_id: r.user_id,
                    email: profile?.email || '',
                    full_name: profile?.full_name || 'Unknown',
                    phone: profile?.phone || undefined,
                    role: r.role,
                    sub_role: r.sub_role || undefined,
                    store_id: r.store_id || undefined,
                    is_active: true,
                    created_at: r.created_at,
                    sales_count: 0,
                    total_revenue: 0,
                  };
                });
                return { data: mappedWorkers };
              }
            }
          }
        } catch (supabaseErr) {
          console.error('[getWorkers] Supabase fetch failed, falling back to IndexedDB:', supabaseErr);
        }
      }


      // ── Offline fallback: use IndexedDB cache ──
      await LocalDatabase.init();

      const localUsers = await LocalDatabase.getAllUsers();
      const localRoles = await LocalDatabase.getAllRoles();
      const localStores = await LocalDatabase.getAllStores();

      const workerRoles = localRoles.filter(r => ['worker', 'master'].includes(r.role));

      const allWorkers: TeamMember[] = workerRoles.map(role => {
        const user = localUsers.find(u => u.id === role.user_id);
        const store = role.store_id ? localStores.find(s => s.id === role.store_id) : undefined;

        return {
          id: role.id,
          user_id: role.user_id,
          email: user?.email || '',
          full_name: user?.full_name || 'Unknown',
          phone: user?.phone,
          role: role.role as AppRole,
          sub_role: role.sub_role as any,
          store_id: role.store_id,
          store_name: store?.name,
          is_active: user ? (user.is_active ?? true) : true,
          created_at: role.created_at,
          sales_count: 0,
          total_revenue: 0,
        };
      });

      return { data: allWorkers };
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

  static async getDeliverers(): Promise<{ data?: TeamMember[]; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        return this.getDeliverersViaLocalBridge();
      }

      // ── Cloud (Supabase) path — use get-team edge function (bypasses profiles RLS) ──
      if (navigator.onLine) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;

          if (token) {
            const { data: teamData, error: teamError } = await supabase.functions.invoke('get-team', {
              headers: { Authorization: `Bearer ${token}` }
            });

            if (!teamError && teamData?.deliverers) {
              return { data: teamData.deliverers };
            }

            if (teamError) {
              console.warn('[getDeliverers] get-team edge function error, falling back to direct table select:', teamError);
              const { data: dbRoles, error: dbRolesError } = await supabase
                .from('user_roles')
                .select('*')
                .eq('role', 'deliverer');

              if (!dbRolesError && dbRoles) {
                if (dbRoles.length === 0) {
                  return { data: [] };
                }
                const userIds = dbRoles.map((r: any) => r.user_id);
                const { data: dbProfiles } = await supabase
                  .from('profiles')
                  .select('*')
                  .in('id', userIds);

                const mappedDeliverers: TeamMember[] = dbRoles.map((r: any) => {
                  const profile = (dbProfiles || []).find((p: any) => p.id === r.user_id);
                  return {
                    id: r.id,
                    user_id: r.user_id,
                    email: profile?.email || '',
                    full_name: profile?.full_name || 'Unknown',
                    phone: profile?.phone || undefined,
                    role: 'deliverer',
                    store_id: r.store_id || undefined,
                    is_active: true,
                    created_at: r.created_at,
                    deliveries_total: 0,
                    deliveries_completed: 0,
                  };
                });
                return { data: mappedDeliverers };
              }
            }
          }
        } catch (supabaseErr) {
          console.error('[getDeliverers] Supabase fetch failed, falling back to IndexedDB:', supabaseErr);
        }
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

      // Cloud sync disabled - return local deliverers only
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
            is_active: user ? (user.is_active ?? true) : true,
            created_at: role.created_at,
            deliveries_total: 0,
            deliveries_completed: 0,
          };
        });

      return { data: [...localDeliverers, ...syncedDeliverers] };
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
        smartFetch(`${baseUrl}/rest/v1/user_roles`, { headers }),
        smartFetch(`${baseUrl}/rest/v1/users`, { headers }),
        smartFetch(`${baseUrl}/rest/v1/stores`, { headers }),
        smartFetch(`${baseUrl}/rest/v1/sales`, { headers }),
      ]);

      const allRoles = rolesRes.ok ? await rolesRes.json() : null;
      const roles = allRoles ? allRoles.filter((r: any) => ['worker', 'master'].includes(r.role)) : null;
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
          role: role.role as AppRole,
          sub_role: role.sub_role || undefined,
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
          sub_role: payload.sub_role,
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
        sub_role: body.sub_role || payload.sub_role,
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
            sub_role: body.sub_role || payload.sub_role,
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
    const dataClient = getDataClient();

    // ── LocalFirst path (backend SQLite) ──────────────────────────────────────
    if (dataClient.isLocalFirst) {
      return this.deleteMemberViaLocalBridge(roleId, userId);
    }

    // ── Legacy IndexedDB path (offline / Supabase) ────────────────────────────
    const isOnline = navigator.onLine;

    try {
      await LocalDatabase.init();

      if (isOnline) {
        // Retrieve caller's access token to authenticate with the edge function
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('delete-user', {
          body: { user_id: userId, role_id: roleId },
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (edgeErr || edgeData?.error) {
          const errMessage = edgeErr?.message || edgeData?.error || 'Failed to delete user on Supabase';
          console.error('[deleteMember] Supabase edge function failed:', errMessage);
          return { success: false, error: { message: errMessage } };
        }
      }

      // Delete from local IndexedDB immediately
      await LocalDatabase.deleteRole(roleId);
      await LocalDatabase.deleteUser(userId);

      if (!isOnline) {
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
   * Delete a team member via LocalBridge backend (SQLite)
   */
  private static async deleteMemberViaLocalBridge(
    roleId: string,
    userId: string
  ): Promise<{ success: boolean; error?: any }> {
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) {
        return { success: false, error: { message: 'Not authenticated' } };
      }

      const baseUrl = getDataClient().localBridgeBaseUrl;

      // DELETE the role (backend also deletes the user if no other roles remain).
      // Path-param :id, matching every other local-bridge delete route
      // (products/:id, clients/:id, ...) - this used to be a PostgREST-style
      // ?id=eq.X query string, which local-bridge never registered a route
      // for, so this always 404'd.
      const res = await smartFetch(
        `${baseUrl}/rest/v1/user_roles/${encodeURIComponent(roleId)}`,
        { method: 'DELETE', headers }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body?.message || `Server returned ${res.status}`;
        console.error('[deleteMember] LocalBridge DELETE failed:', message);
        return { success: false, error: { message } };
      }

      toast({
        title: i18n.t('sync.memberDeleted'),
        description: i18n.t('sync.memberRemoved'),
      });

      return { success: true };
    } catch (error) {
      console.error('[deleteMember] LocalBridge error:', error);
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
            default_price_tier: store.default_price_tier || 1,
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

      // Fetch from server via local bridge
      let remoteStores: any[] = [];
      try {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (headers) {
          const res = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/stores`, { headers });
          if (res.ok) {
            remoteStores = await res.json().catch(() => []);
          } else {
            console.error('Failed to fetch remote stores:', res.status);
            return { data: localStores };
          }
        } else {
          return { data: localStores };
        }
      } catch (fetchErr) {
        console.error('Failed to fetch remote stores:', fetchErr);
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
          default_price_tier: store.default_price_tier || 1,
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

  static async updateWorkerRole(id: string, role: string): Promise<{ success: boolean; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (!dataClient.isLocalFirst) {
        // id is user_roles.id here (see getWorkers()'s direct-table-select fallback,
        // which is the path actually in effect since the get-team edge function
        // doesn't exist in this project and its invoke() always errors).
        const { error } = await supabase
          .from('user_roles')
          .update({ role })
          .eq('id', id);

        if (error) {
          return { success: false, error };
        }
        return { success: true };
      }

      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) throw new Error('Not authenticated');

      const response = await smartFetch(
        `${dataClient.localBridgeBaseUrl}/auth/workers/${id}/role`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update role');
      }

      return { success: true };
    } catch (error) {
      console.error('Update worker role error:', error);
      return { success: false, error };
    }
  }

  /**
   * Reassign a worker/deliverer to a different store. id is user_roles.id,
   * same as updateWorkerRole. Store assignment was write-once (only set at
   * creation time) before this - there was no way to move someone.
   */
  static async updateWorkerStore(id: string, storeId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (!dataClient.isLocalFirst) {
        const { error } = await supabase
          .from('user_roles')
          .update({ store_id: storeId })
          .eq('id', id);

        if (error) {
          return { success: false, error };
        }
        return { success: true };
      }

      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) throw new Error('Not authenticated');

      const response = await smartFetch(
        `${dataClient.localBridgeBaseUrl}/auth/workers/${id}/store`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: storeId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update store');
      }

      return { success: true };
    } catch (error) {
      console.error('Update worker store error:', error);
      return { success: false, error };
    }
  }
}
