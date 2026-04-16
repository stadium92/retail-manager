import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Edit2, Trash2, FolderTree, ChevronRight } from 'lucide-react';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useMasterDataStore, ProductFamily } from '@/stores/useMasterDataStore';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface FichiersFamillesModuleProps {
  storeId: string;
}

export function FichiersFamillesModule({ storeId }: FichiersFamillesModuleProps) {
  const { t } = useTranslation();
  const { supabase, isLocalFirst, localBridgeBaseUrl } = getDataClient();
  const { families, setFamilies, deleteFamily, setLoading } = useMasterDataStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<ProductFamily | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: '',
  });

  const useLocalBridge = isLocalFirst;

  const localBridgeRequest = async <T,>(path: string, init: RequestInit = {}) => {
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
  };

  useEffect(() => {
    if (!storeId) {
      setFamilies([]);
      return;
    }
    fetchFamilies();
  }, [storeId, useLocalBridge]);

  const fetchFamilies = async () => {
    if (!storeId) return;
    setLoading(true);
    setIsFetching(true);
    try {
      const { data, error } = await OfflineInventoryService.getProductFamilies(storeId);

      if (error) {
        throw error;
      }

      if (data) {
        const mapped = data.map(f => ({
          id: f.id,
          name: f.name,
          description: f.description,
          parent_id: f.parent_id,
          store_id: f.store_id,
          created_at: f.created_at,
          updated_at: f.updated_at
        }));
        setFamilies(mapped as ProductFamily[]);
      }
    } catch (error: any) {
      console.error('Failed to fetch product families', error);
      toast({ title: t('common.error'), description: error.message || t('common.failedToLoad'), variant: 'destructive' });
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  const filteredFamilies = useMemo(() => {
    return families.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [families, searchQuery]);

  // Build hierarchy for display
  const parentFamilies = useMemo(() => families.filter((f) => !f.parent_id), [families]);

  const getChildren = (parentId: string) => families.filter((f) => f.parent_id === parentId);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: t('common.error'), description: t('inventory.fields.name'), variant: 'destructive' });
      return;
    }
    if (!storeId) {
      toast({ title: t('common.error'), description: t('inventory.errors.authRequired'), variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      parent_id: formData.parent_id || null,
      store_id: storeId,
    };

    try {
      if (useLocalBridge) {
        if (editingFamily) {
          await localBridgeRequest(`/rest/v1/product_families/${editingFamily.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: payload.name,
              description: payload.description,
              parent_id: payload.parent_id,
            }),
          });
          toast({ title: t('common.success'), description: t('menu.program.editFamily') });
        } else {
          await localBridgeRequest(`/rest/v1/product_families`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          toast({ title: t('common.success'), description: t('menu.program.newFamily') });
        }
        await fetchFamilies();
        setIsDialogOpen(false);
        resetForm();
        return;
      }

      if (editingFamily) {
        const { error } = await supabase
          .from('product_families')
          .update(payload)
          .eq('id', editingFamily.id)
          .eq('store_id', storeId);

        if (error) throw error;
        toast({ title: t('common.success'), description: t('menu.program.editFamily') });
      } else {
        const { error } = await supabase
          .from('product_families')
          .insert(payload);

        if (error) throw error;
        toast({ title: t('common.success'), description: t('menu.program.newFamily') });
      }

      await fetchFamilies();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Failed to save family', error);
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (family: ProductFamily) => {
    setEditingFamily(family);
    setFormData({
      name: family.name,
      description: family.description || '',
      parent_id: family.parent_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleDeleteFamily = async (id: string) => {
    if (!confirm(t('inventory.deleteConfirm'))) return;
    setDeletingId(id);
    try {
      if (useLocalBridge) {
        await localBridgeRequest(`/rest/v1/product_families/${id}`, { method: 'DELETE' });
        deleteFamily(id);
        toast({ title: t('common.success') });
        return;
      }

      const { error } = await supabase
        .from('product_families')
        .delete()
        .eq('id', id)
        .eq('store_id', storeId);

      if (error) throw error;

      deleteFamily(id);
      toast({ title: t('common.success') });
    } catch (error: any) {
      console.error('Failed to delete family', error);
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    setEditingFamily(null);
    setFormData({ name: '', description: '', parent_id: '' });
  };

  const renderFamilyRow = (family: ProductFamily, level: number = 0) => {
    const children = getChildren(family.id);
    return (
      <React.Fragment key={family.id}>
        <TableRow>
          <TableCell>
            <div className="flex items-center" style={{ paddingLeft: `${level * 24}px` }}>
              {level > 0 && <ChevronRight className="h-4 w-4 mr-1 text-muted-foreground" />}
              <FolderTree className="h-4 w-4 mr-2 text-primary" />
              <span className="font-medium">{family.name}</span>
            </div>
          </TableCell>
          <TableCell className="text-muted-foreground">{family.description || '-'}</TableCell>
          <TableCell className="text-center">
            <Badge variant="outline">{children.length} {t('menu.program.subFamilies')}</Badge>
          </TableCell>
          <TableCell className="text-center">
            <div className="flex justify-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => handleEdit(family)}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteFamily(family.id)}
                disabled={deletingId === family.id}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {children.map((child) => renderFamilyRow(child, level + 1))}
      </React.Fragment>
    );
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
          <Plus className="h-4 w-4 mr-2" /> {t('menu.program.newFamily')}
        </Button>
      </div>

      {/* Families Table */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>{t('inventory.table.name')}</TableHead>
                <TableHead>{t('inventory.fields.description')}</TableHead>
                <TableHead className="text-center">{t('menu.program.subFamilies')}</TableHead>
                <TableHead className="text-center">{t('inventory.table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchQuery
                ? filteredFamilies.map((f) => renderFamilyRow(f))
                : parentFamilies.map((f) => renderFamilyRow(f))}
              {!isFetching && (searchQuery ? filteredFamilies : parentFamilies).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <FolderTree className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              )}
              {isFetching && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Family Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              {editingFamily ? t('menu.program.editFamily') : t('menu.program.newFamily')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t('inventory.fields.name')} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('inventory.fields.name')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('inventory.fields.description')}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder="..."
              />
            </div>

            <div className="space-y-2">
              <Label>{t('menu.program.familyParent')}</Label>
              <Select
                value={formData.parent_id || "none"}
                onValueChange={(v) => setFormData((f) => ({ ...f, parent_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('menu.program.rootFamily')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('menu.program.rootFamily')}</SelectItem>
                  {families
                    .filter((f) => f.id !== editingFamily?.id)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t('common.loading') : editingFamily ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React from 'react';