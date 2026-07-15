import { useState, useEffect, useMemo } from 'react';
import { SaleMode } from './SanifereHeader';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface SanifereFooterProps {
  mode: SaleMode;
  netTotal: number;
  onValidate?: () => void;
  onSettlement?: () => void;
  onPrint?: () => void;
  onPrintA4?: () => void;
  onInsert?: () => void;
  onDelete?: () => void;
  onProductCard?: () => void;
  onTicket?: () => void;
  onPriceChange?: () => void;
  onHelp?: () => void;
  onSelect?: () => void;
  onSave?: () => void;
}

export function SanifereFooter({
  mode,
  netTotal,
  onValidate,
  onSettlement,
  onPrint,
  onPrintA4,
  onInsert,
  onDelete,
  onProductCard,
  onTicket,
  onPriceChange,
  onHelp,
  onSelect,
  onSave,
}: SanifereFooterProps) {
  const { t, i18n } = useTranslation();
  const { keyMappings } = useSettingsStore();
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language);
  };

  const functionKeys = useMemo(() => {
    const F_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
    
    const ACTION_LABELS: Record<string, string> = {
      'ACTION_VALIDATE': t('menu.program.validate'),
      'ACTION_PAY': t('pos.totals.pay'),
      'ACTION_SCAN': t('pos.totals.scan'),
      'ACTION_PRINT': t('common.print'),
      'ACTION_PRINT_A4': 'Impr. A4',
      'ACTION_SEARCH': t('common.search'),
      'ACTION_SAVE': t('menu.program.save'),
      'delete': t('common.delete'),
      'vente-detail': t('menu.sales.retail'),
      'facturation-detail': t('menu.sales.billingRetail'),
      'facturation-gros': t('menu.sales.billingWholesale'),
      'proforma': t('menu.sales.proforma'),
      'reception-achats': t('menu.purchases.reception'),
      'listing-stock': t('menu.stock.listing'),
      'journal-caisse': t('menu.management.cashJournal'),
      'tableau-bord': t('menu.management.dashboard'),
      'clients': t('menu.files.clients'),
      'fournisseurs': t('menu.files.suppliers'),
      'produits': t('menu.files.products'),
      'fermeture-caisse': t('menu.sales.closeCash'),
      'NAV_CLOSE_CASH': t('menu.sales.closeCash'),
      'inventaire-stock': t('menu.stock.inventory'),
      'statistiques': t('menu.management.statistics'),
    };

    // Internal actions for SanifereFooter that aren't navigation but specific UI actions
    const INTERNAL_ACTIONS: Record<string, string> = {
      'validate': 'ACTION_VALIDATE',
      'settlement': 'ACTION_PAY', // Mapping settlement to Pay action for now
      'print': 'ACTION_PRINT',
      'productCard': 'ACTION_SEARCH',
    };

    return F_KEYS.map(key => {
      const mapping = keyMappings.find(m => m.key === key);
      const action = mapping?.action || '';
      
      // Default labels if no mapping exists for some standard Sanifere keys
      // This keeps the UI filled even if the user hasn't mapped everything
      let label = t('common.none');
      if (action && ACTION_LABELS[action]) {
        label = ACTION_LABELS[action];
      } else {
        // Legacy fallbacks for Sanifere design
        if (key === 'F1') label = t('common.help');
        if (key === 'F8') label = t('menu.program.insert');
        if (key === 'F9') label = t('common.print');
        if (key === 'F10') label = t('menu.program.save');
        // Removing F11 "Ticket" to avoid confusion with F9 "Print"
      }

      // Final overrides: ensure F9 is PRINT and F10 is SAVE unless explicitly changed
      if (key === 'F9' && (!action || action === 'ACTION_PRINT')) {
        label = t('common.print');
      }
      if (key === 'F11' && (!action || action === 'ACTION_PRINT_A4')) {
        label = 'Impr. A4';
      }
      if (key === 'F10' && (!action || action === 'ACTION_SAVE')) {
        label = t('menu.program.save');
      }

      const finalAction = action || (key === 'F9' ? 'ACTION_PRINT' : key === 'F10' ? 'ACTION_SAVE' : key === 'F11' ? 'ACTION_PRINT_A4' : '');
      return { key, label, action: finalAction };
    });
  }, [keyMappings, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setPressedKey(e.key);
    };
    const handleKeyUp = () => setPressedKey(null);
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

    const handleAction = (action: string) => {
      // Direct prop triggers
      if (action === 'ACTION_VALIDATE') onValidate?.();
      else if (action === 'ACTION_PAY' || action === 'settlement') onSettlement?.();
      else if (action === 'ACTION_PRINT') onPrint?.();
      else if (action === 'ACTION_PRINT_A4') onPrintA4?.();
      else if (action === 'ACTION_SEARCH' || action === 'productCard') onProductCard?.();
      else if (action === 'insert') onInsert?.();
      else if (action === 'delete') onDelete?.();
      else if (action === 'ticket') onTicket?.();
      else if (action === 'priceChange') onPriceChange?.();
      else if (action === 'help') onHelp?.();
      else if (action === 'select') onSelect?.();
      else if (action === 'ACTION_SAVE') onSave?.();
      
      // Navigation actions
      else if ([
        'vente-detail', 'facturation-detail', 'facturation-gros', 'proforma',
        'reception-achats', 'listing-stock', 'journal-caisse', 'tableau-bord',
        'clients', 'fournisseurs', 'produits', 'fermeture-caisse', 'NAV_CLOSE_CASH',
        'inventaire-stock', 'statistiques'
      ].includes(action)) {
        // For now, we don't have direct access to setActiveModule here, 
        // but in a real app we might trigger a route change or context update.
        console.log('Navigating to module:', action);
      }
    };

  const isActive = (k: string) => pressedKey === k;

  return (
    <div className="bg-[hsl(220,20%,90%)] border-t-2 border-black/30 font-mono select-none">
      <div className="flex items-center justify-end px-4 py-2 bg-white/80 border-b border-black/10">
        <span className="text-lg font-bold text-black mr-4 uppercase">{t('menu.program.netToPay')}</span>
        <span className="text-3xl font-bold text-black bg-[hsl(50,100%,60%)] px-6 py-1 min-w-[200px] text-right shadow-inner border border-black/20">
          {formatCurrency(netTotal)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-2 py-2 bg-[hsl(220,15%,80%)] overflow-x-auto shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
        {functionKeys.map((fk) => (
          <button
            key={fk.key}
            onClick={() => handleAction(fk.action)}
            className={cn(
              "relative flex flex-col items-center justify-center min-w-[60px] h-[50px] px-2",
              "bg-gradient-to-b from-[#f0f0f0] to-[#d0d0d0]",
              "border border-b-2 border-r-2 border-white/50 border-b-black/40 border-r-black/40",
              "rounded-sm text-xs font-bold text-black shadow-sm transition-all active:translate-y-0.5 active:shadow-none",
              isActive(fk.key) && "bg-gradient-to-b from-[#e0e0e0] to-[#c0c0c0] translate-y-0.5 shadow-none border-t-black/20 border-l-black/20"
            )}
          >
            <span className="text-[hsl(0,70%,45%)] mb-0.5 text-sm">{fk.key}</span>
            <span className="uppercase tracking-tight leading-none text-[10px]">{fk.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}