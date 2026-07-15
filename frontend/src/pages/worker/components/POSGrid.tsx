import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { CartItem } from "@/stores/usePOSStore";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { useTranslation } from "react-i18next";

interface POSGridProps {
    items: CartItem[];
    activeRow: number;
    onRowClick: (index: number) => void;
    onUpdateQuantity: (index: number, qty: number) => void;
}

export function POSGrid({ items, activeRow, onRowClick, onUpdateQuantity }: POSGridProps) {
    const { t, i18n } = useTranslation();
    const activeRef = useRef<HTMLTableRowElement>(null);

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language);
    };

    useEffect(() => {
        if (activeRef.current) {
            activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [activeRow]);

    if (items.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                    <h3 className="text-xl font-semibold">{t('pos.grid.empty')}</h3>
                    <p>{t('pos.grid.scanPrompt')} {t('common.search')} (Cmd+K).</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10 text-xs uppercase font-medium text-muted-foreground">
                    <tr>
                        <th className="px-4 py-3 text-left w-[40%]">{t('pos.grid.headers.designation')}</th>
                        <th className="px-4 py-3 text-right">{t('inventory.price')}</th>
                        <th className="px-4 py-3 text-center w-[120px]">{t('pos.grid.headers.qty')}</th>
                        <th className="px-4 py-3 text-right">{t('pos.grid.headers.total')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {items.map((item, idx) => {
                        const isActive = idx === activeRow;
                        return (
                            <tr
                                key={`${item.product.id}-${idx}`}
                                ref={isActive ? activeRef : null}
                                className={cn(
                                    "cursor-pointer hover:bg-muted/30 transition-colors",
                                    isActive && "bg-accent text-accent-foreground hover:bg-accent"
                                )}
                                onClick={() => onRowClick(idx)}
                            >
                                <td className="px-4 py-2 font-medium">
                                    <div className="flex flex-col">
                                        <span>{item.product.name}</span>
                                        <span className="text-xs text-muted-foreground opacity-70">
                                            {item.product.sku}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums">
                                    {formatCurrency(item.unitPrice)}
                                </td>
                                <td className="px-4 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                    <NumericInput
                                        className={cn(
                                            "h-8 w-20 text-center mx-auto",
                                            isActive ? "bg-background text-foreground" : "bg-transparent border-transparent hover:border-input"
                                        )}
                                        value={item.quantity}
                                        onValueChange={(v) => onUpdateQuantity(idx, v)}
                                        integer
                                        emptyValue={1}
                                        onFocus={() => onRowClick(idx)}
                                    />
                                </td>
                                <td className="px-4 py-2 text-right font-bold tabular-nums">
                                    {formatCurrency(item.total)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}