import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Coins, TrendingUp, Package, AlertTriangle, ShoppingCart,
  ArrowDownCircle, ArrowUpCircle, Save, Trash2, BarChart3,
  WifiOff, RefreshCw, Search, Calendar as CalendarIcon, Filter as FilterIcon, Plus
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { OfflineDataService, SaleWithItems } from '@/services/OfflineDataService';
import { useStockSearch } from '@/hooks/useStockSearch';
import { ProductLookupDialog } from '../worker/Sales/ProductLookupDialog';
import { Product } from '@/types';
import { useTranslation } from 'react-i18next';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';

interface GestionModuleProps {
  storeId: string;
  mode: 'consultation-caisse' | 'journal-caisse' | 'tableau-bord' | 'statistiques' | 'sorties-pertes';
}

interface CashEntry {
  id: string;
  type: 'in' | 'out';
  description: string;
  amount: number;
  date: string;
  category: string;
}

const CHART_COLORS = ['#00D9FF', '#FF00FF', '#00FF66', '#FFD700', '#FF6B6B'];

interface DashboardAnalytics {
  daily_revenue: number;
  weekly_revenue: { date: string; revenue: number }[];
  top_products: { name: string; quantity: number; revenue: number }[];
  top_workers: { name: string; sales_count: number; revenue: number }[];
  stock_health?: { ok: number; low: number; out: number };
}

export function GestionModule({ storeId, mode }: GestionModuleProps) {
  const { t, i18n } = useTranslation();
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isProductLookupOpen, setIsProductLookupOpen] = useState(false);
  
  // Petty Cash Dialog
  const [isPettyCashOpen, setIsPettyCashOpen] = useState(false);
  const [pettyCashForm, setPettyCashForm] = useState({
    amount: '',
    category: 'petty_cash',
    description: '',
  });

  // Date Range state for Dashboard
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (mode === 'tableau-bord' || mode === 'statistiques') {
      return {
        from: startOfDay(subDays(new Date(), 90)),
        to: endOfDay(new Date()),
      };
    }
    return {
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    };
  });

  const [tableMetrics, setTableMetrics] = useState({ occupied: 0, total: 0 });

  