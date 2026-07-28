import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useSettingsStore } from '../stores/useSettingsStore';

export const DEFAULT_CURRENCY = 'XOF';

export function useFormatters() {
  const { i18n } = useTranslation();
  const { currency } = useSettingsStore();
  
  const getLocale = () => {
    if (i18n.language === 'fr') return fr;
    // For 'bm' (Bambara) or any other language, default to English
    return enUS;
  };

  const formatDate = (date: string | Date, formatStr: string = 'PP') => {
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      return format(dateObj, formatStr, { locale: getLocale() });
    } catch {
      return 'Invalid date';
    }
  };

  const formatDateTime = (date: string | Date) => {
    return formatDate(date, 'PPpp');
  };

  const formatNumber = (num: number | null | undefined, decimals: number = 2) => {
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    // Same reasoning as formatCurrency: never surface "NaN" to a user.
    const safeNum = Number(num);
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number.isFinite(safeNum) ? safeNum : 0);
  };

  const formatCurrency = (amount: number | null | undefined, overrideCurrency?: string) => {
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    const currencyCode = overrideCurrency || currency || DEFAULT_CURRENCY;

    // Money must never render as "NaN" on a till screen - a cashier cannot
    // tell whether that means zero, an error, or a real figure that failed to
    // load, and it appeared on live screens (VALEUR GROS / VALEUR REVENDEUR
    // on Valorisation de stock) simply because the API omitted two fields the
    // component read, making them undefined. Individual callers are still
    // fixed at the source, but this is the last line of defence so no future
    // missing/renamed field can put NaN in front of a user again.
    //
    // Deliberately NOT silent: a value that should have been a number and
    // wasn't is a bug, so it is logged once here while the UI degrades to 0.
    const safeAmount = Number(amount);
    if (!Number.isFinite(safeAmount)) {
      if (amount !== null && amount !== undefined) {
        console.warn('[formatCurrency] received a non-numeric amount:', amount);
      }
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: ['XOF', 'XAF'].includes(currencyCode) ? 0 : 2,
        maximumFractionDigits: ['XOF', 'XAF'].includes(currencyCode) ? 0 : 2,
      }).format(0);
    }

    // Determine decimals: 0 for CFA (XOF/XAF), 2 for others (USD, EUR, GHS)
    const isCFA = ['XOF', 'XAF'].includes(currencyCode);
    const decimals = isCFA ? 0 : 2;

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(safeAmount);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return `${safeAmount} ${currencyCode}`; // Fallback
    }
  };

  const formatPercent = (value: number | null | undefined, decimals: number = 1) => {
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    // Percentages are the most NaN-prone figures in the app because they are
    // nearly always a ratio, and margin/growth denominators (cost, previous
    // period revenue) are legitimately 0 on a new product or a first day of
    // trading - which yields NaN or Infinity, both meaningless on screen.
    const safeValue = Number(value);
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format((Number.isFinite(safeValue) ? safeValue : 0) / 100);
  };

  return { formatDate, formatDateTime, formatNumber, formatCurrency, formatPercent };
}