import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useReactToPrint } from 'react-to-print';
import { InvoiceTemplate, InvoiceData } from '@/components/printing/InvoiceTemplate';
import { InvoiceA4Template } from '@/components/printing/InvoiceA4Template';
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
import { useStockDeduction } from '@/hooks/useStockDeduction';

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

function calculateLineTotal(unitPrice: number, quantity: number, discountAmount: number, isBox: boolean = false, packSize: number = 1): number {
  const multiplier = isBox ? (packSize || 1) : 1;
  const subtotal = unitPrice * quantity * multiplier;
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
  const { deduct } = useStockDeduction();

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

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductLookupOpen, setIsProductLookupOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTier, setActiveTier] = useState<number>(1);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [store, setStore] = useState<any>(null);

  const stableValueRef = useRef<{row: number, col: number, value: any} | null>(null);
  const a4PrintRef = useRef<HTMLDivElement>(null);
  const [a4InvoiceData, setA4InvoiceData] = useState<InvoiceData | null>(null);
  const [lastPaymentMethod, setLastPaymentMethod] = useState<string | undefined>(undefined);
  const [tablesList, setTablesList] = useState<any[]>([]);

  useEffect(() => {
    const fetchTables = async () => {
      if (!storeId) return;
      try {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`${localBridgeBaseUrl}/rest/v1/tables_layout?store_id=${storeId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setTablesList(data || []);
        }
      } catch (err) {
        console.error('[SalesModule] Failed to fetch tables list', err);
      }
    };
    fetchTables();
  }, [storeId, localBridgeBaseUrl]);

  useEffect(() => {
    const tableStr = localStorage.getItem('selected_restaurant_table');
    const orderTypeStr = localStorage.getItem('selected_restaurant_order_type');
    if (tableStr) {
      const tableNum = parseInt(tableStr, 10);
      updateSession(mode, { 
        tableNumber: tableNum,
        orderType: (orderTypeStr as any) || 'dine_in'
      });
      localStorage.removeItem('selected_restaurant_table');
      localStorage.removeItem('selected_restaurant_order_type');
    }
  }, [mode, updateSession]);

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
    