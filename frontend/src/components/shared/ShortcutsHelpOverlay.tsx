import React from 'react';
import { useShortcuts } from '@/contexts/ShortcutsContext';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ShortcutsHelpOverlay() {
  const { isHelpOpen, setHelpOpen, activeShortcuts } = useShortcuts();
  const { t } = useTranslation();

  if (!isHelpOpen) return null;

  // Group shortcuts
  const groupedShortcuts = activeShortcuts.reduce((acc, shortcut) => {
    const group = shortcut.group || 'General';
    if (!acc[group]) acc[group] = [];
    acc[group].push(shortcut);
    return acc;
  }, {} as Record<string, typeof activeShortcuts>);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-black border-4 border-white p-1 shadow-2xl font-mono text-white">
        <div className="border-2 border-white p-6 relative">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8 border-b-2 border-dashed border-white/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white text-black p-1">
                <Keyboard className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-bold uppercase tracking-widest">
                {t('common.help')} - {t('menu.program.keyboardShortcuts')}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm blink">PRESS F1 TO CLOSE</span>
              <button 
                onClick={() => setHelpOpen(false)}
                className="hover:bg-white hover:text-black p-1 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Grid of Shortcuts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.entries(groupedShortcuts).map(([group, shortcuts]) => (
              <div key={group}>
                <h3 className="text-xl font-bold mb-4 text-[hsl(50,100%,50%)] uppercase border-b border-white/30 pb-1">
                  {group}
                </h3>
                <ul className="space-y-3">
                  {shortcuts.map((shortcut) => (
                    <li key={shortcut.key} className="flex items-center justify-between group hover:bg-white/10 p-1 rounded">
                      <span className="text-sm opacity-80 group-hover:opacity-100 transition-opacity">
                        {shortcut.label}
                      </span>
                      <kbd className="px-2 py-1 bg-white text-black font-bold min-w-[3rem] text-center rounded text-sm shadow-[2px_2px_0_0_rgba(100,100,100,1)]">
                        {shortcut.key.toUpperCase()}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t-2 border-dashed border-white/50 text-center text-sm opacity-60">
            <p>DJATI v1.0 • DOS MODE OVERLAY</p>
          </div>
        </div>
      </div>
    </div>
  );
}
