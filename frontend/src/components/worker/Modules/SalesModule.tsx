import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useReactToPrint } from 'react-to-print';
import { InvoiceTemplate, InvoiceData } from '@/components/printing/InvoiceTemplate';
import { usePrinter } from '@/contexts/PrinterContext';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { OfflineDataService } from '@/services/OfflineDataService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { Product } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useSalesStore } from '@/stores/useSalesStore';
import { useMasterDataStore } from '@/stores/useMasterDataStore';

import { SanifereHeader, SaleMode } from '../Sales/SanifereHeader';
import { SanifereGrid, SanifereLineItem } from '../Sales/SanifereGrid';
import { useNavigationStore } from '@/navigation';
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
  const { t } = useTranslation();
  const { formatCurrency } = useFormatters();
  const { getKeyForAction } = useSettingsStore();
  const { user } = useAuth();
  const { localBridgeBaseUrl } = getDataClient();
  const { sessions, updateSession } = useSalesStore();
  const { clients, setClients, services } = useMasterDataStore();
  const { scanProduct } = useProductScanner(storeId);
  const { printReceipt } = usePrinter();

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
    onAfterPrint: () => setSelectedInvoice(null),
  });

  // Automatically trigger print when an invoice is selected
  useEffect(() => {
    if (selectedInvoice) {
      handlePrintTrigger();
    }
  }, [selectedInvoice, handlePrintTrigger]);

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductLookupOpen, setIsProductLookupOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTier, setActiveTier] = useState<number>(1);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [store, setStore] = useState<any>(null);

  const stableValueRef = useRef<{row: number, col: number, value: any} | null>(null);

  const fetchStoreSettings = useCallback(async () => {
    if (!storeId) return;
    try {
      const { data } = await OfflineStoreService.getStore(storeId);
      if (data) {
        setStore(data);
        if (data.default_price_tier) {
          setActiveTier(data.default_price_tier);
        }
      }
    } catch (error) {
      console.error('[SalesModule] Store settings fetch error:', error);
    }
  }, [storeId]);

  useEffect(() => {
    fetchStoreSettings();
    const handleRefresh = (e: any) => {
      if (e.detail?.type === 'settings' || e.detail?.type === 'store') {
        fetchStoreSettings();
      }
    };
    window.addEventListener('localDbDataUpdated', handleRefresh);
    return () => window.removeEventListener('localDbDataUpdated', handleRefresh);
  }, [fetchStoreSettings]);

  useEffect(() => {
    const fetchClients = async () => {
      if (!storeId || clients.length > 0) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      try {
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
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast.error(t('common.failedToLoad'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchClients();
  }, [storeId, localBridgeBaseUrl, clients.length, setClients, t]);

  const netTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [lineItems]);

  const openPayment = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
    const hasValidItems = lineItems.some(item => !!item.productId || !!item.designation);
    if (!hasValidItems) return;
    
    const store = useNavigationStore.getState();
    store.setMode('hover');
    store.setActiveCell(null);
    
    setIsPaymentOpen(true);
  }, [lineItems, setIsPaymentOpen]);

  const handlePrint = useCallback(async () => {
    if (lineItems.length === 0) return;
    
    const validItems = lineItems.filter(item => !!item.productId || !!item.designation);
    if (validItems.length === 0) return;

    // Map to InvoiceData structure for the React Template
    const invoiceData: InvoiceData = {
        id: crypto.randomUUID(),
        invoice_number: invoiceNumber,
        order_ref: orderRef,
        storeName: store?.name || "QUINCAILLERIE DE LA PAIX",
        storeAddress: store?.address || "Face centre Djoliba, Bamako",
        workerName: user?.full_name || "Vendeur",
        customerName: customerName,
        customerPhone: currentSession.customerPhone,
        customerAddress: customerAddress,
        created_at: new Date().toISOString(),
        items: validItems.map(item => ({
            product: {
                id: item.productId || 'manual',
                name: item.designation,
                sku: item.code,
                unit_price: Number(item.unitPrice) || 0,
                // These are required by the Product type but optional for print
                store_id: storeId,
                quantity: item.stock,
                created_at: '',
                updated_at: ''
            } as Product,
            quantity: Number(item.quantity) || 1,
            discount: Number(item.discountPercent) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            lineTotal: item.lineTotal,
            total: item.lineTotal
        })),
        total_price: netTotal,
        type: mode === 'proforma' ? 'proforma' : (mode === 'facturation-gros' ? 'gros' : 'detail'),
        paymentMethod: currentSession.paymentMethod || 'cash'
    };

    // Setting this triggers the useEffect -> react-to-print
    setSelectedInvoice(invoiceData);
    
    // Also send to thermal printer if in Tauri mode
    const subtotal = validItems.reduce((sum, item) => {
        const packSize = item.conditionnement || 1;
        const multiplier = item.isBox ? packSize : 1;
        return sum + (Number(item.quantity) * Number(item.unitPrice) * multiplier);
    }, 0);
    const totalDiscount = subtotal - netTotal;

    const receiptItems = validItems.map(item => {
        const packSize = item.conditionnement || 1;
        let displayQty = item.isBox ? Number(item.quantity) * packSize : Number(item.quantity);
        return {
          name: item.designation,
          qty: displayQty,
          price: Number(item.unitPrice),
          total: item.lineTotal,
        };
    });

    const receiptData = {
        invoice: invoiceNumber,
        storeName: store?.name || "Magasin", 
        storeAddress: store?.address || "",
        phone: store?.phone || "",
        items: receiptItems,
        subtotal: subtotal,
        discount: totalDiscount,
        total: netTotal,
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
        cashier: user?.full_name || t('edition.seller')
    };

    try {
        await printReceipt(receiptData);
    } catch (e) {
        console.warn("Thermal print skipped (not in desktop mode)");
    }
  }, [lineItems, invoiceNumber, user, netTotal, printReceipt, store, t, mode, customerName, customerAddress, orderRef, currentSession, storeId]);

  const handleClientChange = useCallback((field: 'code' | 'name', value: string, phone?: string, address?: string) => {
    let updates: any = {};
    let matchedClient: any;
    
    if (field === 'code') {
      updates = { customerCode: value, customerPhone: phone, customerAddress: address };
      matchedClient = clients.find(c => c.code?.toLowerCase() === value.toLowerCase());
    } else if (field === 'name') {
      updates = { customerName: value, customerPhone: phone, customerAddress: address };
      matchedClient = clients.find(c => c.name.toLowerCase() === value.toLowerCase());
    }

    if (matchedClient) {
      updates.customerCode = matchedClient.code || updates.customerCode || '';
      updates.customerName = matchedClient.name || updates.customerName || '';
      updates.customerPhone = matchedClient.phone || updates.customerPhone || '';
      updates.customerAddress = matchedClient.address || updates.customerAddress || '';
      updates.clientId = matchedClient.id;

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
      updates.clientDiscount = groupDiscount;
    } else {
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

  const handleOrderRefLoad = useCallback(async (ref: string) => {
    const cleanRef = ref?.trim().toLowerCase();
    if (!cleanRef || !storeId) return;
    
    setIsLoading(true);
    try {
      const sales = await OfflineDataService.getSales(storeId);
      const inventoryRes = await OfflineInventoryService.getInventory(storeId, { notify: false });
      const allProducts = inventoryRes.data || [];

      const foundSale = sales.find(s => {
        const inv = String(s.invoice_number || '').toLowerCase();
        const ord = String(s.order_ref || '').toLowerCase();
        const sid = String(s.id || '').toLowerCase();
        return inv.includes(cleanRef) || ord.includes(cleanRef) || sid.includes(cleanRef);
      });
      
      if (foundSale) {
        const rawItems = foundSale.sale_items || foundSale.items || [];
        const mappedItems = (Array.isArray(rawItems) ? rawItems : []).map((item: any, index: number) => {
          try {
            const pid = item.product_id || (item.product && item.product.id);
            const p = allProducts.find(prod => prod.id === pid) || item.product || {};
            const packStr = String(p.packaging || '1');
            const packSize = parseInt(packStr.match(/(\d+)/)?.[1] || '1', 10);
            const unitPrice = Number(item.unit_price || item.price || 0);
            const basePrice = Number(p.unit_price || unitPrice || 0);

            return {
              id: crypto.randomUUID(),
              lineNumber: index + 1,
              productId: pid || `manual-${index}`,
              designation: item.product_name || p.name || 'Item #' + (index+1),
              code: p.sku || item.sku || '',
              conditionnement: packSize,
              stock: Number(p.quantity || 0),
              unitPrice: unitPrice,
              basePrice: basePrice,
              quantity: Number(item.quantity || 1),
              discountPercent: Number(item.discount || 0),
              lineTotal: Number(item.total || (unitPrice * Number(item.quantity || 1))),
              isBox: !!(item.is_box || (packSize > 1 && unitPrice > (basePrice + 1))),
              unit_type: p.unit_type || 'Piece',
              priceTiers: { 
                 1: Number(p.unit_price || 0), 
                 2: Number(p.selling_price_2 || 0), 
                 3: Number(p.selling_price_3 || 0), 
                 4: Number(p.selling_price_4 || 0) 
              }
            };
          } catch (err) { return null; }
        }).filter(Boolean) as SanifereLineItem[];

        mappedItems.push({
          id: crypto.randomUUID(),
          lineNumber: mappedItems.length + 1,
          designation: '',
          code: '',
          conditionnement: 1,
          stock: 0,
          unitPrice: '',
          basePrice: 0,
          quantity: '',
          discountPercent: '',
          lineTotal: 0,
          isBox: false,
          priceTiers: { 1: 0, 2: 0, 3: 0, 4: 0 }
        });

        updateSession(mode, {
          lineItems: mappedItems,
          customerName: foundSale.customer_name || '',
          customerCode: foundSale.customer_code || '',
          customerAddress: foundSale.customer_address || '',
          orderRef: foundSale.order_ref || foundSale.invoice_number || '',
        });
        toast.success(t('common.success'));
      } else {
        toast.error(t('common.noData') + ': ' + cleanRef);
      }
    } catch (e: any) {
      console.error('[OrderLoad] Mapping error:', e);
      toast.error(`Order Ref Error: ${e.message || 'Unknown'}`);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, mode, updateSession, t]);

  const handleDeleteLine = useCallback((index: number) => {
    const newItems = lineItems.filter((_, i) => i !== index);
    newItems.forEach((item, i) => { item.lineNumber = i + 1; });
    updateSession(mode, { lineItems: newItems });
    setSelectedIndex(Math.min(index, newItems.length - 1));
  }, [lineItems, mode, updateSession]);

  const addProduct = useCallback((product: Product) => {
    const clientDiscount = currentSession.clientDiscount || 0;
    let targetRow = -1;

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
      code: product.sku || '',
      conditionnement: packSize,
      isBox: false,
      unit_type: product.unit_type || (packSize > 1 ? 'Carton' : 'Piece'),
      stock: product.quantity || 0,
      basePrice: price,
      unitPrice: price,
      quantity: 1,
      discountPercent: clientDiscount,
      lineTotal: calculateLineTotal(price, 1, clientDiscount, false, packSize),
      priceTiers: priceTiers
    };

    const firstEmptyIndex = lineItems.findIndex(li => !li.productId);
    if (firstEmptyIndex >= 0) {
      const newItems = [...lineItems];
      newItems[firstEmptyIndex] = { ...newItem, lineNumber: firstEmptyIndex + 1 };
      updateSession(mode, { lineItems: newItems });
      setSelectedIndex(firstEmptyIndex);
      targetRow = firstEmptyIndex;
    } else {
      updateSession(mode, { lineItems: [...lineItems, newItem] });
      setSelectedIndex(lineItems.length);
      targetRow = lineItems.length;
    }

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    
    setTimeout(() => {
        const store = useNavigationStore.getState();
        if (targetRow !== -1) {
          store.setActiveCell({ row: targetRow, col: 5 });
          store.setMode('edit');
          setTimeout(() => {
             const el = document.getElementById(`quantity-input-${targetRow}`) as HTMLInputElement;
             if (el) { el.focus(); el.select(); }
          }, 50);
        }
    }, 50);
    toast.success(t('worker.sales.itemFound', { name: product.name }));
  }, [lineItems, mode, updateSession, t, activeTier, currentSession.clientDiscount]);

  const handlePriceChange = useCallback((index: number, unitPrice: any) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    if (!item) return;
    stableValueRef.current = { row: index, col: 4, value: unitPrice };
    const numPrice = unitPrice === '' ? 0 : Number(unitPrice);
    newItems[index] = {
      ...item,
      unitPrice,
      lineTotal: calculateLineTotal(numPrice, Number(item.quantity) || 0, Number(item.discountPercent) || 0, item.isBox, item.conditionnement),
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession]);

  const handleQuantityChange = useCallback((index: number, quantity: any) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    if (!item) return;
    stableValueRef.current = { row: index, col: 5, value: quantity };
    let numQty = quantity === '' ? 0 : Number(quantity);
    if (numQty > 9999) {
      toast.warning(t('worker.sales.quantityTooHigh') || 'Quantity capped.');
      numQty = 1;
    }
    newItems[index] = {
      ...item,
      quantity: numQty,
      lineTotal: calculateLineTotal(Number(item.unitPrice) || 0, numQty, Number(item.discountPercent) || 0, item.isBox, item.conditionnement),
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession, t]);

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

  const handleScanResult = useCallback((code: string) => {
    if (!code) return;
    setIsScanning(false);
    scanProduct(code).then(product => {
      if (product) {
        addProduct(product);
      } else {
        toast.error(t('worker.sales.itemNotFound') + ': ' + code);
      }
    });
  }, [scanProduct, addProduct, t]);

  const handleDesignationChange = useCallback((index: number, value: string) => {
    setInitialSearchQuery(value);
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], designation: value };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession]);

  const handleHardwareScan = useCallback(async (e: any) => {
    const code = e.detail?.code;
    if (!code) return;
    if (stableValueRef.current) {
        const { row, col, value } = stableValueRef.current;
        if (col === 5) handleQuantityChange(row, value);
        else if (col === 4) handlePriceChange(row, value);
        stableValueRef.current = null;
    }
    const product = await scanProduct(code);
    if (product) addProduct(product);
    else {
        const newItem: SanifereLineItem = {
            id: crypto.randomUUID(),
            lineNumber: lineItems.length + 1,
            productId: '',
            designation: code,
            code: code,
            conditionnement: 1,
            isBox: false,
            unit_type: 'Pièce',
            stock: 0,
            basePrice: 0,
            unitPrice: 0,
            quantity: 1,
            discountPercent: 0,
            lineTotal: 0,
            priceTiers: { 1: 0, 2: 0, 3: 0, 4: 0 }
        };
        const firstEmptyIndex = lineItems.findIndex(li => !li.productId);
        let targetRow = firstEmptyIndex >= 0 ? firstEmptyIndex : lineItems.length;
        const newItems = [...lineItems];
        if (firstEmptyIndex >= 0) newItems[firstEmptyIndex] = { ...newItem, lineNumber: firstEmptyIndex + 1 };
        else newItems.push(newItem);
        updateSession(mode, { lineItems: newItems });
        setTimeout(() => {
            const store = useNavigationStore.getState();
            store.setActiveCell({ row: targetRow, col: 0 });
            store.setMode('edit');
        }, 50);
        toast.error(t('worker.sales.itemNotFound') + ': ' + code);
    }
  }, [scanProduct, addProduct, t, lineItems, handleQuantityChange, handlePriceChange, mode, updateSession]);

  const handleToggleUnit = useCallback((index: number) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    if (item.conditionnement <= 1) {
      toast.warning(t('inventory.packaging') + ': 1');
      return; 
    }
    const newIsBox = !item.isBox;
    newItems[index] = {
      ...item,
      isBox: newIsBox,
      lineTotal: calculateLineTotal(item.unitPrice, item.quantity, item.discountPercent, newIsBox, item.conditionnement)
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession, t]);

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

  const handlePaymentConfirm = useCallback(async (paymentMethod: string, amountPaid: number, isCredit: boolean) => {
    if (lineItems.length === 0) return;
    try {
      let saleType: 'detail' | 'gros' | 'proforma' = 'detail';
      if (mode === 'facturation-gros') saleType = 'gros';
      if (mode === 'proforma') saleType = 'proforma';

      const validItems = lineItems.filter(item => !!item.productId && item.quantity > 0);
      if (validItems.length === 0) return;

      const cartItems = validItems.map(item => {
        const packSize = item.conditionnement || 1;
        let totalUnitsForDb = item.isBox ? item.quantity * packSize : item.quantity;
        return {
          product: { id: item.productId || '', store_id: storeId, name: item.designation, unit_price: item.unitPrice, quantity: item.stock, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          quantity: totalUnitsForDb,
          discount: item.discountPercent,
          unit_price: item.unitPrice,
          lineTotal: item.lineTotal,
          total: item.lineTotal,
        };
      });

      const matchedClient = currentSession.clientId ? clients.find(c => c.id === currentSession.clientId) : undefined;
      const { error } = await OfflineSalesService.createSaleWithItems({
        store_id: storeId,
        worker_id: user?.id || '',
        client_id: currentSession.clientId || undefined,
        total_price: netTotal,
        amount_paid: amountPaid,
        payment_method: paymentMethod as 'cash' | 'card' | 'credit',
        payment_status: paymentMethod === 'credit' ? 'pending' : 'paid',
        sale_type: saleType,
        customer_name: customerName || undefined,
        customer_phone: currentSession.customerPhone || matchedClient?.phone || undefined,
        customer_address: customerAddress || undefined,
        invoice_number: invoiceNumber,
        order_ref: orderRef,
        discount: currentSession.clientDiscount || 0,
      }, cartItems);

      if (error) throw error;
      toast.success(t('worker.sales.saleRecorded'));
      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));
      updateSession(mode, { lineItems: [], customerCode: '', customerName: '', customerAddress: '', orderRef: '', invoiceNumber: generateInvoiceNumber() });
      setSelectedIndex(-1);
    } catch (error) { toast.error(t('common.error')); }
  }, [lineItems, storeId, user, netTotal, mode, customerName, currentSession.clientId, clients, customerAddress, invoiceNumber, orderRef, currentSession.clientDiscount, updateSession, t]);

  const handleSaveProforma = useCallback(async () => {
    if (lineItems.length === 0) return;
    try {
      const validItems = lineItems.filter(item => !!item.productId && item.quantity > 0);
      if (validItems.length === 0) return;
      const cartItems = validItems.map(item => {
        const packSize = item.conditionnement || 1;
        let totalUnitsForDb = item.isBox ? item.quantity * packSize : item.quantity;
        return {
          product: { id: item.productId || '', store_id: storeId, name: item.designation, unit_price: item.unitPrice, quantity: item.stock, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          quantity: totalUnitsForDb,
          discount: item.discountPercent,
          unit_price: item.unitPrice,
          lineTotal: item.lineTotal,
          total: item.lineTotal,
        };
      });
      const matchedClient = currentSession.clientId ? clients.find(c => c.id === currentSession.clientId) : undefined;
      const { error } = await OfflineSalesService.createSaleWithItems({
        store_id: storeId,
        worker_id: user?.id || '',
        client_id: currentSession.clientId || undefined,
        total_price: netTotal,
        amount_paid: 0,
        payment_method: 'credit',
        payment_status: 'pending',
        sale_type: 'proforma',
        customer_name: customerName || undefined,
        customer_phone: currentSession.customerPhone || matchedClient?.phone || undefined,
        customer_address: customerAddress || undefined,
        invoice_number: invoiceNumber,
        order_ref: orderRef,
        discount: currentSession.clientDiscount || 0,
      }, cartItems);
      if (error) throw error;
      toast.success(t('menu.program.saveSuccess'));
      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));
      updateSession(mode, { lineItems: [], customerCode: '', customerName: '', customerAddress: '', orderRef: '', invoiceNumber: generateInvoiceNumber() });
      setSelectedIndex(-1);
    } catch (error) { toast.error(t('common.error')); }
  }, [lineItems, storeId, user, netTotal, mode, customerName, currentSession.clientId, clients, customerAddress, invoiceNumber, orderRef, currentSession.clientDiscount, updateSession, t]);

  const openPaymentRef = useRef(openPayment);
  const handleSaveProformaRef = useRef(handleSaveProforma);
  const handleHardwareScanRef = useRef(handleHardwareScan);
  useEffect(() => {
    openPaymentRef.current = openPayment;
    handleSaveProformaRef.current = handleSaveProforma;
    handleHardwareScanRef.current = handleHardwareScan;
  });

  useEffect(() => {
    const handleDeleteEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      const key = e.detail?.key;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) {
        if (!lineItems[rowIndex].productId) return;
        handleDeleteLine(rowIndex);
        setTimeout(() => {
            const store = useNavigationStore.getState();
            let newRow = rowIndex;
            if (key === 'Backspace') newRow = Math.max(0, rowIndex - 1);
            store.setActiveCell({ row: newRow, col: 0 });
            setSelectedIndex(newRow);
        }, 50);
      }
    };
    const handleToggleEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) handleToggleUnit(rowIndex);
    };
    const handleSearchEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) setInitialSearchQuery(lineItems[rowIndex].designation || '');
      else setInitialSearchQuery('');
      setIsProductLookupOpen(true);
    };
    const handleAdjustQtyEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      const delta = e.detail?.delta;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) {
        const currentQty = Number(lineItems[rowIndex].quantity) || 0;
        handleQuantityChange(rowIndex, Math.max(1, currentQty + delta));
      }
    };
    const handleAdjustPriceEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      const delta = e.detail?.delta;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) {
        const currentPrice = Number(lineItems[rowIndex].unitPrice) || 0;
        handlePriceChange(rowIndex, Math.max(0, currentPrice + (delta * 500)));
      }
    };
    const handleNextRowEvent = (e: any) => {
      const { row, forceNew } = e.detail || {};
      const store = useNavigationStore.getState();
      let rowIndex = typeof row === 'number' ? row : (store.activeCell?.row ?? selectedIndex);
      if (rowIndex < 0) rowIndex = lineItems.length - 1;
      if (forceNew || rowIndex >= lineItems.length - 1) {
          const lastItem = lineItems[lineItems.length - 1];
          if (lastItem && !lastItem.productId && !forceNew) {
              store.setActiveCell({ row: lineItems.length - 1, col: 0 });
              store.setMode('hover');
              return;
          }
          const newItem = { id: crypto.randomUUID(), lineNumber: lineItems.length + 1, designation: '', code: '', conditionnement: 1, stock: 0, unitPrice: '', basePrice: 0, quantity: '', discountPercent: '', lineTotal: 0, isBox: false, priceTiers: { 1: 0, 2: 0, 3: 0, 4: 0 } };
          updateSession(mode, { lineItems: [...lineItems, newItem] });
          setTimeout(() => { store.setActiveCell({ row: lineItems.length, col: 0 }); store.setMode('hover'); }, 50);
      } else {
          store.advanceToNextRow();
          store.setMode('hover');
      }
    };
    const handleCaptureKeystroke = (e: any) => {};

    window.addEventListener('nav-delete-row', handleDeleteEvent);
    window.addEventListener('nav-toggle-packing', handleToggleEvent);
    window.addEventListener('nav-open-search', handleSearchEvent);
    window.addEventListener('nav-adjust-quantity', handleAdjustQtyEvent);
    window.addEventListener('nav-adjust-price', handleAdjustPriceEvent);
    window.addEventListener('nav-next-row', handleNextRowEvent);
    window.addEventListener('scanner-input', (e: any) => handleHardwareScanRef.current(e));
    window.addEventListener('nav-pay-shortcut', () => openPaymentRef.current());
    window.addEventListener('nav-search-shortcut', () => setIsProductLookupOpen(true));
    window.addEventListener('nav-save-shortcut', () => handleSaveProformaRef.current());
    window.addEventListener('nav-capture-keystroke', handleCaptureKeystroke);
    
    return () => {
      window.removeEventListener('nav-delete-row', handleDeleteEvent);
      window.removeEventListener('nav-toggle-packing', handleToggleEvent);
      window.removeEventListener('nav-open-search', handleSearchEvent);
      window.removeEventListener('nav-adjust-quantity', handleAdjustQtyEvent);
      window.removeEventListener('nav-adjust-price', handleAdjustPriceEvent);
      window.removeEventListener('nav-next-row', handleNextRowEvent);
      window.removeEventListener('scanner-input', (e: any) => handleHardwareScanRef.current(e));
      window.removeEventListener('nav-pay-shortcut', () => openPaymentRef.current());
      window.removeEventListener('nav-search-shortcut', () => setIsProductLookupOpen(true));
      window.removeEventListener('nav-save-shortcut', () => handleSaveProformaRef.current());
      window.removeEventListener('nav-capture-keystroke', handleCaptureKeystroke);
    };
  }, [lineItems, handleDeleteLine, handleToggleUnit, handleQuantityChange, handleDesignationChange, handlePriceChange, mode, updateSession]);

  useEffect(() => {
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
    <div className="h-full flex flex-col overflow-hidden">
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
      <SanifereGrid items={lineItems} selectedIndex={selectedIndex} priceLabel={mode === 'proforma' ? t('inventory.price') : (mode === 'facturation-gros' ? t('inventory.fields.wholesalePriceShort') : t('inventory.fields.retailPriceShort'))}
        onSelectLine={(index) => { setSelectedIndex(index); const store = useNavigationStore.getState(); if (store.activeCell?.row !== index) store.setActiveCell({ row: index, col: store.activeCell?.col || 0 }); }}
        onQuantityChange={handleQuantityChange} onDiscountChange={handleDiscountChange} onDeleteLine={handleDeleteLine} onDesignationChange={handleDesignationChange} onOpenSearch={() => setIsProductLookupOpen(true)} onPriceChange={handlePriceChange} onToggleUnit={handleToggleUnit} onGlobalTierChange={handleGlobalTierChange} onRowTierChange={handleRowTierChange} activeTier={activeTier} enablePriceTiers={mode === 'proforma'} persistenceKey={`sales_grid_${user?.id || 'anon'}`}
      />
      <SanifereFooter mode={mode} netTotal={netTotal} onValidate={() => lineItems.length > 0 && openPayment()} onSettlement={() => lineItems.length > 0 && openPayment()} onProductCard={() => setIsProductLookupOpen(true)} onDelete={() => selectedIndex >= 0 && handleDeleteLine(selectedIndex)} onSave={handleSaveProforma} onPrint={handlePrint} />
      <ProductLookupDialog initialSearch={initialSearchQuery} open={isProductLookupOpen} onOpenChange={(open) => { setIsProductLookupOpen(open); if (!open) setTimeout(() => { const store = useNavigationStore.getState(); if (store.activeCell) store.setMode('hover'); }, 50); }} storeId={storeId} mode={mode === 'facturation-gros' ? 'wholesale' : 'retail'}
        onSelect={(product) => { addProduct(product); setInitialSearchQuery(''); setTimeout(() => { const store = useNavigationStore.getState(); if (store.activeCell) { store.setActiveCell({ row: store.activeCell.row, col: 5 }); store.setMode('hover'); } }, 100); }}
      />
      <PaymentDialog open={isPaymentOpen} onOpenChange={(open) => { setIsPaymentOpen(open); if (!open) setTimeout(() => { const store = useNavigationStore.getState(); store.jumpToLastEmptyRow(); store.setMode('hover'); }, 100); }} mode={mode} totalAmount={netTotal} onConfirm={handlePaymentConfirm} />
      <BarcodeScanner isScanning={isScanning} onResult={handleScanResult} onClose={() => setIsScanning(false)} />
      <div style={{ display: 'none' }}>{selectedInvoice && <InvoiceTemplate ref={printRef} data={selectedInvoice} />}</div>
    </div>
  );
}
