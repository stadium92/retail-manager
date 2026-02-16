import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Card, 
  CardContent, 
  CardHeader, 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { ScrollText, Search, User, Loader2, AlertCircle } from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  user_id?: string;
  action_type: string;
  entity_affected?: string;
  entity_id?: string;
  old_value?: string;
  new_value?: string;
  ip_address?: string;
  store_id?: string;
}

export default function AuditLogsPage() {
  const { t, i18n } = useTranslation();
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { isLocalFirst, localBridgeBaseUrl } = getDataClient();

      const { data, isLoading, error } = useQuery({
        queryKey: ['audit-logs', actionFilter],
        queryFn: async () => {
          try {
            const headers = await OfflineAuthService.getAuthHeaders();
            const params = new URLSearchParams();
            if (actionFilter !== 'all') params.set('action_type', actionFilter);
            params.set('limit', '100');
  
            const response = await fetch(`${localBridgeBaseUrl}/rest/v1/audit_logs?${params.toString()}`, {
              headers: headers || {}
            });
            
            if (!response.ok) {
              const errBody = await response.json().catch(() => ({}));
              throw new Error(errBody.message || 'Failed to fetch logs');
            }
            return response.json() as Promise<{ data: AuditLog[], total: number }>;
          } catch (err: any) {
            console.error('Audit logs fetch error:', err);
            throw err;
          }
        },
        enabled: isLocalFirst,
        retry: 1
      });
  
      const filteredLogs = data?.data?.filter(log => 
        (log.action_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.user_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.entity_affected || '').toLowerCase().includes(searchQuery.toLowerCase())
      ) || [];
  
      const getLocale = () => {
        if (i18n.language === 'fr' || i18n.language === 'bm') return fr;
        return enUS;
      };

      const formatLogDate = (timestamp: string) => {
        try {
          if (!timestamp) return '—';
          const date = new Date(timestamp);
          if (isNaN(date.getTime())) return 'Invalid date';
          return format(date, 'PPp', { locale: getLocale() });
        } catch (err) {
          return 'Invalid date';
        }
      };
  const getActionBadgeClass = (action: string) => {
    if (action.includes('delete')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (action.includes('login')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (action.includes('price')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
  };

  const translateAction = (action: string) => {
    switch (action) {
      case 'user_login': return t('audit.login');
      case 'price_change': return t('audit.priceChange');
      case 'inventory_movement': return t('audit.inventory');
      case 'sale_deletion': return t('audit.saleDeletion');
      default: return action;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ScrollText className="h-8 w-8 text-primary" />
            {t('sidebar.systemLogs')}
          </h1>
          <p className="text-muted-foreground">
            {t('analytics.description')}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder={t('audit.actionType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="user_login">{t('audit.login')}</SelectItem>
                  <SelectItem value="price_change">{t('audit.priceChange')}</SelectItem>
                  <SelectItem value="inventory_movement">{t('audit.inventory')}</SelectItem>
                  <SelectItem value="sale_deletion">{t('audit.saleDeletion')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">{t('storeDetails.sales.table.date')}</TableHead>
                  <TableHead>{t('sidebar.team')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                  <TableHead>{t('inventory.table.name')}</TableHead>
                  <TableHead>{t('common.unknown')}</TableHead>
                </TableRow>
              </TableHeader>
                              <TableBody>
                                {isLoading ? (
                                  <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                      {t('common.loading')}
                                    </TableCell>
                                  </TableRow>
                                ) : error ? (
                                  <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-destructive">
                                      <AlertCircle className="h-6 w-6 mx-auto mb-2" />
                                      {error instanceof Error ? error.message : 'Error loading logs'}
                                    </TableCell>
                                  </TableRow>
                                ) : filteredLogs.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                      {t('common.noData')}
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  filteredLogs.map((log) => (
                                    <TableRow key={log.id}>
                                      <TableCell className="font-mono text-xs">
                                        {formatLogDate(log.timestamp)}
                                      </TableCell>                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs truncate max-w-[120px]">{log.user_id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${getActionBadgeClass(log.action_type)}`}>
                          {translateAction(log.action_type)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.entity_affected} ({log.entity_id?.slice(0, 8)})
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                        {log.old_value && `${t('audit.old')}: ${log.old_value}`}
                        {log.new_value && ` | ${t('audit.new')}: ${log.new_value}`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}