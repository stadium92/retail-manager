import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useReactToPrint } from 'react-to-print';
import { InvoiceTemplate, InvoiceData } from '@/components/printing/InvoiceTemplate';
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
  const { localBridgeBaseUrl } = getDataClient();
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

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductLookupOpen, setIsProductLookupOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTier, setActiveTier] = useState<number>(1);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [store, setStore] = useState<any>(null);

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
    // BLUR ANY BACKGROUND INPUT
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
    console.log('[SalesModule] openPayment actual trigger. Cart size:', lineItems.length);
    const hasValidItems = lineItems.some(item => !!item.productId || !!item.designation);
    if (!hasValidItems) {
        console.warn('[SalesModule] Cannot open payment for empty cart');
        return;
    }
    
    // Safety: Reset background navigation mode
    const store = useNavigationStore.getState();
    store.setMode('hover');
    store.setActiveCell(null);
    
    setIsPaymentOpen(true);
  }, [lineItems, setIsPaymentOpen]);

  const handlePrint = useCallback(() => {
    if (lineItems.length === 0) return;
    
    const cartItems = lineItems.filter(item => !!item.productId).map(item => {
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
          unit_price: item.unitPrice,
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

  const handleClientChange = useCallback((field: 'code' | 'name', value: string, phone?: string, address?: string) => {
    let updates: any = {};
    let matchedClient: import('@/stores/useMasterDataStore').Client | undefined;
    
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

  const handleOrderRefLoad = useCallback(async (ref: string) => {
    console.log('--- ORDER LOAD DEBUG START ---');
    console.log('Ref received:', ref);
    const cleanRef = ref?.trim().toLowerCase();
    if (!cleanRef || !storeId) return;
    
    setIsLoading(true);
    try {
      console.log('[OrderLoad] Searching for:', cleanRef);
      const sales = await OfflineDataService.getSales(storeId);
      // Fetch the latest product data from the DB to ensure stock levels are 100% accurate
      const inventoryRes = await OfflineInventoryService.getInventory(storeId, { notify: false });
      const allProducts = inventoryRes.data || [];

      // Fuzzy find: match if cleanRef is ANYWHERE in invoice_number, order_ref, or ID
      const foundSale = sales.find(s => {
        const inv = String(s.invoice_number || '').toLowerCase();
        const ord = String(s.order_ref || '').toLowerCase();
        const sid = String(s.id || '').toLowerCase();
        return inv.includes(cleanRef) || ord.includes(cleanRef) || sid.includes(cleanRef);
      });
      
      if (foundSale) {
        console.log('[OrderLoad] SUCCESS! Found sale:', foundSale.id);
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
          } catch (err) {
            return null; // Filter out broken items
          }
        }).filter(Boolean) as SanifereLineItem[];

        // Add mandatory empty row
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
        console.warn('[OrderLoad] Sale not found for:', cleanRef);
        toast.error(t('common.noData') + ': ' + cleanRef);
      }
    } catch (e: any) {
      console.error('[OrderLoad] Mapping error:', e);
      toast.error(`Order Ref Error: ${e.message || 'Unknown'}`); console.error('[DEBUG] Full error object:', e);
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

  const isGroupingUnit = (unit?: string) => {
    const u = (unit || '').toLowerCase();
    return ['carton', 'box', 'pack', 'paquet', 'sac', 'bag'].includes(u);
  };

  const addProduct = useCallback((product: Product) => {

    const existingIndex = lineItems.findIndex(li => li.productId === product.id);
    const clientDiscount = currentSession.clientDiscount || 0;
    
    let targetRow = -1;

    if (existingIndex >= 0) {
      const newItems = [...lineItems];
      const item = newItems[existingIndex];
      

      const newQty = Number(item.quantity) + 1;
      newItems[existingIndex] = {
        ...item,
        quantity: newQty,
        lineTotal: calculateLineTotal(item.unitPrice, newQty, item.discountPercent, item.isBox, item.conditionnement),
      };
      updateSession(mode, { lineItems: newItems });
      setSelectedIndex(existingIndex);
      targetRow = existingIndex;
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
        code: product.sku || '',
        conditionnement: packSize,
        isBox: false,
        unit_type: isGroupingUnit(product.unit_type) ? product.unit_type : (packSize > 1 ? 'Carton' : 'Piece'),
        stock: product.quantity || 0,
        basePrice: price,
        unitPrice: price,
        quantity: 1,
        discountPercent: clientDiscount,
        lineTotal: calculateLineTotal(price, 1, clientDiscount, false, packSize),
        priceTiers: priceTiers
      };

      // CONSUMPTION LOGIC: Fill the first empty row instead of appending a new one
      const firstEmptyIndex = lineItems.findIndex(li => !li.productId);
      
      if (firstEmptyIndex >= 0) {
        const newItems = [...lineItems];
        newItems[firstEmptyIndex] = {
          ...newItem,
          lineNumber: firstEmptyIndex + 1 // Keep original order
        };
        updateSession(mode, { lineItems: newItems });
        setSelectedIndex(firstEmptyIndex);
        targetRow = firstEmptyIndex;
      } else {
        updateSession(mode, { lineItems: [...lineItems, newItem] });
        setSelectedIndex(lineItems.length);
        targetRow = lineItems.length;
      }
    }

      // Force blur the current active element (likely the designation input)
      if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
      }
      
      // Ensure focus jumps to Quantity column (index 5)
      setTimeout(() => {
          const store = useNavigationStore.getState();
          if (targetRow !== -1) {
            store.setActiveCell({ row: targetRow, col: 5 });
            store.setMode('edit');
            
            // Give NavigableCell a moment to render and focus, then select the text
            setTimeout(() => {
               const el = document.getElementById(`quantity-input-${targetRow}`) as HTMLInputElement;
               if (el) {
                   el.focus();
                   el.select();
               }
            }, 50);
          }
      }, 50);
      
      toast.success(t('worker.sales.itemFound', { name: product.name }));
  }, [lineItems, mode, updateSession, t, activeTier, currentSession.clientDiscount]);

  const handlePriceChange = useCallback((index: number, unitPrice: any) => {
    const newItems = [...lineItems];
    const item = newItems[index];
    if (!item) return;
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
    const numQty = quantity === '' ? 0 : Number(quantity);

    newItems[index] = {
      ...item,
      quantity,
      lineTotal: calculateLineTotal(Number(item.unitPrice) || 0, numQty, Number(item.discountPercent) || 0, item.isBox, item.conditionnement),
    };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession, handleDeleteLine, t]);

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
    setInitialSearchQuery(value);
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], designation: value };
    updateSession(mode, { lineItems: newItems });
  }, [lineItems, mode, updateSession]);

    // Handle Hardware Scanner Input (Fast Scan)
  const handleHardwareScan = useCallback(async (e: any) => {
    const code = e.detail?.code;
    if (!code) return;
    
    console.log('[Scanner] High speed input detected:', code);
    
    // 1. Clean up "Scanner Corruption" in the currently active cell
    const store = useNavigationStore.getState();
    const activeCell = store.activeCell;
    
    if (activeCell && activeCell.row >= 0 && activeCell.row < lineItems.length) {
        const row = activeCell.row;
        const item = lineItems[row];
        
        // Only clean up if the row already has a product (empty rows are safely overwritten by addProduct)
        if (item && item.productId) {
            if (activeCell.col === 5) { // Quantity
                const qStr = String(item.quantity);
                if (qStr.includes(code)) {
                    const fixed = qStr.replace(code, '');
                    handleQuantityChange(row, fixed === '' ? 1 : parseInt(fixed));
                }
            } else if (activeCell.col === 0) { // Designation
                const dStr = String(item.designation);
                if (dStr.includes(code)) {
                    handleDesignationChange(row, dStr.replace(code, ''));
                }
            } else if (activeCell.col === 4) { // Price
                const pStr = String(item.unitPrice);
                if (pStr.includes(code)) {
                    handlePriceChange(row, pStr.replace(code, ''));
                }
            }
        }
    }
    
    // 2. Find and add the product
    const product = await scanProduct(code);
    if (product) {
        // Add it directly (consumption logic is inside addProduct)
        addProduct(product);
    } else {
        // If not found, maybe it's just a barcode they are typing manually?
        // We'll leave it in the designation field (captured via handleCaptureKeystroke)
        toast.error(t('worker.sales.itemNotFound') + ': ' + code);
    }
  }, [scanProduct, addProduct, t, lineItems, handleQuantityChange, handleDesignationChange, handlePriceChange]);

  
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

      const cartItems = lineItems.filter(item => !!item.productId).map(item => {
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
          unit_price: basePriceForDb,
          lineTotal: item.lineTotal,
          total: item.lineTotal,
        };
      });

      // Look up full client details if matched
      const matchedClient = currentSession.clientId 
        ? clients.find(c => c.id === currentSession.clientId) 
        : undefined;

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
      const cartItems = lineItems.filter(item => !!item.productId).map(item => {
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
          unit_price: item.unitPrice,
          lineTotal: item.lineTotal,
          total: item.lineTotal,
        };
      });

      const matchedClient = currentSession.clientId 
        ? clients.find(c => c.id === currentSession.clientId) 
        : undefined;

      const { error } = await OfflineSalesService.createSaleWithItems({
        store_id: storeId,
        worker_id: user?.id || '',
        client_id: currentSession.clientId || undefined,
        
        total_price: netTotal,
        amount_paid: 0,
        payment_method: 'credit', // Using credit/pending so it goes to receivables/invoices rather than cash
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

      toast.success(t('menu.program.saveSuccess', 'Draft saved successfully'));
      window.dispatchEvent(new CustomEvent('localDbDataUpdated', { detail: { type: 'sale' } }));
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
      if (isPaymentOpen || isProductLookupOpen || isScanning) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Allow F-keys even if focused in an input
        if (!e.key.startsWith('F')) return;
      }

      if (e.key === keyPay) {
        e.preventDefault();
        if (lineItems.length > 0) openPayment();
      } else if (e.key === keyValidate) {
        e.preventDefault();
        if (lineItems.length > 0) openPayment();
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



  // Ensure there is always an empty row at the bottom for keyboard navigation
  useEffect(() => {
    if (isLoading) return;
    const hasEmptyRow = lineItems.some(i => !i.productId);
    if (!hasEmptyRow) {
      const newItem = {
        id: crypto.randomUUID(),
        lineNumber: lineItems.length + 1,
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
      };
      updateSession(mode, { lineItems: [...lineItems, newItem] });
    }
  }, [lineItems, mode, updateSession, isLoading]);

    const openPaymentRef = useRef(openPayment);
  const handleSaveProformaRef = useRef(handleSaveProforma);
  const handleHardwareScanRef = useRef(handleHardwareScan);
  const handleOrderRefLoadRef = useRef(handleOrderRefLoad);

  useEffect(() => {
    openPaymentRef.current = openPayment;
    handleSaveProformaRef.current = handleSaveProforma;
    handleHardwareScanRef.current = handleHardwareScan;
    handleOrderRefLoadRef.current = handleOrderRefLoad;
  });

  // Listen for navigation events (delete, toggle, search, adjust qty)
  useEffect(() => {
    const handleDeleteEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      const key = e.detail?.key;
      
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) {
        // RULE: The last empty row should NEVER be removed.
        if (!lineItems[rowIndex].productId) return;

        handleDeleteLine(rowIndex);
        
        // BI-DIRECTIONAL DELETE: Backspace goes up (priority), Delete stays at index (goes down)
        setTimeout(() => {
            const store = useNavigationStore.getState();
            let newRow = rowIndex;
            if (key === 'Backspace') {
                newRow = Math.max(0, rowIndex - 1);
            }
            store.setActiveCell({ row: newRow, col: 0 });
            setSelectedIndex(newRow);
        }, 50);
      }
    };
    const handleToggleEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) {
        handleToggleUnit(rowIndex);
      }
    };
    const handleSearchEvent = (e: any) => {
      const rowIndex = e.detail?.row;
      if (typeof rowIndex === 'number' && lineItems[rowIndex]) {
        setInitialSearchQuery(lineItems[rowIndex].designation || '');
      } else {
        setInitialSearchQuery('');
      }
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
        // Increase/decrease by 500 units
        handlePriceChange(rowIndex, Math.max(0, currentPrice + (delta * 500)));
      }
    };
    const handleCaptureKeystroke = (e: any) => {
      const rowIndex = e.detail?.row;
      const colIndex = e.detail?.col;
      const key = e.detail?.key;
      
      if (typeof rowIndex !== 'number' || !lineItems[rowIndex]) return;

      if (colIndex === 0) {
        // Col 0: Designation. Append the character.
        handleDesignationChange(rowIndex, key); // Clean overwrite
      } else if (colIndex === 5) {
        // Col 5: Quantity. OVERWRITE with the key if it's a number.
        if (/[0-9]/.test(key)) {
            handleQuantityChange(rowIndex, key);
        }
      } else if (colIndex === 4) {
        // Col 4: Price. OVERWRITE with the key if it's a number.
        if (/[0-9]/.test(key)) {
            handlePriceChange(rowIndex, key);
        }
      }
    };

    window.addEventListener('nav-delete-row', handleDeleteEvent);
    window.addEventListener('nav-toggle-packing', handleToggleEvent);
    window.addEventListener('nav-open-search', handleSearchEvent);
    window.addEventListener('nav-adjust-quantity', handleAdjustQtyEvent);
    window.addEventListener('nav-adjust-price', handleAdjustPriceEvent);
    const onPayShortcut = () => openPaymentRef.current();
    const onSearchShortcut = () => setIsProductLookupOpen(true);
    const onSaveShortcut = () => handleSaveProformaRef.current();
    const onScannerInput = (e: any) => handleHardwareScanRef.current(e);

    window.addEventListener('scanner-input', onScannerInput);
    window.addEventListener('nav-pay-shortcut', onPayShortcut);
    window.addEventListener('nav-search-shortcut', onSearchShortcut);
    window.addEventListener('nav-save-shortcut', onSaveShortcut);
    window.addEventListener('nav-capture-keystroke', handleCaptureKeystroke);
    
    return () => {
      window.removeEventListener('nav-delete-row', handleDeleteEvent);
      window.removeEventListener('nav-toggle-packing', handleToggleEvent);
      window.removeEventListener('nav-open-search', handleSearchEvent);
      window.removeEventListener('nav-adjust-quantity', handleAdjustQtyEvent);
      window.removeEventListener('nav-adjust-price', handleAdjustPriceEvent);

      window.removeEventListener('scanner-input', onScannerInput);
      window.removeEventListener('nav-pay-shortcut', onPayShortcut);
      window.removeEventListener('nav-search-shortcut', onSearchShortcut);
      window.removeEventListener('nav-save-shortcut', onSaveShortcut);
      window.removeEventListener('nav-capture-keystroke', handleCaptureKeystroke);
    };
  }, [lineItems, handleDeleteLine, handleToggleUnit, handleQuantityChange, handleDesignationChange, handlePriceChange]);

  // Global Keyboard listener for the entire Sales Module grid focus
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      // STRICT ISOLATION: Stop everything if a modal is open
      if (isPaymentOpen || isProductLookupOpen || isScanning) {
          if (e.key === 'Enter') {
              e.stopPropagation();
              // Do NOT prevent default here, as the modal needs its own Enter
          }
          return;
      }

      const { activeCell, inputMethod } = useNavigationStore.getState();
      const target = e.target as HTMLElement;
      const isInputOrButton = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'BUTTON' || target?.getAttribute('role') === 'menuitem';
      
      // Focus first empty row on Enter if nothing is focused AND we aren't focused on a button/menu
      if (e.key === 'Enter' && inputMethod === 'keyboard' && !isInputOrButton && !activeCell) {
        e.preventDefault();
        const emptyRowIndex = lineItems.findIndex(i => !i.productId);
        let targetRow = emptyRowIndex !== -1 ? emptyRowIndex : lineItems.length;
        
        const store = useNavigationStore.getState();
        store.setActiveCell({ row: targetRow, col: 0 });
        store.setMode('edit');
      }
    };
    
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [lineItems, mode, isPaymentOpen, isProductLookupOpen, isScanning]);


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
        customerPhone={currentSession.customerPhone || ''}
        customerAddress={customerAddress}
        orderRef={orderRef}
        onCustomerChange={(code, name, phone, address) => {
          if (code !== customerCode) handleClientChange('code', code, phone, address);
          else if (name !== customerName) handleClientChange('name', name, phone, address);
          else updateSession(mode, { customerAddress: address, customerPhone: phone });
        }}
        onOrderRefChange={(ref) => updateSession(mode, { orderRef: ref })}
        onOrderRefLoad={handleOrderRefLoad}
        onInvoiceNumberChange={(num) => updateSession(mode, { invoiceNumber: num })}
      />

            <SanifereGrid
              items={lineItems}
              selectedIndex={selectedIndex}
              priceLabel={mode === 'proforma' ? t('inventory.price') : (mode === 'facturation-gros' ? t('inventory.fields.wholesalePriceShort') : t('inventory.fields.retailPriceShort'))}
              
              onSelectLine={(index) => {
                setSelectedIndex(index);
                const store = useNavigationStore.getState();
                if (store.activeCell?.row !== index) {
                  store.setActiveCell({ row: index, col: store.activeCell?.col || 0 });
                }
              }}
              onQuantityChange={handleQuantityChange}
              onDiscountChange={handleDiscountChange}
              onDeleteLine={handleDeleteLine}
              onDesignationChange={handleDesignationChange}
              onOpenSearch={() => setIsProductLookupOpen(true)}
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
        onValidate={() => lineItems.length > 0 && openPayment()}
        onSettlement={() => lineItems.length > 0 && openPayment()}
        onProductCard={() => setIsProductLookupOpen(true)}
        onDelete={() => selectedIndex >= 0 && handleDeleteLine(selectedIndex)}
        onSave={handleSaveProforma}
        onPrint={handlePrint}
      />

      <ProductLookupDialog
        initialSearch={initialSearchQuery}
        open={isProductLookupOpen}
        onOpenChange={(open) => {
            setIsProductLookupOpen(open);
            if (!open) {
                setTimeout(() => {
                    const store = useNavigationStore.getState();
                    if (store.activeCell) {
                        store.setMode('hover');
                    }
                }, 50);
            }
        }}
        storeId={storeId}
        mode={mode === 'facturation-gros' ? 'wholesale' : 'retail'}
        onSelect={(product) => {
            addProduct(product);
            setInitialSearchQuery(''); // Reset search
            setTimeout(() => {
                const store = useNavigationStore.getState();
                if (store.activeCell) {
                    store.setActiveCell({ row: store.activeCell.row, col: 5 }); // Jump to Quantity col
                    store.setMode('hover');
                }
            }, 100);
        }}
      />

      <PaymentDialog
        open={isPaymentOpen}
        onOpenChange={(open) => {
            setIsPaymentOpen(open);
            if (!open) {
                // Focus the next line (last empty row) when payment widget closes
                setTimeout(() => {
                    const store = useNavigationStore.getState();
                    store.jumpToLastEmptyRow();
                    store.setMode('hover');
                }, 100);
            }
        }}
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