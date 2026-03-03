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

  const formatNumber = (num: number, decimals: number = 2) => {
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const formatCurrency = (amount: number, overrideCurrency?: string) => {
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    const currencyCode = overrideCurrency || currency || DEFAULT_CURRENCY;
    
    // Determine decimals: 0 for CFA (XOF/XAF), 2 for others (USD, EUR, GHS)
    const isCFA = ['XOF', 'XAF'].includes(currencyCode);
    const decimals = isCFA ? 0 : 2;

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return `${amount} ${currencyCode}`; // Fallback
    }
  };

  const formatPercent = (value: number, decimals: number = 1) => {
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value / 100);
  };

  return { formatDate, formatDateTime, formatNumber, formatCurrency, formatPercent };
}