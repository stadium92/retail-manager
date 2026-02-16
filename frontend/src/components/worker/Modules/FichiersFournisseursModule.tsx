import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Edit2, Trash2, Truck, Phone, Mail, Clock, History } from 'lucide-react';
import { useMasterDataStore, Supplier } from '@/stores/useMasterDataStore';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

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
    });
    setIsDialogOpen(true);
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
    });
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              {editingSupplier ? t('menu.program.editSupplier') : t('menu.program.newSupplier')}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">{t('dashboard.tabs.overview')}</TabsTrigger>
              <TabsTrigger value="history">{t('menu.program.history')}</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('inventory.fields.name')} *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t('inventory.fields.name')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('menu.program.supplierContact')}</Label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData((f) => ({ ...f, contact_person: e.target.value }))}
                    placeholder="..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('stores.fields.phone')}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+223..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('auth.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('stores.address')}</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                  placeholder="..."
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {t('menu.program.leadTimeDays')}
                </Label>
                <Input
                  type="number"
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData((f) => ({ ...f, lead_time_days: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4" /> {t('menu.program.history')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {t('common.loading')}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>
              {editingSupplier ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}