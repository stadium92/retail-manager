import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SaleMode } from './SanifereHeader';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getCurrencyConfig } from '@/utils/currencyConfig';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SaleMode;
  totalAmount: number;
  onConfirm: (paymentMethod: string, amountPaid: number, isCredit: boolean) => void;
}

type PaymentMethod = 'cash' | 'card' | 'mobile' | 'credit';

export function PaymentDialog({
  open,
  onOpenChange,
  mode,
  totalAmount,
  onConfirm,
}: PaymentDialogProps) {
  const { t, i18n } = useTranslation();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState<number>(totalAmount);
  const [partialPayment, setPartialPayment] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { formatCurrency } = useFormatters();
  const { currency } = useSettingsStore();

  const paymentMethods: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: 'cash', label: t('common.cash'), icon: '💵' },
    { id: 'card', label: t('common.card'), icon: '💳' },
    { id: 'mobile', label: 'Mobile', icon: '📱' },
    { id: 'credit', label: t('common.credit'), icon: '📝' },
  ];

  const isCredit = selectedMethod === 'credit';
  const change = amountReceived - totalAmount;
  const remaining = isCredit ? totalAmount - partialPayment : 0;

  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const amountPaid = isCredit ? partialPayment : amountReceived;
    try {
      await onConfirm(selectedMethod, amountPaid, isCredit);
      onOpenChange(false);
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-select text when dialog opens
  useEffect(() => {
    if (open) {
      console.log('[PaymentDialog] Dialog opened, resetting amount and triggering auto-select...');
      setAmountReceived(totalAmount);
      setPartialPayment(totalAmount);
      
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(0, inputRef.current.value.length);
          console.log('[PaymentDialog] Input focused and selected');
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const quickAmounts = getCurrencyConfig(currency).quickAmounts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-md bg-[hsl(180,60%,85%)] border-4 border-[hsl(180,60%,40%)] p-0"
        onKeyDown={(e) => {
          // Trap Enter key to confirm payment and prevent grid navigation
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleConfirm();
          }
        }}
      >
        <DialogHeader className="bg-[hsl(180,60%,40%)] px-4 py-3">
          <DialogTitle className="text-white font-mono text-lg uppercase">
            {t('menu.program.voucherSettlement')} - {mode === 'vente-detail' ? t('sidebar.sales') : t('menu.program.invoice')}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          <div className="bg-[hsl(50,100%,60%)] p-4 rounded text-center">
            <p className="text-sm font-mono text-black/70 uppercase">{t('menu.program.netToPay')}</p>
            <p className="text-3xl font-bold font-mono text-black">
              {formatCurrency(totalAmount)}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={cn(
                  'p-3 rounded border-2 font-mono text-sm flex flex-col items-center gap-1 transition-all',
                  selectedMethod === method.id
                    ? 'bg-[hsl(220,100%,35%)] text-white border-[hsl(220,100%,25%)]'
                    : 'bg-white text-black border-black/20 hover:border-black/40'
                )}
              >
                <span className="text-xl">{method.icon}</span>
                <span className="text-[10px] uppercase font-bold">{method.label}</span>
              </button>
            ))}
          </div>

          {selectedMethod === 'cash' && (
            <div className="space-y-3">
              <div>
                <Label className="font-black font-mono text-lg uppercase mb-2 block text-primary">{t('menu.program.receivedAmount')}</Label>
                <NumericInput
                  ref={inputRef}
                  value={amountReceived}
                  onValueChange={(v) => setAmountReceived(v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!(change < 0) && !isProcessing) {
                        handleConfirm();
                      }
                    }
                  }}
                  className="text-4xl h-16 font-black font-mono text-right bg-white border-2 border-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmountReceived(amt)}
                    className="font-mono text-xs"
                  >
                    {formatCurrency(amt)}
                  </Button>
                ))}
              </div>

              {change >= 0 && (
                <div className="bg-green-100 p-3 rounded border border-green-300">
                  <p className="text-sm font-mono text-green-800">{t('menu.program.change')}</p>
                  <p className="text-2xl font-bold font-mono text-green-700">
                    {formatCurrency(change)}
                  </p>
                </div>
              )}
              {change < 0 && (
                <div className="bg-red-100 p-3 rounded border border-red-300">
                  <p className="text-sm font-mono text-red-800">{t('menu.program.insufficient')}</p>
                  <p className="text-lg font-bold font-mono text-red-700">
                    Manque: {formatCurrency(Math.abs(change))}
                  </p>
                </div>
              )}
            </div>
          )}

          {isCredit && (
            <div className="space-y-3">
              <div>
                <Label className="font-mono text-sm">{t('menu.program.downPayment')}</Label>
                <NumericInput
                  value={partialPayment}
                  onValueChange={(v) => setPartialPayment(v)}
                  max={totalAmount}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isProcessing) {
                        handleConfirm();
                      }
                    }
                  }}
                  className="text-lg font-bold font-mono text-right bg-white"
                />
              </div>
              <div className="bg-orange-100 p-3 rounded border border-orange-300">
                <p className="text-sm font-mono text-orange-800">{t('menu.program.remainingToPay')}</p>
                <p className="text-2xl font-bold font-mono text-orange-700">
                  {formatCurrency(remaining)}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-4 pb-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="font-mono"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={(selectedMethod === 'cash' && change < 0) || isProcessing}
            className="font-mono bg-[hsl(120,70%,35%)] hover:bg-[hsl(120,70%,30%)]"
          >
            {isProcessing ? t('common.loading') : t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}