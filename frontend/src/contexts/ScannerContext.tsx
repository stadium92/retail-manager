import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Logger } from '@/utils/Logger';
import { toast } from 'sonner';

interface ScanEvent {
  code: string;
  source: string;
}

interface ScannerContextType {
  isHardwareConnected: boolean;
  lastScannedCode: string | null;
  scanners: string[];
  refreshScanners: () => Promise<void>;
}

const ScannerContext = createContext<ScannerContextType | undefined>(undefined);

export function ScannerProvider({ children }: { children: React.ReactNode }) {
  const [isHardwareConnected, setIsHardwareConnected] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanners, setScanners] = useState<string[]>([]);
  
  // Buffering logic for HID (Keyboard) Scanners
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  const refreshScanners = async () => {
    try {
      const list = await invoke<string[]>('list_connected_scanners');
      setScanners(list);
      setIsHardwareConnected(list.length > 0);
    } catch (err) {
      Logger.error('SCANNER_LIST_FAILED', { notes: String(err) });
    }
  };

  const handleScan = (code: string, source: string) => {
    const cleanedCode = code.trim();
    if (cleanedCode.length < 3) return;

    setLastScannedCode(cleanedCode);
    
    // Trigger a global custom event so any module can react to the scan
    window.dispatchEvent(new CustomEvent('hardwareBarcodeScanned', { 
      detail: { code: cleanedCode, source } 
    }));
    
    Logger.info('HARDWARE_SCAN_DETECTED', { new_value: cleanedCode, notes: source });
    
    // Optional: Visual/Audio feedback
    // toast.success(`Scanned: ${cleanedCode}`, { duration: 1000 });
  };

  useEffect(() => {
    // 1. Initialize Backend Listener (for Serial/USB CDC scanners)
    const initBackend = async () => {
      try {
        await invoke('start_hardware_scan_listener');
        await refreshScanners();
        
        const unlisten = await listen<ScanEvent>('hardware-scan', (event) => {
          handleScan(event.payload.code, event.payload.source);
        });
        
        return unlisten;
      } catch (err) {
        Logger.error('SCANNER_BACKEND_INIT_FAILED', { notes: String(err) });
      }
    };

    const backendPromise = initBackend();

    // 2. Global Key Listener (for HID Keyboard Emulation scanners)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Safari's autofill (iOS in particular) dispatches synthetic keydown-like
      // events with no .key string set. Bail out rather than crash below on
      // e.key.length for one of these (this listener is mounted globally,
      // active on the login page too).
      if (typeof e.key !== 'string') return;

      // Ignore modifier keys
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;
      
      // Hardware scanners typically type very fast (< 35ms between keys)
      // Humans type much slower (> 50ms)
      if (timeDiff > 35) {
        buffer.current = ''; 
      }

      if (e.key === 'Enter') {
        if (buffer.current.length > 2) {
          handleScan(buffer.current, 'HID');
          buffer.current = '';
        }
      } else if (e.key.length === 1) {
        buffer.current += e.key;
      }

      lastKeyTime.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      backendPromise.then(unlisten => unlisten && unlisten());
    };
  }, []);

  return (
    <ScannerContext.Provider value={{ 
      isHardwareConnected, 
      lastScannedCode, 
      scanners,
      refreshScanners
    }}>
      {children}
    </ScannerContext.Provider>
  );
}

export const useScanner = () => {
  const context = useContext(ScannerContext);
  if (!context) throw new Error('useScanner must be used within ScannerProvider');
  return context;
};
