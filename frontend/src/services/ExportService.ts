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
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 22);
    
    // Add table
    autoTable(doc, {
      head: [columns.map(col => col.header)],
      body: data.map(row => columns.map(col => row[col.dataKey] || '')),
      startY: 30,
      styles: { fontSize: 8 },
    });
    
    doc.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /**
   * Format sales data for export
   */
  static formatSalesForExport(sales: any[]) {
    return sales.map(sale => ({
      'Date': sale.sale_date,
      'Item': sale.items?.name || '',
      'Quantity': sale.quantity,
      'Unit Price': sale.unit_price,
      'Total': sale.total_price,
      'Worker': sale.workers?.full_name || '',
      'Store': sale.stores?.name || '',
      'Customer': sale.customer_name || '',
      'Phone': sale.customer_phone || '',
      'Address': sale.delivery_address || '',
    }));
  }

  /**
   * Format inventory data for export
   */
  static formatInventoryForExport(items: any[]) {
    return items.map(item => ({
      'Name': item.name,
      'SKU': item.sku || '',
      'Quantity': item.quantity,
      'Price': item.price,
      'Cost': item.cost || '',
      'Low Stock Threshold': item.low_stock_threshold || '',
      'Store': item.stores?.name || '',
      'Description': item.description || '',
    }));
  }

  /**
   * Format workers data for export
   * Supports both old format (with profile) and new TeamMember format
   */
  static formatWorkersForExport(workers: any[]) {
    return workers.map(worker => ({
      'Name': worker.full_name || worker.profile?.full_name || '',
      'Email': worker.email || worker.profile?.email || '',
      'Phone': worker.phone || worker.profile?.phone || '',
      'Store': worker.store_name || '',
      'Sales Count': worker.sales_count ?? worker.salesCount ?? 0,
      'Total Revenue': (worker.total_revenue ?? worker.totalRevenue ?? 0).toFixed(2),
      'Status': worker.is_active ? 'Active' : 'Inactive',
    }));
  }

  /**
   * Format deliveries data for export
   */
  static formatDeliveriesForExport(deliveries: any[]) {
    return deliveries.map(delivery => ({
      'Date': delivery.created_at,
      'Customer': delivery.customer_name || '',
      'Phone': delivery.customer_phone || '',
      'Address': delivery.delivery_address || '',
      'Status': delivery.status || '',
      'Deliverer': delivery.deliverer?.full_name || '',
      'Store': delivery.store?.name || '',
    }));
  }
}
