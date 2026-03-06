import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@/services/OfflineAuthService';
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
        if (offlineSession && offlineSession.user) {
          console.log('Restored offline session');
          setUser(offlineSession.user);
          setSession(offlineSession.session);
          setRoles(offlineSession.roles);
          setLoading(false);
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

    // Fallback: create locally and queue for sync
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
