import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Coins } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function CurrencySwitcher() {
  const { currency, setCurrency } = useSettingsStore();

  const currencies = [
    { code: 'XOF', name: 'CFA Franc (XOF)' },
    { code: 'GHS', name: 'Ghanaian Cedi (GHS)' },
    { code: 'EUR', name: 'Euro (€)' },
    { code: 'USD', name: 'US Dollar ($)' },
  ];

  return (
    <Select value={currency} onValueChange={setCurrency}>
      <SelectTrigger className="w-[140px]">
        <Coins className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background z-50">
        {currencies.map((curr) => (
          <SelectItem key={curr.code} value={curr.code}>
            {curr.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
