import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Edit2, Trash2, Truck, Phone, Mail, Clock, History, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useMasterDataStore, Supplier } from '@/stores/useMasterDataStore';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FichiersFournisseursModuleProps {
  storeId: string;
}

export function FichiersFournisseursModule({ storeId }: FichiersFournisseursModuleProps) {
  const { t, i18n } = useTranslation();
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, setSuppliers } = useMasterDataStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  const useLocalBridge = isLocalFirst;

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' XAF';
  };

  const localBridgeRequest = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    if (!useLocalBridge) {
      throw new Error('LocalBridge mode is not enabled.');
    }
    const headers = await OfflineAuthService.getAuthHeaders();
    if (!headers) {
      throw new Error('LocalBridge session expired. Please sign in again.');
    }
    const response = await fetch(`${localBridgeBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...headers,
      },
    });
    let payload: { message?: string } | null = null;
    if (response.status !== 204) {
      try {
        payload = await response.json();
      } catch (error) {
        // ignore
      }
    }
    if (!response.ok) {
      const message = payload?.message || 'LocalBridge request failed';
      throw new Error(message);
    }
    return payload as T;
  }, [localBridgeBaseUrl, useLocalBridge]);

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    lead_time_days: 0,
    default_purchase_type: 'wholesale',
    price_notes: '',
  });

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [suppliers, searchQuery]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      if (!useLocalBridge || !storeId) return;
      try {
        const data = await localBridgeRequest<Supplier[]>(
          `/rest/v1/suppliers?${new URLSearchParams({ store_id: storeId }).toString()}`
        );
        setSuppliers((data as Supplier[]) || []);
      } catch (error) {
        console.error('LocalBridge fetch suppliers error:', error);
      }
    };

    fetchSuppliers();
  }, [storeId, useLocalBridge, localBridgeRequest, setSuppliers]);

  useEffect(() => {
    if (editingSupplier) {
      loadTransactions();
    }
  }, [editingSupplier]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: t('common.error'), description: t('inventory.fields.name'), variant: 'destructive' });
      return;
    }

    const supplierData: Supplier = {
      id: editingSupplier?.id || crypto.randomUUID(),
      name: formData.name,
      contact_person: formData.contact_person,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      lead_time_days: formData.lead_time_days,
      default_purchase_type: formData.default_purchase_type,
      price_notes: formData.price_notes,
      balance: editingSupplier?.balance || 0,
      store_id: storeId,
      created_at: editingSupplier?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (useLocalBridge) {
      try {
        if (editingSupplier) {
          await localBridgeRequest(`/rest/v1/suppliers/${editingSupplier.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: supplierData.name,
              phone: supplierData.phone ?? null,
              email: supplierData.email ?? null,
              address: supplierData.address ?? null,
              balance: supplierData.balance,
              default_purchase_type: supplierData.default_purchase_type,
              price_notes: supplierData.price_notes,
            }),
          });
          updateSupplier(editingSupplier.id, supplierData);
          toast({ title: t('common.success'), description: t('menu.program.editSupplier') });
        } else {
          const created = await localBridgeRequest<Supplier>(`/rest/v1/suppliers`, {
            method: 'POST',
            body: JSON.stringify({
              store_id: storeId,
              name: supplierData.name,
              phone: supplierData.phone ?? null,
              email: supplierData.email ?? null,
              address: supplierData.address ?? null,
              balance: supplierData.balance,
              default_purchase_type: supplierData.default_purchase_type,
              price_notes: supplierData.price_notes,
            }),
          });
          addSupplier(created as Supplier);
          toast({ title: t('common.success'), description: t('menu.program.newSupplier') });
        }
      } catch (error) {
        console.error('LocalBridge supplier save error:', error);
        toast({ title: t('common.error'), variant: 'destructive' });
      }
    } else if (editingSupplier) {
      updateSupplier(editingSupplier.id, supplierData);
      toast({ title: t('common.success') });
    } else {
      addSupplier(supplierData);
      toast({ title: t('common.success') });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      lead_time_days: supplier.lead_time_days || 0,
      default_purchase_type: supplier.default_purchase_type || 'wholesale',
      price_notes: supplier.price_notes || '',
    });
    setTransactions([]); // Clear previous transactions
    setIsDialogOpen(true);
  };

  const loadTransactions = async () => {
    if (!editingSupplier || !storeId || !useLocalBridge) return;
    setIsLoadingTransactions(true);
    try {
      const data = await localBridgeRequest<any[]>(
        `/rest/v1/supplier_transactions?${new URLSearchParams({ store_id: storeId, supplier_id: editingSupplier.id }).toString()}`
      );
      setTransactions(data || []);
    } catch (error) {
      console.error('Failed to load transactions', error);
      toast({ title: t('common.error'), description: t('common.failedToLoad'), variant: 'destructive' });
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleConfirmPayment = async (paymentId: string, currentStatus: boolean) => {
    if (!useLocalBridge) return;
    try {
      const confirmedAt = currentStatus ? null : new Date().toISOString();
      await localBridgeRequest(`/rest/v1/supplier_payments/${paymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ confirmed_at: confirmedAt }),
      });
      
      setTransactions(prev => prev.map(p => p.id === paymentId ? { ...p, confirmed_at: confirmedAt } : p));
      toast({ title: t('common.success') });
    } catch (error) {
      console.error('Failed to confirm payment', error);
      toast({ title: t('common.error'), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('inventory.deleteConfirm'))) return;
    if (useLocalBridge) {
      try {
        await localBridgeRequest(`/rest/v1/suppliers/${id}`, { method: 'DELETE' });
        deleteSupplier(id);
        toast({ title: t('common.success') });
      } catch (error) {
        console.error('LocalBridge supplier delete error:', error);
        toast({ title: t('common.error'), variant: 'destructive' });
      }
      return;
    }
    deleteSupplier(id);
    toast({ title: t('common.success') });
  };

  const resetForm = () => {
    setEditingSupplier(null);
    setFormData({
      name: '', contact_person: '', phone: '', email: '', address: '', lead_time_days: 0,
      default_purchase_type: 'wholesale', price_notes: '',
    });
    setTransactions([]);
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> {t('menu.program.newSupplier')}
        </Button>
      </div>

      {/* Suppliers Table */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t('inventory.table.name')}</TableHead>
                <TableHead>{t('menu.program.supplierContact')}</TableHead>
                <TableHead>{t('stores.fields.phone')}</TableHead>
                <TableHead>{t('menu.program.leadTimeDays')}</TableHead>
                <TableHead>{t('common.type')}</TableHead>
                <TableHead className="text-right">{t('menu.program.dueBalance')}</TableHead>
                <TableHead className="text-center">{t('inventory.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier, idx) => (
                <TableRow key={supplier.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.contact_person || '-'}</TableCell>
                  <TableCell>
                    {supplier.phone && (
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" /> {supplier.phone}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {supplier.lead_time_days ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" /> {supplier.lead_time_days}j
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px]">{supplier.default_purchase_type || 'WHOLESALE'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={supplier.balance > 0 ? 'destructive' : 'secondary'}>
                      {formatCurrency(supplier.balance)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(supplier)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(supplier.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredSuppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Supplier Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-full w-full h-[95vh] p-0 flex flex-col gap-0 rounded-none sm:rounded-lg sm:max-w-6xl sm:h-auto sm:max-h-[90vh] overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-card shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Truck className="h-6 w-6 text-primary" /> 
              {editingSupplier ? t('menu.program.editSupplier') : t('menu.program.newSupplier')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 bg-background">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Column 1: Identification */}
              <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">{t('inventory.sectionIdentification')}</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold">{t('inventory.fields.name')} *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                      className="h-12 text-lg font-semibold bg-muted/20"
                      placeholder={t('menu.program.supplierNamePlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('menu.program.supplierContact')}</Label>
                    <Input
                      value={formData.contact_person}
                      onChange={(e) => setFormData((f) => ({ ...f, contact_person: e.target.value }))}
                      className="h-10"
                      placeholder={t('menu.program.contactName')}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">{t('stores.fields.phone')}</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                          className="pl-9 h-10 font-mono"
                          placeholder="+223..."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase">{t('auth.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                          className="pl-9 h-10"
                          placeholder="email@fournisseur.com"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('stores.address')}</Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                      className="min-h-[80px]"
                      placeholder="Adresse physique..."
                    />
                  </div>
                </div>
              </div>

              {/* Column 2: Pricing & Conditions */}
              <div className="space-y-6">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground border-b pb-2">{t('menu.program.sectionPricesConditions')}</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('menu.program.defaultPurchaseType')}</Label>
                    <Select 
                      value={formData.default_purchase_type} 
                      onValueChange={(v) => setFormData(f => ({ ...f, default_purchase_type: v }))}
                    >
                      <SelectTrigger className="h-12 bg-primary/5 border-primary/20 font-bold">
                        <SelectValue placeholder={t('menu.program.chooseType')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wholesale">Wholesale ({t('menu.program.wholesaleType')})</SelectItem>
                        <SelectItem value="resale">Resale ({t('menu.program.resaleType')})</SelectItem>
                        <SelectItem value="discount">Discount ({t('menu.program.discountType')})</SelectItem>
                        <SelectItem value="other">{t('menu.program.otherType')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {t('menu.program.leadTimeDays')}
                    </Label>
                    <Input
                      type="number"
                      value={formData.lead_time_days}
                      onChange={(e) => setFormData((f) => ({ ...f, lead_time_days: Number(e.target.value) }))}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">Notes sur les Prix & Accords</Label>
                    <Textarea 
                      value={formData.price_notes} 
                      onChange={(e) => setFormData(f => ({ ...f, price_notes: e.target.value }))}
                      placeholder="Conditions particulières, remises négociées, franco de port..."
                      className="min-h-[150px] bg-muted/10"
                    />
                  </div>
                  
                  {editingSupplier && (
                    <div className="p-6 rounded-2xl bg-destructive/5 border border-destructive/10 mt-4 shadow-inner">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-widest text-destructive/60">{t('common.balanceDue')}:</span>
                        <span className="text-2xl font-black text-destructive">{formatCurrency(editingSupplier.balance)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Transaction History */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">{t('menu.program.sectionHistory')}</h3>
                  {editingSupplier && (
                    <Button variant="ghost" size="sm" onClick={loadTransactions} className="h-6 text-[10px] uppercase font-bold">
                      <RefreshCw className="h-3 w-3 mr-1" /> {t('menu.program.refresh')}
                    </Button>
                  )}
                </div>
                
                <div className="h-[400px] overflow-hidden rounded-xl border border-border/50 bg-muted/5">
                  {!editingSupplier ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                      <History className="h-10 w-10 mb-2 opacity-20" />
                      <p className="text-xs font-medium italic">{t('menu.program.historyAvailableAfterCreate')}</p>
                    </div>
                  ) : isLoadingTransactions ? (
                    <div className="h-full flex items-center justify-center italic text-xs text-muted-foreground">{t('common.loading')}</div>
                  ) : transactions.length === 0 ? (
                    <div className="h-full flex items-center justify-center italic text-xs text-muted-foreground">{t('menu.program.noTransactionsFound')}</div>
                  ) : (
                    <div className="h-full overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-muted/20 sticky top-0 z-10">
                          <TableRow className="h-8">
                            <TableHead className="text-[10px] font-black uppercase">{t('menu.program.date')}</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-right">{t('common.amount')}</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-center">{t('common.type')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map(t => (
                            <TableRow key={t.id} className="h-10 hover:bg-muted/30 transition-colors">
                              <TableCell className="text-[10px] font-mono">{format(new Date(t.created_at), 'dd/MM/yy')}</TableCell>
                              <TableCell className={cn(
                                "text-[10px] text-right font-bold",
                                t.type === 'purchase' ? "text-destructive" : "text-success"
                              )}>
                                {t.type === 'purchase' ? '-' : '+'}{formatCurrency(t.amount)}
                              </TableCell>
                              <TableCell className="text-center">
                                {t.type === 'purchase' ? (
                                  <Badge variant="outline" className="text-[8px] uppercase px-1 h-4">ACHAT</Badge>
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <Badge className="text-[8px] uppercase px-1 h-4 bg-green-500 text-white">PAIE</Badge>
                                    <Switch 
                                      checked={!!t.confirmed_at} 
                                      onCheckedChange={() => handleConfirmPayment(t.id, !!t.confirmed_at)}
                                      className="scale-[0.6]"
                                    />
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t bg-muted/10 flex justify-end gap-4 shrink-0">
            <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)} className="h-12 px-10 font-bold uppercase tracking-widest text-xs">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} className="h-12 px-12 font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-primary/20">
              {editingSupplier ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}