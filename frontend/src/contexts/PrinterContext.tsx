import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Logger } from '@/utils/Logger';
import { toast } from 'sonner';

export interface Printer {
  id: string;
  name: string;
  is_default: boolean;
  status: 'online' | 'offline';
}

export interface ReceiptData {
  invoice: string;
  storeName: string;
  storeAddress: string;
  phone: string;
  items: Array<{ name: string; qty: number; price: number; total: number }>;
  subtotal: number;
  discount: number;
  total: number;
  date: string;
  cashier: string;
}

interface PrinterContextType {
  printers: Printer[];
  defaultPrinterId: string | null;
  isDiscovering: boolean;
  discoverPrinters: () => Promise<void>;
  setDefaultPrinter: (id: string) => Promise<void>;
  printReceipt: (data: ReceiptData) => Promise<boolean>;
  downloadReceipt: (data: ReceiptData) => Promise<void>;
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [defaultPrinterId, setDefaultPrinterId] = useState<string | null>(localStorage.getItem('rm_default_printer'));
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Initialize WebSocket Connection to Local Printer Agent
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:9100'); // Standard local agent port
    
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'register', client: 'RetailManager-POS' }));
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'register_ack') {
        setToken(msg.token);
        Logger.info('PRINTER_AGENT_CONNECTED');
      }
      if (msg.type === 'print_result') {
        if (msg.success) {
          toast.success('Print successful');
          Logger.info('PRINT_RESULT', { entity_id: msg.jobId, notes: 'Success' });
        } else {
          toast.error('Print failed', { description: msg.error });
          Logger.error('PRINT_RESULT', { entity_id: msg.jobId, notes: msg.error });
        }
      }
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  const discoverPrinters = useCallback(async () => {
    setIsDiscovering(true);
    try {
      const list = await invoke<Printer[]>('discover_printers');
      setPrinters(list);
    } catch (err) {
      toast.error('Failed to discover printers');
    } finally {
      setIsDiscovering(false);
    }
  }, []);

  const setDefaultPrinter = async (id: string) => {
    await invoke('set_default_printer', { id });
    setDefaultPrinterId(id);
    localStorage.setItem('rm_default_printer', id);
    toast.success('Default printer updated');
  };

  const printReceipt = async (data: ReceiptData): Promise<boolean> => {
    Logger.info('PRINT_STARTED', { entity_id: data.invoice });
    
    if (ws && ws.readyState === WebSocket.OPEN && token && defaultPrinterId) {
      ws.send(JSON.stringify({
        type: 'print',
        token,
        printerId: defaultPrinterId,
        jobId: `job_${Date.now()}`,
        payload: data
      }));
      return true;
    }

    // Fallback if no agent found
    return await invoke<boolean>('print_receipt', { data });
  };

  const downloadReceipt = async (data: ReceiptData) => {
    try {
      await invoke('download_receipt', { data });
      toast.success('PDF Downloaded');
    } catch (err) {
      toast.error('Download failed');
    }
  };

  return (
    <PrinterContext.Provider value={{ 
      printers, defaultPrinterId, isDiscovering, 
      discoverPrinters, setDefaultPrinter, printReceipt, downloadReceipt 
    }}>
      {children}
    </PrinterContext.Provider>
  );
}

export const usePrinter = () => {
  const context = useContext(PrinterContext);
  if (!context) throw new Error('usePrinter must be used within PrinterProvider');
  return context;
};
