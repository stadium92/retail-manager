/**
 * OfflineAuthService - Handles authentication when offline
 * Uses LocalDatabase to verify credentials and manage sessions
 */

import { LocalDatabase, LocalUser, LocalRole } from './LocalDatabase';
import { AppRole, UserRole } from '@/types';
import { toast } from '@/hooks/use-toast';
import { getDataClient } from '@/lib/dataClient';
import { TokenManager } from '@/utils/tokenManager';
import { smartFetch } from '@/lib/dataClient';
import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';

/** Minimal User type replacing @supabase/supabase-js User */
export interface User {
  id: string;
  email?: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  aud: string;
  created_at: string;
}

/** Minimal Session type replacing @supabase/supabase-js Session */
export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: User;
}

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

interface LocalBridgeSessionCache {
  user: LocalBridgeUserPayload;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}

const LOCALBRIDGE_SESSION_KEY = 'localbridge:session';
const ACCESS_EXPIRY_BUFFER_MS = 300_000; // 5 minutes proactive refresh

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
      // In Local-First, we prefer to keep the session even if refresh fails momentarily
      console.warn('[OfflineAuth] Session clear requested, but ignored for Local-First stability');
      TokenManager.releaseRefreshLock();
    } catch (error) {
      console.error('Failed to handle session clear', error);
    }
  }

  private static async refreshLocalBridgeSession(refreshToken: string): Promise<LocalBridgeSessionCache | null> {
    // Acquire cross-tab lock to prevent multiple refreshes
    if (!TokenManager.acquireRefreshLock()) {
        console.log('[OfflineAuth] Refresh in progress in another tab, waiting...');
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 500));
            const freshCache = this.getLocalBridgeSession();
            if (freshCache && TokenManager.isValid(freshCache.accessToken)) {
                return freshCache;
            }
        }
    }

    try {
      const baseUrl = this.getLocalBridgeBaseUrl();
      console.log('[OfflineAuth] Proactively refreshing session...');
      const response = await smartFetch(
        `${baseUrl}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }
      );

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json() as LocalBridgeLoginResponse;
      const cache = this.saveLocalBridgeSession(data);
      TokenManager.releaseRefreshLock();
      return cache;
    } catch (error) {
      console.error('Failed to refresh LocalBridge session', error);
      TokenManager.releaseRefreshLock();
      return null;
    }
  }

  private static async getValidLocalBridgeSession(): Promise<LocalBridgeSessionCache | null> {
    const cache = this.getLocalBridgeSession();
    if (!cache) return null;

    // 1. Proactive Refresh: Check if token expires within 5 minutes
    if (Date.now() >= cache.accessTokenExpiresAt - ACCESS_EXPIRY_BUFFER_MS) {
      if (cache.refreshToken) {
        console.log('[OfflineAuth] Token near expiry, proactive refresh...');
        const refreshed = await this.refreshLocalBridgeSession(cache.refreshToken);
        if (refreshed) return refreshed;
      }
    }

    // 2. Validate current token structure
    if (!cache.accessToken || typeof cache.accessToken !== 'string' || cache.accessToken.split('.').length !== 3) {
      console.warn('[OfflineAuth] Invalid access token format, attempting refresh...');
      if (cache.refreshToken) {
          const refreshed = await this.refreshLocalBridgeSession(cache.refreshToken);
          if (refreshed) return refreshed;
      }
      return cache; // Return old cache anyway, let 401 retry handle it
    }

    return cache;
  }

  /**
   * localBridgeRequest - Robust request wrapper with auto-retry on 401
   */
  public static async localBridgeRequest<T>(
    path: string,
    init: RequestInit,
    retry = true
  ): Promise<T> {
    const baseUrl = this.getLocalBridgeBaseUrl();
    const headers = await this.getAuthHeaders();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await smartFetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
          ...headers,
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - Silent Refresh & Retry
      if (response.status === 401 && retry) {
        console.warn('[OfflineAuth] 401 detected, attempting silent recovery...');
        const session = this.getLocalBridgeSession();
        if (session?.refreshToken) {
          const refreshed = await this.refreshLocalBridgeSession(session.refreshToken);
          if (refreshed) {
            console.log('[OfflineAuth] Recovery successful, retrying request.');
            return this.localBridgeRequest<T>(path, init, false);
          }
        }
      }

      if (!response.ok) {
        let details: any = null;
        try {
          details = await response.json();
        } catch (error) { /* ignore */ }

        const errorMessage = details?.message || details?.error || (details?.details ? (typeof details.details === 'object' ? JSON.stringify(details.details) : details.details) : 'LocalBridge request failed');
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
          body: JSON.stringify({ email, password }),
        }
      );

      const cache = this.saveLocalBridgeSession(response);
      return this.mapCacheToResult(cache);
    } catch (error) {
      console.log('[OfflineAuth] Local login failed, attempting Supabase fallback...');
      try {
        const { data, error: supaError } = await supabase.auth.signInWithPassword({ email, password });
        if (supaError || !data.user) throw supaError;

        console.log('[OfflineAuth] Supabase fallback successful, syncing to Local Bridge...');
        const syncResponse = await this.localBridgeRequest<LocalBridgeLoginResponse>(
          '/auth/sync-cloud-login',
          {
            method: 'POST',
            body: JSON.stringify({
              id: data.user.id,
              email: data.user.email,
              password,
              full_name: data.user.user_metadata?.full_name || 'Cloud User',
              role: data.user.user_metadata?.role || 'worker',
              store_id: data.user.user_metadata?.store_id || null,
            }),
          }
        );

        const cache = this.saveLocalBridgeSession(syncResponse);
        return this.mapCacheToResult(cache);
      } catch (fallbackError) {
        return {
          user: null,
          session: null,
          roles: [],
          error: fallbackError instanceof Error ? fallbackError.message : 'Failed to authenticate locally and in the cloud',
          isOffline: true,
        };
      }
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
      await this.localBridgeRequest('/auth/bootstrap', {
        method: 'POST',
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
      return;
    }

    try {
      await this.localBridgeRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: cache.refreshToken }),
      });
    } catch (error) {
      console.warn('LocalBridge logout failed (continuing):', error);
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(LOCALBRIDGE_SESSION_KEY);
      }
    }
  }
  
  static async verifyMasterPassword(password: string): Promise<boolean> {
    if (!this.isLocalBridgeMode()) {
      return false; // Not supported in legacy offline mode for now
    }
    try {
      const res = await fetch(`${this.getLocalBridgeBaseUrl()}/rest/v1/auth/verify-master`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      return res.ok;
    } catch (e) {
      console.error('[OfflineAuth] verifyMasterPassword error:', e);
      return false;
    }
  }

  static async signIn(email: string, password: string): Promise<OfflineAuthResult> {
    if (this.isLocalBridgeMode()) {
      return this.localBridgeSignIn(email, password);
    }
    return this.legacyOfflineSignIn(email, password);
  }

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
          error: 'User not found.',
          isOffline: true,
        };
      }

      if (!LocalDatabase.verifyPassword(password, localUser.password_hash)) {
        return {
          user: null,
          session: null,
          roles: [],
          error: 'Invalid password',
          isOffline: true,
        };
      }

      const localRoles = await LocalDatabase.getRolesByUserId(localUser.id);
      const storeId = localRoles.find(r => r.store_id)?.store_id;

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
        expires_in: 86400,
        token_type: 'bearer',
        user: mockUser,
      } as Session;

      await LocalDatabase.saveSession({
        user: mockUser,
        session: mockSession,
        timestamp: Date.now(),
      });

      const roles: UserRole[] = localRoles.map(r => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role as AppRole,
        store_id: r.store_id,
        created_at: r.created_at,
      }));

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

      const sessionAge = Date.now() - session.timestamp;
      if (sessionAge > 24 * 60 * 60 * 1000) {
        await LocalDatabase.clearSession();
        return null;
      }

      const localRoles = await LocalDatabase.getRolesByUserId(session.user.id);
      const roles: UserRole[] = localRoles.map(r => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role as AppRole,
        store_id: r.store_id,
        created_at: r.created_at,
      }));

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

    const userId = crypto.randomUUID();
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
        is_active: true
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

      return { success: true, userId };
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
      return { success: false, error: 'Local admin session required.' };
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
          body: JSON.stringify(payload),
        }
      );
      return { success: true, userId: response.id };
    } catch (error) {
      console.error('LocalBridge createUser error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      };
    }
  }

  static async signOut(): Promise<void> {
    if (this.isLocalBridgeMode()) {
      await this.localBridgeLogout();
      return;
    }
    await LocalDatabase.clearSession();
  }
}
