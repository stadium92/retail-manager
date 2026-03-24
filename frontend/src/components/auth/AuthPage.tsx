import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultDashboardRoute } from '@/utils/accessControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Store } from 'lucide-react';
import { z } from 'zod';
import { InvitationService } from '@/services/InvitationService';
import { useToast } from '@/hooks/use-toast';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, signIn, signUp, rolesLoading, hasRole, roles, loading: authLoading, devLogin, isBackendReady } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check for invitation token
  const invitationToken = searchParams.get('token');

  // Check if user came from "Get Started" button
  const fromGetStarted = (location.state as any)?.fromGetStarted === true;

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  });

  useEffect(() => {
    console.log('🔐 AuthPage useEffect - user:', !!user, 'rolesLoading:', rolesLoading, 'roles.length:', roles.length, 'authLoading:', authLoading, 'fromGetStarted:', fromGetStarted);

    // If auth check is complete and no user
    if (!authLoading && !user) {
      console.log('👤 No user found - showing login form');
      // We no longer force redirect to landing page to prevent loops
    }

    // Wait for roles to load before redirecting authenticated users
    // Only redirect if user is authenticated, roles are loaded, AND roles exist
    if (user && !rolesLoading && roles.length > 0) {
      console.log('🚀 User authenticated with roles, navigating to dashboard...');
      const timeout = setTimeout(() => {
        const userRoles = roles.map(r => r.role);
        const dashboardRoute = getDefaultDashboardRoute(userRoles);
        console.log('📍 Navigating to', dashboardRoute, 'for roles:', userRoles);
        navigate(dashboardRoute, { replace: true });
      }, 100);
      return () => clearTimeout(timeout);
    } else if (user && !rolesLoading && roles.length === 0) {
      console.log('⚠️ User exists but no roles found - staying on auth page');
    }
  }, [user, rolesLoading, roles, navigate, authLoading, fromGetStarted]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      loginSchema.parse(loginData);
      setLoading(true);

      const { error } = await signIn(loginData.email, loginData.password);

      if (error) {
        setErrors({ form: error.message });
        setLoading(false);
      } else {
        // If no error, we expect roles to load via context
        // But if roles are empty after sign-in, we need to stop loading manually after a timeout
        // or check if we got roles. signIn in AuthContext sets roles.
        // If signIn returned no error but roles are empty, it means user has no roles.
        // We can't easily check AuthContext state *here* instantly because it's async update.
        // But we can set a timeout to stop loading if redirect doesn't happen.
        setTimeout(() => {
           setLoading(false);
           // If we are still here, it means no redirect happened
           // We can check user roles from context? No, closure stale.
           // But if we are here, we can assume something went wrong with role assignment
           // or we are just waiting.
           // Better: rely on useEffect to redirect. 
           // If we stop loading, the user sees the form again "signed in".
        }, 5000);
      }
      // Navigation will be handled by the useEffect hook when roles are loaded
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      signupSchema.parse(signupData);
      setLoading(true);

      const { error } = await signUp(
        signupData.email,
        signupData.password,
        signupData.fullName
      );

      if (error) {
        setErrors({ form: error.message });
        setLoading(false);
        return;
      }

      // If invitation token exists, accept it
      if (invitationToken) {
        const { error: inviteError } = await InvitationService.acceptInvitation(invitationToken);
        if (inviteError) {
          toast({
            title: 'Warning',
            description: 'Account created but failed to accept invitation',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Success',
            description: 'Account created and invitation accepted!',
          });
        }
      }

      // Navigation will be handled by the useEffect hook when roles are loaded
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
      setLoading(false);
    }
  };

  // Show loading spinner while checking authentication
  if (authLoading || (user && rolesLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no user and auth check is complete, show the form (handled by return below)


  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl">
            <img src="/logo.png" alt="Djati Logo" className="h-full w-full object-contain" />
          </div>
          <CardTitle className="text-3xl font-black uppercase tracking-tighter">Djati</CardTitle>
          <CardDescription>
            {t('auth.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signup')}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t('auth.email')}</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    disabled={loading}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">{t('auth.password')}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    disabled={loading}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                {errors.form && (
                  <p className="text-sm text-destructive">{errors.form}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.signingIn')}
                    </>
                  ) : (
                    t('auth.signIn')
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t('auth.fullName')}</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={signupData.fullName}
                    onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                    disabled={loading}
                    className={errors.fullName ? 'border-destructive' : ''}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('auth.email')}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    disabled={loading}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('auth.password')}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    disabled={loading}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">{t('auth.confirmPassword')}</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={signupData.confirmPassword}
                    onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                    disabled={loading}
                    className={errors.confirmPassword ? 'border-destructive' : ''}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                {errors.form && (
                  <p className="text-sm text-destructive">{errors.form}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.creatingAccount')}
                    </>
                  ) : (
                    t('auth.createAccount')
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}