import { useState, useEffect } from 'react';
import { LogOut, Wifi, WifiOff, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WorkerModule } from './WorkerMenuBar';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { CurrencySwitcher } from '@/components/shared/CurrencySwitcher';
import { HardwareStatus } from '@/components/shared/HardwareStatus';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { LocalDatabase } from '@/services/LocalDatabase';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { toast } from 'sonner';

interface WorkerStatusBarProps {
  storeName: string;
  userEmail: string;
  activeModule: WorkerModule;
  onLogout: () => void;
  storeId?: string;
}

export function WorkerStatusBar({ storeName, userEmail, activeModule, onLogout, storeId }: WorkerStatusBarProps) {
  const { t, i18n } = useTranslation();
  const { getKeyForAction } = useSettingsStore();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const keyValidate = getKeyForAction('ACTION_VALIDATE') || 'F2';
  const keyPay = getKeyForAction('ACTION_PAY') || 'F4';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleHardReset = async () => {
    if (confirm("DANGER: This will wipe the browser cache (IndexedDB and LocalStorage). Your local SQLite database will NOT be affected. Use this to fix 'Ghost Files' or stale interface data. Continue?")) {
        setIsSyncing(true);
        try {
            await LocalDatabase.clearAll();
            localStorage.clear();
            toast.success("Cache wiped. Reloading app...");
            setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
            toast.error("Failed to clear cache");
            setIsSyncing(false);
        }
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(i18n.language === 'bm' ? 'fr-ML' : i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(i18n.language === 'bm' ? 'fr-ML' : i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Use translated shortcut hints
  const shortcutHints: Record<string, string> = {
    'facturation-detail': `${keyValidate} -${t('menu.program.save')}   Esc -${t('menu.program.cancel')}   +/- ${t('menu.program.quantity')}`,
    'facturation-gros': `${keyValidate} -${t('menu.program.save')}   Esc -${t('menu.program.cancel')}   +/- ${t('menu.program.quantity')}`,
    'vente-detail': `${t('menu.program.enter')} -${t('menu.program.add')}   ${keyPay} -${t('menu.program.pay')}   Esc -${t('menu.program.cancel')}`,
    'produits': `${keyValidate} -${t('menu.program.save')}   Esc -${t('menu.program.cancel')}`,
    'fermeture-caisse': `${keyValidate} -${t('menu.program.save')}   Esc -${t('menu.program.cancel')}`,
    'reception-achats': `${keyValidate} -${t('menu.program.validate')}   Esc -${t('menu.program.cancel')}`,
    'commande-auto': `${keyValidate} -${t('menu.program.generate')}   Esc -${t('menu.program.cancel')}`,
    'commande-manuelle': `${keyValidate} -${t('menu.program.save')}   Esc -${t('menu.program.cancel')}`,
  };

  return (
    <footer className="h-8 bg-[hsl(180,80%,40%)] dark:bg-card/80 border-t border-primary/30 flex items-center px-2 text-xs shrink-0">
      {/* Store Name */}
      <div className="flex items-center gap-2 min-w-[200px]">
        <HardDrive className="h-3.5 w-3.5 text-primary-foreground/70 dark:text-primary" />
        <span className="font-medium text-primary-foreground dark:text-foreground truncate">
          {storeName || t('index.title')}
          <span className="font-mono opacity-50 ml-2 text-[10px]">v{import.meta.env.VITE_APP_VERSION || 'dev'}</span>
        </span>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="flex-1 text-center">
        <span className="font-mono text-primary-foreground/90 dark:text-muted-foreground">
          {shortcutHints[activeModule] || t('common.loading')}
        </span>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        <HardwareStatus />
        
        {/* Manual Sync Button */}
        <Button
          variant="ghost"
          size="sm"
          disabled={isSyncing || !isOnline}
          onClick={handleHardReset}
          className="h-6 px-2 text-primary-foreground hover:bg-primary-foreground/10 dark:text-foreground flex items-center gap-1"
          title="Hard Reset Browser Cache"
        >
          <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
          {!isSyncing && <span className="text-[10px] font-bold uppercase tracking-tighter hidden md:inline">Reset Cache</span>}
        </Button>

        {/* Connection Status */}
        <div className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded',
          isOnline 
            ? 'bg-success/20 text-success-foreground' 
            : 'bg-danger/20 text-danger-foreground'
        )}>
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span className="font-medium">{isOnline ? t('common.online') : t('common.offline')}</span>
        </div>

        {/* User */}
        <span className="text-primary-foreground/80 dark:text-muted-foreground truncate max-w-[150px]">
          {userEmail}
        </span>

        {/* Date/Time */}
        <div className="flex items-center gap-2 font-mono text-primary-foreground dark:text-foreground">
          <span>{formatDate(currentTime)}</span>
          <span className="text-primary-foreground/60 dark:text-muted-foreground">•</span>
          <span>{formatTime(currentTime)}</span>
        </div>

        {/* Language & Currency Switcher */}
        <div className="flex items-center gap-2 h-6 scale-75 origin-right">
          <CurrencySwitcher />
          <LanguageSwitcher />
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="h-6 px-2 text-primary-foreground hover:bg-primary-foreground/10 dark:text-foreground dark:hover:bg-muted"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </footer>
  );
}