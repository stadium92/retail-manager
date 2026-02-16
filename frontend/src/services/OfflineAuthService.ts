/**
 * OfflineAuthService - Handles authentication when offline
 * Uses LocalDatabase to verify credentials and manage sessions
 */

import { LocalDatabase, LocalUser, LocalRole } from './LocalDatabase';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { AppRole, UserRole } from '@/types';
import { toast } from '@/hooks/use-toast';
import { getDataClient } from '@/lib/dataClient';
import { SupabaseProvisioningService } from './SupabaseProvisioningService';
import { TokenManager } from '@/utils/tokenManager';

export interface OfflineAuthResult {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  error?: string;
  isOffline: boolean;
}

type LocalBridgeRole = 'master' | 'worker' | 'deliverer';

interface LocalBridgeUserPayload {
  id: string;
  email: string;
  full_name: string;
  role: LocalBridgeRole;
  store_id?: string | null;
}

interface LocalBridgeLoginResponse {
  token_type: 'bearer';
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: LocalBridgeUserPayload;
}

interface LocalBridgeBootstrapResponse {
  message: string;
  store_id: string;
  store_name: string;
}

interface LocalBridgeSessionCache {
  user: LocalBridgeUserPayload;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}

const LOCALBRIDGE_SESSION_KEY = 'localbridge:session';
const ACCESS_EXPIRY_BUFFER_MS = 5_000;

export class OfflineAuthService {
  private static isLocalBridgeMode(): boolean {
    return getDataClient().isLocalFirst;
  }

  private static getLocalBridgeBaseUrl(): string {
    return getDataClient().localBridgeBaseUrl;
  }

  private static toSupabaseUser(payload: LocalBridgeUserPayload): User {
    return {
      id: payload.id,
      email: payload.email,
      app_metadata: { provider: 'localbridge' },
      user_metadata: {
        full_name: payload.full_name,
        role: payload.role,
        store_id: payload.store_id ?? undefined,
      },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User;
  }

  private static toUserRoles(payload: LocalBridgeUserPayload): UserRole[] {
    return [
      {
        id: `${payload.id}-${payload.role}`,
        user_id: payload.id,
        role: payload.role as AppRole,
        store_id: payload.store_id ?? undefined,
        created_at: new Date().toISOString(),
      },
    ];
  }

  private static mapCacheToResult(cache: LocalBridgeSessionCache): OfflineAuthResult {
    const user = this.toSupabaseUser(cache.user);
    const expiresIn = Math.max(
      5,
      Math.floor((cache.accessTokenExpiresAt - Date.now()) / 1000)
    );

    const session: Session = {
      access_token: cache.accessToken,
      refresh_token: cache.refreshToken,
      expires_in: expiresIn,
      token_type: 'bearer',
      user,
    } as Session;

    return {
      user,
      session,
      roles: this.toUserRoles(cache.user),
      isOffline: true,
    };
  }

  private static saveLocalBridgeSession(response: LocalBridgeLoginResponse): LocalBridgeSessionCache {
    const cache: LocalBridgeSessionCache = {
      user: response.user,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      accessTokenExpiresAt: Date.now() + response.expires_in * 1000,
    };

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOCALBRIDGE_SESSION_KEY, JSON.stringify(cache));
      }
    } catch (error) {
      console.error('Failed to persist LocalBridge session', error);
    }

    return cache;
  }

  private static getLocalBridgeSession(): LocalBridgeSessionCache | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(LOCALBRIDGE_SESSION_KEY);
      return raw ? (JSON.parse(raw) as LocalBridgeSessionCache) : null;
    } catch (error) {
      console.error('Failed to parse LocalBridge session cache', error);
      return null;
    }
  }

  private static clearLocalBridgeSession() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(LOCALBRIDGE_SESSION_KEY);
    } catch (error) {
      console.error('Failed to clear LocalBridge session cache', error);
    }
  }

  private static async refreshLocalBridgeSession(refreshToken: string): Promise<LocalBridgeSessionCache | null> {
    try {
      const response = await this.localBridgeRequest<LocalBridgeLoginResponse>(
        '/auth/refresh',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }
      );

      return this.saveLocalBridgeSession(response);
    } catch (error) {
      console.error('Failed to refresh LocalBridge session', error);
      return null;
    }
  }

  private static async getValidLocalBridgeSession(): Promise<LocalBridgeSessionCache | null> {
    const cache = this.getLocalBridgeSession();
    if (!cache) return null;

    // Validate token structure first
    if (!TokenManager.isValid(cache.accessToken)) {
      console.warn('Invalid access token format, clearing session');
      this.clearLocalBridgeSession();
      return null;
    }

    if (Date.now() >= cache.accessTokenExpiresAt - ACCESS_EXPIRY_BUFFER_MS) {
      // Prevent loop: If refresh token is also invalid/expired, stop here
      if (!TokenManager.isValid(cache.refreshToken)) {
         console.warn('Refresh token invalid/expired, stopping loop');
         this.clearLocalBridgeSession();
         return null;
      }
      return (await this.refreshLocalBridgeSession(cache.refreshToken)) ?? null;
    }

    return cache;
  }

  private static async localBridgeRequest<T>(
    path: string,
    init: RequestInit,
    retry = true
  ): Promise<T> {
    const baseUrl = this.getLocalBridgeBaseUrl();
    const headers = await this.getAuthHeaders();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          ...headers,
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        if (retry) {
          console.log('401 detected, attempting refresh...');
          const session = this.getLocalBridgeSession();
          if (session?.refreshToken && TokenManager.isValid(session.refreshToken)) {
            const refreshed = await this.refreshLocalBridgeSession(session.refreshToken);
            if (refreshed) {
              return this.localBridgeRequest<T>(path, init, false);
            }
          }
        }
        
        // If we get here, refresh failed or retry was false
        console.warn('Authentication failed (401), clearing session to prevent loop');
        this.clearLocalBridgeSession();
        throw new Error('Session expired. Please sign in again.');
      }

      if (!response.ok) {
        let details: any = null;
        try {
          details = await response.json();
        } catch (error) {
          // ignore
        }

        const errorMessage = details?.message || 'LocalBridge request failed';
        throw new Error(errorMessage);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private static async localBridgeSignIn(email: string, password: string): Promise<OfflineAuthResult> {
    try {
      const response = await this.localBridgeRequest<LocalBridgeLoginResponse>(
        '/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }
      );

      const cache = this.saveLocalBridgeSession(response);
      return this.mapCacheToResult(cache);
    } catch (error) {
      return {
        user: null,
        session: null,
        roles: [],
        error: error instanceof Error ? error.message : 'Failed to authenticate offline',
        isOffline: true,
      };
    }
  }

  static async bootstrapMaster(
    email: string,
    password: string,
    fullName: string,
    storeName?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isLocalBridgeMode()) {
      return { success: false, error: 'LocalBridge mode is not enabled.' };
    }

    try {
      await this.localBridgeRequest<LocalBridgeBootstrapResponse>('/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          ...(storeName ? { store_name: storeName } : {}),
        }),
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bootstrap master account',
      };
    }
  }

  private static async restoreLocalBridgeSession(): Promise<OfflineAuthResult | null> {
    const cache = await this.getValidLocalBridgeSession();
    if (!cache) return null;
    return this.mapCacheToResult(cache);
  }

  static async getAuthHeaders(): Promise<Record<string, string> | null> {
    if (!this.isLocalBridgeMode()) return null;
    const cache = await this.getValidLocalBridgeSession();
    if (!cache) return null;
    return { Authorization: `Bearer ${cache.accessToken}` };
  }

  private static async localBridgeLogout() {
    const cache = this.getLocalBridgeSession();
    if (!cache) {
      this.clearLocalBridgeSession();
      return;
    }

    try {
      await this.localBridgeRequest('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: cache.refreshToken }),
      });
    } catch (error) {
      console.warn('LocalBridge logout failed (continuing):', error);
    } finally {
      this.clearLocalBridgeSession();
    }
  }
  /**
   * Try to sign in - works both online and offline
   */
  static async signIn(email: string, password: string): Promise<OfflineAuthResult> {
    if (this.isLocalBridgeMode()) {
      return this.localBridgeSignIn(email, password);
    }

    return this.supabaseSignIn(email, password);
  }

  private static async supabaseSignIn(email: string, password: string): Promise<OfflineAuthResult> {
    const isOnline = navigator.onLine;

    if (isOnline) {
      // Try online authentication first
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Supabase sign-in timed out')), 5000)
        );

        const { data, error } = await Promise.race([
          supabase.auth.signInWithPassword({ email, password }),
          timeoutPromise
        ]) as any;

        if (!error && data.user && data.session) {
          // Cache user and session for offline use
          await this.cacheUserCredentials(email, password, data.user);

          // Fetch and cache roles
          const roles = await this.fetchAndCacheRoles(data.user.id);

          return {
            user: data.user,
            session: data.session,
            roles,
            isOffline: false,
          };
        }

        // If online auth fails, don't fall back to offline for security
        return {
          user: null,
          session: null,
          roles: [],
          error: error?.message || 'Authentication failed',
          isOffline: false,
        };
      } catch (err) {
        // Network error - fall through to offline auth
        console.log('Network error during auth, trying offline...');
      }
    }

    // Offline authentication
    return this.offlineSignIn(email, password);
  }

  /**
   * Authenticate using cached local credentials
   */
  static async offlineSignIn(email: string, password: string): Promise<OfflineAuthResult> {
    if (this.isLocalBridgeMode()) {
      return this.localBridgeSignIn(email, password);
    }

    return this.legacyOfflineSignIn(email, password);
  }

  private static async legacyOfflineSignIn(email: string, password: string): Promise<OfflineAuthResult> {
    try {
      await LocalDatabase.init();

      const localUser = await LocalDatabase.getUserByEmail(email);

      if (!localUser) {
        return {
          user: null,
          session: null,
          roles: [],
          error: 'User not found. Please sign in online first to cache credentials.',
          isOffline: true,
        };
      }

      // Verify password
      if (!LocalDatabase.verifyPassword(password, localUser.password_hash)) {
        return {
          user: null,
          session: null,
          roles: [],
          error: 'Invalid password',
          isOffline: true,
        };
      }

      // Get cached roles
      const localRoles = await LocalDatabase.getRolesByUserId(localUser.id);
      const storeId = localRoles.find(r => r.store_id)?.store_id;

      // Create mock user and session for offline mode
      const mockUser: User = {
        id: localUser.id,
        email: localUser.email,
        app_metadata: {},
        user_metadata: {
          full_name: localUser.full_name,
          store_id: storeId
        },
        aud: 'authenticated',
        created_at: localUser.created_at,
      } as User;

      const mockSession: Session = {
        access_token: 'offline_token_' + Date.now(),
        refresh_token: 'offline_refresh_' + Date.now(),
        expires_in: 86400, // 24 hours
        token_type: 'bearer',
        user: mockUser,
      } as Session;

      // Save session for persistence
      await LocalDatabase.saveSession({
        user: mockUser,
        session: mockSession,
        timestamp: Date.now(),
      });

      // Convert local roles to UserRole format
      const roles: UserRole[] = localRoles.map(r => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role as AppRole,
        store_id: r.store_id,
        created_at: r.created_at,
      }));

      toast({
        title: 'Offline Mode',
        description: 'Signed in using cached credentials.',
      });

      return {
        user: mockUser,
        session: mockSession,
        roles,
        isOffline: true,
      };
    } catch (error) {
      console.error('Offline sign in error:', error);
      return {
        user: null,
        session: null,
        roles: [],
        error: 'Failed to authenticate offline',
        isOffline: true,
      };
    }
  }

  /**
   * Check for existing offline session
   */
  static async getOfflineSession(): Promise<OfflineAuthResult | null> {
    if (this.isLocalBridgeMode()) {
      return this.restoreLocalBridgeSession();
    }

    return this.legacyGetOfflineSession();
  }

  private static async legacyGetOfflineSession(): Promise<OfflineAuthResult | null> {
    try {
      await LocalDatabase.init();
      const session = await LocalDatabase.getSession();

      if (!session) return null;

      // Check if session is expired (24 hours)
      const sessionAge = Date.now() - session.timestamp;
      if (sessionAge > 24 * 60 * 60 * 1000) {
        await LocalDatabase.clearSession();
        return null;
      }

      // Get roles
      const localRoles = await LocalDatabase.getRolesByUserId(session.user.id);
      const roles: UserRole[] = localRoles.map(r => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role as AppRole,
        store_id: r.store_id,
        created_at: r.created_at,
      }));

      // Ensure store_id is in user metadata
      const storeId = localRoles.find(r => r.store_id)?.store_id;
      if (storeId && !session.user.user_metadata.store_id) {
        session.user.user_metadata.store_id = storeId;
      }

      return {
        user: session.user,
        session: session.session,
        roles,
        isOffline: !navigator.onLine,
      };
    } catch (error) {
      console.error('Error getting offline session:', error);
      return null;
    }
  }

  /**
   * Cache user credentials for offline use
   */
  private static async cacheUserCredentials(
    email: string,
    password: string,
    user: User
  ): Promise<void> {
    try {
      await LocalDatabase.init();

      const localUser: LocalUser = {
        id: user.id,
        email: email,
        password_hash: LocalDatabase.hashPassword(password),
        full_name: user.user_metadata?.full_name || email.split('@')[0],
        phone: user.user_metadata?.phone,
        created_at: user.created_at,
        updated_at: new Date().toISOString(),
        synced: true,
      };

      await LocalDatabase.saveUser(localUser);
      console.log('User credentials cached for offline use');
    } catch (error) {
      console.error('Failed to cache user credentials:', error);
    }
  }

  /**
   * Fetch roles from server and cache locally
   */
  private static async fetchAndCacheRoles(userId: string): Promise<UserRole[]> {
    try {
      console.log('Fetching roles for user:', userId);
      
      // 1. Create a timeout promise (5 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Roles fetch timed out')), 5000)
      );

      // 2. Race Supabase query against timeout
      const rolesPromise = supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      // Cast to any to handle the race result structure
      const { data, error } = await Promise.race([
        rolesPromise.then(res => ({ data: res.data, error: res.error })),
        timeoutPromise
      ]) as { data: any[], error: any };

      if (error || !data) {
        console.error('Error fetching roles (online):', error);
        throw new Error(error?.message || 'No data returned');
      }

      // 3. Cache roles locally
      await LocalDatabase.init();
      for (const role of data) {
        const localRole: LocalRole = {
          id: role.id,
          user_id: role.user_id,
          role: role.role as 'master' | 'worker' | 'deliverer',
          store_id: role.store_id || undefined,
          created_at: role.created_at,
          synced: true,
        };
        await LocalDatabase.saveRole(localRole);
      }

      return data as UserRole[];
    } catch (error) {
      console.warn('Failed to fetch/cache online roles, falling back to local:', error);
      
      // 4. Fallback to local database
      try {
        await LocalDatabase.init();
        const localRoles = await LocalDatabase.getRolesByUserId(userId);
        if (localRoles.length > 0) {
          console.log('Recovered roles from local cache:', localRoles.length);
          return localRoles.map(r => ({
            id: r.id,
            user_id: r.user_id,
            role: r.role as AppRole,
            store_id: r.store_id,
            created_at: r.created_at,
          }));
        }
      } catch (localError) {
        console.error('Local role fallback failed:', localError);
      }
      
      return [];
    }
  }

  /**
   * Create a new user (works offline)
   */
  static async createUser(
    email: string,
    password: string,
    fullName: string,
    role: AppRole,
    storeId?: string
  ): Promise<{ success: boolean; error?: string; userId?: string }> {
    if (this.isLocalBridgeMode()) {
      return this.localBridgeCreateUser(email, password, fullName, role, storeId);
    }

    const isOnline = navigator.onLine;
    const userId = crypto.randomUUID();

    // Always save locally first
    try {
      await LocalDatabase.init();

      const localUser: LocalUser = {
        id: userId,
        email,
        password_hash: LocalDatabase.hashPassword(password),
        full_name: fullName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced: false,
      };

      await LocalDatabase.saveUser(localUser);

      const localRole: LocalRole = {
        id: crypto.randomUUID(),
        user_id: userId,
        role: role as 'master' | 'worker' | 'deliverer',
        store_id: storeId,
        created_at: new Date().toISOString(),
        synced: false,
      };

      await LocalDatabase.saveRole(localRole);

      // Add to sync queue if offline
      if (!isOnline) {
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'user_create',
          data: { email, password, fullName, role, storeId, localUserId: userId },
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: 'User Created (Offline)',
          description: 'Will sync when back online.',
        });

        return { success: true, userId };
      }

      // If online, also create on server
      const provisionResult = await SupabaseProvisioningService.provisionUser({
        email,
        password,
        full_name: fullName,
        role: role === 'deliverer' ? 'deliverer' : 'worker',
        store_id: storeId,
      });

      if (!provisionResult.success) {
        // Keep local copy for later sync
        await LocalDatabase.addToSyncQueue({
          id: crypto.randomUUID(),
          type: 'user_create',
          data: { email, password, fullName, role, storeId, localUserId: userId },
          timestamp: Date.now(),
          retries: 0,
        });

        toast({
          title: 'User Created Locally',
          description: provisionResult.error || 'Server sync failed, will retry later.',
          variant: 'destructive',
        });

        return { success: true, userId };
      }

      // Mark as synced
      const user = await LocalDatabase.getUser(userId);
      if (user) {
        user.synced = true;
        await LocalDatabase.saveUser(user);
      }

      return { success: true, userId: provisionResult.userId || userId };
    } catch (error) {
      console.error('Create user error:', error);
      return { success: false, error: 'Failed to create user' };
    }
  }

  private static async localBridgeCreateUser(
    email: string,
    password: string,
    fullName: string,
    role: AppRole,
    storeId?: string
  ): Promise<{ success: boolean; error?: string; userId?: string }> {
    const headers = await this.getAuthHeaders();
    if (!headers) {
      return {
        success: false,
        error: 'Local admin session required to create users offline.',
      };
    }

    const payload = {
      email,
      password,
      full_name: fullName,
      role: role === 'deliverer' ? 'deliverer' : ('worker' as LocalBridgeRole),
      store_id: storeId,
    };

    try {
      const response = await this.localBridgeRequest<{ id: string }>(
        '/auth/workers',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(payload),
        }
      );

      toast({
        title: 'Offline User Created',
        description: 'Stored in LocalBridge and ready to use.',
      });

      return { success: true, userId: response.id };
    } catch (error) {
      console.error('LocalBridge createUser error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      };
    }
  }

  /**
   * Sign out and clear offline session
   * IMPORTANT: This clears only the session, NOT the sync queue
   * so pending changes will still be synced when back online
   */
  static async signOut(): Promise<void> {
    if (this.isLocalBridgeMode()) {
      await this.localBridgeLogout();
      return;
    }

    try {
      // Only clear session, keep sync queue for later sync
      await LocalDatabase.clearSessionOnly();

      // Try to sign out from Supabase if online
      if (navigator.onLine) {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.log('Supabase signOut failed (may be offline):', err);
        }
      }

      console.log('Signed out successfully. Sync queue preserved for later sync.');
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, try to clear the session
      try {
        await LocalDatabase.clearSessionOnly();
      } catch (e) {
        console.error('Failed to clear session:', e);
      }
    }
  }
}
