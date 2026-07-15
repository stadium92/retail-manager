export interface CurrencyConfig {
  code: string;
  name: string;
  quickAmounts: number[];
  denominations: number[];
}

export const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  XOF: {
    code: 'XOF',
    name: 'CFA Franc',
    quickAmounts: [500, 1000, 2000, 5000, 10000, 20000, 50000],
    denominations: [10000, 5000, 2000, 1000, 500],
  },
  GHS: {
    code: 'GHS',
    name: 'Ghanaian Cedi',
    quickAmounts: [1, 5, 10, 20, 50, 100, 200, 500],
    denominations: [200, 100, 50, 20, 10, 5, 2, 1],
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    quickAmounts: [5, 10, 20, 50, 100, 200, 500],
    denominations: [500, 200, 100, 50, 20, 10, 5],
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    quickAmounts: [1, 5, 10, 20, 50, 100],
    denominations: [100, 50, 20, 10, 5, 1],
  },
};

export const getCurrencyConfig = (currencyCode: string): CurrencyConfig => {
  return CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.XOF;
};
