import { usePOSStore } from '@/stores/usePOSStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  Receipt, 
  Trash2, 
  ScanBarcode,
  User
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface POSTotalsProps {
  onPayment: () => void;
  onScan: () => void;
  onClear: () => void;
}

export function POSTotals({ onPayment, onScan, onClear }: POSTotalsProps) {
  const { t, i18n } = useTranslation();
  const {
    cart,
    subtotal,
    totalDiscount,
    grandTotal,
    customerName,
    customerPhone,
    setCustomer,
  } = usePOSStore();

  const { formatCurrency } = useFormatters();
  const { getKeyForAction } = useSettingsStore();
  const keyPay = getKeyForAction('ACTION_PAY') || 'F4';
  const keyScan = getKeyForAction('ACTION_SCAN') || 'F2';

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Customer Info */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{t('pos.totals.customer')}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="customer-name" className="text-xs text-muted-foreground">{t('pos.totals.name')}</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomer(undefined, e.target.value, customerPhone)}
              placeholder={t('pos.totals.name')}
              className="h-8 text-sm bg-muted/50 border-border/50"
            />
          </div>
          <div>
            <Label htmlFor="customer-phone" className="text-xs text-muted-foreground">{t('pos.totals.phone')}</Label>
            <Input
              id="customer-phone"
              value={customerPhone}
              onChange={(e) => setCustomer(undefined, customerName, e.target.value)}
              placeholder={t('pos.totals.phone')}
              className="h-8 text-sm bg-muted/50 border-border/50"
            />
          </div>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Totals */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('pos.totals.items')} ({itemCount})</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        
        {totalDiscount > 0 && (
          <div className="flex items-center justify-between text-sm text-success">
            <span>{t('pos.totals.discount')}</span>
            <span>-{formatCurrency(totalDiscount)}</span>
          </div>
        )}

        <Separator className="bg-border/50" />
        
        <div className="flex items-center justify-between pt-1">
          <span className="text-lg font-semibold">{t('pos.totals.total')}</span>
          <span className="text-2xl font-bold text-primary text-glow-primary">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Primary Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={onScan}
            className="h-12 glass-card-hover"
          >
            <ScanBarcode className="h-5 w-5 mr-2" />
            {t('pos.totals.scan')}
            <kbd className="kbd-shortcut ml-auto">{keyScan}</kbd>
          </Button>
          
          <Button
            onClick={onPayment}
            disabled={cart.length === 0}
            className="h-12 btn-neon"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            {t('pos.totals.pay')}
            <kbd className="kbd-shortcut ml-auto bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">{keyPay}</kbd>
          </Button>
        </div>

        {/* Secondary Actions */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={cart.length === 0}
            className="flex-1 text-muted-foreground hover:text-danger hover:bg-danger/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('pos.totals.clear')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={cart.length === 0}
            className="flex-1 text-muted-foreground hover:text-foreground"
          >
            <Receipt className="h-4 w-4 mr-2" />
            {t('pos.totals.proforma')}
          </Button>
        </div>
      </div>

      {/* Keyboard Hints */}
      <div className="pt-2 border-t border-border/30">
        <p className="text-[10px] text-muted-foreground text-center">
          <kbd className="kbd-shortcut">↑↓</kbd> {t('pos.totals.navigation')} • 
          <kbd className="kbd-shortcut ml-1">+/-</kbd> {t('pos.totals.quantity')} • 
          <kbd className="kbd-shortcut ml-1">Del</kbd> {t('pos.totals.delete')}
        </p>
      </div>
    </div>
  );
}