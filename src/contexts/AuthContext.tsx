import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@/services/OfflineAuthService';
import { AppRole, UserRole } from '@/types';
import { toast } from '@/hooks/use-toast';
import { DEV_MODE_UUIDS } from '@/utils/devMode';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { SyncService } from '@/services/SyncService';
import { LocalBridgeSyncService } from '@/services/LocalBridgeSyncService';
import { LocalDatabase } from '@/services/LocalDatabase';
import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
 
interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  loading: boolean;
  rolesLoading: boolean;
  isOffline: boolean;
  isBackendReady: boolean;
  isBootstrapped: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  devLogin: (role?: AppRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const dataClient = getDataClient();
  console.log('ðŸ” AuthProvider Init - Mode:', dataClient.mode, 'isLocalFirst:', dataClient.isLocalFirst);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(true);
  const rolesLoadingStartTimeRef = useRef<number | null>(null);

    // 3. Proactive Session Heartbeat: Keep LocalBridge token fresh
  useEffect(() => {
    if (!user) return;
    
    console.log('[AuthContext] Initializing proactive session heartbeat');
    const heartbeat = setInterval(async () => {
        try {
            await OfflineAuthService.getAuthHeaders();
        } catch (e) {
            console.warn('[AuthContext] Heartbeat refresh failed:', e);
        }
    }, 600_000); // Every 10 minutes (5 min before 15-min token expiry)

    return () => clearInterval(heartbeat);
  }, [user]);

  useEffect(() => {
    const activeRole = roles[0];
    const storeId = activeRole?.store_id;

    if (storeId) {
      console.log('[AuthContext] Auto-starting LocalBridgeSyncService for store:', storeId);
      LocalBridgeSyncService.start(storeId);

      // Proactively check and update Supabase user_metadata if it is out of sync
      if (navigator.onLine) {
        (async () => {
          try {
            const { data: { session: supaSession } } = await supabase.auth.getSession();
            if (supaSession && supaSession.user) {
              const currentMeta = supaSession.user.user_metadata || {};
              const role = activeRole.role;
              if (!currentMeta.store_id || currentMeta.store_id !== storeId || currentMeta.role !== role) {
                console.log('[AuthContext] Supabase metadata out of sync on startup. Updating...', { storeId, role });
                await supabase.auth.updateUser({
                  data: {
                    store_id: storeId,
                    role: role
                  }
                });
                console.log('[AuthContext] Supabase metadata successfully updated on startup.');
              }
            }
          } catch (e) {
            console.warn('[AuthContext] Failed to check/update Supabase metadata on startup:', e);
          }
        })();
      }

      return () => {
        console.log('[AuthContext] Stopping LocalBridgeSyncService');
        LocalBridgeSyncService.stop();
      };
    }
  }, [roles]);

  // Poll Backend Readiness
  useEffect(() => {
    const dataClient = getDataClient();
    if (!dataClient.isLocalFirst) {
      setIsBackendReady(true);
      return;
    }

    let isMounted = true;
    let pollInterval: NodeJS.Timeout;
    const healthUrl = `${dataClient.localBridgeBaseUrl}/health`;
    const startTime = Date.now();
    let warningShown = false;

    const checkHealth = async () => {
      try {
        const response = await fetch(healthUrl);
        if (response.ok && isMounted) {
          const data = await response.json();
          console.log('✅ [AuthContext] Backend is READY, bootstrapped:', data.isBootstrapped);
          setIsBackendReady(true);
          setIsBootstrapped(data.isBootstrapped !== false);
          toast({
            title: i18n.t('sync.systemReady'),
            description: i18n.t('sync.systemReadyDesc'),
          });
          return true;
        }
      } catch (e) {
        // Not ready yet
        if (isMounted && !warningShown && (Date.now() - startTime > 10000)) {
          warningShown = true;
          toast({
            title: i18n.t('sync.slowStartup'),
            description: i18n.t('sync.slowStartupDesc'),
            variant: 'destructive',
          });
        }
      }
      return false;
    };

    const startPolling = async () => {
      console.log('ðŸ” [AuthContext] Starting backend health poll at:', healthUrl);
      
      // Try immediately
      if (await checkHealth()) return;

      // Then poll every 1s
      pollInterval = setInterval(async () => {
        if (await checkHealth()) {
          clearInterval(pollInterval);
        }
      }, 1000);
    };

    startPolling();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast({
        title: i18n.t('sync.backOnline'),
        description: i18n.t('sync.syncingPending'),
      });
      SyncService.syncAll();
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast({
        title: i18n.t('sync.offlineMode'),
        description: i18n.t('sync.workingOffline'),
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchUserRoles = async (userId: string) => {
    console.log('fetchUserRoles called for userId:', userId);
    setRolesLoading(true);

    const determineRoleFromDevId = (id: string): AppRole | null => {
      if (id === DEV_MODE_UUIDS['dev-worker']) return 'worker';
      if (id === DEV_MODE_UUIDS['dev-deliverer']) return 'deliverer';
      if (id === DEV_MODE_UUIDS['dev-master']) return 'master';
      return null;
    };

    try {
      const dataClient = getDataClient();
      if (!dataClient.isLocalFirst && navigator.onLine) {
        try {
          const { data: supaRoles, error: supaErr } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', userId);

          if (!supaErr && supaRoles && supaRoles.length > 0) {
            console.log('Using Supabase cloud roles:', supaRoles);
            const mappedRoles = supaRoles.map(r => ({
              id: r.id,
              user_id: r.user_id,
              role: r.role as AppRole,
              store_id: r.store_id,
              created_at: r.created_at,
            }));
            setRoles(mappedRoles);

            // Save updated roles to LocalDatabase
            LocalDatabase.deleteRolesByUserId(userId).then(async () => {
              for (const r of supaRoles) {
                await LocalDatabase.saveRole({
                  id: r.id,
                  user_id: r.user_id,
                  role: r.role as any,
                  store_id: r.store_id || null,
                  created_at: r.created_at || new Date().toISOString(),
                  synced: true,
                });
              }
              console.log('[AuthContext] Successfully synced fresh roles to local IndexedDB.');
            }).catch(dbErr => console.error('[AuthContext] Failed to save roles to local IndexedDB:', dbErr));

            const ROLE_PRIORITY: Record<string, number> = {
              master: 4,
              worker: 3,
              deliverer: 2,
              customer: 1,
            };
            const bestRow = supaRoles.reduce((best, current) => {
              const bestP = ROLE_PRIORITY[best.role] ?? 0;
              const currP = ROLE_PRIORITY[current.role] ?? 0;
              return currP > bestP ? current : best;
            });
            const storeId = bestRow.store_id;
            const role = bestRow.role;

            if (storeId) {
              setUser(prev => {
                if (prev && (prev.user_metadata?.store_id !== storeId || prev.user_metadata?.role !== role)) {
                  console.log('[AuthContext] fetchUserRoles updating local user state metadata:', storeId, role);
                  supabase.auth.updateUser({
                    data: {
                      store_id: storeId,
                      role: role,
                    }
                  }).catch(err => console.error('[AuthContext] fetchUserRoles background metadata update failed:', err));

                  return {
                    ...prev,
                    user_metadata: {
                      ...prev.user_metadata,
                      store_id: storeId,
                      role: role,
                    }
                  };
                }
                return prev;
              });
            }

            setRolesLoading(false);
            return;
          }
        } catch (supaErr) {
          console.warn('Failed to fetch roles from Supabase, falling back to IndexedDB:', supaErr);
        }
      }

      // Use local roles only
      await LocalDatabase.init();
      const localRoles = await LocalDatabase.getRolesByUserId(userId);
      
      if (localRoles.length > 0) {
        console.log('Using local roles:', localRoles);
        setRoles(localRoles.map(r => ({
          id: r.id,
          user_id: r.user_id,
          role: r.role as AppRole,
          store_id: r.store_id,
          created_at: r.created_at,
        })));
        setRolesLoading(false);
        return;
      }

      console.log('No roles found locally for user:', userId);
      
      const devRole = determineRoleFromDevId(userId);
      if (devRole) {
        console.log('Dev user detected, using role:', devRole);
        setRoles([{
          id: 'temp-dev',
          user_id: userId,
          role: devRole,
          store_id: undefined,
          created_at: new Date().toISOString()
        }]);
      } else {
        console.warn('User has no roles assigned. User should contact admin.');
        setRoles([]);
      }
      setRolesLoading(false);
    } catch (err) {
      console.error('Unexpected error in fetchUserRoles:', err);
      
      // Attempt fallback to local roles on crash
      try {
        await LocalDatabase.init();
        const localRoles = await LocalDatabase.getRolesByUserId(userId);
        if (localRoles.length > 0) {
          console.log('Recovered using cached local roles:', localRoles);
          setRoles(localRoles.map(r => ({
            id: r.id,
            user_id: r.user_id,
            role: r.role as AppRole,
            store_id: r.store_id,
            created_at: r.created_at,
          })));
        } else {
          setRoles([]);
        }
      } catch (dbErr) {
        console.error('Failed to recover local roles:', dbErr);
        setRoles([]);
      }
      
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // Safety mechanism for rolesLoading
      const safetyInterval = setInterval(() => {
        if (rolesLoading) {
          const now = Date.now();
          if (!rolesLoadingStartTimeRef.current) {
            rolesLoadingStartTimeRef.current = now;
          } else if (now - rolesLoadingStartTimeRef.current > 3000) {
            console.warn('Safety mechanism: rolesLoading stuck for >3s, forcing to false');
            setRolesLoading(false);
            rolesLoadingStartTimeRef.current = null;
          }
        } else {
          rolesLoadingStartTimeRef.current = null;
        }
      }, 500);

      // Restore session from local storage / local bridge
      try {
        const offlineSession = await OfflineAuthService.getOfflineSession();
        if (offlineSession?.user) {
          console.log('Restored offline session');
          setUser(offlineSession.user);
          setSession(offlineSession.session);

          // Sync with global Supabase client in cloud mode
          if (offlineSession.session && !dataClient.isLocalFirst) {
            console.log('[AuthContext] Restoring Supabase client session');
            try {
              await supabase.auth.setSession({
                access_token: offlineSession.session.access_token,
                refresh_token: offlineSession.session.refresh_token,
              });
            } catch (e) {
              console.warn('[AuthContext] Failed to sync restored session to Supabase client:', e);
            }
          }

          setRoles(offlineSession.roles);
          setLoading(false);

          // Non-blocking background role sync — does NOT block the UI.
          if (navigator.onLine) {
            setTimeout(() => {
              fetchUserRoles(offlineSession.user.id).catch(e =>
                console.warn('[AuthContext] Background role sync failed:', e)
              );
            }, 1000);
          }

          return () => {
            clearInterval(safetyInterval);
            rolesLoadingStartTimeRef.current = null;
          };
        }
      } catch (err) {
        console.warn('Failed to restore offline session:', err);
      }

      // No session found
      console.log('No cached session found');
      setLoading(false);

      return () => {
        clearInterval(safetyInterval);
        rolesLoadingStartTimeRef.current = null;
      };
    };

    initializeAuth();

    // Force loading to false after 5 seconds to prevent infinite spinner
    const fallbackTimeout = setTimeout(() => {
      setLoading((currentLoading) => {
        if (currentLoading) {
          console.warn('Auth initialization timed out, forcing loading to false');
          return false;
        }
        return currentLoading;
      });
    }, 5000);

    return () => clearTimeout(fallbackTimeout);
  }, []);

  const runCloudBootstrapFlow = async (email: string, password: string) => {
    if (!navigator.onLine) {
      return { error: 'Internet connection is required for first-time account activation.' };
    }

    try {
      // 1. Authenticate with Supabase
      const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (supabaseError) {
        return { error: supabaseError.message };
      }

      if (!data.user) {
        return { error: 'Failed to retrieve cloud user details.' };
      }

      // 2. Extract user metadata
      const metadata = data.user.user_metadata || {};
      const fullName = metadata.full_name || 'Cloud User';
      let role = metadata.role || 'master';

      const emailLower = email.toLowerCase();
      if (emailLower === 'imsnsylla@gmail.com' || emailLower === 'bahsyllah223@gmail.com' || emailLower === 'ursula@master.com') {
        role = 'master';
      }
      
      let storeId = metadata.store_id;
      let storeName = metadata.store_name || 'Cloud Store';

      if (!storeId && role === 'master') {
        // Dynamically generate a store_id for a new master user if not pre-configured
        storeId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' 
          ? crypto.randomUUID() 
          : 'store-' + Math.random().toString(36).substring(2, 15);
        storeName = 'STIHL Store';
        console.log('[AuthContext] Dynamically generated storeId for master:', storeId);
      }

      if (!storeId) {
        return { error: 'Cloud account is missing required store association (store_id metadata).' };
      }

      // 3. Send credentials to local bridge
      const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/auth/bootstrap-cloud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data.user.id,
          email,
          password,
          full_name: fullName,
          role,
          store_id: storeId,
          store_name: storeName,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let message = 'Failed to bootstrap account locally.';
        try {
          const parsedErr = JSON.parse(errorText);
          message = parsedErr.message || parsedErr.error || message;
        } catch (e) {}
        return { error: message };
      }

      // 4. Sign in locally now that it has been bootstrapped
      const localResult = await OfflineAuthService.signIn(email, password);
      if (!localResult.error) {
        setIsBootstrapped(true);
      }
      return localResult;
    } catch (err: any) {
      console.error('Error during cloud bootstrap:', err);
      return { error: err.message || 'An unexpected error occurred during cloud bootstrap.' };
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔑 AuthContext.signIn called for:', email, 'isBootstrapped:', isBootstrapped);
    const dc = getDataClient();
    
    let result;
    if (!dc.isLocalFirst) {
      console.log('🌐 Direct cloud sign in...');
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          result = { error: error.message };
        } else if (!data.user || !data.session) {
          result = { error: 'Retrieval of user session failed.' };
        } else {
          // Fetch cloud user roles
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', data.user.id);

          result = {
            user: data.user,
            session: data.session,
            roles: rolesData || [],
            isOffline: false,
          };
        }
      } catch (err: any) {
        result = { error: err.message || 'Supabase authentication failed.' };
      }
    } else if (!isBootstrapped) {
      console.log('🔌 Running cloud designed account bootstrap flow...');
      result = await runCloudBootstrapFlow(email, password);
    } else {
      console.log('🔑 Running local sign in flow...');
      result = await OfflineAuthService.signIn(email, password);
      
      // Fallback: If local sign in fails and we are online, attempt to bootstrap/update from cloud
      if (result.error && navigator.onLine) {
        console.log('🔄 Local sign in failed but online. Attempting cloud bootstrap fallback...');
        const fallbackResult = await runCloudBootstrapFlow(email, password);
        if (!fallbackResult.error) {
          result = fallbackResult;
        }
      }
    }

    console.log('🔑 AuthContext.signIn result:', result);


    if (result.error) {
      toast({
        title: 'Sign In Error',
        description: typeof result.error === 'object' && result.error.message ? result.error.message : String(result.error),
        variant: 'destructive',
      });
      return { error: result.error };
    }

    if (result.user && result.session) {
      setUser(result.user);
      setSession(result.session);

      // Sync with global Supabase client in cloud mode
      if (result.session && !dataClient.isLocalFirst) {
        console.log('[AuthContext] Syncing Supabase client session on sign in');
        try {
          await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });
        } catch (e) {
          console.warn('[AuthContext] Failed to sync signed in session to Supabase client:', e);
        }
      }

      setRoles(result.roles);
      setIsOffline(result.isOffline);

      toast({
        title: result.isOffline ? 'Signed In (Offline)' : 'Welcome back!',
        description: result.isOffline 
          ? 'Using cached credentials. Changes will sync when online.'
          : 'You have successfully signed in.',
      });
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const dataClient = getDataClient();

    if (dataClient.isLocalFirst) {
      const bootstrapResult = await OfflineAuthService.bootstrapMaster(email, password, fullName);

      if (!bootstrapResult.success) {
        toast({
          title: 'Sign Up Error',
          description: bootstrapResult.error || 'Failed to create master account',
          variant: 'destructive',
        });
        return { error: { message: bootstrapResult.error } };
      }

      const signInResult = await OfflineAuthService.signIn(email, password);
      if (signInResult.user) {
        setUser(signInResult.user);
        setSession(signInResult.session);
        setRoles(signInResult.roles);
        setIsOffline(signInResult.isOffline);
      }

      toast({
        title: 'Master Account Created',
        description: 'LocalBridge master account is ready.',
      });

      return { error: null };
    }

    // Pure Cloud mode: Register user on Supabase
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (signUpError) {
        toast({
          title: 'Sign Up Error',
          description: signUpError.message,
          variant: 'destructive',
        });
        return { error: signUpError };
      }

      if (!data.user) {
        toast({
          title: 'Sign Up Error',
          description: 'Failed to create account.',
          variant: 'destructive',
        });
        return { error: { message: 'Failed to create account' } };
      }

      // Auto sign in or show verification message
      if (data.session) {
        let role = 'master'; // default role
        const emailLower = email.toLowerCase();
        if (emailLower.includes('@worker.') || emailLower.startsWith('worker@') || emailLower.includes('@employee.') || emailLower.startsWith('employee@')) {
          role = 'worker';
        } else if (emailLower.includes('@deliverer.') || emailLower.startsWith('deliverer@') || emailLower.includes('@delivery.') || emailLower.startsWith('delivery@')) {
          role = 'deliverer';
        }

        // Generate a random store ID for new master registration
        const storeId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' 
          ? crypto.randomUUID() 
          : 'store-' + Math.random().toString(36).substring(2, 15);

        await OfflineAuthService.saveOfflineSession(data.user, data.session, role, storeId, fullName, password);
        
        setUser(data.user);
        setSession(data.session);
        setRoles([{
          id: `${data.user.id}-${role}`,
          user_id: data.user.id,
          role: role as any,
          store_id: storeId,
          created_at: new Date().toISOString()
        }]);
        
        toast({
          title: 'Account Created',
          description: 'Welcome to retail manager!',
        });
      } else {
        // If email confirmation is enabled, user needs to verify email first
        toast({
          title: 'Account Created',
          description: 'Please check your email inbox to verify your account.',
        });
      }

      return { error: null };
    } catch (err: any) {
      toast({
        title: 'Sign Up Error',
        description: err.message || 'An unexpected error occurred during sign up.',
        variant: 'destructive',
      });
      return { error: err };
    }
  };

  const devLogin = async (role: AppRole = 'master') => {
    let email = 'master@example.com';
    let fullName = 'Dev Master';
    let devKey: keyof typeof DEV_MODE_UUIDS = 'dev-master';

    if (role === 'worker') {
      email = 'worker@example.com';
      fullName = 'Dev Worker';
      devKey = 'dev-worker';
    } else if (role === 'deliverer') {
      email = 'deliverer@example.com';
      fullName = 'Dev Deliverer';
      devKey = 'dev-deliverer';
    }

    const id = DEV_MODE_UUIDS[devKey];

    const mockUser: User = {
      id: id,
      app_metadata: {},
      user_metadata: { full_name: fullName },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: email
    } as User;

    setUser(mockUser);
    setSession({
      access_token: 'fake',
      refresh_token: 'fake',
      expires_in: 3600,
      token_type: 'bearer',
      user: mockUser
    } as Session);

    toast({
      title: `Dev ${role.charAt(0).toUpperCase() + role.slice(1)} Login Success`,
      description: 'Bypassing Supabase auth...',
    });

    rolesLoadingStartTimeRef.current = Date.now();
    await fetchUserRoles(mockUser.id);
  };

  const signOut = async () => {
    try {
      // Always allow sign out - works offline too
      await OfflineAuthService.signOut();
      
      setUser(null);
      setSession(null);
      setRoles([]);

      if (!dataClient.isLocalFirst) {
        await supabase.auth.signOut().catch(e => console.warn('[AuthContext] Failed to sign out of Supabase client:', e));
      }
      
      toast({
        title: 'Signed Out',
        description: isOffline 
          ? 'Signed out. Pending changes will sync when back online.'
          : 'You have been signed out successfully.',
      });
    } catch (error) {
      console.error('Sign out error:', error);
      // Force clear state even if there's an error
      setUser(null);
      setSession(null);
      setRoles([]);

      if (!dataClient.isLocalFirst) {
        supabase.auth.signOut().catch(() => {});
      }
      
      toast({
        title: 'Signed Out',
        description: 'Session cleared.',
      });
    }
  };

  const hasRole = (role: AppRole) => {
    return roles.some((r) => r.role === role);
  };

  const value = {
    user,
    session,
    roles,
    loading,
    rolesLoading,
    isOffline,
    isBackendReady,
    isBootstrapped,
    signIn,
    signUp,
    signOut,
    hasRole,
    devLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
