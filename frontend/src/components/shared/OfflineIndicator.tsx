import { useOffline } from '@/hooks/useOffline';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OfflineManager } from '@/services/OfflineManager';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface OfflineIndicatorProps {
  syncHandlers?: any;
  compact?: boolean;
}

export function OfflineIndicator({ syncHandlers, compact = false }: OfflineIndicatorProps) {
  const { t } = useTranslation();
  const { isOnline, queueSize } = useOffline();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!syncHandlers || syncing) return;
    setSyncing(true);
    await OfflineManager.syncQueue(syncHandlers);
    setSyncing(false);
  };

  if (isOnline && queueSize === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {!isOnline && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <WifiOff className="h-3 w-3" />
            <span>{t('common.offline')}</span>
          </Badge>
        )}
        {queueSize > 0 && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <span>{queueSize} {t('menu.program.pendingMutations')}</span>
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
      {isOnline ? (
        <Wifi className="h-5 w-5 text-success" />
      ) : (
        <WifiOff className="h-5 w-5 text-destructive" />
      )}
      
      <div className="flex-1">
        <p className="text-sm font-medium">
          {isOnline ? t('common.online') : t('common.offline')}
        </p>
        {queueSize > 0 && (
          <p className="text-xs text-muted-foreground">
            {queueSize} {t('menu.program.pendingMutations')}
          </p>
        )}
      </div>

      {queueSize > 0 && isOnline && syncHandlers && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              {t('common.loading')}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('menu.program.syncLocalChanges')}
            </>
          )}
        </Button>
      )}
    </div>
  );
}