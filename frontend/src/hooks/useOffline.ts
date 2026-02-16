import { useState, useEffect } from 'react';
import { OfflineManager } from '@/services/OfflineManager';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(OfflineManager.getQueueSize());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleQueueUpdate = (e: CustomEvent) => setQueueSize(e.detail);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('queueUpdated', handleQueueUpdate as EventListener);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('queueUpdated', handleQueueUpdate as EventListener);
    };
  }, []);

  return { isOnline, queueSize };
}
