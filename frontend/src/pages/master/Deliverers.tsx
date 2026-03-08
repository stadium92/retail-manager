import { useState, useEffect, useCallback } from 'react';
import { Profile, UserRole } from '@/types';
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
import { Truck, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { OfflineTeamService } from '@/services/OfflineTeamService';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';

interface DelivererWithRole {
  profile: Profile;
  role: UserRole;
  deliveryCount: number;
  completedDeliveries: number;
}

export default function DeliverersPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatPercent } = useFormatters();
  const { version } = useMasterDashboardStore();
  const [deliverers, setDeliverers] = useState<DelivererWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDeliverers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await OfflineTeamService.getDeliverers();

    if (error) {
      toast({
        title: t('common.error'),
        description: t('deliverers.errors.loadDeliverers'),
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const deliverersWithData: DelivererWithRole[] = (data || []).map((member) => ({
      profile: {
        id: member.user_id,
        email: member.email,
        full_name: member.full_name,
        phone: member.phone,
        created_at: member.created_at,
        updated_at: member.created_at,
      },
      role: {
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        store_id: member.store_id,
        created_at: member.created_at,
      },
      deliveryCount: member.deliveries_total || 0,
      completedDeliveries: member.deliveries_completed || 0,
    }));

    setDeliverers(deliverersWithData);
    setLoading(false);
  }, [t, toast]);

  useEffect(() => {
    loadDeliverers();
  }, [loadDeliverers, version]);

  if (loading) {
    return (
      <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('deliverers.title')}</h1>
        <p className="text-muted-foreground">{t('deliverers.manageDeliverers')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {t('deliverers.allDeliverers')}
          </CardTitle>
          <CardDescription>
            {t('deliverers.totalDeliverers', { total: deliverers.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deliverers.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {t('deliverers.emptyState')}
              </p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                  <TableRow>
                    <TableHead>{t('deliverers.table.name')}</TableHead>
                    <TableHead>{t('deliverers.table.email')}</TableHead>
                    <TableHead>{t('deliverers.table.phone')}</TableHead>
                    <TableHead>{t('deliverers.table.total')}</TableHead>
                    <TableHead>{t('deliverers.table.completed')}</TableHead>
                    <TableHead>{t('deliverers.table.completionRate')}</TableHead>
                    <TableHead>{t('deliverers.table.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliverers.map((deliverer) => {
                    const completionRate = deliverer.deliveryCount > 0
                      ? (deliverer.completedDeliveries / deliverer.deliveryCount) * 100
                      : 0;
                    
                    return (
                      <TableRow key={deliverer.role.id}>
                        <TableCell className="font-medium">
                          {deliverer.profile.full_name || t('common.unknown')}
                        </TableCell>
                        <TableCell>{deliverer.profile.email || '-'}</TableCell>
                        <TableCell>{deliverer.profile.phone || '-'}</TableCell>
                        <TableCell>{deliverer.deliveryCount}</TableCell>
                        <TableCell>{deliverer.completedDeliveries}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {formatPercent(completionRate)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">{t('deliverers.active')}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
