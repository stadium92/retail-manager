import { useState, useEffect, useCallback } from 'react';
import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Edit2, Check, Trash2, Layout, User, Receipt, Navigation, RefreshCw, Grid
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

  // Create table handler
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const tableNum = parseInt(newTableNumber, 10);
    if (isNaN(tableNum) || tableNum <= 0) {
      toast({ title: t('common.error'), description: 'Numéro de table invalide.' });
      return;
    }

    // Check if table number already exists
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
          position_x: 10 + (tables.length % 5) * 120, // offset position
          position_y: 10 + Math.floor(tables.length / 5) * 120,
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
        toast({ title: 'Statut mis à jour', description: `Table est maintenant : ${nextStatus}` });
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
    const x = Math.max(0, Math.min(container.width - 90, e.clientX - container.left - 45));
    const y = Math.max(0, Math.min(container.height - 90, e.clientY - container.top - 45));

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

  // Redirect to Sales POS module with selected table
  const handleTakeOrder = (tableNum: number) => {
    localStorage.setItem('selected_restaurant_table', String(tableNum));
    localStorage.setItem('selected_restaurant_order_type', 'dine_in');
    
    if (onModuleChange) {
      onModuleChange('vente-detail');
    }
  };

  return (
    <div className="h-full flex bg-slate-950 text-white select-none">
      {/* Visual Floor Plan */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-primary/20 border border-primary/30">
              <Grid className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-wider uppercase">Plan de Salle</h1>
              <span className="text-xs text-muted-foreground">Suivi visuel de l'occupation des tables</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(
                'border-white/10 h-9 gap-1.5',
                isEditMode ? 'bg-primary text-black border-primary' : 'bg-slate-900/50 hover:bg-slate-900'
              )}
            >
              {isEditMode ? <Check className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
              {isEditMode ? 'Quitter Configuration' : 'Configurer Plan'}
            </Button>
            <Button variant="outline" onClick={fetchTables} className="text-white border-white/10 bg-slate-900/50 hover:bg-slate-900 gap-2 h-9">
              <RefreshCw className="h-4 w-4" />
              Rafraîchir
            </Button>
          </div>
        </div>

        {/* Floor Canvas */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="flex-1 bg-slate-900/40 border border-white/5 rounded-2xl relative overflow-hidden bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))]"
          style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0)', backgroundSize: '24px 24px' }}
        >
          {tables.map((table) => (
            <div
              key={table.id}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, table.id)}
              onClick={() => !isEditMode && setSelectedTable(table)}
              className={cn(
                'absolute w-[96px] h-[96px] rounded-full flex flex-col items-center justify-center cursor-pointer transition-all border shadow-lg',
                table.status === 'available' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:scale-105',
                table.status === 'occupied' && 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:scale-105',
                table.status === 'reserved' && 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:scale-105',
                table.status === 'cleaning' && 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:scale-105',
                selectedTable?.id === table.id && 'ring-2 ring-primary border-primary scale-105'
              )}
              style={{
                left: `${table.position_x}px`,
                top: `${table.position_y}px`,
              }}
            >
              <span className="text-xs text-muted-foreground font-mono">T.</span>
              <span className="text-2xl font-black tracking-tighter leading-none">{table.table_number}</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{table.capacity} pax</span>
              {table.status === 'occupied' && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
              )}
            </div>
          ))}

          {tables.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <p>Aucune table configurée dans le plan.</p>
              <p className="text-xs">Cliquez sur "Configurer Plan" pour en ajouter une.</p>
            </div>
          )}
        </div>
      </div>

      {/* Control Panel / Sidebar */}
      <div className="w-[320px] bg-slate-900 border-l border-white/10 p-4 flex flex-col gap-4">
        {isEditMode ? (
          <form onSubmit={handleCreateTable} className="flex flex-col gap-4">
            <h2 className="text-sm font-black tracking-wider uppercase text-primary border-b border-white/10 pb-2">
              Ajouter une Table
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Numéro de table</label>
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
              <label className="text-xs text-muted-foreground">Capacité (personnes)</label>
              <Input
                type="number"
                value={newTableCapacity}
                onChange={(e) => setNewTableCapacity(e.target.value)}
                placeholder="Ex: 4"
                className="bg-slate-950 border-white/10 text-white h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Zone</label>
              <Input
                value={newTableZone}
                onChange={(e) => setNewTableZone(e.target.value)}
                placeholder="Ex: Terrasse"
                className="bg-slate-950 border-white/10 text-white h-9"
              />
            </div>
            <Button type="submit" className="bg-primary text-black font-black uppercase text-xs tracking-wider h-10 w-full gap-1.5">
              <Plus className="h-4 w-4" />
              Créer Table
            </Button>
          </form>
        ) : selectedTable ? (
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h2 className="text-lg font-black text-primary">
                TABLE {selectedTable.table_number}
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                {selectedTable.zone || 'Salle'}
              </span>
            </div>

            {/* Status updates buttons */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Statut de la table</label>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedTable.id, 'available')}
                  className={cn('text-xs h-8 border-emerald-500/30 text-emerald-400', selectedTable.status === 'available' && 'bg-emerald-500/20')}
                >
                  Libre
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedTable.id, 'occupied')}
                  className={cn('text-xs h-8 border-rose-500/30 text-rose-400', selectedTable.status === 'occupied' && 'bg-rose-500/20')}
                >
                  Occupé
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedTable.id, 'reserved')}
                  className={cn('text-xs h-8 border-cyan-500/30 text-cyan-400', selectedTable.status === 'reserved' && 'bg-cyan-500/20')}
                >
                  Réservé
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedTable.id, 'cleaning')}
                  className={cn('text-xs h-8 border-amber-500/30 text-amber-400', selectedTable.status === 'cleaning' && 'bg-amber-500/20')}
                >
                  Nettoyage
                </Button>
              </div>
            </div>

            {/* Details panel */}
            <ScrollArea className="flex-1 border border-white/5 rounded-xl bg-slate-950/50 p-3">
              {selectedTable.status === 'occupied' && activeOrderDetails ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Receipt className="h-4 w-4 text-primary" />
                    <span>Facture #{activeOrderDetails.invoice_number}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <User className="h-4 w-4 text-primary" />
                    <span>Serveur : {activeOrderDetails.waiter_id || '—'}</span>
                  </div>

                  <div className="border-t border-white/10 pt-2 flex flex-col gap-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">
                      Plats Commandés
                    </span>
                    {activeOrderDetails.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs py-1 border-b border-white/5">
                        <span className="text-slate-200 truncate pr-2">
                          {item.product_name || 'Plat'}
                        </span>
                        <span className="text-primary font-black shrink-0">
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/10 pt-2 flex justify-between font-black text-sm">
                    <span className="text-slate-300">Total :</span>
                    <span className="text-primary">{activeOrderDetails.total_price || 0} F CFA</span>
                  </div>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-xs text-muted-foreground text-center">
                  {selectedTable.status === 'available'
                    ? 'Table disponible pour une nouvelle commande.'
                    : 'Aucune commande active sur cette table.'}
                </div>
              )}
            </ScrollArea>

            {/* Redirection actions */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => handleTakeOrder(selectedTable.table_number)}
                className="bg-primary text-black font-black uppercase text-xs tracking-wider h-10 w-full gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Prendre Commande
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteTable(selectedTable.id)}
                className="bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white font-black uppercase text-xs tracking-wider h-10 w-full gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer Table
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <Navigation className="h-8 w-8 text-white/20" />
            <p className="text-sm">Sélectionnez une table pour afficher ses détails ou prendre une commande.</p>
          </div>
        )}
      </div>
    </div>
  );
}
