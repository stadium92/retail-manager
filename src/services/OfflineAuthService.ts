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
import i18n from '@/i18n/config';
import { supabase } from '../lib/supabase';

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
  sub_role?: 'cook' | 'cashier' | 'waiter' | null;
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
    const dc = getDataClient();
    if (!dc.isLocalFirst) {
      return (import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co').replace(/\/$/, '');
    }
    return dc.localBridgeBaseUrl;
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
        sub_role: payload.sub_role ?? undefined,
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
        sub_role: payload.sub_role ?? undefined,
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

    if (!getDataClient().isLocalFirst) {
      try {
        if (path.startsWith('/rest/v1/recipes')) {
          const urlObj = new URL(`http://localhost${path}`);
          const dishId = urlObj.searchParams.get('dish_id');
          
          if (init.method === 'POST') {
            const body = JSON.parse(init.body as string);
            await supabase.from('dish_recipes').delete().eq('dish_id', body.dish_id);
            if (body.items && body.items.length > 0) {
              const rows = body.items.map((it: any) => ({
                id: crypto.randomUUID(),
                dish_id: body.dish_id,
                ingredient_id: it.ingredient_id,
                quantity_needed: Number(it.quantity_needed || it.quantity_required || 0),
                unit: it.unit || 'pcs'
              }));
              const { error } = await supabase.from('dish_recipes').insert(rows);
              if (error) throw error;
            }
            return { success: true } as any;
          } else if (init.method === 'DELETE') {
            const parts = path.split('/');
            const dishId = parts[4];
            const ingredientId = parts[5];
            await supabase.from('dish_recipes').delete().eq('dish_id', dishId).eq('ingredient_id', ingredientId);
            return { success: true } as any;
          } else {
            const { data, error } = await supabase
              .from('dish_recipes')
              .select('*, ingredients:ingredient_id(*)')
              .eq('dish_id', dishId);
            if (error) throw error;
            
            return (data || []).map((dr: any) => ({
              id: dr.id,
              dish_id: dr.dish_id,
              ingredient_id: dr.ingredient_id,
              quantity_needed: dr.quantity_needed,
              unit: dr.unit,
              name: dr.ingredients?.name || 'Unknown',
              unit_cost: dr.ingredients?.cost_per_unit || 0
            })) as any;
          }
        }

        if (path.startsWith('/rest/v1/sales')) {
          const urlObj = new URL(`http://localhost${path}`);
          const storeId = urlObj.searchParams.get('store_id');
          
          const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('restaurant_id', storeId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          if (error) throw error;

          return (data || []).map((sale: any) => ({
            ...sale,
            order_status: sale.status,
            store_id: sale.restaurant_id,
            items: (sale.order_items || []).map((item: any) => ({
              id: item.id,
              sale_id: item.order_id,
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price),
              discount: Number(item.discount),
              total: Number(item.total),
              modifiers: item.modifiers,
              status: item.status,
            })),
          })) as any;
        }

        if (path.startsWith('/rest/v1/cash_register_closures')) {
          if (init.method === 'POST') {
            const body = JSON.parse(init.body as string);
            const userRes = await supabase.auth.getUser();
            const mapped = {
              id: crypto.randomUUID(),
              restaurant_id: body.store_id,
              worker_id: userRes.data.user?.id || null,
              opening_balance: Number(body.fonds_caisse || 0),
              expected_balance: Number(body.total_informatique || 0),
              actual_balance: Number(body.total_billetage || 0),
              difference: Number(body.ecart || 0),
              bill_details_json: JSON.stringify(body.billets_details || []),
              observations: body.observations || null,
              status: 'submitted',
              created_at: body.date || new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            const { error } = await supabase.from('cash_closings').insert(mapped);
            if (error) throw error;
            return { success: true } as any;
          }
        }

        if (path.includes('/analytics/stock-valuation')) {
          const urlObj = new URL(`http://localhost${path}`);
          const storeId = urlObj.searchParams.get('store_id');
          
          let query = supabase.from('menu_items').select('cost_price, unit_price, quantity');
          if (storeId) {
            query = query.eq('restaurant_id', storeId);
          }
          
          const { data, error } = await query;
          if (error) throw error;
          
          let total_cost = 0;
          let total_retail = 0;
          let item_count = 0;
          if (data) {
            for (const p of data) {
              const qty = Number(p.quantity) || 0;
              total_cost += (Number(p.cost_price) || 0) * qty;
              total_retail += (Number(p.unit_price) || 0) * qty;
              if (qty > 0) item_count++;
            }
          }
          return { total_cost, total_retail, item_count } as any;
        }

        if (path.startsWith('/rest/v1/stock/dashboard')) {
          const urlObj = new URL(`http://localhost${path}`);
          const storeId = urlObj.searchParams.get('store_id');
          if (!storeId) throw new Error('store_id is required');

          const { data: ingredientsData, error: ingError } = await supabase
            .from('ingredients')
            .select('*')
            .eq('restaurant_id', storeId)
            .is('deleted_at', null);
          if (ingError) throw ingError;

          const mappedIngredients = (ingredientsData || []).map((i: any) => ({
            id: i.id,
            store_id: i.restaurant_id,
            name: i.name,
            unit: i.unit,
            category: i.category,
            current_stock: Number(i.current_stock || 0),
            min_threshold: Number(i.min_threshold || 0),
            cost_per_unit: Number(i.cost_per_unit || 0),
            expiry_date: i.expiry_date,
            created_at: i.created_at,
            updated_at: i.updated_at
          }));

          const low_stock = mappedIngredients.filter(i => i.current_stock < i.min_threshold);
          const expiring_soon: any[] = [];
          const today = new Date();
          for (const i of mappedIngredients) {
            if (i.expiry_date) {
              const exp = new Date(i.expiry_date);
              const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              if (daysLeft >= 0 && daysLeft <= 3) {
                expiring_soon.push(i);
              }
            }
          }

          const { data: dishes, error: dishesError } = await supabase
            .from('menu_items')
            .select('id, name')
            .eq('restaurant_id', storeId)
            .is('deleted_at', null);
          if (dishesError) throw dishesError;

          const { data: recipes, error: recError } = await supabase
            .from('dish_recipes')
            .select('*, ingredients!inner(name, unit, current_stock)')
            .eq('ingredients.restaurant_id', storeId);
          if (recError) throw recError;

          const portions_remaining: any[] = [];
          for (const dish of (dishes || [])) {
            const dishRecipe = (recipes || []).filter((r: any) => r.dish_id === dish.id);
            if (dishRecipe.length > 0) {
              let maxPortions = Infinity;
              let limitingIngredientName = '—';

              for (const item of dishRecipe) {
                const ing = item.ingredients;
                if (!ing) continue;
                
                const convertQuantity = (qty: number, fromUnit: string, toUnit: string): number => {
                  if (fromUnit === toUnit) return qty;
                  const f = fromUnit.toLowerCase();
                  const t = toUnit.toLowerCase();
                  if (f === 'kg' && t === 'g') return qty * 1000;
                  if (f === 'g' && t === 'kg') return qty / 1000;
                  if (f === 'l' && t === 'ml') return qty * 1000;
                  if (f === 'ml' && t === 'l') return qty / 1000;
                  return qty;
                };

                const currentStockInRecipeUnit = convertQuantity(Number(ing.current_stock || 0), ing.unit, item.unit);
                const possiblePortions = item.quantity_needed > 0 ? (currentStockInRecipeUnit / Number(item.quantity_needed)) : Infinity;
                if (possiblePortions < maxPortions) {
                  maxPortions = possiblePortions;
                  limitingIngredientName = ing.name;
                }
              }

              portions_remaining.push({
                dish_id: dish.id,
                dish_name: dish.name,
                max_portions: maxPortions === Infinity ? 0 : Math.floor(maxPortions),
                limiting_ingredient: maxPortions === Infinity ? undefined : limitingIngredientName,
              });
            }
          }

          return {
            ingredients: mappedIngredients,
            portions_remaining,
            expiring_soon,
            low_stock
          } as any;
        }

        if (path.includes('/restock')) {
          const parts = path.split('/');
          const id = parts[3];
          const body = JSON.parse(init.body as string);

          const { data: existing, error: getErr } = await supabase
            .from('ingredients')
            .select('*')
            .eq('id', id)
            .single();
          if (getErr || !existing) throw new Error('Ingredient not found');

          const newStock = Number(existing.current_stock || 0) + Number(body.quantity || 0);
          const now = new Date().toISOString();

          const { error: updErr } = await supabase
            .from('ingredients')
            .update({ current_stock: newStock, updated_at: now })
            .eq('id', id);
          if (updErr) throw updErr;

          const movementId = crypto.randomUUID();
          const { error: movErr } = await supabase
            .from('ingredient_movements')
            .insert({
              id: movementId,
              ingredient_id: id,
              movement_type: 'restock',
              quantity_delta: Number(body.quantity || 0),
              note: body.note || 'Réapprovisionnement de stock manuel',
              created_at: now
            });
          if (movErr) throw movErr;

          return { success: true } as any;
        }

        if (path.includes('/waste')) {
          const parts = path.split('/');
          const id = parts[3];
          const body = JSON.parse(init.body as string);

          const { data: existing, error: getErr } = await supabase
            .from('ingredients')
            .select('*')
            .eq('id', id)
            .single();
          if (getErr || !existing) throw new Error('Ingredient not found');

          const newStock = Math.max(0, Number(existing.current_stock || 0) - Number(body.quantity || 0));
          const now = new Date().toISOString();

          const { error: updErr } = await supabase
            .from('ingredients')
            .update({ current_stock: newStock, updated_at: now })
            .eq('id', id);
          if (updErr) throw updErr;

          const movementId = crypto.randomUUID();
          const { error: movErr } = await supabase
            .from('ingredient_movements')
            .insert({
              id: movementId,
              ingredient_id: id,
              movement_type: 'waste',
              quantity_delta: -Number(body.quantity || 0),
              note: body.note || 'Déchet / perte déclarée manuellement',
              created_at: now
            });
          if (movErr) throw movErr;

          return { success: true } as any;
        }

        if (path.includes('/movements')) {
          const parts = path.split('/');
          const id = parts[3];

          const { data: movements, error: movError } = await supabase
            .from('ingredient_movements')
            .select('*, menu_items(name)')
            .eq('ingredient_id', id)
            .order('created_at', { ascending: false });
          if (movError) throw movError;

          return (movements || []).map((m: any) => ({
            id: m.id,
            ingredient_id: m.ingredient_id,
            movement_type: m.movement_type,
            quantity_delta: Number(m.quantity_delta),
            related_dish_id: m.related_dish_id,
            order_id: m.order_id,
            dish_name: m.menu_items?.name || null,
            note: m.note,
            created_at: m.created_at
          })) as any;
        }
      } catch (err) {
        console.error('🚫 [OfflineAuth] Supabase direct client request failed:', err);
        throw err;
      }
    }

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
      if (response.status === 401 && retry && getDataClient().isLocalFirst) {
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
      // 1. ONLINE FIRST: Try Supabase
      console.log('[OfflineAuth] Attempting online Supabase login first...');
      toast({ title: 'Attempting cloud login...', description: 'Connecting to Supabase...' });

      const { data, error: supaError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (supaError || !data.user) {
        throw supaError;
      }

      let store_id = data.user.user_metadata?.store_id || null;
      let userRole = data.user.user_metadata?.role;
      let store_object = null;
      
      try {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role, store_id')
          .eq('user_id', data.user.id);
        
        if (rolesError) {
          console.error('[OfflineAuth] user_roles query failed:', rolesError);
        } else if (rolesData && rolesData.length > 0) {
           userRole = rolesData[0].role;
           if (!store_id && rolesData[0].store_id) {
             store_id = rolesData[0].store_id;
           }
        }
      } catch (e) {
        console.warn('[OfflineAuth] Exception fetching roles from supabase', e);
      }
      
      if (!userRole || userRole === 'worker') {
          try {
             const { data: ownedStores, error: storesError } = await supabase
               .from('restaurants')
               .select('*')
               .eq('owner_id', data.user.id)
               .limit(1);
             
             if (storesError) {
               console.error('[OfflineAuth] restaurants query failed:', storesError);
             } else if (ownedStores && ownedStores.length > 0) {
                userRole = 'master';
                store_id = ownedStores[0].id;
                store_object = ownedStores[0];
             }
          } catch (e) {
             console.warn('[OfflineAuth] Exception checking owned restaurants', e);
          }
      }
        
      let finalRole = userRole || undefined;
      
      if (!store_object && !store_id && finalRole === 'master') {
          const { data: stores } = await supabase
            .from('restaurants')
            .select('*')
            .eq('owner_id', data.user.id)
            .limit(1);
          
          if (stores && stores.length > 0) {
             store_id = stores[0].id;
             store_object = stores[0];
          }
      }

      // If store_id or role on Supabase user_metadata is missing or different, update it
      const currentMeta = data.user.user_metadata || {};
      if (store_id && (currentMeta.store_id !== store_id || currentMeta.role !== finalRole)) {
        console.log('[OfflineAuth] Updating Supabase user metadata with store_id:', store_id, 'role:', finalRole);
        try {
          await supabase.auth.updateUser({
            data: {
              store_id: store_id,
              role: finalRole || 'master'
            }
          });
        } catch (metaErr) {
          console.error('[OfflineAuth] Failed to update user metadata on Supabase:', metaErr);
        }
      }

      if (!getDataClient().isLocalFirst) {
        // Pure Cloud: Save session to LocalDatabase (IndexedDB) directly
        await this.saveOfflineSession(
          data.user,
          data.session,
          finalRole || 'master',
          store_id || '',
          data.user.user_metadata?.full_name || 'Cloud User',
          password
        );

        const mockUser: User = {
          id: data.user.id,
          email: data.user.email,
          app_metadata: data.user.app_metadata || {},
          user_metadata: {
            ...data.user.user_metadata,
            full_name: data.user.user_metadata?.full_name || 'Cloud User',
            store_id: store_id,
            role: finalRole,
          },
          aud: data.user.aud || 'authenticated',
          created_at: data.user.created_at || new Date().toISOString(),
        } as User;

        const mockSession: Session = {
          access_token: data.session?.access_token || '',
          refresh_token: data.session?.refresh_token || '',
          expires_in: data.session?.expires_in || 3600,
          token_type: data.session?.token_type || 'bearer',
          user: mockUser,
        } as Session;

        const mockRoles: UserRole[] = [{
          id: `${data.user.id}-${finalRole || 'master'}`,
          user_id: data.user.id,
          role: (finalRole || 'master') as any,
          store_id: store_id || undefined,
          created_at: new Date().toISOString(),
        }];

        toast({ title: 'Cloud login successful', description: 'Logged in online securely.' });
        return {
          user: mockUser,
          session: mockSession,
          roles: mockRoles,
          isOffline: false
        };
      }

      const syncResponse = await this.localBridgeRequest<LocalBridgeLoginResponse>(
        '/auth/sync-cloud-login',
        {
          method: 'POST',
          body: JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            password,
            full_name: data.user.user_metadata?.full_name || 'Cloud User',
            role: finalRole,
            store_id: store_id,
            store_object: store_object,
          }),
        }
      );

      const cache = this.saveLocalBridgeSession(syncResponse);

      // Post-sync update: If store_id was resolved locally but is missing or different on Supabase, update it now
      const resolvedStoreId = syncResponse.user?.store_id;
      const resolvedRole = syncResponse.user?.role || finalRole || 'master';
      if (resolvedStoreId && (!currentMeta.store_id || currentMeta.store_id !== resolvedStoreId || currentMeta.role !== resolvedRole)) {
        console.log('[OfflineAuth] Post-sync: Updating Supabase user metadata with resolved store_id:', resolvedStoreId, 'role:', resolvedRole);
        try {
          await supabase.auth.updateUser({
            data: {
              store_id: resolvedStoreId,
              role: resolvedRole
            }
          });
          console.log('[OfflineAuth] Supabase user metadata successfully updated post-sync.');
        } catch (metaErr) {
          console.error('[OfflineAuth] Failed to update user metadata on Supabase post-sync:', metaErr);
        }
      }

      toast({ title: 'Cloud sync successful', description: 'Logged in online securely.' });
      return this.mapCacheToResult(cache);

    } catch (onlineError: any) {
      console.log('[OfflineAuth] Online login failed (offline or invalid). Attempting local fallback...', onlineError);
      toast({ title: 'Cloud unavailable', description: 'Logging in offline...', variant: 'destructive' });
      
      if (!getDataClient().isLocalFirst) {
        // Pure Cloud: Call legacy offline sign-in directly using IndexedDB cached session
        return this.legacyOfflineSignIn(email, password);
      }

      try {
        // 2. OFFLINE FALLBACK: Try Local Bridge
        const response = await this.localBridgeRequest<LocalBridgeLoginResponse>(
          '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }
        );

        const cache = this.saveLocalBridgeSession(response);
        return this.mapCacheToResult(cache);
      } catch (localError: any) {
        const cloudMsg = onlineError?.message || onlineError?.error_description || 'Network error';
        const localMsg = localError?.message || localError?.error || 'Database error';
        return {
          user: null,
          session: null,
          roles: [],
          error: `Cloud: ${cloudMsg}. Local: ${localMsg}`,
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

  static async saveOfflineSession(
    user: any,
    session: any,
    role: string,
    storeId: string,
    fullName: string,
    password?: string
  ): Promise<void> {
    try {
      await LocalDatabase.init();
      
      const passwordHash = password ? LocalDatabase.hashPassword(password) : '';

      // 1. Save user
      await LocalDatabase.saveUser({
        id: user.id,
        email: user.email || '',
        password_hash: passwordHash,
        full_name: fullName,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced: true,
        is_active: true,
      });

      // 2. Save role
      await LocalDatabase.saveRole({
        id: `${user.id}-${role}`,
        user_id: user.id,
        role: role as any,
        store_id: storeId,
        created_at: new Date().toISOString(),
        synced: true,
      });

      // 3. Save session
      await LocalDatabase.saveSession({
        user: {
          id: user.id,
          email: user.email,
          app_metadata: user.app_metadata || {},
          user_metadata: {
            ...user.user_metadata,
            full_name: fullName,
            store_id: storeId,
            role: role,
          },
          aud: user.aud || 'authenticated',
          created_at: user.created_at || new Date().toISOString(),
        },
        session: {
          access_token: session?.access_token || '',
          refresh_token: session?.refresh_token || '',
          expires_in: session?.expires_in || 3600,
          token_type: session?.token_type || 'bearer',
        },
        timestamp: Date.now(),
      });
      console.log('[OfflineAuthService] Saved offline session successfully.');
    } catch (e) {
      console.error('[OfflineAuthService] Failed to save offline session:', e);
    }
  }

  private static async restoreLocalBridgeSession(): Promise<OfflineAuthResult | null> {
    const cache = await this.getValidLocalBridgeSession();
    if (!cache) return null;
    return this.mapCacheToResult(cache);
  }

  static async getAuthHeaders(): Promise<Record<string, string> | null> {
    const dc = getDataClient();
    if (!dc.isLocalFirst) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      return {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${token}`
      };
    }
    const cache = await this.getValidLocalBridgeSession();
    if (!cache) return null;
    return { Authorization: `Bearer ${cache.accessToken}` };
  }

  private static async localBridgeLogout() {
    const cache = this.getLocalBridgeSession();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOCALBRIDGE_SESSION_KEY);
    }
    if (!cache) {
      return;
    }

    // Call backend logout in background without awaiting, preventing network/backend slowdown from blocking logout UI
    this.localBridgeRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: cache.refreshToken }),
    }).catch((error) => {
      console.warn('LocalBridge logout failed (in background):', error);
    });
  }
  
  static async verifyMasterPassword(password: string): Promise<boolean> {
    if (this.isLocalBridgeMode()) {
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

    // Pure Cloud mode: Verify against master password cached in browser IndexedDB
    try {
      await LocalDatabase.init();
      const users = await LocalDatabase.getAllUsers();
      for (const u of users) {
        const roles = await LocalDatabase.getRolesByUserId(u.id);
        const isMaster = roles.some(r => r.role === 'master');
        if (isMaster && u.password_hash) {
          if (LocalDatabase.verifyPassword(password, u.password_hash)) {
            return true;
          }
        }
      }
      return false;
    } catch (e) {
      console.error('[OfflineAuth] verifyMasterPassword cloud fallback error:', e);
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
        sub_role: r.sub_role,
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
        sub_role: r.sub_role,
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
