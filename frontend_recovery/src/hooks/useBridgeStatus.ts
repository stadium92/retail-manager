import { useState, useEffect } from 'react';
import { getDataClient } from '@/lib/dataClient';

export function useBridgeStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const { localBridgeBaseUrl, isLocalFirst } = getDataClient();

  useEffect(() => {
    if (!isLocalFirst) return;

    const checkHealth = async () => {
      try {
        const res = await fetch(`${localBridgeBaseUrl}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(2000) 
        });
        setIsConnected(res.ok);
      } catch (error) {
        setIsConnected(false);
      }
    };

    // Initial check
    checkHealth();

    // Poll every 10 seconds
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [localBridgeBaseUrl, isLocalFirst]);

  return isConnected;
}
