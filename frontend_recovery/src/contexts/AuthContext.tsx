import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, UserRole } from '@/types';
import { toast } from '@/hooks/use-toast';
import { DEV_MODE_UUIDS } from '@/utils/devMode';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { getDataClient } from '@/lib/dataClient';
import { SyncService } from '@/services/SyncService';
import { LocalDatabase } from '@/services/LocalDatabase';
import i18n from '@/i18n/config';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: UserRole[];
  loading: boolean;
  rolesLoading: boolean;
  isOffline: boolean;
  isBackendReady: boolean;
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
  const rolesLoadingStartTimeRef = useRef<number | null>(null);

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
          console.log('âœ… [AuthContext] Backend is READY');
          setIsBackendReady(true);
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
      // Try local roles first (faster, works offline)
      await LocalDatabase.init();
      const localRoles = await LocalDatabase.getRolesByUserId(userId);
      
      if (localRoles.length > 0 && !navigator.onLine) {
        console.log('Using cached local roles:', localRoles);
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

      console.log('Fetching roles from Supabase...');
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase request timed out')), 5000)
      );

      const rolesPromise = supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      // Race the query against the timeout
      const { data, error } = await Promise.race([
        rolesPromise.then(res => ({ data: res.data, error: res.error })),
        timeoutPromise.then(() => ({ data: null, error: { message: 'Timeout' } }))
      ]) as any;

      console.log('Supabase query result:', { data, error });

      if (error) {
        console.error('Error fetching user roles:', error);
        // Fall back to local roles if available, regardless of online status
        if (localRoles.length > 0) {
          console.log('Falling back to cached local roles:', localRoles);
          setRoles(localRoles.map(r => ({
            id: r.id,
            user_id: r.user_id,
            role: r.role as AppRole,
            store_id: r.store_id,
            created_at: r.created_at,
          })));
        } else {
          const devRole = determineRoleFromDevId(userId);
          if (devRole) {
            setRoles([{
              id: 'temp-dev',
              user_id: userId,
              role: devRole,
              store_id: undefined,
              created_at: new Date().toISOString()
            }]);
          } else {
            setRoles([]);
          }
        }
        setRolesLoading(false);
        return;
      }

      if (data && data.length > 0) {
        console.log('Found roles from database:', data);
        setRoles(data);
        
        // Cache roles locally for offline use
        for (const role of data) {
          await LocalDatabase.saveRole({
            id: role.id,
            user_id: role.user_id,
            role: role.role as 'master' | 'worker' | 'deliverer',
            store_id: role.store_id || undefined,
            created_at: role.created_at,
            synced: true,
          });
        }
        
        setRolesLoading(false);
        return;
      }

      console.log('No roles found in database for user:', userId);
      
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
        console.warn('Real user has no roles assigned. User should contact admin.');
        setRoles([]);
      }
      setRolesLoading(false);
    } catch (err) {
      console.error('Unexpected error in fetchUserRoles:', err);
      
      // Attempt fallback to local roles on crash/timeout
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

      // Check for offline session first
      try {
        const offlineSession = await OfflineAuthService.getOfflineSession();
        if (offlineSession && offlineSession.user && !navigator.onLine) {
          console.log('Restored offline session');
          setUser(offlineSession.user);
          setSession(offlineSession.session);
          setRoles(offlineSession.roles);
          setLoading(false);
          return () => clearInterval(safetyInterval);
        }
      } catch (err) {
        console.warn('Failed to restore offline session:', err);
        // Continue to Supabase check
      }

      // Set up auth state listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state changed:', event, session?.user?.id);
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            rolesLoadingStartTimeRef.current = Date.now();
            await fetchUserRoles(session.user.id);
          } else {
            setRoles([]);
            setRolesLoading(false);
            rolesLoadingStartTimeRef.current = null;
          }

          setLoading(false);
        }
      );

      // Check for existing session
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        console.log('🔍 getSession result:', {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email
        });
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('✅ Found cached session, fetching roles...');
          fetchUserRoles(session.user.id);
        } else if (offlineSession?.user) {
          // No online session but we have offline session
          console.log('Using offline session fallback');
          setUser(offlineSession.user);
          setSession(offlineSession.session);
          setRoles(offlineSession.roles);
          setLoading(false);
        } else {
          console.log('❌ No cached session found');
          setLoading(false);
        }
      });

      return () => {
        subscription.unsubscribe();
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

  const signIn = async (email: string, password: string) => {
    console.log('ðŸ” AuthContext.signIn called for:', email);
    // Use OfflineAuthService which handles both online and offline
    const result = await OfflineAuthService.signIn(email, password);
    console.log('ðŸ” AuthContext.signIn result:', result);

    if (result.error) {
      toast({
        title: 'Sign In Error',
        description: result.error,
        variant: 'destructive',
      });
      return { error: { message: result.error } };
    }

    if (result.user && result.session) {
      setUser(result.user);
      setSession(result.session);
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
    const isOnline = navigator.onLine;

    if (!dataClient.isLocalFirst && isOnline) {
      // Online signup via Supabase
      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: fullName },
        },
      });

      if (error) {
        toast({
          title: 'Sign Up Error',
          description: error.message,
          variant: 'destructive',
        });
        return { error };
      }

      // Cache for offline use
      if (data.user) {
        await LocalDatabase.init();
        await LocalDatabase.saveUser({
          id: data.user.id,
          email,
          password_hash: LocalDatabase.hashPassword(password),
          full_name: fullName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          synced: true,
        });
      }

      toast({
        title: 'Account Created!',
        description: 'Your account has been created successfully.',
      });

      return { error: null };
    }

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

    // Offline signup (non-LocalBridge) - create locally and queue for sync
    const result = await OfflineAuthService.createUser(email, password, fullName, 'worker');
    
    if (!result.success) {
      toast({
        title: 'Sign Up Error',
        description: result.error || 'Failed to create account',
        variant: 'destructive',
      });
      return { error: { message: result.error } };
    }

    // Auto sign in the new offline user
    const signInResult = await OfflineAuthService.offlineSignIn(email, password);
    if (signInResult.user) {
      setUser(signInResult.user);
      setSession(signInResult.session);
      setRoles(signInResult.roles);
    }

    toast({
      title: 'Account Created (Offline)',
      description: 'Your account will be synced when back online.',
    });

    return { error: null };
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
