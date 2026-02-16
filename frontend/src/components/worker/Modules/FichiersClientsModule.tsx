import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Edit2, Trash2, Users, Phone, Mail, CreditCard } from 'lucide-react';
import { useMasterDataStore, Client } from '@/stores/useMasterDataStore';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface FichiersClientsModuleProps {
  storeId: string;
}

export function FichiersClientsModule({ storeId }: FichiersClientsModuleProps) {
  const { t, i18n } = useTranslation();
  const { clients, setClients, services, setServices, setLoading } = useMasterDataStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: 0,
    service_id: '',
  });

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(i18n.language === 'bm' ? 'fr-ML' : i18n.language) + ' XAF';
  };

  useEffect(() => {
    if (storeId) {
      fetchClients();
      fetchServices();
    }
  }, [storeId]);

  const fetchClients = async () => {
    setLoading(true);
    setLoading(false);
  };

  const fetchServices = async () => {
    // Placeholder for client services/groups
    setServices([
      { id: 'vip', name: 'VIP', default_discount_percent: 10, store_id: storeId, created_at: '', updated_at: '' },
      { id: 'gros', name: 'Grossiste', default_discount_percent: 15, store_id: storeId, created_at: '', updated_at: '' },
      { id: 'public', name: 'Public', default_discount_percent: 0, store_id: storeId, created_at: '', updated_at: '' },
    ]);
  };

  const filteredClients = useMemo(() => {
    return clients.filter((c) =>
      c.store_id === storeId && (
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.code?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [clients, searchQuery, storeId]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: t('common.error'), description: t('inventory.fields.name'), variant: 'destructive' });
      return;
    }

    const newClient: Client = {
      id: editingClient?.id || crypto.randomUUID(),
      name: formData.name,
      code: formData.code || `CLI${Date.now().toString(36).toUpperCase()}`,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      credit_limit: formData.credit_limit,
      current_balance: editingClient?.current_balance || 0,
      service_id: formData.service_id,
      store_id: storeId,
      created_at: editingClient?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (editingClient) {
      useMasterDataStore.getState().updateClient(editingClient.id, newClient);
      toast({ title: t('common.success'), description: t('menu.program.editClient') });
    } else {
      useMasterDataStore.getState().addClient(newClient);
      toast({ title: t('common.success'), description: t('menu.program.newClient') });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      code: client.code || '',
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      credit_limit: client.credit_limit || 0,
      service_id: client.service_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm(t('inventory.deleteConfirm'))) return;
    useMasterDataStore.getState().deleteClient(id);
    toast({ title: t('common.success') });
  };

  const resetForm = () => {
    setEditingClient(null);
    setFormData({
      name: '', code: '', phone: '', email: '', address: '', credit_limit: 0, service_id: '',
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
          <Plus className="h-4 w-4 mr-2" /> {t('menu.program.newClient')}
        </Button>
      </div>

      {/* Clients Table */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t('menu.program.clientCode')}</TableHead>
                <TableHead>{t('inventory.table.name')}</TableHead>
                <TableHead>{t('stores.fields.phone')}</TableHead>
                <TableHead>{t('menu.program.clientGroup')}</TableHead>
                <TableHead className="text-right">{t('menu.program.creditLimit')}</TableHead>
                <TableHead className="text-right">{t('menu.program.balance')}</TableHead>
                <TableHead className="text-center">{t('inventory.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client, idx) => {
                const service = services.find((s) => s.id === client.service_id);
                const isOverLimit = client.current_balance > (client.credit_limit || 0);
                return (
                  <TableRow key={client.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{client.code}</TableCell>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      {client.phone && (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" /> {client.phone}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {service && <Badge variant="outline">{service.name}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(client.credit_limit || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={isOverLimit ? 'destructive' : 'secondary'}>
                        {formatCurrency(client.current_balance)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(client)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredClients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Client Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {editingClient ? t('menu.program.editClient') : t('menu.program.newClient')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
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
                <Label>{t('menu.program.clientCode')}</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value }))}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('menu.program.clientGroup')}</Label>
                <Select
                  value={formData.service_id}
                  onValueChange={(v) => setFormData((f) => ({ ...f, service_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.search')} />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.default_discount_percent}% {t('pos.grid.headers.discount')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4" /> {t('menu.program.creditLimit')}
                </Label>
                <Input
                  type="number"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData((f) => ({ ...f, credit_limit: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>
              {editingClient ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}