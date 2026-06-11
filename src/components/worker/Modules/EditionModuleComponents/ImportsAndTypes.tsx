import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Search, CalendarIcon, FileText, Users, 
  ShoppingBag, Eye, WifiOff, RefreshCw, Printer, Download
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  OfflineDataService, 
  SaleWithItems, 
  PurchaseWithSupplier 
} from '@/services/OfflineDataService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { OfflineTeamService, TeamMember } from '@/services/OfflineTeamService';
import { LocalDatabase } from '@/services/LocalDatabase';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { InvoiceDetailsDialog } from './InvoiceDetailsDialog';
import { ExportService } from '@/services/ExportService';

interface EditionModuleProps {
  storeId: string;
  mode: 'situation-client' | 'suivi-ventes-jour' | 'suivi-ventes-produit' | 
        'suivi-ventes-factures' | 'situation-fournisseur' | 'suivi-achats-famille' | 
        'suivi-achats-jour' | 'suivi-achats-periode';
}

interface ProductFamily {
  family_name: string;
  total_quantity: number;
  total_amount: number;
}

interface Supplier {
  id: string;
  name: string;
  balance: number;
  phone: string | null;
}

interface Transaction {
  id: string;
  type: 'sale' | 'purchase' | 'payment';
  amount: number;
  method?: string;
  reference?: string;
  created_at: string;
  order_ref?: string;
  notes?: string;
}

export function EditionModule({ storeId, mode }: EditionModuleProps) {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useFormatters();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    if (mode.endsWith('-jour')) {
      return { from: startOfDay(new Date()), to: endOfDay(new Date()) };
    }
    return {
      from: subDays(new Date(), 30),
      to: endOfDay(new Date()),
    };
  });

  useEffect(() => {
    if (mode.endsWith('-jour')) {
      setDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
    } else {
      setDateRange({ from: subDays(new Date(), 30), to: endOfDay(new Date()) });
    }
  }, [mode]);

  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleWithItems | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseWithSupplier[]>([]);
  const [purchasesByFamily, setPurchasesByFamily] = useState<ProductFamily[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Statement State
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [statementData, setStatementData] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [workers, setWorkers] = useState<TeamMember[]>([]);

  