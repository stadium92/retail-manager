import { CartItem } from '@/stores/usePOSStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, TrendingDown, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormatters } from '@/utils/formatting';
import { useTranslation } from 'react-i18next';

interface POSSidebarProps {
  selectedItem: CartItem | null;
  lastSalePrice?: number;
  className?: string;
}

export function POSSidebar({ selectedItem, lastSalePrice, className }: POSSidebarProps) {
  const { formatCurrency } = useFormatters();
  const { t } = useTranslation();

  const getStockStatus = (quantity: number, threshold: number = 10) => {
    if (quantity <= 0) return { label: t('pos.stockOut'), class: 'status-rupture', icon: AlertTriangle };
    if (quantity <= threshold) return { label: t('pos.stockLow'), class: 'status-low', icon: TrendingDown };
    return { label: t('pos.stockNormal'), class: 'status-ok', icon: TrendingUp };
  };

  const getStockPercentage = (current: number, threshold: number = 10) => {
    const max = threshold * 5;
    return Math.min((current / max) * 100, 100);
  };

  if (!selectedItem) {
    return (
      <div className={cn('glass-card p-4', className)}>
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
          <Package className="h-12 w-12 mb-3 opacity-50" />
          <p className="text-sm font-medium">{t('pos.selectItem')}</p>
          <p className="text-xs mt-1">{t('pos.realTimeDetails')}</p>
        </div>
      </div>
    );
  }

  const product = selectedItem.product;
  const threshold = product.min_quantity ?? 10;
  const status = getStockStatus(product.quantity, threshold);
  const StatusIcon = status.icon;
  const stockPercentage = getStockPercentage(product.quantity, threshold);
  const unitPrice = product.unit_price ?? 0;
  const costPrice = product.cost_price ?? 0;

  return (
    <div className={cn('glass-card overflow-hidden', className)}>
      {/* Product Header */}
      <div className="p-4 bg-gradient-to-br from-primary/10 to-transparent">
        <div className="flex items-start gap-3">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name}
              className="h-16 w-16 rounded-lg object-cover ring-2 ring-primary/20"
            />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{product.name}</h3>
            {product.sku && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">SKU: {product.sku}</p>
            )}
            <Badge className={cn('mt-2', status.class)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stock Level */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">{t('inventory.availableStock')}</span>
            <span className="font-semibold">{t('inventory.units', { count: product.quantity })}</span>
          </div>
          <div className="stock-bar">
            <div 
              className={cn(
                'stock-bar-fill',
                status.class.replace('status-', '')
              )}
              style={{ width: `${stockPercentage}%` }}
            />
          </div>
          {threshold && (
            <p className="text-xs text-muted-foreground mt-1">
              {t('inventory.alertThreshold', { threshold })}
            </p>
          )}
        </div>

        <Separator className="bg-border/50" />

        {/* Pricing Details */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('inventory.sellingPrice')}</span>
            <span className="font-semibold text-primary text-glow-primary">
              {formatCurrency(unitPrice)}
            </span>
          </div>
          
          {costPrice > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('inventory.purchasePrice')}</span>
              <span className="font-medium">{formatCurrency(costPrice)}</span>
            </div>
          )}
          
          {costPrice > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('inventory.margin')}</span>
              <span className={cn(
                'font-semibold',
                unitPrice > costPrice ? 'text-success' : 'text-danger'
              )}>
                {(((unitPrice - costPrice) / costPrice) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {lastSalePrice && (
          <>
            <Separator className="bg-border/50" />
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Clock className="h-3 w-3" />
                <span>{t('pos.lastSaleToClient')}</span>
              </div>
              <p className="font-semibold">{formatCurrency(lastSalePrice)}</p>
            </div>
          </>
        )}

        <Separator className="bg-border/50" />

        {/* Current Line Summary */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-xs text-muted-foreground mb-2">{t('pos.currentLine')}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Qté:</span>
              <span className="ml-2 font-medium">{selectedItem.quantity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Remise:</span>
              <span className="ml-2 font-medium">{selectedItem.discount}%</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('pos.lineTotal')}</span>
              <span className="font-bold text-lg text-primary text-glow-primary">
                {formatCurrency(selectedItem.lineTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
