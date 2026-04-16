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
  'vente-detail': 'bg-[hsl(120,100%,35%)]',
  'facturation-detail': 'bg-[hsl(120,100%,35%)]',
  'facturation-gros': 'bg-[hsl(120,100%,35%)]',
  'proforma': 'bg-[hsl(120,100%,35%)]',
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

  const isSimpleSale = mode === 'vente-detail';
  const dateStr = format(currentTime, 'EEEE dd/MM/yyyy', { locale: getLocale() });
  const timeStr = format(currentTime, 'HH:mm:ss');

  const displayInvoiceNumber = invoiceNumber || format(currentTime, 'yyMMdd') + '0001';

  return (
    <div className={`${modeBgColors[mode]} text-black font-mono`}>
      <div className="px-3 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[hsl(180,100%,50%)]">═══</span>
          <span className="text-lg font-bold tracking-wide text-[hsl(60,100%,50%)] px-2 border border-[hsl(180,100%,50%)] uppercase">
            {modeLabels[mode]}
          </span>
          <span className="text-[hsl(180,100%,50%)]">═══</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="capitalize">{dateStr}</span>
          <span className="bg-white/90 px-2 py-0.5 text-black font-bold text-lg">
            {timeStr}
          </span>
        </div>
      </div>

      <div className="px-3 py-1 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[hsl(60,100%,50%)] uppercase">N° {t('menu.program.invoice')}:</span>
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
              className="bg-[hsl(180,100%,40%)] px-2 py-0.5 text-black font-bold w-32 border-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
          ) : (
            <span className="bg-[hsl(180,100%,40%)] px-2 py-0.5 text-black font-bold">
              {displayInvoiceNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="uppercase">{t('menu.program.date')}</span>
          <span className="bg-[hsl(180,100%,40%)] px-2 py-0.5 text-black font-bold">
            {format(currentTime, 'dd/MM/yyyy')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="uppercase">{t('menu.program.orderRef')}:</span>
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
            className="bg-[hsl(120,100%,35%)] border-b border-black/50 px-2 py-0.5 w-32 text-black placeholder:text-black/50 focus:outline-none focus:border-[hsl(60,100%,50%)]"
            placeholder=""
          />
        </div>
      </div>

      <div className="px-3 pb-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[hsl(60,100%,50%)] uppercase">{t('menu.program.customerCode')}</span>
          <input
            type="text"
            value={customerCode}
            onChange={(e) => onCustomerChange?.(e.target.value, customerName, customerPhone, customerAddress)}
            className="bg-[hsl(120,100%,35%)] border-b border-black/50 px-2 py-0.5 w-24 text-black focus:outline-none focus:border-[hsl(60,100%,50%)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="uppercase">{t('pos.totals.name')}</span>
          <input
            type="text"
            value={customerName}
            onChange={(e) => onCustomerChange?.(customerCode, e.target.value, customerPhone, customerAddress)}
            className="bg-[hsl(120,100%,35%)] border-b border-black/50 px-2 py-0.5 w-48 text-black focus:outline-none focus:border-[hsl(60,100%,50%)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="uppercase">{t('stores.fields.phone')}</span>
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => onCustomerChange?.(customerCode, customerName, e.target.value, customerAddress)}
            className="bg-[hsl(120,100%,35%)] border-b border-black/50 px-2 py-0.5 w-32 text-black focus:outline-none focus:border-[hsl(60,100%,50%)]"
          />
        </div>
      </div>
      <div className="px-3 pb-2 flex items-center gap-2 text-sm">
        <span className="text-[hsl(60,100%,50%)] uppercase">{t('menu.program.address')}</span>
        <input
          type="text"
          value={customerAddress}
          onChange={(e) => onCustomerChange?.(customerCode, customerName, customerPhone, e.target.value)}
          className="bg-[hsl(120,100%,35%)] border-b border-black/50 px-2 py-0.5 flex-1 text-black focus:outline-none focus:border-[hsl(60,100%,50%)]"
        />
      </div>
    </div>
  );
}