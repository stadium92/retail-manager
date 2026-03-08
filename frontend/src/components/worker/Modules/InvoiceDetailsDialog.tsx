import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SaleWithItems } from '@/services/OfflineDataService';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { Printer } from 'lucide-react';

interface InvoiceDetailsDialogProps {
  sale: SaleWithItems | null;
  onClose: () => void;
}

export function InvoiceDetailsDialog({ sale, onClose }: InvoiceDetailsDialogProps) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useFormatters();

  if (!sale) return null;

  const getLocale = () => {
    if (i18n.language === 'fr' || i18n.language === 'bm') return fr;
    return enUS;
  };

  return (
    <Dialog open={!!sale} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span>{t('sales.invoice_number')}: {sale.invoice_number || sale.id.slice(0, 8)}</span>
              <span className="text-sm font-normal text-muted-foreground">
                - {format(new Date(sale.created_at), 'PPP p', { locale: getLocale() })}
              </span>
            </div>
            {sale.order_ref && (
              <span className="text-xs font-mono text-muted-foreground">
                Réf. Commande: {sale.order_ref}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex justify-between items-start bg-muted/50 p-4 rounded-lg">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('pos.totals.customer')}</p>
              <p className="text-lg font-bold">{sale.customer_name || t('customer.counterClient')}</p>
              {sale.customer_phone && <p className="text-sm">{sale.customer_phone}</p>}
              {sale.customer_address && <p className="text-sm italic text-muted-foreground">{sale.customer_address}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">{t('common.total')}</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(sale.total_price)}</p>
              <p className="text-sm text-muted-foreground capitalize">{sale.payment_status}</p>
            </div>
          </div>

          <div className="border rounded-md">
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                  <TableRow>
                    <TableHead>{t('inventory.table.name')}</TableHead>
                    <TableHead className="text-center">{t('inventory.table.quantity')}</TableHead>
                    <TableHead className="text-right">{t('inventory.price')}</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.sale_items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button variant="default">
            <Printer className="mr-2 h-4 w-4" />
            {t('common.print')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
