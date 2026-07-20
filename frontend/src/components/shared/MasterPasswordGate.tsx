import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface MasterPasswordGateProps {
  children: React.ReactNode;
  moduleName?: string;
  onCancel?: () => void;
}

// Session-based cache to keep modules unlocked until navigation resets them
const unlockedModules = new Set<string>();

/**
 * Reset all unlocked gates (used during navigation)
 */
export const resetMasterPasswordGates = () => {
  unlockedModules.clear();
};

export function MasterPasswordGate({ children, moduleName, onCancel }: MasterPasswordGateProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { hasRole, loading: authLoading } = useAuth();
  
  // Use the global cache as the initial state
  const [isAuthenticated, setIsAuthenticated] = useState(moduleName ? unlockedModules.has(moduleName) : false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isMaster = hasRole('master');

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    try {
      const isValid = await OfflineAuthService.verifyMasterPassword(password);
      if (isValid) {
        if (moduleName) {
          unlockedModules.add(moduleName);
        }
        setIsAuthenticated(true);
        toast({
          title: t('common.success'),
          description: t('auth.accessGranted', 'Accès autorisé'),
        });
      } else {
        toast({
          title: t('common.error'),
          description: t('auth.invalidPassword', 'Mot de passe incorrect'),
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: t('common.error'),
        description: t('common.unknownError', 'Une erreur est survenue'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onCancel) {
      onCancel();
    }
  };

  // Show loading state while checking roles
  if (authLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-12 bg-muted/5">
        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
      </div>
    );
  }

  // Automatically bypass for Master role or if already verified
  if (isMaster || isAuthenticated) {
    if (isMaster) return <>{children}</>;
    
    return (
      <div className="relative h-full w-full">
        {isAuthenticated && (
          <div className="absolute top-4 right-4 z-50">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                if (moduleName) {
                  unlockedModules.delete(moduleName);
                }
                setIsAuthenticated(false);
                setPassword('');
              }}
              className="bg-white/80 hover:bg-white text-black shadow-sm"
            >
              <Unlock className="w-4 h-4 mr-2" />
              Verrouiller
            </Button>
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Lock Overlay - children are NOT mounted while locked: this gate
          used to always render {children} blurred behind the overlay, which
          meant a heavy module (e.g. the full product catalog) paid its full
          fetch/render cost every time it was opened locked, before anyone
          ever typed a password - the exact "freezes when opening the
          product file" complaint this was fixed for. */}
      <div
        onClick={handleBackdropClick}
        className={cn(
          "absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm",
          onCancel ? "cursor-pointer" : "cursor-default"
        )}
      >
        <div className="bg-background border shadow-2xl rounded-2xl p-8 max-w-md w-full mx-4 text-center animate-in fade-in zoom-in duration-300 cursor-default">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight uppercase">
            Accès Restreint
          </h2>
          <p className="text-muted-foreground mb-8 text-sm">
            Le module <span className="font-bold text-foreground">{moduleName || 'sécurisé'}</span> nécessite le mot de passe administrateur (Master).
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              type="password"
              placeholder="Mot de passe Master..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-center text-lg tracking-widest"
              autoFocus
            />
            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-bold uppercase tracking-widest"
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Déverrouiller'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

