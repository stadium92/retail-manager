import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Truck, UserPlus, Loader2, Trash2, Building, WifiOff, RefreshCw, Eye, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useFormatters } from '@/utils/formatting';
import { OfflineTeamService, TeamMember } from '@/services/OfflineTeamService';
import { Store } from '@/types';
import { AddWorkerDialog } from '@/components/master/Team/AddWorkerDialog';
import { AddDelivererDialog } from '@/components/master/Team/AddDelivererDialog';
import { ConfirmActionDialog } from '@/components/shared/ConfirmActionDialog';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';

// Slot limits (can be made dynamic later)
const WORKER_SLOT_LIMIT = 10;
const DELIVERER_SLOT_LIMIT = 10;

export default function TeamPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { formatCurrency, formatPercent } = useFormatters();
  const { selectedStoreIds, isAllStoresSelected, version } = useMasterDashboardStore();

  const [workers, setWorkers] = useState<TeamMember[]>([]);
  const [deliverers, setDeliverers] = useState<TeamMember[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('workers');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddDeliverer, setShowAddDeliverer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [viewTarget, setViewTarget] = useState<TeamMember | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [version]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Use OfflineTeamService for offline-first data fetching
      const [workersRes, deliverersRes, storesRes] = await Promise.all([
        OfflineTeamService.getWorkers(),
        OfflineTeamService.getDeliverers(),
        OfflineTeamService.getStores(),
      ]);

      if (workersRes.error) {
        console.error('Failed to load workers:', workersRes.error);
      } else {
        setWorkers(workersRes.data || []);
      }

      if (deliverersRes.error) {
        console.error('Failed to load deliverers:', deliverersRes.error);
      } else {
        setDeliverers(deliverersRes.data || []);
      }

      if (storesRes.error) {
        console.error('Failed to load stores:', storesRes.error);
      } else {
        // Map stores to Store type
        setStores((storesRes.data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          address: s.address,
          phone: s.phone,
          owner_id: s.owner_id,
          default_price_tier: s.default_price_tier || 1,
          created_at: s.created_at,
          updated_at: s.updated_at,
        })));
      }
    } catch (error) {
      console.error('Error loading team data:', error);
      toast({
        title: t('common.error'),
        description: t('team.errors.loadTeam'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!navigator.onLine) {
      toast({
        title: t('common.offline') || 'Offline',
        description: t('common.offlineModeMessage') || 'Cannot refresh while offline',
        variant: 'destructive',
      });
      return;
    }
    setSyncing(true);
    await loadData();
    setSyncing(false);
  };

  const handleDeleteMember = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      // Use OfflineTeamService for offline-first deletion
      const { success, error } = await OfflineTeamService.deleteMember(
        deleteTarget.id,
        deleteTarget.user_id
      );
      
      if (!success) {
        toast({
          title: t('common.error'),
          description: t('team.errors.deleteMember'),
          variant: 'destructive',
        });
      } else {
        // Update local state immediately
        if (deleteTarget.role === 'worker') {
          setWorkers(prev => prev.filter(w => w.id !== deleteTarget.id));
        } else {
          setDeliverers(prev => prev.filter(d => d.id !== deleteTarget.id));
        }
        
        toast({
          title: t('common.success'),
          description: t('team.success.deleteMember'),
        });
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handlePromote = async () => {
    if (!promoteTarget) return;
    setPromoting(true);

    try {
      const response = await OfflineTeamService.updateWorkerRole(promoteTarget.id, 'master');

      if (response.error) {
        toast({
          title: t('common.error'),
          description: response.error.message || 'Failed to promote member',
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('common.success'),
          description: 'Team member promoted to Master successfully.',
        });
        loadData();
      }
    } catch (err) {
      toast({
        title: t('common.error'),
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setPromoting(false);
      setPromoteTarget(null);
    }
  };

  const handleWorkerCreated = () => {
    setShowAddWorker(false);
    loadData();
  };

  const handleDelivererCreated = () => {
    setShowAddDeliverer(false);
    loadData();
  };

  const filteredWorkers = workers.filter(w => {
    const matchesSearch = w.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          w.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStore = isAllStoresSelected || !w.store_id || selectedStoreIds.includes(w.store_id);
    return matchesSearch && matchesStore;
  });

  const filteredDeliverers = deliverers.filter(d => {
    const matchesSearch = d.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStore = isAllStoresSelected || !d.store_id || selectedStoreIds.includes(d.store_id);
    return matchesSearch && matchesStore;
  });

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {isOffline && (
        <div className="flex items-center gap-2 p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-lg">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm">{t('common.offlineMode') || 'Offline mode - showing cached data'}</span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('team.title')}</h1>
          <p className="text-muted-foreground">{t('team.description')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={syncing || isOffline}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {t('common.refresh') || 'Refresh'}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('team.totalWorkers')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workers.length} / {WORKER_SLOT_LIMIT}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('team.slotsAvailable', { count: WORKER_SLOT_LIMIT - workers.length })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('team.totalDeliverers')}</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {deliverers.length} / {DELIVERER_SLOT_LIMIT}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('team.slotsAvailable', { count: DELIVERER_SLOT_LIMIT - deliverers.length })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('workers.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="workers" className="gap-2">
                  <Users className="h-4 w-4" />
                  {t('team.tabs.workers')} ({workers.length})
                </TabsTrigger>
                <TabsTrigger value="deliverers" className="gap-2">
                  <Truck className="h-4 w-4" />
                  {t('team.tabs.deliverers')} ({deliverers.length})
                </TabsTrigger>
              </TabsList>

              {activeTab === 'workers' ? (
                <Button
                  onClick={() => setShowAddWorker(true)}
                  disabled={workers.length >= WORKER_SLOT_LIMIT}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('team.addWorker')}
                </Button>
              ) : (
                <Button
                  onClick={() => setShowAddDeliverer(true)}
                  disabled={deliverers.length >= DELIVERER_SLOT_LIMIT}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('team.addDeliverer')}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {/* Workers Tab */}
            <TabsContent value="workers" className="mt-0">
              {workers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('team.emptyWorkers')}</p>
                </div>
              ) : (
              <div className="overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                    <TableRow>
                      <TableHead>{t('team.table.name')}</TableHead>
                      <TableHead>{t('team.table.email')}</TableHead>
                      <TableHead>{t('team.table.phone')}</TableHead>
                      <TableHead>{t('team.table.role')}</TableHead>
                      <TableHead>{t('team.table.store')}</TableHead>
                      <TableHead>{t('team.table.sales')}</TableHead>
                      <TableHead>{t('team.table.revenue')}</TableHead>
                      <TableHead>{t('team.table.status')}</TableHead>
                      <TableHead className="w-[100px]">{t('team.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkers.map((worker) => (
                      <TableRow key={worker.id}>
                        <TableCell className="font-medium">{worker.full_name}</TableCell>
                        <TableCell>{worker.email}</TableCell>
                        <TableCell>{worker.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {worker.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {worker.store_name ? (
                            <Badge variant="outline" className="gap-1">
                              <Building className="h-3 w-3" />
                              {worker.store_name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{worker.sales_count || 0}</TableCell>
                        <TableCell>{formatCurrency(worker.total_revenue || 0)}</TableCell>
                        <TableCell>
                          <Badge variant={worker.is_active ? 'default' : 'secondary'}>
                            {worker.is_active ? t('team.status.active') : t('team.status.inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewTarget(worker)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {worker.role !== 'master' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPromoteTarget(worker)}
                                title="Promouvoir en Master"
                              >
                                <Shield className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(worker)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              )}
            </TabsContent>

            {/* Deliverers Tab */}
            <TabsContent value="deliverers" className="mt-0">
              {deliverers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('team.emptyDeliverers')}</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                    <TableRow>
                      <TableHead>{t('team.table.name')}</TableHead>
                      <TableHead>{t('team.table.email')}</TableHead>
                      <TableHead>{t('team.table.phone')}</TableHead>
                      <TableHead>{t('team.table.vehicle')}</TableHead>
                      <TableHead>{t('team.table.deliveries')}</TableHead>
                      <TableHead>{t('team.table.completed')}</TableHead>
                      <TableHead>{t('team.table.status')}</TableHead>
                      <TableHead className="w-[100px]">{t('team.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeliverers.map((deliverer) => (
                      <TableRow key={deliverer.id}>
                        <TableCell className="font-medium">{deliverer.full_name}</TableCell>
                        <TableCell>{deliverer.email}</TableCell>
                        <TableCell>{deliverer.phone || '-'}</TableCell>
                        <TableCell>
                          {deliverer.vehicle_type ? (
                            <Badge variant="outline">{deliverer.vehicle_type}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{deliverer.deliveries_total || 0}</TableCell>
                        <TableCell>
                          {deliverer.deliveries_completed || 0}
                          {deliverer.deliveries_total && deliverer.deliveries_total > 0 && (
                            <span className="text-muted-foreground ml-1">
                              ({formatPercent((deliverer.deliveries_completed || 0) / deliverer.deliveries_total * 100)})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={deliverer.is_active ? 'default' : 'secondary'}>
                            {deliverer.is_active ? t('team.status.active') : t('team.status.inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(deliverer)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Add Worker Dialog */}
      <AddWorkerDialog
        open={showAddWorker}
        onOpenChange={setShowAddWorker}
        stores={stores}
        onSuccess={handleWorkerCreated}
      />

      {/* Add Deliverer Dialog */}
      <AddDelivererDialog
        open={showAddDeliverer}
        onOpenChange={setShowAddDeliverer}
        onSuccess={handleDelivererCreated}
      />

      {/* Worker Details Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{viewTarget?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('team.table.email')}</label>
                <div className="text-sm">{viewTarget?.email}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('team.table.phone')}</label>
                <div className="text-sm">{viewTarget?.phone || '-'}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('team.table.store')}</label>
                <div className="text-sm">{viewTarget?.store_name || '-'}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('team.table.role')}</label>
                <div className="text-sm capitalize">{viewTarget?.role}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t('team.table.status')}</label>
                <div>
                  <Badge variant={viewTarget?.is_active ? 'default' : 'secondary'}>
                    {viewTarget?.is_active ? t('team.status.active') : t('team.status.inactive')}
                  </Badge>
                </div>
              </div>
            </div>
            
            {viewTarget?.role === 'worker' && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Performance</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">{t('team.table.sales')}</div>
                    <div className="text-lg font-bold">{viewTarget.sales_count || 0}</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">{t('team.table.revenue')}</div>
                    <div className="text-lg font-bold">{formatCurrency(viewTarget.total_revenue || 0)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleDeleteMember}
        title={t('team.dialogs.deleteTitle')}
        description={t('team.dialogs.deleteDesc')}
        variant="destructive"
      />

      <ConfirmActionDialog
        open={!!promoteTarget}
        onOpenChange={(open) => { if (!open) setPromoteTarget(null); }}
        onConfirm={handlePromote}
        title="Promouvoir au rang de Master"
        description={`Êtes-vous sûr de vouloir promouvoir ${promoteTarget?.full_name} au rôle de Master ? Ce rôle aura un accès complet au tableau de bord Master et à toutes les fonctionnalités d'administration. (Cette action nécessite une synchronisation internet ultérieure pour s'appliquer sur tous les appareils)`}
        confirmText="Promouvoir"
      />
    </div>
  );
}
