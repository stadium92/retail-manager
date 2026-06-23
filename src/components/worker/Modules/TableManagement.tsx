import { useState, useEffect, useCallback } from 'react';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Edit2, Check, Trash2, Layout, User, Receipt, Navigation, RefreshCw, Grid, Sparkles, Coins
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface TableManagementProps {
  storeId: string;
  onModuleChange?: (module: any) => void;
}

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  current_order_id: string | null;
  zone: string | null;
  position_x: number;
  position_y: number;
}

export function TableManagement({ storeId, onModuleChange }: TableManagementProps) {
  const { t } = useTranslation();
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Modal / Sidebar details state
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [activeOrderDetails, setActiveOrderDetails] = useState<any | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);

  // New table form state
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [newTableZone, setNewTableZone] = useState('Salle Principale');

  // Edit table properties form state
  const [editTableNumber, setEditTableNumber] = useState('');
  const [editTableCapacity, setEditTableCapacity] = useState('4');
  const [editTableZone, setEditTableZone] = useState('Salle Principale');

  // Filter Zone state
  const [activeZone, setActiveZone] = useState('Toutes');

  // Settle Payment state
  const [isPaying, setIsPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit'>('cash');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const { localBridgeBaseUrl } = getDataClient();

  const fetchTables = useCallback(async () => {
    if (!storeId) return;
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;
      const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/tables_layout?store_id=${storeId}`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setTables(data || []);
      }
    } catch (err) {
      console.error('[TableManagement] Fetch tables error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, localBridgeBaseUrl]);

  // Load active order if table is occupied
  const fetchOrderDetails = useCallback(async (orderId: string) => {
    setIsLoadingOrder(true);
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;
      const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/sales/${orderId}`, {
        headers,
      });
      if (res.ok) {
        const order = await res.json();
        setActiveOrderDetails(order);
      }
    } catch (err) {
      console.error('[TableManagement] Fetch active order error:', err);
    } finally {
      setIsLoadingOrder(false);
    }
  }, [localBridgeBaseUrl]);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 8000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  useEffect(() => {
    if (selectedTable?.status === 'occupied' && selectedTable.current_order_id) {
      fetchOrderDetails(selectedTable.current_order_id);
    } else {
      setActiveOrderDetails(null);
    }
  }, [selectedTable, fetchOrderDetails]);

  // Populate edit fields when table selection changes
  useEffect(() => {
    if (selectedTable) {
      setEditTableNumber(String(selectedTable.table_number));
      setEditTableCapacity(String(selectedTable.capacity));
      setEditTableZone(selectedTable.zone || 'Salle Principale');
      setIsPaying(false);
    } else {
      setEditTableNumber('');
      setEditTableCapacity('4');
      setEditTableZone('Salle Principale');
      setIsPaying(false);
    }
  }, [selectedTable]);

  // Create table handler
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const tableNum = parseInt(newTableNumber, 10);
    if (isNaN(tableNum) || tableNum <= 0) {
      toast({ title: t('common.error'), description: 'Numéro de table invalide.' });
      return;
    }

    if (tables.some((t) => t.table_number === tableNum)) {
      toast({ title: t('common.error'), description: 'Ce numéro de table existe déjà.' });
      return;
    }

    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;
      const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/tables_layout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          store_id: storeId,
          table_number: tableNum,
          capacity: parseInt(newTableCapacity, 10) || 4,
          zone: newTableZone || 'Salle Principale',
          status: 'available',
          position_x: 10 + (tables.length % 5) * 150, // offset position
          position_y: 10 + Math.floor(tables.length / 5) * 150,
        }),
      });

      if (res.ok) {
        toast({ title: 'Succès', description: 'Table ajoutée.' });
        setNewTableNumber('');
        fetchTables();
      }
    } catch (err) {
      console.error('[TableManagement] Add table error:', err);
    }
  };

  // Update existing table properties
  const handleUpdateTableProperties = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;

    const tableNum = parseInt(editTableNumber, 10);
    if (isNaN(tableNum) || tableNum <= 0) {
      toast({ title: t('common.error'), description: 'Numéro de table invalide.' });
      return;
    }

    if (tables.some((t) => t.table_number === tableNum && t.id !== selectedTable.id)) {
      toast({ title: t('common.error'), description: 'Ce numéro de table existe déjà.' });
      return;
    }

    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;
      const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/tables_layout/${selectedTable.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          table_number: tableNum,
          capacity: parseInt(editTableCapacity, 10) || 4,
          zone: editTableZone || 'Salle Principale',
        }),
      });

      if (res.ok) {
        toast({ title: 'Succès', description: 'Table mise à jour.' });
        fetchTables();
        setSelectedTable(null);
      }
    } catch (err) {
      console.error('[TableManagement] Edit table properties error:', err);
    }
  };

  // Update table status
  const handleUpdateStatus = async (tableId: string, nextStatus: Table['status']) => {
    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;
      const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/tables_layout/${tableId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: nextStatus,
          current_order_id: nextStatus === 'available' ? null : undefined, // clean order ref if set to available
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTables((prev) => prev.map((t) => (t.id === tableId ? updated : t)));
        if (selectedTable && selectedTable.id === tableId) {
          setSelectedTable(updated);
        }
        toast({ title: 'Statut mis à jour', description: `La table est maintenant : ${nextStatus}` });
      }
    } catch (err) {
      console.error('[TableManagement] Update status error:', err);
    }
  };

  // Delete table
  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Supprimer cette table définitivement ?')) return;

    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;
      const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/tables_layout/${tableId}`, {
        method: 'DELETE',
        headers,
      });

      if (res.ok) {
        toast({ title: 'Table supprimée', description: 'Le plan de salle a été mis à jour.' });
        setSelectedTable(null);
        fetchTables();
      }
    } catch (err) {
      console.error('[TableManagement] Delete table error:', err);
    }
  };

  // Drag and Drop implementation for custom floor plan positioning
  const handleDragStart = (e: React.DragEvent, tableId: string) => {
    if (!isEditMode) return;
    e.dataTransfer.setData('text/plain', tableId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const tableId = e.dataTransfer.getData('text/plain');
    if (!tableId) return;

    const container = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(container.width - 96, e.clientX - container.left - 48));
    const y = Math.max(0, Math.min(container.height - 96, e.clientY - container.top - 48));

    try {
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) return;
      const res = await smartFetch(`${localBridgeBaseUrl}/rest/v1/tables_layout/${tableId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          position_x: Math.round(x),
          position_y: Math.round(y),
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTables((prev) => prev.map((t) => (t.id === tableId ? updated : t)));
      }
    } catch (err) {
      console.error('[TableManagement] Update position error:', err);
    }
  };

  // Serve active kitchen order
  const handleServeOrder = async () => {
    if (!selectedTable?.current_order_id) return;
    try {
      const { OfflineSalesService } = await import('@/services/OfflineSalesService');
      const { error } = await OfflineSalesService.updateSale(selectedTable.current_order_id, { order_status: 'served' });
      if (!error) {
        toast({ title: 'Succès', description: 'Commande marquée comme servie.' });
        fetchOrderDetails(selectedTable.current_order_id);
        fetchTables();
      }
    } catch (err) {
      console.error('[TableManagement] Serve order error:', err);
    }
  };

  // Direct checkout payment confirmation
  const handleConfirmDirectPayment = async () => {
    if (!selectedTable?.current_order_id || !activeOrderDetails) return;
    setIsSubmittingPayment(true);
    try {
      const { OfflineSalesService } = await import('@/services/OfflineSalesService');
      const { error } = await OfflineSalesService.updateSale(selectedTable.current_order_id, {
        payment_status: 'paid',
        payment_method: paymentMethod,
        amount_paid: activeOrderDetails.total_price || 0,
        status: 'served',
        order_status: 'served'
      });
      if (!error) {
        toast({ title: 'Facture payée', description: `La table ${selectedTable.table_number} a été libérée.` });
        setIsPaying(false);
        setSelectedTable(null);
        setActiveOrderDetails(null);
        fetchTables();
      } else {
        throw error;
      }
    } catch (err: any) {
      toast({ title: t('common.error'), description: err.message || 'Le paiement direct a échoué.', variant: 'destructive' });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Redirect to Sales POS module with selected table
  const handleTakeOrder = (tableNum: number) => {
    localStorage.setItem('selected_restaurant_table', String(tableNum));
    localStorage.setItem('selected_restaurant_order_type', 'dine_in');
    
    if (onModuleChange) {
      onModuleChange('vente-detail');
    }
  };

  // Compute dynamic list of zones
  const zonesList = useMemo(() => {
    const extracted = tables.map((t) => t.zone).filter(Boolean) as string[];
    const unique = Array.from(new Set(extracted));
    return ['Toutes', ...unique.length > 0 ? unique : ['Salle Principale', 'Terrasse', 'VIP', 'Bar']];
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (activeZone === 'Toutes') return tables;
    return tables.filter(t => t.zone === activeZone);
  }, [tables, activeZone]);

  // Compute Table Shape and Dimension
  const getTableSizeAndShape = (capacity: number) => {
    if (capacity <= 2) return 'w-[84px] h-[84px] rounded-full';
    if (capacity <= 4) return 'w-[96px] h-[96px] rounded-[18px]';
    if (capacity <= 6) return 'w-[124px] h-[84px] rounded-[12px]';
    return 'w-[148px] h-[96px] rounded-[16px]';
  };

  // Render Visual Chairs around Table elements
  const renderChairs = (capacity: number) => {
    const chairsCount = Math.min(capacity, 10);
    const chairs = [];
    if (chairsCount <= 2) {
      chairs.push(<span key="c1" className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c2" className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
    } else if (chairsCount <= 4) {
      chairs.push(<span key="c1" className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c2" className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c3" className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c4" className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
    } else if (chairsCount <= 6) {
      chairs.push(<span key="c1" className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c2" className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c3" className="absolute -top-1.5 left-1/4 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c4" className="absolute -top-1.5 left-3/4 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c5" className="absolute -bottom-1.5 left-1/4 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c6" className="absolute -bottom-1.5 left-3/4 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
    } else {
      chairs.push(<span key="c1" className="absolute -left-1.5 top-1/3 -translate-y-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c2" className="absolute -left-1.5 top-2/3 -translate-y-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c3" className="absolute -right-1.5 top-1/3 -translate-y-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c4" className="absolute -right-1.5 top-2/3 -translate-y-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c5" className="absolute -top-1.5 left-1/4 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c6" className="absolute -top-1.5 left-2/4 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c7" className="absolute -top-1.5 left-3/4 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c8" className="absolute -bottom-1.5 left-1/4 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c9" className="absolute -bottom-1.5 left-2/4 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
      chairs.push(<span key="c10" className="absolute -bottom-1.5 left-3/4 -translate-x-1/2 w-3.5 h-3.5 bg-slate-800 border border-white/10 rounded-full shadow-inner z-0" />);
    }
    return chairs;
  };

  // Render Visual Kitchen Preparation stage stepper
  const renderOrderStepper = (status: string) => {
    const steps = [
      { label: 'Reçu', key: 'pending' },
      { label: 'Cuisine', key: 'preparing' },
      { label: 'Prêt', key: 'ready' },
      { label: 'Servi', key: 'served' }
    ];
    const currentIdx = steps.findIndex(s => s.key === status);
    return (
      <div className="flex flex-col gap-2 my-2.5 p-3 bg-slate-900 border border-white/5 rounded-xl">
        <div className="flex justify-between text-[10px] text-muted-foreground font-black uppercase">
          <span>Suivi Préparation</span>
          <span className={cn(
            'font-mono px-1.5 py-0.5 rounded text-[9px] font-black',
            status === 'pending' && 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
            status === 'preparing' && 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
            status === 'ready' && 'bg-purple-500/20 text-purple-400 border border-purple-500/30 animate-pulse',
            status === 'served' && 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          )}>
            {status === 'pending' ? 'Attente' : status === 'preparing' ? 'Préparation' : status === 'ready' ? 'Prêt' : 'Servi'}
          </span>
        </div>
        <div className="flex items-center justify-between relative mt-2 px-1 pb-1">
          {/* Progress lines */}
          <div className="absolute top-[11px] left-4 right-4 h-[2px] bg-slate-800 z-0" />
          <div 
            className="absolute top-[11px] left-4 h-[2px] bg-primary z-0 transition-all duration-300"
            style={{ width: `${currentIdx >= 0 ? (currentIdx / (steps.length - 1)) * 90 : 0}%` }}
          />
          {steps.map((step, idx) => {
            const active = idx <= currentIdx;
            const current = idx === currentIdx;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1 z-10">
                <div 
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300",
                    active ? "bg-primary text-black border-primary ring-4 ring-primary/10" : "bg-slate-950 border-white/10 text-muted-foreground",
                    current && "animate-pulse"
                  )}
                >
                  {idx + 1}
                </div>
                <span className={cn("text-[9px] font-bold tracking-tight", active ? "text-primary" : "text-muted-foreground")}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex bg-slate-950 text-white select-none">
      {/* Visual Floor Plan */}
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-primary/20 border border-primary/30">
              <Grid className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-wider uppercase">Plan de Salle</h1>
              <span className="text-xs text-muted-foreground">Suivi visuel et gestion des tables en temps réel</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditMode(!isEditMode);
                setSelectedTable(null);
              }}
              className={cn(
                'border-white/10 h-9 gap-1.5 text-xs font-bold uppercase tracking-wider',
                isEditMode ? 'bg-primary text-black border-primary hover:bg-primary/95' : 'bg-slate-900/50 hover:bg-slate-900'
              )}
            >
              {isEditMode ? <Check className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
              {isEditMode ? 'Quitter Config' : 'Configurer Plan'}
            </Button>
            <Button variant="outline" onClick={fetchTables} className="text-white border-white/10 bg-slate-900/50 hover:bg-slate-900 gap-2 h-9 text-xs font-bold uppercase tracking-wider">
              <RefreshCw className="h-4 w-4" />
              Rafraîchir
            </Button>
          </div>
        </div>

        {/* Zones Selector Tab Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 border-b border-white/5">
          {zonesList.map((z) => (
            <button
              key={z}
              onClick={() => setActiveZone(z)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border',
                activeZone === z
                  ? 'bg-primary text-black border-primary shadow-lg shadow-primary/10'
                  : 'bg-slate-900/60 text-muted-foreground border-white/5 hover:text-white hover:bg-slate-900'
              )}
            >
              {z === 'Toutes' ? 'Toutes les zones' : z}
            </button>
          ))}
        </div>

        {/* Floor Canvas */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="flex-1 bg-slate-900/20 border border-white/5 rounded-2xl relative overflow-hidden bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.08),rgba(255,255,255,0))]"
          style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.04) 1.2px, transparent 0)', backgroundSize: '24px 24px' }}
        >
          {filteredTables.map((table) => {
            const shapeClass = getTableSizeAndShape(table.capacity);
            const isOccupied = table.status === 'occupied';
            const isReserved = table.status === 'reserved';
            const isCleaning = table.status === 'cleaning';
            const isAvailable = table.status === 'available';

            return (
              <div
                key={table.id}
                draggable={isEditMode}
                onDragStart={(e) => handleDragStart(e, table.id)}
                onClick={() => setSelectedTable(table)}
                className={cn(
                  'absolute flex flex-col items-center justify-center cursor-pointer transition-all border shadow-xl z-10 group select-none',
                  shapeClass,
                  isAvailable && 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:scale-[1.03]',
                  isOccupied && 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/25 text-rose-400 hover:scale-[1.03]',
                  isReserved && 'bg-cyan-500/5 hover:bg-cyan-500/10 border-cyan-500/25 text-cyan-400 hover:scale-[1.03]',
                  isCleaning && 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/25 text-amber-400 hover:scale-[1.03]',
                  selectedTable?.id === table.id && 'ring-2 ring-primary border-primary scale-[1.03] z-20'
                )}
                style={{
                  left: `${table.position_x}px`,
                  top: `${table.position_y}px`,
                }}
              >
                {/* Visual Chairs Render */}
                {renderChairs(table.capacity)}

                {/* Table text details */}
                <div className="relative z-10 flex flex-col items-center text-center">
                  <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Table</span>
                  <span className="text-2xl font-black tracking-tighter leading-none">{table.table_number}</span>
                  <span className="text-[9px] text-muted-foreground font-medium mt-0.5">{table.capacity} Pax</span>
                </div>

                {/* Pulsing indicator */}
                {isOccupied && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
                  </span>
                )}
                {isCleaning && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                  </span>
                )}
              </div>
            );
          })}

          {filteredTables.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-center p-4">
              <p className="font-bold">Aucune table dans cette zone.</p>
              <p className="text-xs max-w-xs mt-1 text-muted-foreground/60">
                {isEditMode ? 'Utilisez le formulaire pour ajouter une table et déplacez-la sur le plan.' : 'Activez le mode configuration pour ajouter des tables.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Control Panel / Sidebar */}
      <div className="w-[320px] bg-slate-900 border-l border-white/10 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
        {isEditMode ? (
          selectedTable ? (
            <form onSubmit={handleUpdateTableProperties} className="flex flex-col gap-4 shrink-0">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h2 className="text-sm font-black tracking-wider uppercase text-primary">
                  Modifier Table {selectedTable.table_number}
                </h2>
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setSelectedTable(null)} 
                  className="h-6 px-1.5 text-xs hover:bg-white/5"
                >
                  Annuler
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-bold">Numéro de table</label>
                <Input
                  type="number"
                  value={editTableNumber}
                  onChange={(e) => setEditTableNumber(e.target.value)}
                  placeholder="Ex: 5"
                  required
                  className="bg-slate-950 border-white/10 text-white h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-bold">Capacité (personnes)</label>
                <Input
                  type="number"
                  value={editTableCapacity}
                  onChange={(e) => setEditTableCapacity(e.target.value)}
                  placeholder="Ex: 4"
                  className="bg-slate-950 border-white/10 text-white h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-bold">Zone</label>
                <Input
                  value={editTableZone}
                  onChange={(e) => setEditTableZone(e.target.value)}
                  placeholder="Ex: Terrasse"
                  className="bg-slate-950 border-white/10 text-white h-9"
                />
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <Button type="submit" className="bg-primary text-black font-black uppercase text-xs tracking-wider h-10 w-full gap-1.5 hover:bg-primary/95">
                  <Check className="h-4 w-4" />
                  Sauvegarder
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDeleteTable(selectedTable.id)}
                  className="bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white font-black uppercase text-xs tracking-wider h-10 w-full gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer la table
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateTable} className="flex flex-col gap-4 shrink-0">
              <h2 className="text-sm font-black tracking-wider uppercase text-primary border-b border-white/10 pb-2">
                Ajouter une Table
              </h2>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-bold">Numéro de table</label>
                <Input
                  type="number"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="Ex: 5"
                  required
                  className="bg-slate-950 border-white/10 text-white h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-bold">Capacité (personnes)</label>
                <Input
                  type="number"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(e.target.value)}
                  placeholder="Ex: 4"
                  className="bg-slate-950 border-white/10 text-white h-9"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-bold">Zone</label>
                <Input
                  value={newTableZone}
                  onChange={(e) => setNewTableZone(e.target.value)}
                  placeholder="Ex: Salle Principale"
                  className="bg-slate-950 border-white/10 text-white h-9"
                />
              </div>
              <Button type="submit" className="bg-primary text-black font-black uppercase text-xs tracking-wider h-10 w-full gap-1.5 hover:bg-primary/95">
                <Plus className="h-4 w-4" />
                Créer Table
              </Button>
            </form>
          )
        ) : selectedTable ? (
          isPaying ? (
            /* Quick Checkout flow in the sidebar */
            <div className="flex flex-col gap-4 h-full shrink-0">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h2 className="text-sm font-black tracking-wider uppercase text-primary">
                  Encaissement Table {selectedTable.table_number}
                </h2>
                <Button 
                  variant="ghost" 
                  onClick={() => setIsPaying(false)} 
                  className="h-6 px-1.5 text-xs hover:bg-white/5"
                >
                  Retour
                </Button>
              </div>

              <div className="p-3.5 bg-slate-950 border border-white/5 rounded-xl flex flex-col gap-1 items-center justify-center my-1.5">
                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Montant à payer</span>
                <span className="text-2xl font-black text-primary font-mono">{activeOrderDetails?.total_price || 0} F CFA</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted-foreground font-bold">Mode de règlement</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={cn(
                      'text-xs h-10 font-bold border-white/5',
                      paymentMethod === 'cash' ? 'bg-primary text-black border-primary' : 'bg-slate-950 text-slate-300'
                    )}
                  >
                    Espèces
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={cn(
                      'text-xs h-10 font-bold border-white/5',
                      paymentMethod === 'card' ? 'bg-primary text-black border-primary' : 'bg-slate-950 text-slate-300'
                    )}
                  >
                    Carte
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setPaymentMethod('credit')}
                    className={cn(
                      'text-xs h-10 font-bold border-white/5',
                      paymentMethod === 'credit' ? 'bg-primary text-black border-primary' : 'bg-slate-950 text-slate-300'
                    )}
                  >
                    Crédit
                  </Button>
                </div>
              </div>

              <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-white/10">
                <Button
                  disabled={isSubmittingPayment}
                  onClick={handleConfirmDirectPayment}
                  className="bg-primary text-black font-black uppercase text-xs tracking-wider h-11 w-full gap-1.5 hover:bg-primary/95"
                >
                  {isSubmittingPayment ? 'Traitement...' : 'Confirmer le paiement'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsPaying(false)}
                  className="border-white/10 bg-transparent hover:bg-white/5 text-white font-black uppercase text-xs tracking-wider h-10 w-full"
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            /* Selected Table View details */
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex flex-col">
                  <h2 className="text-lg font-black text-primary leading-none">
                    TABLE {selectedTable.table_number}
                  </h2>
                  <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {selectedTable.zone || 'Salle'}
                  </span>
                </div>
                <div className={cn(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
                  selectedTable.status === 'available' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                  selectedTable.status === 'occupied' && 'bg-rose-500/10 border-rose-500/20 text-rose-400',
                  selectedTable.status === 'reserved' && 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
                  selectedTable.status === 'cleaning' && 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                )}>
                  {selectedTable.status === 'available' ? 'Libre' : selectedTable.status === 'occupied' ? 'Occupée' : selectedTable.status === 'reserved' ? 'Réservée' : 'Nettoyage'}
                </div>
              </div>

              {/* Status updates buttons */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Forcer statut table</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedTable.id, 'available')}
                    className={cn('text-[10px] h-8 font-bold border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10', selectedTable.status === 'available' && 'bg-emerald-500/20 border-emerald-500/40')}
                  >
                    Disponible
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedTable.id, 'occupied')}
                    className={cn('text-[10px] h-8 font-bold border-rose-500/20 text-rose-400 hover:bg-rose-500/10', selectedTable.status === 'occupied' && 'bg-rose-500/20 border-rose-500/40')}
                  >
                    Occupée
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedTable.id, 'reserved')}
                    className={cn('text-[10px] h-8 font-bold border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10', selectedTable.status === 'reserved' && 'bg-cyan-500/20 border-cyan-500/40')}
                  >
                    Réservée
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedTable.id, 'cleaning')}
                    className={cn('text-[10px] h-8 font-bold border-amber-500/20 text-amber-400 hover:bg-amber-500/10', selectedTable.status === 'cleaning' && 'bg-amber-500/20 border-amber-500/40')}
                  >
                    Nettoyage
                  </Button>
                </div>
              </div>

              {/* Kitchen stepper for active order status */}
              {selectedTable.status === 'occupied' && activeOrderDetails && (
                renderOrderStepper(activeOrderDetails.order_status || activeOrderDetails.status || 'pending')
              )}

              {/* Details list area */}
              <div className="flex flex-col gap-1.5 flex-1 overflow-hidden min-h-[160px]">
                <label className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">Détail commande active</label>
                <ScrollArea className="flex-1 border border-white/5 rounded-xl bg-slate-950/40 p-3">
                  {isLoadingOrder ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground py-8">
                      Chargement de la commande...
                    </div>
                  ) : selectedTable.status === 'occupied' && activeOrderDetails ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                        <Receipt className="h-4 w-4 text-primary" />
                        <span className="font-bold">Facture #{activeOrderDetails.invoice_number}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <User className="h-4 w-4 text-primary/70" />
                        <span>Serveur ID : {activeOrderDetails.waiter_id || '—'}</span>
                      </div>

                      {activeOrderDetails.kitchen_notes && (
                        <div className="bg-slate-900 border border-white/5 rounded-lg p-2 text-[10px] text-amber-400 italic">
                          💡 Notes : {activeOrderDetails.kitchen_notes}
                        </div>
                      )}

                      <div className="border-t border-white/10 pt-2 flex flex-col gap-1">
                        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">
                          Plats & Consommations
                        </span>
                        {activeOrderDetails.items && activeOrderDetails.items.length > 0 ? (
                          activeOrderDetails.items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs py-1.5 border-b border-white/5 last:border-b-0 items-center">
                              <span className="text-slate-200 truncate pr-2">
                                {item.product_name || 'Plat'}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-slate-400 text-[10px]">x{item.quantity}</span>
                                <span className="text-primary font-black font-mono text-[11px]">
                                  {item.total || (item.unit_price * item.quantity)} F
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Aucun article enregistré.</span>
                        )}
                      </div>

                      <div className="border-t border-white/10 pt-2 flex justify-between font-black text-sm mt-1">
                        <span className="text-slate-300">TOTAL :</span>
                        <span className="text-primary font-mono">{activeOrderDetails.total_price || 0} F CFA</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground text-center py-10 gap-1">
                      <Sparkles className="h-5 w-5 text-white/15" />
                      <p>
                        {selectedTable.status === 'available'
                          ? 'Table libre pour une nouvelle commande.'
                          : selectedTable.status === 'reserved'
                          ? 'Table réservée pour un groupe.'
                          : 'Table en cours de nettoyage.'}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-white/5 shrink-0">
                {selectedTable.status === 'occupied' && activeOrderDetails && (
                  <>
                    {(activeOrderDetails.order_status === 'ready' || activeOrderDetails.status === 'ready') && (
                      <Button
                        onClick={handleServeOrder}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs tracking-wider h-10 w-full gap-1.5"
                      >
                        <Check className="h-4 w-4" />
                        Marquer comme Servi
                      </Button>
                    )}
                    <Button
                      onClick={() => setIsPaying(true)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-wider h-10 w-full gap-1.5"
                    >
                      <Coins className="h-4 w-4" />
                      Encaisser Direct
                    </Button>
                  </>
                )}
                
                <Button
                  onClick={() => handleTakeOrder(selectedTable.table_number)}
                  className="bg-primary text-black font-black uppercase text-xs tracking-wider h-10 w-full gap-1.5 hover:bg-primary/95"
                >
                  <Plus className="h-4 w-4" />
                  {selectedTable.status === 'occupied' ? 'Modifier / Ajouter' : 'Prendre Commande'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <Navigation className="h-8 w-8 text-white/20 animate-pulse" />
              <p className="text-xs max-w-[200px]">Sélectionnez une table sur le plan pour gérer ses commandes, changer son statut ou configurer sa capacité.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
