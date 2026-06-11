const handleExport = (type: 'pdf' | 'excel' | 'csv') => {
    const exportLabels = {
      date: t('storeDetails.sales.table.date'),
      item: t('inventory.table.name'),
      quantity: t('pos.grid.headers.qty'),
      unitPrice: t('pos.grid.headers.price'),
      total: t('common.total'),
      worker: t('edition.seller'),
      store: t('inventory.fields.store'),
      customer: t('pos.totals.customer'),
      invoice: t('sales.invoice_number'),
      orderRef: t('edition.orderRef')
    };

    let exportData: any[] = [];
    let title = '';
    let columns: { header: string; dataKey: string }[] = [];

    if (mode.startsWith('suivi-ventes')) {
        exportData = ExportService.formatSalesForExport(filteredSales, workerMap, {}, exportLabels);
        title = t('menu.edition.salesTracking');
        columns = [
            { header: exportLabels.date, dataKey: exportLabels.date },
            { header: exportLabels.invoice, dataKey: exportLabels.invoice },
            { header: exportLabels.item, dataKey: exportLabels.item },
            { header: exportLabels.quantity, dataKey: exportLabels.quantity },
            { header: exportLabels.total, dataKey: exportLabels.total },
            { header: exportLabels.worker, dataKey: exportLabels.worker }
        ];
    } else if (mode.startsWith('suivi-achats')) {
        exportData = purchases.map(p => ({
            [exportLabels.date]: format(new Date(p.created_at), 'dd/MM/yyyy HH:mm'),
            [exportLabels.item]: p.supplier?.name || '?',
            [exportLabels.total]: p.total_amount,
            ['Status']: p.status
        }));
        title = t('menu.edition.purchaseTracking');
        columns = [
            { header: exportLabels.date, dataKey: exportLabels.date },
            { header: exportLabels.item, dataKey: exportLabels.item },
            { header: exportLabels.total, dataKey: exportLabels.total },
            { header: 'Status', dataKey: 'Status' }
        ];
    }

    if (type === 'pdf') {
        ExportService.exportToPDF(exportData, `report-${mode}`, title, columns);
    } else if (type === 'excel') {
        ExportService.exportToExcel(exportData, `report-${mode}`);
    } else {
        ExportService.exportToCSV(exportData, `report-${mode}`);
    }
  };

  const OfflineIndicator = () => isOffline ? (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-warning/20 text-warning text-xs">
      <WifiOff className="h-3 w-3" />
      <span>{t('common.offline')}</span>
    </div>
  ) : null;

  