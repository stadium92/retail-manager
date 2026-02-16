import { useState, useEffect } from 'react';
import { InvitationService, WorkerInvitation } from '@/services/InvitationService';
import { StoreService } from '@/services/StoreService';
import { Store } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, RefreshCw, XCircle, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

export default function InvitationsPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatDate } = useFormatters();
  const [invitations, setInvitations] = useState<WorkerInvitation[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role: 'worker' as 'worker' | 'deliverer',
    store_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    const [invitationsResult, storesResult] = await Promise.all([
      InvitationService.getInvitations(),
      StoreService.getStores(),
    ]);

    if (invitationsResult.error) {
      toast({
        title: t('common.error'),
        description: t('invitations.errors.loadInvitations'),
        variant: 'destructive',
      });
    } else {
      setInvitations(invitationsResult.data || []);
    }

    if (!storesResult.error) {
      setStores(storesResult.data || []);
    }

    setLoading(false);
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { data, error } = await InvitationService.createInvitation({
      email: formData.email,
      role: formData.role,
      store_id: formData.store_id || undefined,
    });

    if (error) {
      toast({
        title: t('common.error'),
        description: t('invitations.errors.createInvitation'),
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('common.success'),
        description: t('invitations.success.created'),
      });
      setDialogOpen(false);
      setFormData({ email: '', role: 'worker', store_id: '' });
      loadData();
    }

    setSubmitting(false);
  };

  const handleResend = async (id: string) => {
    const { error } = await InvitationService.resendInvitation(id);
    
    if (error) {
      toast({
        title: t('common.error'),
        description: t('invitations.errors.resendInvitation'),
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('common.success'),
        description: t('invitations.success.resent'),
      });
    }
  };

  const handleCancel = async (id: string) => {
    const { error } = await InvitationService.cancelInvitation(id);
    
    if (error) {
      toast({
        title: t('common.error'),
        description: t('invitations.errors.cancelInvitation'),
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('common.success'),
        description: t('invitations.success.cancelled'),
      });
      loadData();
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    if (status === 'accepted') {
      return <Badge variant="default">{t('invitations.status.accepted')}</Badge>;
    }
    if (status === 'cancelled') {
      return <Badge variant="destructive">{t('invitations.status.cancelled')}</Badge>;
    }
    if (new Date(expiresAt) < new Date()) {
      return <Badge variant="secondary">{t('invitations.status.expired')}</Badge>;
    }
    return <Badge variant="outline">{t('invitations.status.pending')}</Badge>;
  };

  if (loading) {
    return (
      <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('invitations.title')}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              Offline Construction
            </Badge>
            <p className="text-muted-foreground">{t('invitations.description')}</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              {t('invitations.actions.invite')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateInvitation}>
              <DialogHeader>
                <DialogTitle>{t('invitations.dialog.title')}</DialogTitle>
                <DialogDescription>
                  {t('invitations.dialog.description')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('invitations.form.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('invitations.form.emailPlaceholder')}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">{t('invitations.form.role')}</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: 'worker' | 'deliverer') =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('invitations.form.selectRole')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="worker">{t('invitations.roles.worker')}</SelectItem>
                      <SelectItem value="deliverer">{t('invitations.roles.deliverer')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store">{t('invitations.form.store')}</Label>
                  <Select
                    value={formData.store_id}
                    onValueChange={(value) => setFormData({ ...formData, store_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('invitations.form.selectStore')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('invitations.form.noStore')}</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? t('invitations.actions.sending') : t('invitations.actions.send')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('invitations.cards.allTitle')}
          </CardTitle>
          <CardDescription>
            {t('invitations.cards.total', { count: invitations.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('invitations.emptyState')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('invitations.table.email')}</TableHead>
                    <TableHead>{t('invitations.table.role')}</TableHead>
                    <TableHead>{t('invitations.table.status')}</TableHead>
                    <TableHead>{t('invitations.table.expires')}</TableHead>
                    <TableHead>{t('invitations.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell className="capitalize">{invitation.role}</TableCell>
                      <TableCell>{getStatusBadge(invitation.status, invitation.expires_at)}</TableCell>
                      <TableCell>
                        {formatDate(invitation.expires_at)}
                      </TableCell>
                      <TableCell>
                        {invitation.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResend(invitation.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(invitation.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
