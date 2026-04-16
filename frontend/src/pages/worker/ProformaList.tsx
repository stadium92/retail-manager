import { useEffect, useState, useRef } from "react";
import { OfflineSalesService } from "@/services/OfflineSalesService";
import { OfflineAuthService } from "@/services/OfflineAuthService";
import { useToast } from "@/hooks/use-toast";
import { POSLayout } from "./components/POSLayout";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, Printer, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { usePOSStore } from "@/stores/usePOSStore";
import { useNavigate } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import { InvoiceTemplate, InvoiceData } from "@/components/printing/InvoiceTemplate";
import { useTranslation } from "react-i18next";

export default function ProformaList() {
    const { t, i18n } = useTranslation();
    const [proformas, setProformas] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const navigate = useNavigate();
    const { addItem, clearCart } = usePOSStore();

    const printRef = useRef<HTMLDivElement>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Proforma_${selectedInvoice?.id?.slice(0, 8) || Date.now()}`,
    });

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' XAF';
    };

    const loadProformas = async () => {
        setIsLoading(true);
        try {
            const offlineSession = await OfflineAuthService.getOfflineSession();
            if (!offlineSession?.user?.user_metadata?.store_id) return;

            const data = await OfflineSalesService.getProformas(offlineSession.user.user_metadata.store_id);
            setProformas(data);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: t('common.error'), description: t('common.failedToLoad') });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadProformas();
    }, []);

    const handleConvertToSale = (proforma: any) => {
        clearCart();

        if (proforma.items && Array.isArray(proforma.items)) {
            proforma.items.forEach((item: any) => {
                if (item.product) {
                    addItem(item.product, item.quantity);
                }
            });
        }

        if (proforma.customer_name) {
            usePOSStore.setState({ customerId: proforma.customer_name });
        }

        toast({ title: t('common.success'), description: t('worker.sales.itemAlreadyAdded') });
        navigate('/worker/pos');
    };

    const onPrintClick = (proforma: any) => {
        const invoiceData: InvoiceData = {
            id: proforma.id,
            storeName: "Magasin",
            workerName: t('edition.seller'),
            customerName: proforma.customer_name,
            customerPhone: proforma.customer_phone,
            created_at: proforma.created_at,
            items: proforma.items,
            total_price: proforma.total_price,
            type: 'proforma'
        };
        setSelectedInvoice(invoiceData);

        setTimeout(() => {
            handlePrint();
        }, 100);
    };

    return (
        <POSLayout>
            <div className="p-8 max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="w-8 h-8 text-amber-500" />
                        {t('menu.sales.proforma')}
                    </h1>
                    <Button onClick={loadProformas} variant="outline">{t('common.refresh')}</Button>
                </div>

                <div className="bg-card rounded-lg border shadow-sm overflow-auto max-h-[60vh]">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                            <TableRow>
                                <TableHead>{t('menu.program.date')}</TableHead>
                                <TableHead>{t('pos.totals.customer')}</TableHead>
                                <TableHead>{t('pos.totals.items')}</TableHead>
                                <TableHead className="text-right">{t('worker.sales.total')}</TableHead>
                                <TableHead className="text-right">{t('common.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {proformas.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        {t('common.noData')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                proformas.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>{format(new Date(p.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell className="font-medium">{p.customer_name || t('common.unknown')}</TableCell>
                                        <TableCell>{p.items?.length || 0} {t('pos.totals.items')}</TableCell>
                                        <TableCell className="text-right font-bold">{formatCurrency(p.total_price || 0)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => onPrintClick(p)}>
                                                    <Printer className="w-4 h-4 mr-1" /> {t('menu.program.print')}
                                                </Button>
                                                <Button size="sm" onClick={() => handleConvertToSale(p)}>
                                                    <ShoppingCart className="w-4 h-4 mr-1" /> {t('common.clear')}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div style={{ display: "none" }}>
                {selectedInvoice && <InvoiceTemplate ref={printRef} data={selectedInvoice} />}
            </div>
        </POSLayout>
    );
}