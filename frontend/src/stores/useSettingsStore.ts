import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface KeyMapping {
  key: string;
  action: string; // e.g., 'ACTION_PAY', 'NAV_POS', etc.
}

interface SettingsState {
  currency: string;
  storeName: string;
  keyMappings: KeyMapping[];
  setCurrency: (currency: string) => void;
  setStoreName: (name: string) => void;
  setKeyMappings: (mappings: KeyMapping[]) => void;
  getKeyForAction: (action: string) => string | undefined;
}

const DEFAULT_MAPPINGS: KeyMapping[] = [
  { key: 'F2', action: 'ACTION_VALIDATE' },
  { key: 'F3', action: 'ACTION_SEARCH' },
  { key: 'F4', action: 'ACTION_PAY' },
  { key: 'F9', action: 'ACTION_PRINT' },
  { key: 'F10', action: 'ACTION_SAVE' },
  // Navigation defaults (can be overridden)
  { key: 'F12', action: 'NAV_CLOSE_CASH' },
];

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      currency: 'XOF',
      storeName: '',
      keyMappings: DEFAULT_MAPPINGS,
      setCurrency: (currency) => set({ currency }),
      setStoreName: (storeName) => set({ storeName }),
      setKeyMappings: (keyMappings) => set({ keyMappings }),
      getKeyForAction: (action) => get().keyMappings.find((m) => m.action === action)?.key,
    }),
    {
      name: 'app-settings',
    }
  )
);