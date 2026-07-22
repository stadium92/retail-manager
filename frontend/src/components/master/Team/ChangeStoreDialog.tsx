import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { OfflineTeamService, TeamMember } from '@/services/OfflineTeamService';
import { Store } from '@/types';

interface ChangeStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  stores: Store[];
  onSuccess: () => void;
}

export function ChangeStoreDialog({ open, onOpenChange, member, stores, onSuccess }: ChangeStoreDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [storeId, setStoreId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (member) setStoreId(member.store_id || '');
  }, [member]);

  const handleConfirm = async () => {
    if (!member || !storeId) return;
    setSubmitting(true);
    try {
      const { success, error } = await OfflineTeamService.updateWorkerStore(member.id, storeId);
      if (!success) {
        toast({
          title: t('common.error'),
          description: error?.message || t('team.errors.changeStore'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('common.success'),
          description: t('team.success.changeStore'),
        });
        onSuccess();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t('team.dialog.changeStoreTitle')}</DialogTitle>
          <DialogDescription>
            {t('team.dialog.changeStoreDescription', { name: member?.full_name })}
          </DialogDescription>
        </DialogHeader>

        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger>
            <SelectValue placeholder={t('team.form.selectStore')} />
          </SelectTrigger>
          <SelectContent>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !storeId || storeId === member?.store_id}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
