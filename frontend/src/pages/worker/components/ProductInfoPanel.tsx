import { Product } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";

interface ProductInfoPanelProps {
    product?: Product;
}

export function ProductInfoPanel({ product }: ProductInfoPanelProps) {
    const { t, i18n } = useTranslation();

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' XAF';
    };

    if (!product) {
        return (
            <Card className="h-[200px] flex items-center justify-center text-muted-foreground bg-muted/20 border-dashed">
                <p>{t('common.noData')}</p>
            </Card>
        );
    }

    return (
        <Card className="shadow-sm border-l-4 border-l-primary animate-in fade-in slide-in-from-right-4 duration-200">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg leading-tight">{product.name}</CardTitle>
                <p className="text-xs text-muted-foreground font-mono mt-1">SKU: {product.sku || 'N/A'}</p>
            </CardHeader>
            <CardContent className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <span className="text-xs text-muted-foreground block uppercase">{t('inventory.price')}</span>
                        <span className="text-2xl font-bold tracking-tight text-primary">
                            {formatCurrency(product.unit_price || 0)}
                        </span>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground block uppercase">{t('menu.sales.billingWholesale')}</span>
                        <span className="text-lg font-semibold text-muted-foreground">
                            {product.wholesale_price ? formatCurrency(product.wholesale_price) : '-'}
                        </span>
                    </div>
                </div>

                <Separator />

                <div className="space-y-2">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">{t('sidebar.inventory')}</span>

                    <div className="flex justify-between items-center p-2 bg-muted/40 rounded-md">
                        <span className="text-sm">{t('menu.program.currentStock')}</span>
                        <span className={`font-mono font-bold ${product.quantity > 5 ? "text-green-500" : "text-amber-500"}`}>
                            {product.quantity} {t('menu.program.unit')}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}