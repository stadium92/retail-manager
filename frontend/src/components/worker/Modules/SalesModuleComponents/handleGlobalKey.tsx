const handleGlobalKey = (e: KeyboardEvent) => {
      if (isPaymentOpen || isProductLookupOpen || isScanning) return;
      const { activeCell, inputMethod } = useNavigationStore.getState();
      const target = e.target as HTMLElement;
      const isInputOrButton = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'BUTTON' || target?.getAttribute('role') === 'menuitem';
      if (e.key === 'Enter' && inputMethod === 'keyboard' && !isInputOrButton && !activeCell) {
        e.preventDefault();
        const emptyRowIndex = lineItems.findIndex(i => !i.productId);
        let targetRow = emptyRowIndex !== -1 ? emptyRowIndex : lineItems.length;
        const store = useNavigationStore.getState();
        store.setActiveCell({ row: targetRow, col: 0 });
        store.setMode('hover');
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [lineItems, isPaymentOpen, isProductLookupOpen, isScanning]);

  useEffect(() => {
    if (isLoading) return;
    if (!lineItems.some(i => !i.productId)) {
      const newItem = { id: crypto.randomUUID(), lineNumber: lineItems.length + 1, designation: '', code: '', conditionnement: 1, stock: 0, unitPrice: '', basePrice: 0, quantity: '', discountPercent: '', lineTotal: 0, isBox: false, priceTiers: { 1: 0, 2: 0, 3: 0, 4: 0 } };
      updateSession(mode, { lineItems: [...lineItems, newItem] });
    }
  }, [lineItems, mode, updateSession, isLoading]);

  if (isLoading) return <div className="h-full flex items-center justify-center font-mono text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div id="sales-module-container" className="h-full flex flex-col overflow-hidden">
      <SanifereHeader mode={mode} invoiceNumber={invoiceNumber} customerCode={customerCode} customerName={customerName} customerPhone={currentSession.customerPhone || ''} customerAddress={customerAddress} orderRef={orderRef}
        onCustomerChange={(code, name, phone, address) => {
          if (code !== customerCode) handleClientChange('code', code, phone, address);
          else if (name !== customerName) handleClientChange('name', name, phone, address);
          else updateSession(mode, { customerAddress: address, customerPhone: phone });
        }}
        onOrderRefChange={(ref) => updateSession(mode, { orderRef: ref })}
        onOrderRefLoad={handleOrderRefLoad}
        onInvoiceNumberChange={(num) => updateSession(mode, { invoiceNumber: num })}
      />
      
      {/* Restaurant Specific Bar - MPM Food Dark Theme */}
      <div className="bg-[#0D0D0D] border-b border-[#F5C518]/20 px-4 py-1.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#F5C518] font-bold uppercase tracking-wider">Table :</span>
          <select
            value={currentSession.tableNumber || ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : null;
              updateSession(mode, { tableNumber: val });
            }}
            className="bg-[#1A1A1A] border border-[#F5C518]/30 px-2 py-0.5 rounded text-white font-bold focus:outline-none focus:border-[#F5C518]/60 transition-colors"
          >
            <option value="">À Emporter</option>
            {tablesList.map((tbl) => (
              <option key={tbl.id} value={tbl.table_number}>Table {tbl.table_number}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#F5C518] font-bold uppercase tracking-wider">Service :</span>
          <select
            value={currentSession.orderType || 'dine_in'}
            onChange={(e) => {
              updateSession(mode, { orderType: e.target.value as any });
            }}
            className="bg-[#1A1A1A] border border-[#F5C518]/30 px-2 py-0.5 rounded text-white font-bold focus:outline-none focus:border-[#F5C518]/60 transition-colors"
          >
            <option value="dine_in">Sur Place</option>
            <option value="takeaway">À Emporter</option>
            <option value="delivery">Livraison</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <span className="text-[#F5C518] font-bold uppercase tracking-wider">Notes Cuisine :</span>
          <input
            type="text"
            value={currentSession.kitchenNotes || ''}
            onChange={(e) => {
              updateSession(mode, { kitchenNotes: e.target.value });
            }}
            placeholder="Ex: Sans oignon, bien cuit..."
            className="bg-[#1A1A1A] border border-[#F5C518]/30 px-3 py-0.5 rounded text-white font-bold flex-1 focus:outline-none focus:border-[#F5C518]/60 transition-colors placeholder:text-white/30"
          />
        </div>
      </div>


      <SanifereGrid items={lineItems} selectedIndex={selectedIndex} priceLabel={mode === 'proforma' ? t('inventory.price') : (mode === 'facturation-gros' ? t('inventory.fields.wholesalePriceShort') : t('inventory.fields.retailPriceShort'))}
        onSelectLine={(index) => { setSelectedIndex(index); const store = useNavigationStore.getState(); if (store.activeCell?.row !== index) store.setActiveCell({ row: index, col: store.activeCell?.col || 0 }); }}
        onQuantityChange={handleQuantityChange} onDiscountChange={handleDiscountChange} onDeleteLine={handleDeleteLine} onDesignationChange={handleDesignationChange} onOpenSearch={() => setIsProductLookupOpen(true)} onPriceChange={handlePriceChange} onToggleUnit={handleToggleUnit} onGlobalTierChange={handleGlobalTierChange} onRowTierChange={handleRowTierChange} activeTier={activeTier} enablePriceTiers={mode === 'proforma'} persistenceKey={`sales_grid_${user?.id || 'anon'}`}
      />
      <SanifereFooter mode={mode} netTotal={netTotal} onValidate={() => lineItems.length > 0 && openPayment()} onSettlement={() => lineItems.length > 0 && openPayment()} onProductCard={() => setIsProductLookupOpen(true)} onDelete={() => selectedIndex >= 0 && handleDeleteLine(selectedIndex)} onSave={handleSaveProforma} onPrint={handlePrint} onPrintA4={handlePrintA4} />
      <ProductLookupDialog initialSearch={initialSearchQuery} open={isProductLookupOpen} onOpenChange={(open) => { setIsProductLookupOpen(open); if (!open) setTimeout(() => { const store = useNavigationStore.getState(); if (store.activeCell) store.setMode('hover'); }, 50); }} storeId={storeId} mode={mode === 'facturation-gros' ? 'wholesale' : 'retail'}
        onSelect={(product) => { addProduct(product); setInitialSearchQuery(''); setTimeout(() => { const store = useNavigationStore.getState(); if (store.activeCell) { store.setActiveCell({ row: store.activeCell.row, col: 5 }); store.setMode('hover'); } }, 100); }}
      />
      <PaymentDialog open={isPaymentOpen} onOpenChange={(open) => { setIsPaymentOpen(open); if (!open) setTimeout(() => { const store = useNavigationStore.getState(); store.jumpToLastEmptyRow(); store.setMode('hover'); }, 100); }} mode={mode} totalAmount={netTotal} onConfirm={handlePaymentConfirm} />
      <BarcodeScanner isScanning={isScanning} onResult={handleScanResult} onClose={() => setIsScanning(false)} />
      {/* Hidden A4 Invoice Template for printing */}
      <div style={{ display: 'none' }}>
        {a4InvoiceData && <InvoiceA4Template ref={a4PrintRef} data={a4InvoiceData} />}
      </div>
    </div>
  );
}
