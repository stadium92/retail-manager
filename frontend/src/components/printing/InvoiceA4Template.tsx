import React, { forwardRef } from 'react';
import { format } from "date-fns";
import { useTranslation } from 'react-i18next';
import { InvoiceData } from './InvoiceTemplate';

const QuincaillerieLogo = () => (
    <div className="w-[100px] shrink-0">
        <img src="/quincaillerie-logo.jpg" alt="Logo ETS" className="w-full h-auto object-contain rounded" />
    </div>
);

const StihlLogo = () => (
    <div className="w-[110px] shrink-0 text-right flex justify-end">
        <img src="/stihl-logo.jpg" alt="STIHL" className="w-full h-auto object-contain" />
    </div>
);

export const InvoiceA4Template = forwardRef<HTMLDivElement, { data: InvoiceData }>(({ data }, ref) => {
    const { t } = useTranslation();

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('fr-FR') + ' FCFA';
    };

    const hasStihlProduct = data.items.some(item =>
        item.product.name.toLowerCase().includes('stihl') ||
        item.product.name.toLowerCase().includes('steel')
    );

    return (
        <div
            ref={ref}
            className="bg-white text-black font-sans hidden print:flex print:flex-col mx-auto"
            style={{ width: '210mm', minHeight: '297mm', padding: '10mm 15mm' }}
        >
            {/* HEADER MODULE */}
            <div className={`flex justify-between items-center mb-6 pb-4 border-b-4 ${hasStihlProduct ? 'border-[#f04e23]' : 'border-[#2c3e50]'}`}>
                <QuincaillerieLogo />

                <div className="flex-1 text-center px-4">
                    <div className="inline-block bg-red-600 text-white text-xs font-bold px-2 py-1 rounded mb-1">
                        ETS Madjou Sylla
                    </div>
                    <h1 className={`text-3xl font-black tracking-tight mb-1 leading-none uppercase ${hasStihlProduct ? 'text-[#f04e23]' : 'text-[#2c3e50]'}`}>
                        Quincaillerie De La Paix
                    </h1>
                    <p className="text-[13px] font-bold text-red-600 tracking-wide uppercase mb-2">
                        Vente de machine tronçonneuse, disque, meule, etc.
                    </p>
                    <div className="text-sm font-semibold text-gray-800 leading-snug">
                        <p>TEL: <span className="text-green-700">+223 77 77 90 60 / 20 22 26 45 / 79 45 49 46</span></p>
                        <p className="text-blue-800">madjoulalasylla@gmail.com &nbsp;|&nbsp; <span className="text-gray-600">Face à Djoliba, près du Trésor</span></p>
                    </div>
                </div>

                <div className="w-[110px] shrink-0 text-right flex justify-end">
                    {hasStihlProduct ? <StihlLogo /> : <div className="w-full"></div>}
                </div>
            </div>

            {/* INVOICE METADATA */}
            <div className="flex justify-between items-start mb-8">
                <div className="w-1/2">
                    <h2 className="text-3xl font-black text-gray-800 uppercase tracking-widest mb-4">
                        {data.type === 'proforma' ? 'Proforma' : 'Facture'}
                    </h2>
                    <div className="grid grid-cols-[100px_1fr] gap-y-0.5 text-sm">
                        <span className="font-bold text-gray-600">N° Facture :</span>
                        <span className="font-mono font-medium text-gray-900">{data.invoice_number || data.id.slice(0, 8)}</span>

                        {data.order_ref && (
                            <>
                                <span className="font-bold text-gray-600">Réf. Cmd :</span>
                                <span className="font-mono font-medium text-gray-900">{data.order_ref}</span>
                            </>
                        )}

                        <span className="font-bold text-gray-600">Date :</span>
                        <span className="font-medium text-gray-900">{format(new Date(data.created_at), 'dd/MM/yyyy HH:mm')}</span>

                        {data.workerName && (
                            <>
                                <span className="font-bold text-gray-600">Vendeur :</span>
                                <span className="font-medium text-gray-900">{data.workerName}</span>
                            </>
                        )}
                        {data.paymentMethod && data.type !== 'proforma' && (
                            <>
                                <span className="font-bold text-gray-600">Paiement :</span>
                                <span className="font-medium text-gray-900 uppercase">{data.paymentMethod}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Client Info Box */}
                {(data.customerName || data.customerPhone || data.customerAddress) && (
                    <div className="w-[45%] border-2 border-gray-300 rounded p-4 bg-gray-50">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Facturé à :</p>
                        {data.customerName && <h3 className="text-lg font-bold text-gray-900 mb-1">{data.customerName}</h3>}
                        {data.customerAddress && <p className="text-sm text-gray-700">{data.customerAddress}</p>}
                        {data.customerPhone && <p className="text-sm text-gray-700">Tel: {data.customerPhone}</p>}
                    </div>
                )}
            </div>

            {/* TABLE OF ITEMS */}
            <div className="flex-grow">
                <table className="w-full text-sm border-collapse mb-6">
                    <thead>
                        <tr className="bg-[#2c3e50] text-white">
                            <th className="py-2 px-3 text-left border border-[#2c3e50] font-semibold">Désignation</th>
                            <th className="py-2 px-3 text-center border border-[#2c3e50] font-semibold w-20">Qté</th>
                            <th className="py-2 px-3 text-right border border-[#2c3e50] font-semibold w-28">Prix U.</th>
                            <th className="py-2 px-3 text-right border border-[#2c3e50] font-semibold w-32">Montant</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item, index) => (
                            <tr key={index} className={index % 2 === 0 ? '' : 'bg-gray-50'}>
                                <td className="py-2 px-3 border border-gray-300 font-medium text-gray-900">
                                    {item.product.name}
                                    {item.discount > 0 && (
                                        <span className="ml-2 text-[10px] text-red-600 font-bold bg-red-50 px-1 rounded">
                                            -{item.discount}%
                                        </span>
                                    )}
                                </td>
                                <td className="py-2 px-3 border border-gray-300 text-center text-gray-800">
                                    {item.quantity}
                                    {item.isBox && (
                                        <span className="ml-1 text-[10px] text-blue-600 font-semibold">
                                            ×{item.product.quantity_per_box || 1}
                                        </span>
                                    )}
                                </td>
                                <td className="py-2 px-3 border border-gray-300 text-right text-gray-800">
                                    {formatCurrency(item.unit_price)}
                                </td>
                                <td className="py-2 px-3 border border-gray-300 text-right font-medium text-gray-900">
                                    {formatCurrency(item.lineTotal ?? item.total)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* TOTALS & SUM TEXT */}
                <div className="flex justify-between items-start mt-4">
                    <div className="w-[50%]">
                        <p className="text-sm text-gray-600 italic">
                            Arrêté la présente facture à la somme de :<br />
                            <span className="font-bold text-gray-800">{formatCurrency(data.total_price)}</span>
                        </p>
                    </div>

                    <div className="w-[45%]">
                        <div className="flex justify-between items-center py-2 px-3 font-bold text-lg bg-gray-100 border border-gray-300 rounded whitespace-nowrap">
                            <span className="mr-4">NET À PAYER :</span>
                            <span>{formatCurrency(data.total_price)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* SIGNATURES */}
            <div className="flex justify-between mt-12 px-8">
                <div className="text-center w-48">
                    <p className="font-bold text-gray-800 mb-12">Le Client</p>
                    <div className="border-b border-gray-400"></div>
                </div>
                <div className="text-center w-48">
                    <p className="font-bold text-gray-800 mb-12">La Direction</p>
                    <div className="border-b border-gray-400"></div>
                </div>
            </div>

            {/* FOOTER: JATE Watermark */}
            <div className="flex justify-end items-end mt-auto pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 opacity-50 grayscale">
                    <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Propulsé par JATE</span>
                    <img src="/jati-icon.png" alt="Jate" className="h-6 object-contain" />
                </div>
            </div>

        </div>
    );
});

InvoiceA4Template.displayName = 'InvoiceA4Template';
