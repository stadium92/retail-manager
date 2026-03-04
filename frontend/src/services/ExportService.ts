import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export class ExportService {
  /**
   * Export data to CSV
   */
  static exportToCSV(data: any[], filename: string, headers?: string[]) {
    const csv = Papa.unparse(data, {
      columns: headers,
      header: true,
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  /**
   * Export data to Excel
   */
  static exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  /**
   * Export data to PDF
   */
  static exportToPDF(
    data: any[],
    filename: string,
    title: string,
    columns: { header: string; dataKey: string }[]
  ) {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Add title
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 22);

    const totalKeywords = ['total', 'valeur', 'montant', 'somme', 'da', 'cogoya', 'bɛɛ'];
    const totalColIndex = columns.findIndex(c => {
        const h = c.header.toLowerCase().trim();
        const d = c.dataKey.toLowerCase().trim();
        return totalKeywords.some(k => {
            // Strict match or space-bounded match to prevent 'da' matching 'date'
            const regex = new RegExp(`\\b${k}\\b`, 'i');
            return regex.test(h) || regex.test(d);
        });
    });

    let runningTotal = 0;
    let pageTotal = 0;
    let lastRowParsed = -1;
    
    // Pre-calculate raw numerical values for exactly what goes into the table
    // to avoid trying to parse complex React objects inside the PDF generator hook
    const cleanTableData = data.map(row => {
        const cleanRow: any[] = [];
        columns.forEach((col, idx) => {
            let val = row[col.dataKey];
            if (val === null || val === undefined) {
                cleanRow.push('');
            } else if (idx === totalColIndex && typeof val === 'number') {
                cleanRow.push(val); // Keep as number for easy math later
            } else {
                // If it's an object or react element, try to just cast to string safely
                cleanRow.push(typeof val === 'object' ? '' : String(val));
            }
        });
        return cleanRow;
    });

    // Add table
    autoTable(doc, {
      head: [columns.map(col => col.header)],
      body: cleanTableData.map(row => 
        row.map((cell, idx) => idx === totalColIndex && typeof cell === 'number' ? `${cell.toLocaleString()} F` : cell)
      ),
      foot: [
        columns.map((col, idx) => {
          if (idx === 0) return 'TOTAL';
          if (idx === totalColIndex) return '0 F';
          return '';
        }),
        columns.map((col, idx) => {
          if (idx === 0) return 'TOTAL (Cumul)';
          if (idx === totalColIndex) return '0 F';
          return '';
        })
      ],
      showFoot: 'everyPage',
      startY: 30,
      styles: { fontSize: 6 },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
      footStyles: { 
        fillColor: [22, 163, 74], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold',
        halign: 'right' 
      },
      didParseCell: function(data: any) {
        if (data.section === 'head') {
            pageTotal = 0;
        }
        
        // Use the clean pre-calculated array instead of the formatted cell strings
        if (data.section === 'body' && data.column.index === totalColIndex) {
          if (data.row.index !== lastRowParsed) {
              lastRowParsed = data.row.index;
              const rawVal = cleanTableData[data.row.index][totalColIndex];
              if (typeof rawVal === 'number') {
                pageTotal += rawVal;
                runningTotal += rawVal;
              }
          }
        }
        
        if (data.section === 'foot') {
          if (data.column.index === 0) {
            data.cell.styles.halign = 'left';
          }
          
          if (data.column.index === totalColIndex) {
            data.cell.styles.halign = 'right';
            if (data.row.index === 0) {
              data.cell.text = [`${pageTotal.toLocaleString()} F`];
            } else if (data.row.index === 1) {
              data.cell.text = [`${runningTotal.toLocaleString()} F`];
            }
          } else if (data.column.index !== 0) {
             data.cell.styles.lineWidth = 0;
             data.cell.text = [''];
          }
        }
      }
    });
    
    doc.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Format sales data for export
   */
  static formatSalesForExport(
    sales: any[], 
    workerMap?: Record<string, string>, 
    storeMap?: Record<string, string>,
    labels: Record<string, string> = {}
  ) {
    const l = {
      date: labels.date || 'Date',
      item: labels.item || 'Item',
      quantity: labels.quantity || 'Quantity',
      unitPrice: labels.unitPrice || 'Unit Price',
      total: labels.total || 'Total',
      worker: labels.worker || 'Worker',
      store: labels.store || 'Store',
      customer: labels.customer || 'Customer',
      phone: labels.phone || 'Phone',
      address: labels.address || 'Address',
      invoice: labels.invoice || 'Invoice',
      orderRef: labels.orderRef || 'Order Ref'
    };

    return sales.flatMap(sale => {
      const dateObj = new Date(sale.created_at);
      const dateStr = dateObj.toLocaleDateString();
      const timeStr = dateObj.toLocaleTimeString(); 
      
      const workerId = sale.worker_id || '';
      const workerName = (workerMap && workerMap[workerId]) 
        || sale.worker?.full_name 
        || sale.worker?.email 
        || (workerId.length > 8 ? `ID: ${workerId.slice(0, 8)}` : workerId)
        || 'Unknown';

      const storeName = (storeMap && storeMap[sale.store_id]) || sale.store?.name || sale.store_id || '';

      const items = sale.items || sale.sale_items || [];

      if (items.length === 0) {
        return [{
          [l.date]: `${dateStr} ${timeStr}`,
          [l.item]: '-',
          [l.quantity]: 0,
          [l.unitPrice]: 0,
          [l.total]: sale.total_price,
          [l.worker]: workerName,
          [l.store]: storeName,
          [l.customer]: sale.customer_name || 'Counter Client',
          [l.phone]: sale.customer_phone || '',
          [l.address]: sale.customer_address || '',
          [l.invoice]: sale.invoice_number || sale.id?.slice(0, 8) || '',
          [l.orderRef]: sale.order_ref || ''
        }];
      }

      return items.map((item: any) => ({
        [l.date]: `${dateStr} ${timeStr}`,
        [l.item]: item.product_name || item.name || 'Unknown',
        [l.quantity]: item.quantity,
        [l.unitPrice]: item.unit_price || item.price || 0,
        [l.total]: item.total || ((item.quantity || 0) * (item.unit_price || item.price || 0)),
        [l.worker]: workerName,
        [l.store]: storeName,
        [l.customer]: sale.customer_name || 'Counter Client',
        [l.phone]: sale.customer_phone || '',
        [l.address]: sale.customer_address || '',
        [l.invoice]: sale.invoice_number || sale.id?.slice(0, 8) || '',
        [l.orderRef]: sale.order_ref || ''
      }));
    });
  }

  /**
   * Format inventory data for export
   */
  static formatInventoryForExport(items: any[], storeMap?: Record<string, string>, labels: Record<string, string> = {}) {
    const l = {
      name: labels.name || 'Désignation',
      sku: labels.sku || 'SKU',
      store: labels.store || 'Magasin',
      unit: labels.unit || 'Unité',
      packaging: labels.packaging || 'Cond.',
      quantity: labels.quantity || 'Qté (PCS)',
      price: labels.price || 'Prix Détail',
      wholesale: labels.wholesale || 'Prix Gros',
      wholesaleHT: labels.wholesaleHT || 'Prix Gros HT',
      discount: labels.discount || 'Prix Remise',
      resale: labels.resale || 'Prix Revente',
      cost: labels.cost || 'Prix Achat',
      value: labels.value || 'Valeur (Détail)',
      threshold: labels.threshold || 'Seuil',
      description: labels.description || 'Description'
    };

    return items.map(item => ({
      [l.name]: item.name,
      [l.sku]: item.sku || '',
      [l.store]: (storeMap && storeMap[item.store_id]) || item.store_name || item.store_id || '',
      [l.unit]: item.unit_type || '',
      [l.packaging]: item.packaging || '1',
      [l.quantity]: item.quantity,
      [l.price]: Number(item.price || 0),
      [l.discount]: Number(item.selling_price_2 || 0),
      [l.wholesale]: Number(item.wholesale_price_ttc || item.selling_price_3 || 0),
      [l.wholesaleHT]: Number(item.wholesale_price_ht || 0),
      [l.resale]: Number(item.selling_price_4 || 0),
      [l.cost]: Number(item.cost || 0),
      [l.value]: Number(item.quantity || 0) * Number(item.price || 0),
      [l.threshold]: item.low_stock_threshold || '',
      [l.description]: item.description || '',
    }));
  }

  /**
   * Format workers data for export
   */
  static formatWorkersForExport(workers: any[], labels: Record<string, string> = {}) {
    const l = {
      name: labels.name || 'Name',
      email: labels.email || 'Email',
      phone: labels.phone || 'Phone',
      store: labels.store || 'Store',
      salesCount: labels.salesCount || 'Sales Count',
      revenue: labels.revenue || 'Total Revenue',
      status: labels.status || 'Status'
    };

    return workers.map(worker => ({
      [l.name]: worker.full_name || worker.profile?.full_name || '',
      [l.email]: worker.email || worker.profile?.email || '',
      [l.phone]: worker.phone || worker.profile?.phone || '',
      [l.store]: worker.store_name || '',
      [l.salesCount]: worker.sales_count ?? worker.salesCount ?? 0,
      [l.revenue]: (worker.total_revenue ?? worker.totalRevenue ?? 0).toFixed(2),
      [l.status]: worker.is_active ? 'Active' : 'Inactive',
    }));
  }

  /**
   * Format deliveries data for export
   */
  static formatDeliveriesForExport(deliveries: any[], storeMap?: Record<string, string>, labels: Record<string, string> = {}) {
    const l = {
      date: labels.date || 'Date',
      customer: labels.customer || 'Customer',
      phone: labels.phone || 'Phone',
      address: labels.address || 'Address',
      status: labels.status || 'Status',
      deliverer: labels.deliverer || 'Deliverer',
      store: labels.store || 'Store'
    };

    return deliveries.map(delivery => ({
      [l.date]: delivery.created_at,
      [l.customer]: delivery.customer_name || '',
      [l.phone]: delivery.customer_phone || '',
      [l.address]: delivery.delivery_address || '',
      [l.status]: delivery.status || '',
      [l.deliverer]: delivery.deliverer?.full_name || '',
      [l.store]: (storeMap && storeMap[delivery.store_id]) || delivery.store?.name || delivery.store_id || '',
    }));
  }
}
