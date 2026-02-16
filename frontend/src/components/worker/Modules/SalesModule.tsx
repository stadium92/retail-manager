import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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

interface SalesModuleProps {
  storeId: string;
  mode: SaleMode;
}

function getProductPrice(product: Product, mode: SaleMode): number {
  if (mode === 'facturation-gros') {
    return product.wholesale_price || product.unit_price;
  }
  return product.unit_price;
}

function calculateLineTotal(unitPrice: number, quantity: number, discountPercent: number): number {
  const subtotal = unitPrice * quantity;
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
  const { clients, setClients } = useMasterDataStore();
  const { scanProduct } = useProductScanner(storeId);

  const keyValidate = getKeyForAction('ACTION_VALIDATE') || 'F2';
  const keySearch = getKeyForAction('ACTION_SEARCH') || 'F3';
  const keyPay = getKeyForAction('ACTION_PAY') || 'F4';
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

  const handleClientChange = useCallback((field: 'code' | 'name', value: string) => {
    let updates: any = {};
    
    if (field === 'code') {
      updates = { customerCode: value };
      const client = clients.find(c => c.code?.toLowerCase() === value.toLowerCase());
      if (client) {
        updates.customerName = client.name;
        updates.customerAddress = client.address || '';
      }
    } else if (field === 'name') {
      updates = { customerName: value };
      const client = clients.find(c => c.name.toLowerCase() === value.toLowerCase());
      if (client) {
        updates.customerCode = client.code || '';
        updates.customerAddress = client.address || '';
      }
    }

    updateSession(mode, updates);
  }, [clients, mode, updateSession]);

  const handleDeleteLine = useCallback((index: number) => {
    const newItems = lineItems.filter((_, i) => i !== index);
    newItems.forEach((item, i) => { item.lineNumber = i + 1; });
    updateSession(mode, { lineItems: newItems });
    setSelectedIndex(Math.min(index, newItems.length - 1));
  }, [lineItems, mode, updateSession]);

  const addProduct = useCallback((product: Product) => {
    const existingIndex = lineItems.findIndex(li => li.productId === product.id);
    
    if (existingIndex >= 0) {
      const newItems = [...lineItems];
      const item = newItems[existingIndex];
      const newQty = item.quantity + 1;
      newItems[existingIndex] = {
        ...item,
        quantity: newQty,
        lineTotal: calculateLineTotal(item.unitPrice, newQty, item.discountPercent),
      };
      updateSession(mode, { lineItems: newItems });
      setSelectedIndex(existingIndex);
    } else {
      const price = getProductPrice(product, mode);
      const newItem: SanifereLineItem = {
        id: crypto.randomUUID(),
        lineNumber: lineItems.length + 1,
        productId: product.id,
        designation: product.name,
        code: product.sku || product.barcode || '',
        conditionnement: 1,
        stock: product.quantity,
        unitPrice: price,
        quantity: 1,
        discountPercent: 0,
        lineTotal: price,
      };
      updateSession(mode, { lineItems: [...lineItems, newItem] });
      setSelectedIndex(lineItems.length);
    }
    
    toast.success(t('worker.sales.itemFound', { name: product.name }));
  }, [lineItems, mode, updateSession, t]);

  const handleQuantityChange = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) {
      handleDeleteLine(index);
      return;
    }
    
    const newItems = [...lineItems];
    const item = newItems[index];
    newItems[index] = {
      ...item,
      quantity,
      lineTotal: calculateLineTotal(item.unitPrice, quantity, item.discountPercent),
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession, handleDeleteLine]);

  const handleDiscountChange = useCallback((index: number, discount: number) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    newItems[index] = {
      ...item,
      discountPercent: discount,
      lineTotal: calculateLineTotal(item.unitPrice, item.quantity, discount),
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession]);

  const handleDesignationChange = useCallback((index: number, value: string) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], designation: value };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession]);

  const handlePriceChange = useCallback((index: number, value: number) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    newItems[index] = { 
      ...item, 
      unitPrice: value,
      lineTotal: calculateLineTotal(value, item.quantity, item.discountPercent)
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

      const cartItems = lineItems.map(item => ({
        product: {
          id: item.productId || '',
          store_id: storeId,
          name: item.designation,
          unit_price: item.unitPrice,
          quantity: item.stock,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        quantity: item.quantity,
        discount: item.discountPercent,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        total: item.lineTotal,
      }));

      const { error } = await OfflineSalesService.createSale({
        store_id: storeId,
        worker_id: user?.id || '',
        items: cartItems,
        total_price: netTotal,
        payment_method: paymentMethod as 'cash' | 'card' | 'credit',
        sale_type: saleType,
        customer_name: customerName || undefined,
        customer_phone: undefined,
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
      }, [lineItems, storeId, user, netTotal, mode, customerName, updateSession, t]);
  
      useEffect(() => {      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }

        if (e.key === keyPay) {
          e.preventDefault();
          if (lineItems.length > 0) setIsPaymentOpen(true);
        } else if (e.key === keyValidate) {
          e.preventDefault();
          if (lineItems.length > 0) setIsPaymentOpen(true);
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
    }, [lineItems.length, selectedIndex, handleDeleteLine, keyPay, keyValidate, keySearch, keyScan]);

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
                  priceLabel={mode === 'facturation-gros' ? t('inventory.fields.wholesalePriceShort') : t('inventory.fields.retailPriceShort')}
        
        onSelectLine={setSelectedIndex}
        onQuantityChange={handleQuantityChange}
        onDiscountChange={handleDiscountChange}
        onDeleteLine={handleDeleteLine}
        onDesignationChange={handleDesignationChange}
        onPriceChange={handlePriceChange}
        persistenceKey={`sales_grid_${user?.id || 'anon'}`}
      />

      <SanifereFooter
        mode={mode}
        netTotal={netTotal}
        onValidate={() => lineItems.length > 0 && setIsPaymentOpen(true)}
        onSettlement={() => lineItems.length > 0 && setIsPaymentOpen(true)}
        onProductCard={() => setIsProductLookupOpen(true)}
        onDelete={() => selectedIndex >= 0 && handleDeleteLine(selectedIndex)}
        onPrint={() => toast.info('...')}
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
    </div>
  );
}