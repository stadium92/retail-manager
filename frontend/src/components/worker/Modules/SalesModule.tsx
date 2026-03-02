import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useReactToPrint } from 'react-to-print';
import { InvoiceTemplate, InvoiceData } from '@/components/printing/InvoiceTemplate';
import { supabase } from '@/integrations/supabase/client';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { Product } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useSalesStore } from '@/stores/useSalesStore';
import { useMasterDataStore } from '@/stores/useMasterDataStore';

import { SanifereHeader, SaleMode } from '../Sales/SanifereHeader';
import { SanifereGrid, SanifereLineItem } from '../Sales/SanifereGrid';
import { SanifereFooter } from '../Sales/SanifereFooter';
import { ProductLookupDialog } from '../Sales/ProductLookupDialog';
import { PaymentDialog } from '../Sales/PaymentDialog';
import { BarcodeScanner } from '@/components/shared/BarcodeScanner';
import { useProductScanner } from '@/hooks/useProductScanner';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useSettingsStore } from '@/stores/useSettingsStore';

import { OfflineStoreService } from '@/services/OfflineStoreService';

interface SalesModuleProps {
  storeId: string;
  mode: SaleMode;
}

function getProductPrice(product: Product, mode: SaleMode, tier: number): number {
  if (mode === 'facturation-gros') {
    // Wholesale Billing uses Price 3 (Bulk/Gros)
    return product.selling_price_3 || product.selling_price_2 || product.unit_price;
  }
  
  switch(tier) {
    case 1: return product.unit_price;
    case 2: return product.selling_price_2 || product.unit_price;
    case 3: return product.selling_price_3 || product.unit_price;
    case 4: return product.selling_price_4 || product.unit_price;
    default: return product.unit_price;
  }
}

function calculateLineTotal(unitPrice: number, quantity: number, discountPercent: number, isBox: boolean = false, packSize: number = 1): number {
  const multiplier = isBox ? (packSize || 1) : 1;
  const subtotal = unitPrice * quantity * multiplier;
  const discountAmount = subtotal * (discountPercent / 100);
  return Math.round(subtotal - discountAmount);
}

function generateInvoiceNumber(): string {
  const datePrefix = format(new Date(), 'yyMMdd');
  const sequence = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `${datePrefix}${sequence}`;
}

export function SalesModule({ storeId, mode }: SalesModuleProps) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useFormatters();
  const { getKeyForAction } = useSettingsStore();
  const { user } = useAuth();
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
  const { sessions, updateSession } = useSalesStore();
  const { clients, setClients, services } = useMasterDataStore();
  const { scanProduct } = useProductScanner(storeId);

  const keyValidate = getKeyForAction('ACTION_VALIDATE') || 'F2';
  const keySearch = getKeyForAction('ACTION_SEARCH') || 'F3';
  const keyPay = getKeyForAction('ACTION_PAY') || 'F4';
  const keyPrint = getKeyForAction('ACTION_PRINT') || 'F9';
  const keySave = getKeyForAction('ACTION_SAVE') || 'F10';
  const keyScan = getKeyForAction('ACTION_SCAN');

  const currentSession = sessions[mode] || {
    lineItems: [],
    customerCode: '',
    customerName: '',
    customerAddress: '',
    orderRef: '',
  };

  const {
    lineItems,
    customerCode,
    customerName,
    customerAddress,
    orderRef,
    invoiceNumber: savedInvoiceNumber
  } = currentSession;

  const invoiceNumber = useMemo(() => {
    return savedInvoiceNumber || generateInvoiceNumber();
  }, [savedInvoiceNumber]);

  const printRef = useRef<HTMLDivElement>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);

  const handlePrintTrigger = useReactToPrint({
    contentRef: printRef,
  });

  useEffect(() => {
    if (!savedInvoiceNumber) {
      updateSession(mode, { invoiceNumber });
    }
  }, [invoiceNumber, savedInvoiceNumber, mode, updateSession]);

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductLookupOpen, setIsProductLookupOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTier, setActiveTier] = useState<number>(1);

  // Fetch Store Default Tier
  useEffect(() => {
    const fetchStoreSettings = async () => {
      try {
        const { data: stores } = await OfflineStoreService.getStores({ notify: false });
        if (stores) {
          const currentStore = stores.find(s => s.id === storeId);
          if (currentStore && currentStore.default_price_tier) {
            setActiveTier(currentStore.default_price_tier);
          }
        }
      } catch (e) {
        console.error("Failed to fetch store settings", e);
      }
    };
    fetchStoreSettings();
  }, [storeId]);

  useEffect(() => {
    const fetchClients = async () => {
      if (!storeId || clients.length > 0) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      try {
        if (isLocalFirst) {
          const headers = await OfflineAuthService.getAuthHeaders();
          if (!headers) {
            setIsLoading(false);
            return;
          }
          const params = new URLSearchParams({ store_id: storeId });
          const clientRes = await fetch(`${localBridgeBaseUrl}/rest/v1/clients?${params.toString()}`, { headers });
          const clientPayload = await clientRes.json().catch(() => []);
          if (clientRes.ok && clientPayload) {
            setClients(clientPayload);
          }
        } else {
          const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .eq('store_id', storeId);
            if (clientData) setClients(clientData); 
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error(t('common.failedToLoad'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchClients();
  }, [storeId, isLocalFirst, localBridgeBaseUrl, clients.length, setClients, t]);

  const netTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [lineItems]);

  const handlePrint = useCallback(() => {
    if (lineItems.length === 0) return;
    
    const cartItems = lineItems.map(item => {
        const packSize = item.conditionnement || 1;
        let totalUnitsForDb = item.isBox ? item.quantity * packSize : item.quantity;
        return {
          product: {
            id: item.productId || '',
            store_id: storeId,
            name: item.designation,
            unit_price: item.unitPrice,
            quantity: item.stock,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          quantity: totalUnitsForDb,
          discount: item.discountPercent,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          total: item.lineTotal,
        };
    });

    const invoiceData: InvoiceData = {
        id: invoiceNumber,
        invoice_number: invoiceNumber,
        order_ref: orderRef,
        storeName: "Magasin", 
        workerName: user?.full_name || t('edition.seller'),
        customerName: customerName,
        customerPhone: (currentSession as any).customerPhone,
        customerAddress: customerAddress,
        created_at: new Date().toISOString(),
        items: cartItems as any,
        total_price: netTotal,
        type: mode === 'proforma' ? 'proforma' : 'detail'
    };

    setSelectedInvoice(invoiceData);
    setTimeout(() => {
        handlePrintTrigger();
    }, 100);
  }, [lineItems, invoiceNumber, orderRef, user, customerName, currentSession, customerAddress, netTotal, mode, handlePrintTrigger, storeId]);

  const handleClientChange = useCallback((field: 'code' | 'name', value: string) => {
    let updates: any = {};
    let matchedClient: import('@/stores/useMasterDataStore').Client | undefined;
    
    if (field === 'code') {
      updates = { customerCode: value };
      matchedClient = clients.find(c => c.code?.toLowerCase() === value.toLowerCase());
    } else if (field === 'name') {
      updates = { customerName: value };
      matchedClient = clients.find(c => c.name.toLowerCase() === value.toLowerCase());
    }

    if (matchedClient) {
      updates.customerCode = matchedClient.code || updates.customerCode || '';
      updates.customerName = matchedClient.name || updates.customerName || '';
      updates.customerAddress = matchedClient.address || '';
      updates.clientId = matchedClient.id;

      // AUTO-APPLY DISCOUNT from client's service group
      const service = services.find(s => s.id === matchedClient!.service_id);
      const groupDiscount = service?.default_discount_percent || 0;

      if (groupDiscount > 0) {
        toast.info(t('menu.program.autoDiscount', { percent: groupDiscount }));
        
        if (lineItems.length > 0) {
          const updatedItems = lineItems.map(item => ({
            ...item,
            discountPercent: groupDiscount,
            lineTotal: calculateLineTotal(item.unitPrice, item.quantity, groupDiscount, item.isBox, item.conditionnement),
          }));
          updates.lineItems = updatedItems;
        }
      }
      
      // Store the discount for future items added in this session
      updates.clientDiscount = groupDiscount;
    } else {
      // Client cleared
      if (field === 'code' && !value) {
        updates.clientId = undefined;
        updates.clientDiscount = 0;
        if (lineItems.length > 0) {
          const updatedItems = lineItems.map(item => ({
            ...item,
            discountPercent: 0,
            lineTotal: calculateLineTotal(item.unitPrice, item.quantity, 0, item.isBox, item.conditionnement),
          }));
          updates.lineItems = updatedItems;
        }
      }
    }

    updateSession(mode, updates);
  }, [clients, services, lineItems, mode, updateSession, t]);

  const handleDeleteLine = useCallback((index: number) => {
    const newItems = lineItems.filter((_, i) => i !== index);
    newItems.forEach((item, i) => { item.lineNumber = i + 1; });
    updateSession(mode, { lineItems: newItems });
    setSelectedIndex(Math.min(index, newItems.length - 1));
  }, [lineItems, mode, updateSession]);

  const addProduct = useCallback((product: Product) => {
    const existingIndex = lineItems.findIndex(li => li.productId === product.id);
    const clientDiscount = currentSession.clientDiscount || 0;
    
    if (existingIndex >= 0) {
      const newItems = [...lineItems];
      const item = newItems[existingIndex];
      const newQty = item.quantity + 1;
      newItems[existingIndex] = {
        ...item,
        quantity: newQty,
        lineTotal: calculateLineTotal(item.unitPrice, newQty, item.discountPercent, item.isBox, item.conditionnement),
      };
      updateSession(mode, { lineItems: newItems });
      setSelectedIndex(existingIndex);
    } else {
      const price = getProductPrice(product, mode, activeTier);
      const packSize = parseInt(product.packaging?.match(/\d+/)?.[0] || '1') || 1;
      const priceTiers = {
        1: product.unit_price || 0,
        2: product.selling_price_2 || product.unit_price || 0,
        3: product.selling_price_3 || product.unit_price || 0,
        4: product.selling_price_4 || product.unit_price || 0,
      };
      
      const newItem: SanifereLineItem = {
        id: crypto.randomUUID(),
        lineNumber: lineItems.length + 1,
        productId: product.id,
        designation: product.name,
        code: product.sku || product.barcode || '',
        conditionnement: packSize,
        isBox: false,
        stock: product.quantity,
        basePrice: price,
        unitPrice: price,
        quantity: 1,
        discountPercent: clientDiscount,
        lineTotal: calculateLineTotal(price, 1, clientDiscount, false, packSize),
        priceTiers,
      };
      updateSession(mode, { lineItems: [...lineItems, newItem] });
      setSelectedIndex(lineItems.length);
    }
    
    toast.success(t('worker.sales.itemFound', { name: product.name }));
  }, [lineItems, mode, updateSession, t, activeTier, currentSession.clientDiscount]);

  const handleQuantityChange = useCallback((index: number, quantity: any) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    const numQty = quantity === '' ? 0 : Number(quantity);
    newItems[index] = {
      ...item,
      quantity,
      lineTotal: calculateLineTotal(Number(item.unitPrice) || 0, numQty, Number(item.discountPercent) || 0, item.isBox, item.conditionnement),
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession, handleDeleteLine]);

  const handleDiscountChange = useCallback((index: number, discount: any) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    const numDisc = discount === '' ? 0 : Number(discount);
    newItems[index] = {
      ...item,
      discountPercent: discount,
      lineTotal: calculateLineTotal(Number(item.unitPrice) || 0, Number(item.quantity) || 0, numDisc, item.isBox, item.conditionnement),
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession]);

  const handleDesignationChange = useCallback((index: number, value: string) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], designation: value };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession]);

  const handlePriceChange = useCallback((index: number, value: any) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    const numPrice = value === '' ? 0 : Number(value);
    newItems[index] = { 
      ...item, 
      unitPrice: value,
      lineTotal: calculateLineTotal(numPrice, Number(item.quantity) || 0, Number(item.discountPercent) || 0, item.isBox, item.conditionnement)
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession]);

  const handleToggleUnit = useCallback((index: number) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    
    if (item.conditionnement <= 1) {
      toast.warning(t('inventory.packaging') + ': 1');
      return; 
    }

    const newIsBox = !item.isBox;
    // Fix: Do NOT change unitPrice. Keep base price.
    // Calculate line total using the new isBox flag and existing unitPrice.

    newItems[index] = {
      ...item,
      isBox: newIsBox,
      // unitPrice stays as is (Piece Price)
      lineTotal: calculateLineTotal(item.unitPrice, item.quantity, item.discountPercent, newIsBox, item.conditionnement)
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession]);

  const handleGlobalTierChange = useCallback((tier: number) => {
    setActiveTier(tier);
    const newItems = lineItems.map(item => {
        if (!item.priceTiers) return item;
        const newUnitPrice = item.priceTiers[tier] || item.unitPrice;
        return {
            ...item,
            unitPrice: newUnitPrice,
            lineTotal: calculateLineTotal(newUnitPrice, item.quantity, item.discountPercent, item.isBox, item.conditionnement)
        };
    });
    updateSession(mode, { lineItems: newItems });
    toast.success(`Price Tier ${tier} Applied`);
  }, [lineItems, mode, updateSession]);

  const handleRowTierChange = useCallback((index: number, tier: number) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    if (!item.priceTiers) return;

    const newUnitPrice = item.priceTiers[tier] || item.unitPrice;
    
    newItems[index] = {
        ...item,
        unitPrice: newUnitPrice,
        lineTotal: calculateLineTotal(newUnitPrice, item.quantity, item.discountPercent, item.isBox, item.conditionnement)
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession]);

  const handleScanResult = useCallback(async (result: string) => {
    const product = await scanProduct(result);

    if (product) {
      addProduct(product);
    } else {
      toast.error(t('worker.sales.itemNotFound'));
    }
    setIsScanning(false);
  }, [scanProduct, addProduct, t]);

  const handlePaymentConfirm = useCallback(async (paymentMethod: string, amountPaid: number, isCredit: boolean) => {
    if (lineItems.length === 0) return;

    try {
      let saleType: 'detail' | 'gros' | 'proforma' = 'detail';
      if (mode === 'facturation-gros') saleType = 'gros';
      if (mode === 'proforma') saleType = 'proforma';

      const cartItems = lineItems.map(item => {
        const packSize = item.conditionnement || 1;
        
        let totalUnitsForDb: number;
        let basePriceForDb: number;

        if (item.isBox) {
          // Selling Boxes. DB is in Pieces. Multiply by PackSize.
          totalUnitsForDb = item.quantity * packSize; 
          // Price is already Piece Price. No division needed.
          basePriceForDb = item.unitPrice;
        } else {
          // Selling Pieces. DB is in Pieces. Just use qty.
          totalUnitsForDb = item.quantity;
          basePriceForDb = item.unitPrice;
        }

        return {
          product: {
            id: item.productId || '',
            store_id: storeId,
            name: item.designation,
            unit_price: basePriceForDb,
            quantity: item.stock,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          quantity: totalUnitsForDb,
          discount: item.discountPercent,
          unitPrice: basePriceForDb,
          lineTotal: item.lineTotal,
          total: item.lineTotal,
        };
      });

      // Look up full client details if matched
      const matchedClient = currentSession.clientId 
        ? clients.find(c => c.id === currentSession.clientId) 
        : undefined;

      const { error } = await OfflineSalesService.createSale({
        store_id: storeId,
        worker_id: user?.id || '',
        client_id: currentSession.clientId || undefined,
        items: cartItems,
        total_price: netTotal,
        payment_method: paymentMethod as 'cash' | 'card' | 'credit',
        sale_type: saleType,
        customer_name: customerName || undefined,
        customer_phone: matchedClient?.phone || undefined,
        customer_address: customerAddress || undefined,
        invoice_number: invoiceNumber,
        order_ref: orderRef,
        discount: currentSession.clientDiscount || 0,
      });

      if (error) throw error;

      toast.success(t('worker.sales.saleRecorded'));

      updateSession(mode, {
        lineItems: [],
        customerCode: '',
        customerName: '',
        customerAddress: '',
        orderRef: '',
        invoiceNumber: generateInvoiceNumber(),
      });
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(t('common.error'));
    }
  }, [lineItems, storeId, user, netTotal, mode, customerName, currentSession.clientId, clients, customerAddress, invoiceNumber, orderRef, currentSession.clientDiscount, updateSession, t]);

  const handleSaveProforma = useCallback(async () => {
    if (lineItems.length === 0) return;

    try {
      const cartItems = lineItems.map(item => {
        const packSize = item.conditionnement || 1;
        let totalUnitsForDb = item.isBox ? item.quantity * packSize : item.quantity;
        return {
          product: {
            id: item.productId || '',
            store_id: storeId,
            name: item.designation,
            unit_price: item.unitPrice,
            quantity: item.stock,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          quantity: totalUnitsForDb,
          discount: item.discountPercent,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          total: item.lineTotal,
        };
      });

      const matchedClient = currentSession.clientId 
        ? clients.find(c => c.id === currentSession.clientId) 
        : undefined;

      const { error } = await OfflineSalesService.createSale({
        store_id: storeId,
        worker_id: user?.id || '',
        client_id: currentSession.clientId || undefined,
        items: cartItems,
        total_price: netTotal,
        payment_method: 'cash',
        sale_type: 'proforma',
        customer_name: customerName || undefined,
        customer_phone: matchedClient?.phone || undefined,
        customer_address: customerAddress || undefined,
        invoice_number: invoiceNumber,
        order_ref: orderRef,
        discount: currentSession.clientDiscount || 0,
      });

      if (error) throw error;

      toast.success(t('menu.program.saveSuccess', 'Draft saved successfully'));
      updateSession(mode, {
        lineItems: [],
        customerCode: '',
        customerName: '',
        customerAddress: '',
        orderRef: '',
        invoiceNumber: generateInvoiceNumber(),
      });
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t('common.error'));
    }
  }, [lineItems, storeId, user, netTotal, mode, customerName, currentSession.clientId, clients, customerAddress, invoiceNumber, orderRef, currentSession.clientDiscount, updateSession, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === keyPay) {
        e.preventDefault();
        if (lineItems.length > 0) setIsPaymentOpen(true);
      } else if (e.key === keyValidate) {
        e.preventDefault();
        if (lineItems.length > 0) setIsPaymentOpen(true);
      } else if (e.key === keySave) {
        e.preventDefault();
        handleSaveProforma();
      } else if (e.key === keyPrint) {
        e.preventDefault();
        handlePrint();
      } else if (e.key === keySearch) {
          e.preventDefault();
          setIsProductLookupOpen(true);
        } else if (e.key === keyScan) {
          e.preventDefault();
          setIsScanning(true);
        } else {
          switch (e.key) {
            case 'F8':
              e.preventDefault();
              if (selectedIndex >= 0) handleDeleteLine(selectedIndex);
              break;
            case 'Delete':
              e.preventDefault();
              if (selectedIndex >= 0) handleDeleteLine(selectedIndex);
              break;
            case 'Escape':
              setIsScanning(false);
              setIsProductLookupOpen(false);
              setIsPaymentOpen(false);
              break;
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lineItems.length, selectedIndex, handleDeleteLine, handlePrint, handleSaveProforma, keyPay, keyValidate, keySearch, keyScan, keyPrint, keySave]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [mode]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center font-mono text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SanifereHeader
        mode={mode}
        invoiceNumber={invoiceNumber}
        customerCode={customerCode}
        customerName={customerName}
        customerAddress={customerAddress}
        orderRef={orderRef}
        onCustomerChange={(code, name, address) => {
          if (code !== customerCode) handleClientChange('code', code);
          else if (name !== customerName) handleClientChange('name', name);
          else updateSession(mode, { customerAddress: address });
        }}
        onOrderRefChange={(ref) => updateSession(mode, { orderRef: ref })}
        onInvoiceNumberChange={(num) => updateSession(mode, { invoiceNumber: num })}
      />

            <SanifereGrid
              items={lineItems}
              selectedIndex={selectedIndex}
              priceLabel={mode === 'proforma' ? t('inventory.price') : (mode === 'facturation-gros' ? t('inventory.fields.wholesalePriceShort') : t('inventory.fields.retailPriceShort'))}
              
              onSelectLine={setSelectedIndex}
              onQuantityChange={handleQuantityChange}
              onDiscountChange={handleDiscountChange}
              onDeleteLine={handleDeleteLine}
              onDesignationChange={handleDesignationChange}
              onPriceChange={handlePriceChange}
              onToggleUnit={handleToggleUnit}
                      onGlobalTierChange={handleGlobalTierChange}
                      onRowTierChange={handleRowTierChange}
                      activeTier={activeTier}
                      enablePriceTiers={mode === 'proforma'}
                      persistenceKey={`sales_grid_${user?.id || 'anon'}`}
                    />      <SanifereFooter
        mode={mode}
        netTotal={netTotal}
        onValidate={() => lineItems.length > 0 && setIsPaymentOpen(true)}
        onSettlement={() => lineItems.length > 0 && setIsPaymentOpen(true)}
        onProductCard={() => setIsProductLookupOpen(true)}
        onDelete={() => selectedIndex >= 0 && handleDeleteLine(selectedIndex)}
        onSave={handleSaveProforma}
        onPrint={handlePrint}
      />

      <ProductLookupDialog
        open={isProductLookupOpen}
        onOpenChange={setIsProductLookupOpen}
        storeId={storeId}
        mode={mode === 'facturation-gros' ? 'wholesale' : 'retail'}
        onSelect={addProduct}
      />

      <PaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        mode={mode}
        totalAmount={netTotal}
        onConfirm={handlePaymentConfirm}
      />

      <BarcodeScanner
        isScanning={isScanning}
        onResult={handleScanResult}
        onClose={() => setIsScanning(false)}
      />

      <div style={{ display: 'none' }}>
        {selectedInvoice && <InvoiceTemplate ref={printRef} data={selectedInvoice} />}
      </div>
    </div>
  );
}