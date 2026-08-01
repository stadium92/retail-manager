import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SaleWithItems } from '@/services/OfflineDataService';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { Printer, FileText } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { InvoiceTemplate, InvoiceData } from '@/components/printing/InvoiceTemplate';
import { InvoiceA4Template } from '@/components/printing/InvoiceA4Template';

interface InvoiceDetailsDialogProps {
  sale: SaleWithItems | null;
  onClose: () => void;
}

export function InvoiceDetailsDialog({ sale, onClose }: InvoiceDetailsDialogProps) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useFormatters();

  const thermalRef = useRef<HTMLDivElement>(null);
  const a4Ref = useRef<HTMLDivElement>(null);

  const printThermal = useReactToPrint({
    contentRef: thermalRef,
    documentTitle: `Ticket_${sale?.invoice_number || sale?.id?.slice(0, 8) || 'inv'}`,
  });

  const printA4 = useReactToPrint({
    contentRef: a4Ref,
    documentTitle: `Facture_A4_${sale?.invoice_number || sale?.id?.slice(0, 8) || 'inv'}`,
  });

  if (!sale) return null;

  const getLocale = () => {
    if (i18n.language === 'fr' || i18n.language === 'bm') return fr;
    return enUS;
  };

  // Build InvoiceData from the SaleWithItems record
  const saleItems = (sale.items?.length ? sale.items : sale.sale_items) || [];

  const cartItems = saleItems.map(item => ({
    product: {
      id: item.product_id || '',
      name: item.product_name || item.name || t('common.unknown'),
      unit_price: Number(item.unit_price) || 0,
      quantity_per_box: 1,
    },
    quantity: Number(item.quantity) || 1,
    unit_price: Number(item.unit_price) || 0,
    isBox: false,
    discount: 0,
    lineTotal: Number(item.total) || 0,
    total: Number(item.total) || 0,
  })) as any[];

  const invoiceData: InvoiceData = {
    id: sale.id,
    invoice_number: sale.invoice_number || sale.id.slice(0, 8),
    order_ref: sale.order_ref || undefined,
    storeName: 'Quincaillerie De La Paix',
    storeAddress: 'Dibidani, Face à Djoliba, près du Trésor',
    workerName: undefined,
    customerName: sale.customer_name || undefined,
    customerPhone: sale.customer_phone || undefined,
    customerAddress: sale.customer_address || undefined,
    created_at: sale.created_at,
    items: cartItems,
    total_price: sale.total_price,
    type: sale.sale_type === 'proforma' ? 'proforma' : sale.sale_type === 'gros' ? 'gros' : 'detail',
    paymentMethod: sale.payment_method || undefined,
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
            <div className="text-right flex flex-col gap-2">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('common.total')}</p>
                <p className="text-2xl font-black text-primary font-mono">{formatCurrency(sale.total_price)}</p>
              </div>
              
              {sale.payment_method === 'credit' && (
                <div className="bg-danger/10 p-2 rounded border border-danger/20">
                  <p className="text-[9px] font-black uppercase text-danger tracking-widest">{t('common.dueAmount', 'Montant Dû')}</p>
                  <p className="text-lg font-black text-danger font-mono">{formatCurrency(sale.total_price)}</p>
                </div>
              )}

              <div className="flex flex-col items-end">
                <Badge variant={sale.payment_method === 'credit' ? 'destructive' : 'default'} className={`uppercase text-[10px] mb-1 ${sale.payment_method !== 'credit' ? 'bg-success text-white border-transparent' : ''}`}>
                  {sale.payment_method === 'credit' ? t('common.credit') : t('common.cash')}
                </Badge>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter opacity-60">{sale.payment_status}</p>
              </div>
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
                  {saleItems.map((item) => (
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>

          {/* Thermal Receipt */}
          <Button variant="outline" onClick={() => printThermal()} className="border-orange-400 text-orange-600 hover:bg-orange-50">
            <Printer className="mr-2 h-4 w-4" />
            Ticket Caisse
          </Button>

          {/* A4 Invoice */}
          <Button variant="default" onClick={() => printA4()}>
            <FileText className="mr-2 h-4 w-4" />
            Facture A4
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Hidden print templates */}
      <div style={{ display: 'none' }}>
        <InvoiceTemplate ref={thermalRef} data={invoiceData} />
        <InvoiceA4Template ref={a4Ref} data={invoiceData} />
      </div>
    </Dialog>
  );
}
