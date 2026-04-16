import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Settings, Moon, Sun, Printer, Keyboard, Lock, Save, 
  Eye, EyeOff, Check, AlertCircle, RefreshCw, Cloud, WifiOff, Database
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { OfflineDataService } from '@/services/OfflineDataService';
import { LocalBridgeSyncService } from '@/services/LocalBridgeSyncService';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { LocalDatabase } from '@/services/LocalDatabase';
import { useStockSearch } from '@/hooks/useStockSearch';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, KeyMapping } from '@/stores/useSettingsStore';

interface SettingsModuleProps {
  storeId: string;
  mode: 'preferences' | 'programmation-touches' | 'mots-de-passe' | 'synchronisation';
}

// Default keys now managed by store
const F_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

export function SettingsModule({ storeId, mode }: SettingsModuleProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { keyMappings, setKeyMappings } = useSettingsStore();
  
  const AVAILABLE_ACTIONS = [
    // POS Actions
    { value: 'ACTION_VALIDATE', label: `${t('menu.program.validate')} (POS)` },
    { value: 'ACTION_PAY', label: `${t('pos.totals.pay')} (POS)` },
    { value: 'ACTION_SCAN', label: `${t('pos.totals.scan')} (POS)` },
    { value: 'ACTION_PRINT', label: `${t('common.print')} (POS)` },
    { value: 'ACTION_SAVE', label: `${t('menu.program.save')} (POS)` },
    { value: 'ACTION_SEARCH', label: `${t('common.search')} (POS)` },
    { value: 'delete', label: `${t('common.delete')} (POS)` },
    
    // Navigation Actions
    { value: 'vente-detail', label: t('menu.sales.retail') },
    { value: 'facturation-detail', label: t('menu.sales.billingRetail') },
    { value: 'facturation-gros', label: t('menu.sales.billingWholesale') },
    { value: 'proforma', label: t('menu.sales.proforma') },
    { value: 'reception-achats', label: t('menu.purchases.reception') },
    { value: 'listing-stock', label: t('menu.stock.listing') },
    { value: 'journal-caisse', label: t('menu.management.cashJournal') },
    { value: 'tableau-bord', label: t('menu.management.dashboard') },
    { value: 'clients', label: t('menu.files.clients') },
    { value: 'fournisseurs', label: t('menu.files.suppliers') },
    { value: 'produits', label: t('menu.files.products') },
    { value: 'fermeture-caisse', label: t('menu.sales.closeCash') },
    { value: 'NAV_CLOSE_CASH', label: t('menu.sales.closeCash') }, // Alias for consistency
    { value: 'inventaire-stock', label: t('menu.stock.inventory') },
    // Statistiques
    { value: 'statistiques', label: t('menu.management.statistics') },
    
    // Unbind
    { value: 'none', label: t('common.none') }
  ];

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingQueueSize, setPendingQueueSize] = useState(0);
  const [serviceKey, setServiceKey] = useState('');
  const lastSync = useMasterDataStore(state => state.lastSync);
  
  const { total: productsCount } = useStockSearch(storeId, mode === 'synchronisation');
  const suppliersCount = useMasterDataStore(state => state.suppliers.filter(s => s.store_id === storeId).length);
  
  const [printerFormat, setPrinterFormat] = useState<'a4' | 'ticket'>('a4');
  const [autoLogout, setAutoLogout] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Helper to get action for a key
  const getActionForKey = (key: string) => {
    return keyMappings.find(m => m.key === key)?.action || 'none';
  };

  const updateFKeyAction = (key: string, action: string) => {
    // Remove existing mapping for this key
    let newMappings = keyMappings.filter(m => m.key !== key);
    
    if (action && action !== 'none') {
      // Also remove this action from any other key it might be assigned to
      newMappings = newMappings.filter(m => m.action !== action);
      newMappings.push({ key, action });
    }
    
    setKeyMappings(newMappings);
    toast.success(t('common.success'));
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error(t('common.loading'));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('auth.confirmPassword'));
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      toast.success(t('common.success'));
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || t('common.error'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const savePreferences = () => {
    localStorage.setItem('printerFormat', printerFormat);
    localStorage.setItem('autoLogout', String(autoLogout));
    localStorage.setItem('soundEnabled', String(soundEnabled));
    toast.success(t('common.success'));
  };

  const saveFKeyMappings = () => {
    localStorage.setItem('fKeyMappings', JSON.stringify(fKeyMappings));
    toast.success(t('common.success'));
  };

  const handleRepairDb = async () => {
    try {
      const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
      if (!isLocalFirst) return;
      
      const headers = await OfflineAuthService.getAuthHeaders();
      const res = await fetch(`${localBridgeBaseUrl}/rest/v1/system-repair`, {
        method: 'POST',
        headers: { ...headers }
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success(t('audit.repairSuccess'));
      } else {
        toast.error(data.message || t('common.error'));
      }
    } catch (e) {
      toast.error(t('common.error'));
    }
  };

  const renderContent = () => {
    switch (mode) {
      case 'preferences':
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  {t('menu.program.appearance')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('menu.program.darkTheme')}</Label>
                  </div>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  {t('menu.program.printing')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('menu.program.printerFormat')}</Label>
                  </div>
                  <Select value={printerFormat} onValueChange={(v: 'a4' | 'ticket') => setPrinterFormat(v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4 (Standard)</SelectItem>
                      <SelectItem value="ticket">Ticket (Thermique)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {t('sidebar.dashboard')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('menu.program.autoLogout')}</Label>
                  </div>
                  <Switch
                    checked={autoLogout}
                    onCheckedChange={setAutoLogout}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('menu.program.sounds')}</Label>
                  </div>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={setSoundEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            <Button onClick={savePreferences} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {t('menu.program.savePreferences')}
            </Button>
          </div>
        );

      case 'programmation-touches':
        return (
          <div className="max-w-3xl mx-auto space-y-6">
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Keyboard className="h-4 w-4" />
                  {t('menu.program.fKeyProgramming')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {F_KEYS.map(key => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-12 h-10 flex items-center justify-center bg-muted rounded-lg font-mono font-bold text-sm">
                        {key}
                      </div>
                      <Select 
                        value={getActionForKey(key)} 
                        onValueChange={(v) => updateFKeyAction(key, v)}
                      >
                        <SelectTrigger className="flex-1 h-10">
                          <SelectValue placeholder={t('common.none')} />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_ACTIONS.map(action => (
                            <SelectItem key={action.value} value={action.value}>
                              {action.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setKeyMappings([])}
                className="flex-1"
              >
                {t('menu.program.resetToDefault')}
              </Button>
            </div>
          </div>
        );

      case 'mots-de-passe':
        return (
          <div className="max-w-md mx-auto space-y-6">
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {t('menu.program.changePassword')}
                </CardTitle>
                <CardDescription>
                  {t('sidebar.team')}: {user?.email}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">{t('menu.program.currentPassword')}</Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPasswords(s => ({ ...s, current: !s.current }))}
                    >
                      {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">{t('menu.program.newPassword')}</Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">{t('menu.program.confirmPassword')}</Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
                    >
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={handleChangePassword} 
              disabled={isChangingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
              className="w-full"
            >
              <Lock className="h-4 w-4 mr-2" />
              {isChangingPassword ? t('common.loading') : t('menu.program.changePassword')}
            </Button>
          </div>
        );

      case 'synchronisation':
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className={cn(
              isOnline ? 'border-success' : 'border-warning'
            )}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'p-3 rounded-full',
                    isOnline ? 'bg-success/20' : 'bg-warning/20'
                  )}>
                    {isOnline ? <Cloud className="h-6 w-6 text-success" /> : <WifiOff className="h-6 w-6 text-warning" />}
                  </div>
                  <div>
                    <p className="font-medium">{isOnline ? t('common.online') : t('common.offline')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {t('menu.program.syncStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">{t('menu.program.productsInCache')}</p>
                    <p className="text-2xl font-bold">{productsCount}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">{t('menu.program.suppliersInCache')}</p>
                    <p className="text-2xl font-bold">{suppliersCount}</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{t('menu.program.lastSync')}</p>
                  <p className="text-lg font-medium">
                    {lastSync 
                      ? new Date(lastSync).toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language)
                      : t('common.noData')}
                  </p>
                </div>

                {pendingQueueSize > 0 && (
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                    <p className="text-xs text-warning">{t('menu.program.pendingMutations')}</p>
                    <p className="text-lg font-bold text-warning">{pendingQueueSize} {t('common.transactions')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {t('menu.program.fullSync')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">{t('menu.program.supabaseKey')}</Label>
                  <Input
                    type="password"
                    value={serviceKey}
                    onChange={(e) => setServiceKey(e.target.value)}
                  />
                </div>
                
                <Button
                  variant="secondary"
                  onClick={handleSyncPush}
                  disabled={isSyncing || !isOnline || !serviceKey}
                  className="w-full"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                  {t('menu.program.syncLocalChanges')}
                </Button>

                <Button 
                  onClick={handleInitialSync} 
                  disabled={isSyncing || !isOnline}
                  className="w-full"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
                  {t('menu.program.syncData')}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/10">
              <CardHeader className="py-4">
                <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  System Tools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  onClick={handleRepairDb}
                  className="w-full"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Repair Database
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Use this if you see "database disk image is malformed" errors.
                </p>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return <div className="p-8 text-center text-muted-foreground">{t('common.error')}</div>;
    }
  };

  return (
    <div className="h-full flex flex-col p-6 bg-[hsl(60,80%,85%)] dark:bg-transparent overflow-auto">
      {renderContent()}
    </div>
  );
}