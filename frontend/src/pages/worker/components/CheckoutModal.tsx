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
    // Cart-level remise in CFA, subtracted from the per-line total. Optional
    // because desktop callers have no global-discount concept; without this
    // prop the mobile "Remise Globale" was pure theatre - the dialog stored
    // the amount, the footer drew a strike-through, and both checkout paths
    // charged the full price anyway.
    discount?: number;
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

export function CheckoutModal({ open, onOpenChange, onConfirm, isLoading, discount }: CheckoutModalProps) {
    const { t, i18n } = useTranslation();
    const { formatCurrency } = useFormatters();
    const { currency } = useSettingsStore();
    const { getTotal, saleType: storeSaleType, setSaleType: setStoreSaleType } = usePOSStore();
    const total = Math.max(0, getTotal() - (discount ?? 0));

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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        {isProforma ? <FileText className="w-6 h-6 text-amber-500" /> : <Check className="w-6 h-6 text-green-500" />}
                        {isProforma ? t('menu.sales.proforma') : t('worker.sales.recordSale')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('worker.sales.total')} : <span className="font-bold text-primary text-lg">{formatCurrency(total)}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>{t('sales.title')}</Label>
                        <div className="flex gap-2 p-1 bg-muted rounded-lg">
                            <Button
                                variant={currentSaleType === 'detail' ? 'default' : 'ghost'}
                                className="flex-1 min-w-0 h-auto min-h-8 py-1.5 px-1 text-xs whitespace-normal leading-tight"
                                onClick={() => handleTypeChange('detail')}
                            >
                                {t('menu.sales.retail')}
                            </Button>
                            <Button
                                variant={currentSaleType === 'gros' ? 'default' : 'ghost'}
                                className="flex-1 min-w-0 h-auto min-h-8 py-1.5 px-1 text-xs whitespace-normal leading-tight"
                                onClick={() => handleTypeChange('gros')}
                            >
                                {t('menu.sales.billingWholesale')}
                            </Button>
                            <Button
                                variant={currentSaleType === 'proforma' ? 'secondary' : 'ghost'}
                                className={`flex-1 min-w-0 h-auto min-h-8 py-1.5 px-1 text-xs whitespace-normal leading-tight ${currentSaleType === 'proforma' ? 'bg-amber-100 text-amber-900 font-bold' : ''}`}
                                onClick={() => handleTypeChange('proforma')}
                            >
                                {t('menu.sales.proforma')}
                            </Button>
                        </div>
                    </div>

                    {!isProforma && (
                        <div className="space-y-2">
                            <Label>{t('menu.program.receptionTitle')}</Label>
                            <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)} className="w-full">
                                <TabsList className="grid w-full grid-cols-3 h-auto">
                                    <TabsTrigger value="cash" className="min-w-0 whitespace-normal px-1 py-1.5 leading-tight"><Banknote className="w-4 h-4 mr-1 shrink-0" />{t('common.cash')}</TabsTrigger>
                                    <TabsTrigger value="card" className="min-w-0 whitespace-normal px-1 py-1.5 leading-tight"><CreditCard className="w-4 h-4 mr-1 shrink-0" />{t('common.card')}</TabsTrigger>
                                    <TabsTrigger value="credit" className="min-w-0 whitespace-normal px-1 py-1.5 leading-tight"><FileText className="w-4 h-4 mr-1 shrink-0" />{t('common.credit')}</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="customer">{t('worker.sales.customerName')}</Label>
                            <Input
                                id="customer"
                                placeholder={t('worker.sales.enterCustomerName')}
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">{t('worker.sales.customerPhone')}</Label>
                            <Input
                                id="phone"
                                placeholder={t('worker.sales.enterPhone')}
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                            />
                        </div>
                    </div>

                    {paymentMethod === 'cash' && !isProforma && (
                        <div className="bg-muted/50 p-4 rounded-md space-y-4 border">
                            <div className="space-y-2">
                                <Label>{t('menu.program.receivedAmount')}</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        className="pl-12 text-lg font-bold"
                                        placeholder="0"
                                        value={receivedAmount}
                                        onChange={(e) => setReceivedAmount(e.target.value)}
                                        autoFocus
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">{currency}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t">
                                <span className="font-medium">{t('menu.program.change')} :</span>
                                <span className={`text-xl font-bold ${change < 0 ? "text-destructive" : "text-green-600"}`}>
                                    {formatCurrency(change)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading || (paymentMethod === 'cash' && !isProforma && received < total)}
                        className={isProforma ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                    >
                        {isLoading ? t('common.loading') : isProforma ? t('menu.sales.proforma') : t('worker.sales.recordSale')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
