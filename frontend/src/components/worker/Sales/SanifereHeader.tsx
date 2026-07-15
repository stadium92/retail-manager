import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

export type SaleMode = 'vente-detail' | 'facturation-detail' | 'facturation-gros' | 'proforma';

interface SanifereHeaderProps {
  mode: SaleMode;
  invoiceNumber?: string;
  customerCode?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  orderRef?: string;
  onCustomerChange?: (code: string, name: string, phone: string, address: string) => void;
  onOrderRefChange?: (ref: string) => void;
  onOrderRefLoad?: (ref: string) => void;
  onInvoiceNumberChange?: (invoice: string) => void;
}

const modeBgColors: Record<SaleMode, string> = {
  'vente-detail': 'bg-[#0D0D0D]',
  'facturation-detail': 'bg-[#0D0D0D]',
  'facturation-gros': 'bg-[#0D0D0D]',
  'proforma': 'bg-[#0D0D0D]',
};

export function SanifereHeader({
  mode,
  invoiceNumber,
  customerCode = '',
  customerName = '',
  customerPhone = '',
  customerAddress = '',
  orderRef = '',
  onCustomerChange,
  onOrderRefChange,
  onOrderRefLoad,
  onInvoiceNumberChange,
}: SanifereHeaderProps) {
  const { t, i18n } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());

  const modeLabels: Record<SaleMode, string> = {
    'vente-detail': t('menu.sales.retail'),
    'facturation-detail': t('menu.sales.billingRetail'),
    'facturation-gros': t('menu.sales.billingWholesale'),
    'proforma': t('menu.sales.proforma'),
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getLocale = () => {
    if (i18n.language === 'fr' || i18n.language === 'bm') return fr;
    return enUS;
  };

  const dateStr = format(currentTime, 'EEEE dd/MM/yyyy', { locale: getLocale() });
  const timeStr = format(currentTime, 'HH:mm:ss');

  const displayInvoiceNumber = invoiceNumber || format(currentTime, 'yyMMdd') + '0001';
  const inputClass = 'h-7 rounded-md border border-[#F5C518]/25 bg-[#1A1A1A] px-2 text-xs font-bold text-white placeholder:text-white/30 outline-none transition focus:border-[#F5C518]/70 focus:ring-1 focus:ring-[#F5C518]/30';
  const labelClass = 'text-[10px] font-black uppercase tracking-wider text-[#F5C518]';

  return (
    <div className={`${modeBgColors[mode]} border-b border-[#F5C518]/20 text-white font-mono`}>
      <div className="flex flex-col gap-3 px-3 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-[#F5C518]/35 bg-[#F5C518]/10 px-2 py-1 text-[11px] font-black uppercase tracking-widest text-[#F5C518]">
              Caisse commandes
            </span>
            <span className="text-base font-black uppercase tracking-wide text-white">
              {modeLabels[mode]}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/60">
            <span className="capitalize">{dateStr}</span>
            <span className="rounded bg-white/10 px-2 py-0.5 font-black text-white">{timeStr}</span>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[420px]">
          <label className="flex min-w-0 items-center gap-2">
            <span className={labelClass}>N° ticket</span>
            {onInvoiceNumberChange ? (
              <input
                type="text"
                value={invoiceNumber || ''}
                onChange={(e) => onInvoiceNumberChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onOrderRefLoad?.(invoiceNumber || '');
                  }
                }}
                className={`${inputClass} min-w-0 flex-1`}
              />
            ) : (
              <span className="h-7 min-w-0 flex-1 rounded-md border border-[#F5C518]/25 bg-[#1A1A1A] px-2 py-1 text-xs font-bold text-white">
                {displayInvoiceNumber}
              </span>
            )}
          </label>

          <label className="flex min-w-0 items-center gap-2">
            <span className={labelClass}>Ref. commande</span>
            <input
              type="text"
              value={orderRef}
              onChange={(e) => onOrderRefChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onOrderRefLoad?.(orderRef);
                }
              }}
              className={`${inputClass} min-w-0 flex-1`}
              placeholder="Ticket, table, client..."
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-2 xl:grid-cols-[160px_1fr_180px_1.4fr]">
        <label className="flex min-w-0 items-center gap-2">
          <span className={labelClass}>{t('menu.program.customerCode')}</span>
          <input
            type="text"
            value={customerCode}
            onChange={(e) => onCustomerChange?.(e.target.value, customerName, customerPhone, customerAddress)}
            className={`${inputClass} min-w-0 flex-1`}
          />
        </label>
        <label className="flex min-w-0 items-center gap-2">
          <span className={labelClass}>{t('pos.totals.name')}</span>
          <input
            type="text"
            value={customerName}
            onChange={(e) => onCustomerChange?.(customerCode, e.target.value, customerPhone, customerAddress)}
            className={`${inputClass} min-w-0 flex-1`}
          />
        </label>
        <label className="flex min-w-0 items-center gap-2">
          <span className={labelClass}>{t('stores.fields.phone')}</span>
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => onCustomerChange?.(customerCode, customerName, e.target.value, customerAddress)}
            className={`${inputClass} min-w-0 flex-1`}
          />
        </label>
        <label className="flex min-w-0 items-center gap-2">
          <span className={labelClass}>{t('menu.program.address')}</span>
          <input
            type="text"
            value={customerAddress}
            onChange={(e) => onCustomerChange?.(customerCode, customerName, customerPhone, e.target.value)}
            className={`${inputClass} min-w-0 flex-1`}
          />
        </label>
      </div>
    </div>
  );
}
