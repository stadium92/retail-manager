import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, FileText, CreditCard, Banknote } from "lucide-react";
import { usePOSStore } from "@/stores/usePOSStore";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/utils/formatting";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface CheckoutModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (data: CheckoutData) => Promise<void>;
    isLoading?: boolean;
}

export interface CheckoutData {
    paymentMethod: 'cash' | 'card' | 'credit';
    saleType: 'detail' | 'gros' | 'proforma';
    customerName?: string;
    customerPhone?: string;
    amountData: {
        total: number;
        received: number;
        change: number;
    };
}

export function CheckoutModal({ open, onOpenChange, onConfirm, isLoading }: CheckoutModalProps) {
    const { t, i18n } = useTranslation();
    const { formatCurrency } = useFormatters();
    const { currency } = useSettingsStore();
    const { getTotal, saleType: storeSaleType, setSaleType: setStoreSaleType } = usePOSStore();
    const total = getTotal();

    const [currentSaleType, setCurrentSaleType] = useState<'detail' | 'gros' | 'proforma'>(storeSaleType);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit'>('cash');
    const [receivedAmount, setReceivedAmount] = useState<string>('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');

    useEffect(() => {
        if (storeSaleType) setCurrentSaleType(storeSaleType);
    }, [storeSaleType]);

    const received = parseFloat(receivedAmount) || 0;
    const change = Math.max(0, received - total);

    const handleTypeChange = (type: 'detail' | 'gros' | 'proforma') => {
        setCurrentSaleType(type);
        if (type === 'detail' || type === 'gros') {
            setStoreSaleType(type);
        }
    };

    const handleConfirm = () => {
        onConfirm({
            paymentMethod,
            saleType: currentSaleType,
            customerName,
            customerPhone,
            amountData: {
                total,
                received,
                change
            }
        });
    };

    const isProforma = currentSaleType === 'proforma';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-rs-surface border-rs-surface-container-highest text-rs-on-surface">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-rs-on-surface">
                        {isProforma ? <FileText className="w-6 h-6 text-rs-surface-tint" /> : <Check className="w-6 h-6 text-rs-secondary" />}
                        {isProforma ? t('menu.sales.proforma') : t('worker.sales.recordSale')}
                    </DialogTitle>
                    <DialogDescription className="text-rs-on-surface-variant">
                        {t('worker.sales.total')} : <span className="font-bold text-rs-surface-tint text-lg">{formatCurrency(total)}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-rs-on-surface-variant">{t('sales.title')}</Label>
                        <div className="flex gap-2 p-1 bg-rs-surface-container-low rounded-lg">
                            <Button
                                variant="ghost"
                                className={`flex-1 min-w-0 h-auto min-h-8 py-1.5 px-1 text-xs whitespace-normal leading-tight hover:bg-rs-surface-container-highest hover:text-rs-on-surface ${currentSaleType === 'detail' ? 'bg-rs-surface-tint text-rs-on-primary hover:bg-rs-surface-tint hover:text-rs-on-primary' : 'text-rs-on-surface-variant'}`}
                                onClick={() => handleTypeChange('detail')}
                            >
                                {t('menu.sales.retail')}
                            </Button>
                            <Button
                                variant="ghost"
                                className={`flex-1 min-w-0 h-auto min-h-8 py-1.5 px-1 text-xs whitespace-normal leading-tight hover:bg-rs-surface-container-highest hover:text-rs-on-surface ${currentSaleType === 'gros' ? 'bg-rs-surface-tint text-rs-on-primary hover:bg-rs-surface-tint hover:text-rs-on-primary' : 'text-rs-on-surface-variant'}`}
                                onClick={() => handleTypeChange('gros')}
                            >
                                {t('menu.sales.billingWholesale')}
                            </Button>
                            <Button
                                variant="ghost"
                                className={`flex-1 min-w-0 h-auto min-h-8 py-1.5 px-1 text-xs whitespace-normal leading-tight hover:bg-rs-surface-container-highest hover:text-rs-on-surface ${currentSaleType === 'proforma' ? 'bg-rs-primary-container text-rs-on-primary-container font-bold hover:bg-rs-primary-container hover:text-rs-on-primary-container' : 'text-rs-on-surface-variant'}`}
                                onClick={() => handleTypeChange('proforma')}
                            >
                                {t('menu.sales.proforma')}
                            </Button>
                        </div>
                    </div>

                    {!isProforma && (
                        <div className="space-y-2">
                            <Label className="text-rs-on-surface-variant">{t('menu.program.receptionTitle')}</Label>
                            <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)} className="w-full">
                                <TabsList className="grid w-full grid-cols-3 h-auto bg-rs-surface-container-low">
                                    <TabsTrigger value="cash" className="min-w-0 whitespace-normal px-1 py-1.5 leading-tight text-rs-on-surface-variant data-[state=active]:bg-rs-surface data-[state=active]:text-rs-on-surface data-[state=active]:shadow-sm"><Banknote className="w-4 h-4 mr-1 shrink-0" />{t('common.cash')}</TabsTrigger>
                                    <TabsTrigger value="card" className="min-w-0 whitespace-normal px-1 py-1.5 leading-tight text-rs-on-surface-variant data-[state=active]:bg-rs-surface data-[state=active]:text-rs-on-surface data-[state=active]:shadow-sm"><CreditCard className="w-4 h-4 mr-1 shrink-0" />{t('common.card')}</TabsTrigger>
                                    <TabsTrigger value="credit" className="min-w-0 whitespace-normal px-1 py-1.5 leading-tight text-rs-on-surface-variant data-[state=active]:bg-rs-surface data-[state=active]:text-rs-on-surface data-[state=active]:shadow-sm"><FileText className="w-4 h-4 mr-1 shrink-0" />{t('common.credit')}</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="customer" className="text-rs-on-surface-variant">{t('worker.sales.customerName')}</Label>
                            <Input
                                id="customer"
                                placeholder={t('worker.sales.enterCustomerName')}
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="bg-rs-surface-container-low border-rs-surface-container-highest text-rs-on-surface placeholder:text-rs-on-surface-variant focus-visible:ring-rs-surface-tint"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-rs-on-surface-variant">{t('worker.sales.customerPhone')}</Label>
                            <Input
                                id="phone"
                                placeholder={t('worker.sales.enterPhone')}
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                className="bg-rs-surface-container-low border-rs-surface-container-highest text-rs-on-surface placeholder:text-rs-on-surface-variant focus-visible:ring-rs-surface-tint"
                            />
                        </div>
                    </div>

                    {paymentMethod === 'cash' && !isProforma && (
                        <div className="bg-rs-surface-container-low p-4 rounded-md space-y-4 border border-rs-surface-container-highest">
                            <div className="space-y-2">
                                <Label className="text-rs-on-surface-variant">{t('menu.program.receivedAmount')}</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        className="pl-12 text-lg font-bold bg-rs-surface border-rs-surface-container-highest text-rs-on-surface focus-visible:ring-rs-surface-tint"
                                        placeholder="0"
                                        value={receivedAmount}
                                        onChange={(e) => setReceivedAmount(e.target.value)}
                                        autoFocus
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rs-on-surface-variant font-bold">{currency}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-rs-surface-container-highest">
                                <span className="font-medium text-rs-on-surface">{t('menu.program.change')} :</span>
                                <span className={`text-xl font-bold ${change < 0 ? "text-red-400" : "text-green-400"}`}>
                                    {formatCurrency(change)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-rs-outline bg-transparent text-rs-on-surface hover:bg-rs-surface-container-highest hover:text-rs-on-surface">{t('common.cancel')}</Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading || (paymentMethod === 'cash' && !isProforma && received < total)}
                        className="bg-rs-surface-tint text-rs-on-primary hover:bg-rs-primary-fixed"
                    >
                        {isLoading ? t('common.loading') : isProforma ? t('menu.sales.proforma') : t('worker.sales.recordSale')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
