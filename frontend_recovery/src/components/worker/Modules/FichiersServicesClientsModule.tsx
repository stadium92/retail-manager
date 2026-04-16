import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Edit2, Trash2, Tags, Percent } from 'lucide-react';
import { useMasterDataStore, ClientService } from '@/stores/useMasterDataStore';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';

interface FichiersServicesClientsModuleProps {
  storeId: string;
}

export function FichiersServicesClientsModule({ storeId }: FichiersServicesClientsModuleProps) {
  const { t } = useTranslation();
  const { services, addService, updateService, deleteService, clients } = useMasterDataStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ClientService | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    default_discount_percent: 0,
  });
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
  const useLocalBridge = isLocalFirst;

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
    let payload: any = null;
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

  const filteredServices = useMemo(() => {
    return services.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [services, searchQuery]);

  // Count clients per service
  const clientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach((c) => {
      if (c.service_id) {
        counts[c.service_id] = (counts[c.service_id] || 0) + 1;
      }
    });
    return counts;
  }, [clients]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: t('common.error'), description: t('inventory.fields.name'), variant: 'destructive' });
      return;
    }

    const serviceData = {
      store_id: storeId,
      name: formData.name,
      default_discount_percent: formData.default_discount_percent,
    };

    if (useLocalBridge) {
      try {
        if (editingService) {
          const updated = await localBridgeRequest<ClientService>(`/rest/v1/client_services/${editingService.id}`, {
            method: 'PATCH',
            body: JSON.stringify(serviceData),
          });
          updateService(editingService.id, updated);
          toast({ title: t('common.success'), description: t('menu.program.editGroup') });
        } else {
          const created = await localBridgeRequest<ClientService>(`/rest/v1/client_services`, {
            method: 'POST',
            body: JSON.stringify(serviceData),
          });
          addService(created);
          toast({ title: t('common.success'), description: t('menu.program.newGroup') });
        }
      } catch (error) {
        console.error('Service save error:', error);
        toast({ title: t('common.error'), variant: 'destructive' });
      }
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (service: ClientService) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      default_discount_percent: service.default_discount_percent || 0,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const clientsInGroup = clientCounts[id] || 0;
    if (clientsInGroup > 0) {
      toast({ 
        title: t('common.error'), 
        description: `${clientsInGroup} ${t('common.itemsSelected')}`, 
        variant: 'destructive' 
      });
      return;
    }
    if (!confirm(t('inventory.deleteConfirm'))) return;
    
    if (useLocalBridge) {
      try {
        await localBridgeRequest(`/rest/v1/client_services/${id}`, { method: 'DELETE' });
        deleteService(id);
        toast({ title: t('common.success') });
      } catch (error) {
        console.error('Service delete error:', error);
        toast({ title: t('common.error'), variant: 'destructive' });
      }
    }
  };

  const resetForm = () => {
    setEditingService(null);
    setFormData({ name: '', default_discount_percent: 0 });
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
          <Plus className="h-4 w-4 mr-2" /> {t('menu.program.newGroup')}
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-3">
          <Tags className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            {t('menu.program.groupDescription')}
          </p>
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t('menu.program.clientGroup')}</TableHead>
                <TableHead className="text-center">{t('menu.program.defaultDiscount')}</TableHead>
                <TableHead className="text-center">{t('menu.program.clientCount')}</TableHead>
                <TableHead className="text-center">{t('inventory.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map((service, idx) => (
                <TableRow key={service.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Tags className="h-4 w-4 text-primary" />
                      {service.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="gap-1">
                      <Percent className="h-3 w-3" />
                      {service.default_discount_percent || 0}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">
                      {clientCounts[service.id] || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(service)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredServices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <Tags className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Service Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              {editingService ? t('menu.program.editGroup') : t('menu.program.newGroup')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('menu.program.clientGroup')} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                placeholder="..."
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Percent className="h-4 w-4" /> {t('menu.program.defaultDiscount')}
              </Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.default_discount_percent}
                onChange={(e) => setFormData((f) => ({ ...f, default_discount_percent: Number(e.target.value) }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>
              {editingService ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}