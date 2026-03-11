import React, { forwardRef } from 'react';
import { format } from "date-fns";
import { CartItem } from '@/stores/usePOSStore';
import { useTranslation } from 'react-i18next';

export interface InvoiceData {
    id: string;
    invoice_number?: string;
    order_ref?: string;
    storeName: string;
    storeAddress?: string;
    workerName: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    created_at: string;
    items: CartItem[];
    total_price: number;
    type: 'detail' | 'gros' | 'proforma';
    paymentMethod?: string;
}

export const InvoiceTemplate = forwardRef<HTMLDivElement, { data: InvoiceData }>(({ data }, ref) => {
    const isProforma = data.type === 'proforma';
    const { t } = useTranslation();

    return (
        <div ref={ref} className="p-8 max-w-[800px] mx-auto bg-white text-black font-sans hidden print:block">
            {/* Header */}
            <div className="flex justify-between items-start border-b pb-4 mb-4">
                <div>
                    <h1 className="text-2xl font-bold uppercase tracking-wider">{data.storeName}</h1>
                    <p className="text-sm text-gray-600">{data.storeAddress || t('invoice.defaultStore')}</p>
                    <p className="text-sm text-gray-600">Tel: +223 00 00 00 00</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold text-gray-800 uppercase">
                        {isProforma ? t('invoice.proforma') : (data.paymentMethod === 'credit' ? 'FACTURE À CRÉDIT' : t('invoice.cashReceipt'))}
                    </h2>
                    <p className="text-sm text-gray-500 font-mono">
                        {t('menu.program.invoice')}: {data.invoice_number || data.id.slice(0, 8)}
                    </p>
                    {data.order_ref && (
                        <p className="text-sm text-gray-500 font-mono">
                            {t('menu.program.orderRef')}: {data.order_ref}
                        </p>
                    )}
                    <p className="text-sm mt-1">{format(new Date(data.created_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
            </div>

            {/* Bill To */}
            <div className="mb-6">
                <h3 className="text-xs uppercase font-bold text-gray-500 mb-1">{t('invoice.billedTo')}:</h3>
                <p className="font-bold">{data.customerName || t('customer.counterClient')}</p>
                {data.customerPhone && <p className="text-sm">{data.customerPhone}</p>}
                {data.customerAddress && <p className="text-sm italic">{data.customerAddress}</p>}
            </div>

            {/* Items Table */}
            <table className="w-full text-sm mb-6">
                <thead>
                    <tr className="border-b-2 border-black">
                        <th className="text-left py-2">{t('invoice.designation')}</th>
                        <th className="text-right py-2">{t('invoice.unitPrice')}</th>
                        <th className="text-center py-2">{t('invoice.qty')}</th>
                        <th className="text-right py-2">{t('invoice.total')}</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                            <td className="py-2">
                                <span className="font-medium block">{item.product.name}</span>
                                <span className="text-xs text-gray-500">{item.product.sku}</span>
                            </td>
                            <td className="text-right py-2">{item.product.unit_price.toLocaleString()}</td>
                            <td className="text-center py-2">{item.quantity}</td>
                            <td className="text-right py-2">{item.total.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-8">
                <div className="w-48">
                    <div className="flex justify-between py-1 border-t border-black mt-2 font-bold text-lg">
                        <span>{t('invoice.total')}</span>
                        <span>{data.total_price.toLocaleString()} FCFA</span>
                    </div>
                </div>
            </div>

            {/* Footer / Disclaimer */}
            <div className="text-center text-xs text-gray-500 mt-12 border-t pt-4">
                {isProforma ? (
                    <p className="italic font-medium text-black">
                        {t('invoice.proformaNote')}
                    </p>
                ) : (
                    <p>{t('invoice.thankYou')}</p>
                )}
                <p className="mt-2">{t('invoice.generatedBy')}</p>
            </div>
        </div>
    );
});

InvoiceTemplate.displayName = "InvoiceTemplate";
