import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SanifereLineItem } from '@/components/worker/Sales/SanifereGrid';

export interface SalesSessionState {
  lineItems: SanifereLineItem[];
  customerCode: string;
  customerName: string;
  customerAddress: string;
  orderRef: string;
  invoiceNumber: string; // Persisted invoice number
  clientId?: string;       // FK to clients table
  clientDiscount?: number; // auto-applied discount % from client group
  // Metadata for restoration
  lastUpdated: number;
}

interface SalesStoreState {
  // Map mode/view ID to its state
  sessions: Record<string, SalesSessionState>;
  
  // Actions
  updateSession: (mode: string, updates: Partial<SalesSessionState>) => void;
  getSession: (mode: string) => SalesSessionState;
  clearSession: (mode: string) => void;
}

export const DEFAULT_SESSION: SalesSessionState = {
  lineItems: [],
  customerCode: '',
  customerName: '',
  customerAddress: '',
  orderRef: '',
  invoiceNumber: '',
  clientId: undefined,
  clientDiscount: 0,
  lastUpdated: 0,
};

export const useSalesStore = create<SalesStoreState>()(
  persist(
    (set, get) => ({
      sessions: {},

      updateSession: (mode, updates) => {
        set((state) => {
          const current = state.sessions[mode] || { ...DEFAULT_SESSION };
          return {
            sessions: {
              ...state.sessions,
              [mode]: {
                ...current,
                ...updates,
                lastUpdated: Date.now(),
              },
            },
          };
        });
      },

      getSession: (mode) => {
        const state = get();
        return state.sessions[mode] || { ...DEFAULT_SESSION };
      },

      clearSession: (mode) => {
        set((state) => {
          const newSessions = { ...state.sessions };
          delete newSessions[mode];
          return { sessions: newSessions };
        });
      },
    }),
    {
      name: 'sales-sessions-storage', // Key in localStorage
      partialize: (state) => ({ sessions: state.sessions }), // Only persist sessions
    }
  )
);
