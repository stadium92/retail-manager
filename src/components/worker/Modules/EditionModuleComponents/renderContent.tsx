const renderContent = () => {
    switch (mode) {
      case 'situation-client':
        const selectedClient = clients.find(c => c.id === selectedClientId);
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 bg-muted/20 p-3 rounded-lg border">
              <div className="flex items-center gap-2 flex-1">
                <Label className="font-bold uppercase text-[10px] whitespace-nowrap">{t('menu.program.client')}:</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-10 bg-background border-2">
                    <SelectValue placeholder={t('common.search')} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code || 'No Code'})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="font-bold uppercase text-[10px] whitespace-nowrap">{t('menu.program.date')}:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-10 border-2 font-mono">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <OfflineIndicator />
            </div>

            {selectedClient && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('menu.program.balance')}</p>
                    <p className={cn("text-2xl font-black font-mono", selectedClient.current_balance > 0 ? "text-danger" : "text-success")}>
                      {formatCurrency(selectedClient.current_balance)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('team.table.phone')}</p>
                    <p className="text-xl font-bold">{selectedClient.phone || '—'}</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('menu.program.creditLimit')}</p>
                    <p className="text-xl font-bold font-mono">{formatCurrency(selectedClient.credit_limit)}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="border-2 shadow-lg">
              <CardHeader className="py-3 border-b bg-muted/10">
                <CardTitle className="text-sm font-black uppercase tracking-widest font-mono">
                  {t('menu.edition.accountStatement')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.time')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('common.type')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('inventory.fields.description')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-center">{t('edition.orderRef')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.debit')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.credit')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStatement.map(tx => (
                        <TableRow key={tx.id} className="h-11 border-b hover:bg-muted/5 transition-colors">
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {format(new Date(tx.created_at), 'dd/MM HH:mm')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.type === 'sale' ? 'destructive' : 'default'} className="text-[9px] uppercase font-bold px-1">
                              {tx.type === 'sale' ? t('menu.management.saleShort') : t('menu.management.paymentShort')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-bold uppercase truncate max-w-[200px]">
                            {tx.reference || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-center font-mono">
                            {tx.order_ref || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold text-danger font-mono">
                            {tx.type === 'sale' ? formatCurrency(tx.amount) : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold text-success font-mono">
                            {tx.type === 'payment' ? formatCurrency(tx.amount) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredStatement.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-32 text-xs text-muted-foreground uppercase font-mono tracking-widest opacity-50">
                            {selectedClientId ? t('common.noData') : t('menu.program.selectDate')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'suivi-ventes-jour':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="h-4 w-4" />
                <span className="font-medium">
                  {format(dateRange.from, 'dd/MM/yyyy', { locale: getLocale() })}
                </span>
                <OfflineIndicator />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold text-primary">
                  {t('common.total')}: {formatCurrency(totalSales)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {filteredSales.length} {t('common.transactions')}
                </span>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow>
                        <TableHead className="text-xs">{t('menu.program.time')}</TableHead>
                        <TableHead className="text-xs">{t('sales.invoice_number', 'N° Facture')}</TableHead>
                        <TableHead className="text-xs">{t('edition.orderRef')}</TableHead>
                        <TableHead className="text-xs">{t('common.type')}</TableHead>
                        <TableHead className="text-xs">{t('common.status')}</TableHead>
                        <TableHead className="text-xs">{t('inventory.table.name')}</TableHead>
                        <TableHead className="text-xs text-center">{t('pos.grid.headers.qty')}</TableHead>
                        <TableHead className="text-xs text-right">{t('pos.grid.headers.price')}</TableHead>
                        <TableHead className="text-xs text-right">{t('common.total')}</TableHead>
                        <TableHead className="text-xs">{t('edition.seller')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.flatMap(sale => 
                        ((sale.items?.length ? sale.items : sale.sale_items) || []).map((item, idx) => (
                          <TableRow key={`${sale.id}-${idx}`} className="h-9">
                            <TableCell className="text-xs">
                              {sale.created_at ? format(new Date(sale.created_at), 'HH:mm', { locale: getLocale() }) : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-black font-mono">{sale.invoice_number || sale.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-xs font-mono">{sale.order_ref || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={sale.sale_type === 'proforma' ? 'secondary' : 'default'} className="text-[9px] uppercase font-bold px-1">
                                {sale.sale_type === 'proforma' ? t('edition.saved') : sale.sale_type === 'gros' ? t('edition.wholesale') : t('edition.retail')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={(sale.payment_status === 'paid' && sale.sale_type !== 'proforma') ? 'success' : 'warning'} className={cn("text-[9px] uppercase font-bold px-1", (sale.payment_status === 'paid' && sale.sale_type !== 'proforma') && "bg-success text-white")}>
                                {(sale.payment_status === 'paid' && sale.sale_type !== 'proforma') ? t('edition.paid') : t('edition.pending')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-medium uppercase">{getProductName(item)}</TableCell>
                            <TableCell className="text-xs text-center font-mono">{item.quantity}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="text-xs text-right font-bold font-mono">{formatCurrency(item.total)}</TableCell>
                            <TableCell className="text-xs font-medium">{workerMap[sale.worker_id || ''] || ((isLoading && !workerMap[sale.worker_id || '']) ? '...' : (sale.worker_id ? (sale.worker_id.length < 15 ? sale.worker_id : `ID: ${sale.worker_id.slice(0,8)}`) : '—'))}</TableCell>
                          </TableRow>
                        ))
                      )}
                      {filteredSales.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground py-8 uppercase font-mono opacity-50">
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    {filteredSales.length > 0 && (
                      <tfoot className="sticky bottom-0 bg-muted/50 font-bold border-t-2">
                        <TableRow>
                          <TableCell colSpan={8} className="text-right uppercase text-[10px]">{t('common.totalPage') || 'TOTAL PAGE'}</TableCell>
                          <TableCell className="text-right text-sm font-black text-primary font-mono">{formatCurrency(totalSales)}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </tfoot>
                    )}
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'suivi-ventes-factures':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-lg border">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 border-2 font-mono">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('common.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-9 border-2"
                />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-lg border border-primary/20">
                <span className="text-[10px] font-black uppercase text-primary opacity-70 tracking-widest">{t('common.total')}:</span>
                <span className="text-xl font-black font-mono text-primary">{formatCurrency(totalSales)}</span>
              </div>
              <OfflineIndicator />
            </div>

            <Card className="border-2 shadow-lg">
              <CardHeader className="py-3 border-b bg-muted/10">
                <CardTitle className="text-sm font-black uppercase tracking-widest font-mono flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t('menu.edition.invoiceList')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] uppercase font-bold">{t('storeDetails.sales.table.date')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('sales.invoice_number', 'N° Facture')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('edition.orderRef')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('common.type')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('common.status')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('pos.totals.customer')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.items')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('edition.seller')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('common.total')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-center">{t('common.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSales.map(sale => (
                        <TableRow key={sale.id} className="h-11 border-b hover:bg-muted/5 transition-colors">
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {sale.created_at ? format(new Date(sale.created_at), 'dd/MM HH:mm', { locale: getLocale() }) : '—'}
                          </TableCell>
                          <TableCell className="text-xs font-black font-mono">{sale.invoice_number || sale.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs font-mono">{sale.order_ref || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={sale.sale_type === 'proforma' ? 'secondary' : 'default'} className="text-[9px] uppercase font-bold px-1">
                              {sale.sale_type === 'proforma' ? t('edition.saved') : sale.sale_type === 'gros' ? t('edition.wholesale') : t('edition.retail')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={(sale.payment_status === 'paid' && sale.sale_type !== 'proforma') ? 'success' : 'warning'} className={cn("text-[9px] uppercase font-bold px-1", (sale.payment_status === 'paid' && sale.sale_type !== 'proforma') && "bg-success text-white")}>
                              {(sale.payment_status === 'paid' && sale.sale_type !== 'proforma') ? t('edition.paid') : t('edition.pending')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-bold uppercase">{sale.customer_name || t('customer.counterClient')}</TableCell>
                          <TableCell className="text-xs font-mono max-w-[200px] truncate" title={((sale.items?.length ? sale.items : sale.sale_items) || []).map(i => getProductName(i)).join(', ')}>
                            {((sale.items?.length ? sale.items : sale.sale_items) || []).map(i => getProductName(i)).join(', ') || '—'}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{workerMap[sale.worker_id || ''] || ((isLoading && !workerMap[sale.worker_id || '']) ? '...' : (sale.worker_id ? (sale.worker_id.length < 15 ? sale.worker_id : `ID: ${sale.worker_id.slice(0,8)}`) : '—'))}</TableCell>
                          <TableCell className="text-xs text-right font-black font-mono text-primary">{formatCurrency(sale.total_price)}</TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => setSelectedSale(sale)}>
                              <Eye className="h-4 w-4 text-primary" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSales.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-32 text-xs text-muted-foreground uppercase font-mono tracking-widest opacity-50">
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    {filteredSales.length > 0 && (
                      <tfoot className="sticky bottom-0 bg-muted/50 font-bold border-t-2">
                        <TableRow>
                          <TableCell colSpan={8} className="text-right uppercase text-[10px]">{t('common.totalPage') || 'TOTAL PAGE'}</TableCell>
                          <TableCell className="text-right text-sm font-black text-primary font-mono">{formatCurrency(totalSales)}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </tfoot>
                    )}
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'suivi-ventes-produit':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-lg border">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 border-2 font-mono">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
              <OfflineIndicator />
            </div>

            <Card className="border-2 shadow-lg">
              <CardHeader className="py-3 border-b bg-muted/10">
                <CardTitle className="text-sm font-black uppercase tracking-widest font-mono flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  {t('menu.program.topProducts')} ({salesByProduct.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] uppercase font-bold w-12">#</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('inventory.table.name')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-center">{t('inventory.table.quantity')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('edition.totalRevenue')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesByProduct.map((item, idx) => (
                        <TableRow key={item.name} className="h-11 border-b hover:bg-muted/5 transition-colors">
                          <TableCell className="text-xs font-bold text-muted-foreground font-mono">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-black uppercase">{item.name}</TableCell>
                          <TableCell className="text-xs text-center font-black font-mono">{item.quantity}</TableCell>
                          <TableCell className="text-xs text-right font-black font-mono text-primary">{formatCurrency(item.total)}</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground font-mono font-bold">
                            {totalSales > 0 ? ((item.total / totalSales) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'suivi-achats-jour':
      case 'suivi-achats-periode':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-lg border">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 border-2 font-mono">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-lg font-black text-primary font-mono">{t('common.total')}: {formatCurrency(totalPurchases)}</span>
                <OfflineIndicator />
              </div>
            </div>

            <Card className="border-2 shadow-lg">
              <CardHeader className="py-3 border-b bg-muted/10">
                <CardTitle className="text-sm font-black uppercase tracking-widest font-mono flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  {mode === 'suivi-achats-jour' ? t('menu.edition.dailyPurchases') : t('menu.edition.periodPurchases')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] uppercase font-bold">{t('storeDetails.sales.table.date')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.supplier')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-center">{t('menu.management.status')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('common.total')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map(order => (
                        <TableRow key={order.id} className="h-11 border-b hover:bg-muted/5 transition-colors">
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {order.created_at ? format(new Date(order.created_at), 'dd/MM HH:mm', { locale: getLocale() }) : '—'}
                          </TableCell>
                          <TableCell className="text-xs font-black uppercase">{order.supplier?.name || t('common.unknown')}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={order.status === 'received' ? 'default' : 'secondary'} className="text-[9px] uppercase font-bold px-1">
                              {order.status === 'received' ? t('menu.program.received') : t('menu.program.ordered')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right font-black font-mono text-danger">{formatCurrency(order.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                      {purchases.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-32 text-xs text-muted-foreground uppercase font-mono tracking-widest opacity-50">
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'suivi-achats-famille':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-lg border">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 border-2 font-mono">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
              <OfflineIndicator />
            </div>

            <Card className="border-2 shadow-lg">
              <CardHeader className="py-3 border-b bg-muted/10">
                <CardTitle className="text-sm font-black uppercase tracking-widest font-mono flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  {t('menu.edition.purchaseByFamily')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] uppercase font-bold">{t('inventory.fields.family')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-center">{t('menu.management.quantityOrdered')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.management.totalAmount')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchasesByFamily.map((fam) => (
                        <TableRow key={fam.family_name} className="h-11 border-b hover:bg-muted/5 transition-colors">
                          <TableCell className="text-xs font-black uppercase">{fam.family_name}</TableCell>
                          <TableCell className="text-xs text-center font-black font-mono">{fam.total_quantity}</TableCell>
                          <TableCell className="text-xs text-right font-black font-mono text-danger">{formatCurrency(fam.total_amount)}</TableCell>
                        </TableRow>
                      ))}
                      {purchasesByFamily.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-32 text-xs text-muted-foreground uppercase font-mono tracking-widest opacity-50">
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      case 'situation-fournisseur':
        const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 bg-muted/20 p-3 rounded-lg border">
              <div className="flex items-center gap-2 flex-1">
                <Label className="font-bold uppercase text-[10px] whitespace-nowrap">{t('menu.program.supplier')}:</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="h-10 bg-background border-2">
                    <SelectValue placeholder={t('common.search')} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="font-bold uppercase text-[10px] whitespace-nowrap">{t('menu.program.date')}:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-10 border-2 font-mono">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <OfflineIndicator />
            </div>

            {selectedSupplier && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('menu.program.dueBalance')}</p>
                    <p className={cn("text-2xl font-black font-mono", selectedSupplier.balance > 0 ? "text-danger" : "text-success")}>
                      {formatCurrency(selectedSupplier.balance)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('team.table.phone')}</p>
                    <p className="text-xl font-bold">{selectedSupplier.phone || '—'}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="border-2 shadow-lg">
              <CardHeader className="py-3 border-b bg-muted/10">
                <CardTitle className="text-sm font-black uppercase tracking-widest font-mono">
                  {t('menu.edition.supplierStatement')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.time')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('common.type')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('inventory.fields.description')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.debit')} ({t('menu.management.paymentShort')})</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.credit')} ({t('menu.management.purchaseShort')})</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStatement.map(tx => (
                        <TableRow key={tx.id} className="h-11 border-b hover:bg-muted/5 transition-colors">
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {format(new Date(tx.created_at), 'dd/MM HH:mm')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.type === 'purchase' ? 'destructive' : 'default'} className="text-[9px] uppercase font-bold px-1">
                              {tx.type === 'purchase' ? t('menu.management.purchaseShort') : t('menu.management.paymentShort')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-black uppercase truncate max-w-[200px]">
                            {tx.notes || tx.reference || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold text-success font-mono">
                            {tx.type === 'payment' ? formatCurrency(tx.amount) : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold text-danger font-mono">
                            {tx.type === 'purchase' ? formatCurrency(tx.amount) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredStatement.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-32 text-xs text-muted-foreground uppercase font-mono tracking-widest opacity-50">
                            {selectedSupplierId ? t('common.noData') : t('menu.program.selectDate')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return <div className="text-center py-8 text-muted-foreground">{t('common.error')}</div>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black uppercase tracking-tight">{t(`menu.edition.${mode.replace(/-/g, '_')}`)}</h2>
          <OfflineIndicator />
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={(v) => handleExport(v as any)}>
            <SelectTrigger className="h-8 w-32 bg-primary text-white border-none font-bold text-[10px] uppercase">
              <Download className="h-3 w-3 mr-2" />
              <SelectValue placeholder={t('export.title')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadData} className="h-8 text-[10px] font-bold uppercase">
            <RefreshCw className="h-3 w-3 mr-2" />
            {t('common.refresh')}
          </Button>
        </div>
      </div>
      {renderContent()}
      <InvoiceDetailsDialog 
        sale={selectedSale} 
        onClose={() => setSelectedSale(null)} 
      />
    </div>
  );
}
