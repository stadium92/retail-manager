const renderContent = () => {
    switch (mode) {
      case 'consultation-caisse':
      case 'journal-caisse':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 font-mono">
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</>
                        ) : (
                          format(dateRange.from, "dd/MM/yy")
                        )
                      ) : (
                        <span>{t('menu.program.selectDate')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <Button size="sm" variant="secondary" className="h-9 gap-2" onClick={() => setIsPettyCashOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('menu.management.recordExpense')}
                </Button>
              </div>
              <OfflineIndicator />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/20">
                      <ArrowDownCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.income')}</p>
                      <p className="text-lg font-bold text-success font-mono">{formatCurrency(kpis.totalRevenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-danger/20">
                      <ArrowUpCircle className="h-5 w-5 text-danger" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.expenses')}</p>
                      <p className="text-lg font-bold text-danger font-mono">{formatCurrency(kpis.totalExpenses)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.creditSale')}</p>
                      <p className="text-lg font-bold font-mono">{formatCurrency(kpis.totalCreditSales)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-primary/10 border-primary">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20 text-primary">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.cashBalance')}</p>
                      <p className="text-lg font-bold font-mono">{formatCurrency(kpis.netCash)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-lg border-2 border-primary/20">
              <CardHeader className="py-3 border-b bg-muted/10">
                <CardTitle className="text-sm uppercase tracking-widest font-mono">
                  {t('menu.program.cashJournal')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.time')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('inventory.fields.description')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('inventory.fields.category')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.transaction')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.runningBalance')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashEntries.map(entry => (
                        <TableRow key={entry.id} className={cn("h-11 border-b hover:bg-muted/10 transition-colors", (entry as any).isCredit && "opacity-60 bg-muted/20 italic")}>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {format(new Date(entry.date), 'HH:mm')}
                          </TableCell>
                          <TableCell className="text-xs font-bold uppercase truncate max-w-[250px]">
                            {entry.description}
                            {(entry as any).method && (
                              <Badge variant="outline" className="ml-2 text-[8px] h-4 py-0 uppercase border-muted-foreground/30">
                                {(entry as any).method}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[10px] uppercase text-muted-foreground font-medium">
                            {entry.category}
                          </TableCell>
                          <TableCell className={cn("text-xs text-right font-bold font-mono", entry.type === 'in' ? "text-success" : "text-danger")}>
                            {entry.type === 'in' ? '+' : '-'}{formatCurrency(entry.amount)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-black font-mono text-primary bg-primary/5">
                            {formatCurrency((entry as any).runningBalance || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {cashEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-24 uppercase font-mono tracking-[0.2em] opacity-50">
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            <Dialog open={isPettyCashOpen} onOpenChange={setIsPettyCashOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="uppercase font-mono">{t('menu.management.recordExpense')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('menu.program.amount')}</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={pettyCashForm.amount}
                      onChange={e => setPettyCashForm({...pettyCashForm, amount: e.target.value})}
                      className="h-12 text-2xl font-bold font-mono border-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('menu.program.reason')}</Label>
                    <Select 
                      value={pettyCashForm.category}
                      onValueChange={v => setPettyCashForm({...pettyCashForm, category: v})}
                    >
                      <SelectTrigger className="h-11 border-2 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="petty_cash">Dépense Diverse / Petty Cash</SelectItem>
                        <SelectItem value="supplies">Fournitures / Supplies</SelectItem>
                        <SelectItem value="bills">Factures / Bills</SelectItem>
                        <SelectItem value="salaries">Avance Salaire / Salaries</SelectItem>
                        <SelectItem value="delivery">Frais Livraison / Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.description')}</Label>
                    <Textarea 
                      placeholder={t('analytics.expenseDetailPlaceholder')}
                      value={pettyCashForm.description}
                      onChange={e => setPettyCashForm({...pettyCashForm, description: e.target.value})}
                      className="border-2"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPettyCashOpen(false)}>{t('common.cancel')}</Button>
                  <Button 
                    className="bg-danger hover:bg-danger/90 text-white font-bold"
                    onClick={handleRecordPettyCash}
                  >
                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                    {t('common.confirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );

      case 'tableau-bord':


        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 font-mono">
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yy")
                        )
                      ) : (
                        <span>{t('menu.program.selectDate')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] h-7 px-2 uppercase"
                    onClick={() => setDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}
                  >
                    {t('menu.program.today')}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] h-7 px-2 uppercase"
                    onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) })}
                  >
                    {t('menu.program.last7Days')}
                  </Button>
                </div>
              </div>
              <OfflineIndicator />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-primary">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('menu.program.revenue') || 'Chiffre d\'Affaires'}</p>
                      <p className="text-lg font-bold">{formatCurrency(kpis.totalRevenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-success">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/20">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Couverts Estimés</p>
                      <p className="text-lg font-bold text-success">{kpis.coversCount} pers.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-amber-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <ShoppingCart className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Commandes Totales</p>
                      <p className="text-lg font-bold text-amber-600">{kpis.orderCount} ({kpis.dineInCount} Sur place / {kpis.takeawayCount} Emporter / {kpis.deliveryCount} Livr.)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-warning">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/20">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Occupation des Tables</p>
                      <p className="text-lg font-bold text-warning">
                        {tableMetrics.total > 0 ? `${((tableMetrics.occupied / tableMetrics.total) * 100).toFixed(0)}%` : '0%'} ({tableMetrics.occupied}/{tableMetrics.total} Tables)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('analytics.revenueEvolution')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={weeklyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="date" className="text-[10px] font-mono" />
                      <YAxis className="text-[10px] font-mono" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('menu.management.stockStatus')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stockHealthData.length > 0 ? (
                    <div className="space-y-4">
                      <div className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stockHealthData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {stockHealthData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-1 gap-2 pt-2">
                        {stockHealthData.map((item) => (
                          <div key={item.name} className="flex items-center justify-between text-[10px] font-bold uppercase">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span>{item.name}</span>
                            </div>
                            <span className="font-mono">{item.value} {t('menu.program.productsDisplayed')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground uppercase font-mono">
                      {t('common.noData')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               <Card>
                <CardHeader className="py-3 border-b bg-muted/20">
                  <CardTitle className="text-xs uppercase">{t('analytics.topProductsVolume')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {topProducts.slice(0, 5).map((p, idx) => (
                        <TableRow key={p.name} className="h-10 border-b last:border-0">
                          <TableCell className="text-xs font-mono w-8 text-muted-foreground">0{idx+1}</TableCell>
                          <TableCell className="text-xs font-bold uppercase">{p.name}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{p.qty} {t('inventory.unitTypes.piece')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
               </Card>

               <Card>
                <CardHeader className="py-3 border-b bg-muted/20">
                  <CardTitle className="text-xs uppercase">{t('analytics.categoryDistribution')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {categoryData.map((c, idx) => (
                        <TableRow key={c.name} className="h-10 border-b last:border-0">
                          <TableCell className="text-xs font-bold uppercase">{c.name}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{formatCurrency(c.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
               </Card>
            </div>
          </div>
        );

      case 'statistiques':
        // Calculate Hourly Distribution
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}h`,
          revenue: 0,
          count: 0
        }));

        sales.forEach(sale => {
          const hour = new Date(sale.created_at).getHours();
          hourlyData[hour].revenue += Number(sale.total_price || 0);
          hourlyData[hour].count += 1;
        });

        const activeHours = hourlyData.filter(h => h.count > 0 || h.revenue > 0);

        // Average Basket Value
        const abv = kpis.orderCount > 0 ? kpis.totalRevenue / kpis.orderCount : 0;
        const avgItems = kpis.orderCount > 0 
          ? sales.reduce((sum, s) => sum + ((s.items?.length ? s.items : s.sale_items) || []).length, 0) / kpis.orderCount 
          : 0;

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 font-mono">
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</>
                        ) : (
                          format(dateRange.from, "dd/MM/yy")
                        )
                      ) : (
                        <span>{t('menu.program.selectDate')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <OfflineIndicator />
            </div>

            {/* Advanced KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('analytics.avgBasket')}</p>
                    <p className="text-xl font-bold font-mono">{formatCurrency(abv)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary opacity-20" />
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('analytics.itemsPerSale')}</p>
                    <p className="text-xl font-bold font-mono">{avgItems.toFixed(1)}</p>
                  </div>
                  <Package className="h-8 w-8 text-success opacity-20" />
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Temps Prep Moyen</p>
                    <p className="text-xl font-bold font-mono">
                      {kpis.avgPrepTime.toFixed(1)} min
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-warning opacity-20" />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hourly Peak Analysis */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('analytics.hourlyTraffic')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={activeHours}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="hour" className="text-[10px] font-mono" />
                      <YAxis yAxisId="left" className="text-[10px] font-mono" orientation="left" stroke="#888888" />
                      <YAxis yAxisId="right" className="text-[10px] font-mono" orientation="right" stroke="hsl(var(--primary))" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', fontSize: '12px' }}
                      />
                      <Bar yAxisId="left" dataKey="count" name={t('analytics.sales')} fill="#888888" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="revenue" name={t('analytics.revenue')} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Worker Performance */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('analytics.workerPerformance')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow className="bg-muted/20">
                        <TableHead className="text-[10px] uppercase">{t('common.name')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-center">{t('sidebar.sales')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">{t('analytics.revenue')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics?.top_workers?.map(worker => (
                        <TableRow key={worker.name} className="h-11">
                          <TableCell className="text-xs font-bold uppercase">{worker.name}</TableCell>
                          <TableCell className="text-xs text-center font-mono">{worker.sales_count}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-primary">
                            {formatCurrency(worker.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!analytics?.top_workers?.length && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8 uppercase">
                            {t('analytics.noPerformanceData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="py-3 border-b bg-muted/20">
                <CardTitle className="text-xs uppercase">{t('menu.program.topProducts')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase w-12">#</TableHead>
                        <TableHead className="text-[10px] uppercase">{t('inventory.table.name')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-center">{t('inventory.table.quantity')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">Chiffre d'Affaires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((product, idx) => (
                        <TableRow key={product.name} className="h-11">
                          <TableCell className="text-xs font-bold text-primary font-mono">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-bold uppercase">{product.name}</TableCell>
                          <TableCell className="text-xs text-center font-mono">{product.qty}</TableCell>
                          <TableCell className="text-xs text-right font-bold">
                            {formatCurrency(product.revenue)}
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

      case 'sorties-pertes':
        const lossMovements = movements.filter(m => m.type === 'out' && m.reason?.startsWith('Perte'));
        const todayLosses = lossMovements.filter(m => new Date(m.date) >= startOfDay(new Date()));

        return (
          <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
            <div className="space-y-4">
              <Card className="border-danger/30">
                <CardHeader className="py-3 bg-danger/5">
                  <CardTitle className="text-sm flex items-center gap-2 text-danger uppercase font-mono">
                    <Trash2 className="h-4 w-4" />
                    {t('menu.management.recordLoss')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('inventory.table.name')}</Label>
                    <Button 
                      variant="outline" 
                      className={cn("w-full h-11 justify-start text-left font-normal border-2", !lossForm.product && "text-muted-foreground")}
                      onClick={() => setIsProductLookupOpen(true)}
                    >
                      {lossForm.product ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-black uppercase">{lossForm.product.name}</span>
                          <span className="text-[10px] text-muted-foreground">{t('menu.management.currentStock')}: {lossForm.product.quantity} {t('inventory.unitTypes.piece')}</span>
                        </div>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          {t('common.search')}...
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('inventory.table.quantity')}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={lossForm.quantity === 0 ? '' : lossForm.quantity}
                      onChange={(e) => setLossForm(f => ({ ...f, quantity: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                      onBlur={() => { if (lossForm.quantity === '') setLossForm(f => ({ ...f, quantity: 1 })) }}
                      className="h-11 text-lg font-mono font-bold border-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('menu.program.reason')}</Label>
                    <Select 
                      value={lossForm.reason} 
                      onValueChange={(v: 'expired' | 'broken' | 'theft' | 'other') => setLossForm(f => ({ ...f, reason: v }))}
                    >
                      <SelectTrigger className="h-11 border-2 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expired">{t('menu.management.reasons.expired')}</SelectItem>
                        <SelectItem value="broken">{t('menu.management.reasons.broken')}</SelectItem>
                        <SelectItem value="theft">{t('menu.management.reasons.theft')}</SelectItem>
                        <SelectItem value="other">{t('menu.management.reasons.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('menu.program.notes')}</Label>
                    <Textarea
                      value={lossForm.notes}
                      onChange={(e) => setLossForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="..."
                      rows={2}
                      className="border-2"
                    />
                  </div>

                  <Button 
                    onClick={() => {
                      if (confirm(t('menu.management.confirmLoss', { qty: lossForm.quantity, name: lossForm.product?.name }))) {
                        handleRecordLoss();
                      }
                    }} 
                    disabled={!lossForm.product || lossForm.quantity <= 0}
                    className="w-full h-12 bg-danger hover:bg-danger/90 text-white font-bold uppercase tracking-widest"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {t('menu.management.validateLoss')}
                  </Button>
                </CardContent>
              </Card>

              {/* Low stock warning */}
              {lowStockQuery.total > 0 && (
                <Card className="border-warning/50">
                  <CardHeader className="py-2 bg-warning/10">
                    <CardTitle className="text-xs flex items-center gap-2 text-warning uppercase">
                      <AlertTriangle className="h-3 w-3" />
                      {t('inventory.lowStock')} ({lowStockQuery.total})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[150px]">
                      <Table>
                        <TableBody>
                          {lowStockQuery.results.map(p => (
                            <TableRow key={p.id} className="h-8 border-b">
                              <TableCell className="text-[10px] font-bold uppercase truncate max-w-[150px]">{p.name}</TableCell>
                              <TableCell className="text-[10px] text-right text-warning font-bold font-mono">
                                {p.quantity} {t('inventory.unitTypes.piece')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card className="h-full">
                <CardHeader className="py-3 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-xs uppercase font-mono tracking-widest">{t('menu.management.lossHistory')}</CardTitle>
                  <OfflineIndicator />
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.time')}</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold">{t('sidebar.inventory')}</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-center">{t('inventory.table.quantity')}</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.reason')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {todayLosses.map(mov => (
                          <TableRow key={mov.id} className="h-11 border-b">
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {format(new Date(mov.created_at || mov.date || new Date()), 'HH:mm')}
                            </TableCell>
                            <TableCell className="text-xs font-bold uppercase">{mov.product_name}</TableCell>
                            <TableCell className="text-xs text-center font-bold text-danger font-mono">-{mov.quantity}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[9px] uppercase border-danger text-danger">
                                {t(`menu.management.reasons.${mov.reason?.replace('Perte: ', '')}`) || mov.reason?.replace('Perte: ', '') || t('common.other')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {todayLosses.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-20 text-xs text-muted-foreground uppercase font-mono tracking-widest">
                              {t('menu.management.noLossToday')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            
            <ProductLookupDialog
              open={isProductLookupOpen}
              onOpenChange={setIsProductLookupOpen}
              storeId={storeId}
              mode="retail"
              onSelect={(p) => {
                setLossForm(f => ({ ...f, product: p }));
                setIsProductLookupOpen(false);
              }}
            />
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
    <div className="h-full overflow-auto p-4">
      {renderContent()}
    </div>
  );
}