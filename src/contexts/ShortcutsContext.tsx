import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export interface Shortcut {
  key: string;
  label: string;
  action: () => void;
  description?: string;
  group?: string; // e.g., 'Navigation', 'Actions', 'Global'
}

interface ShortcutsContextType {
  registerShortcut: (shortcut: Shortcut) => void;
  unregisterShortcut: (key: string) => void;
  activeShortcuts: Shortcut[];
  isHelpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}

const ShortcutsContext = createContext<ShortcutsContextType | undefined>(undefined);

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Map<string, Shortcut>>(new Map());
  const [isHelpOpen, setHelpOpen] = useState(false);
  const { t } = useTranslation();

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    setShortcuts((prev) => {
      const newMap = new Map(prev);
      newMap.set(shortcut.key.toLowerCase(), shortcut);
      return newMap;
    });
  }, []);

  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts((prev) => {
      const newMap = new Map(prev);
      newMap.delete(key.toLowerCase());
      return newMap;
    });
  }, []);

  // Global Key Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Safari's autofill (iOS in particular) dispatches synthetic keydown-like
      // events with no .key string set - e.g. from its internal
      // _autoFillControlWithValueRecursively machinery when filling saved
      // credentials on the login form. Bail out rather than crash on
      // e.key.startsWith()/.toLowerCase() below.
      if (typeof e.key !== 'string') {
        return;
      }

      // Always allow F1 for help
      if (e.key === 'F1') {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      // Ignore if input/textarea is focused (unless it's a function key)
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput && !e.key.startsWith('F')) {
        return;
      }

      const key = e.key.toLowerCase();
      const shortcut = shortcuts.get(key);

      if (shortcut) {
        e.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  const activeShortcuts = Array.from(shortcuts.values());

  return (
    <ShortcutsContext.Provider
      value={{
        registerShortcut,
        unregisterShortcut,
        activeShortcuts,
        isHelpOpen,
        setHelpOpen,
      }}
    >
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts() {
  const context = useContext(ShortcutsContext);
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutsProvider');
  }
  return context;
}

// Hook for registering shortcuts in components
export function useRegisterShortcuts(shortcuts: Shortcut[]) {
  const { registerShortcut, unregisterShortcut } = useShortcuts();

  useEffect(() => {
    shortcuts.forEach(registerShortcut);
    return () => {
      shortcuts.forEach((s) => unregisterShortcut(s.key));
    };
  }, [shortcuts, registerShortcut, unregisterShortcut]);
}
