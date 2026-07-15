import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { OfflineTeamService } from '@/services/OfflineTeamService';
import { Store } from '@/types';

const workerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(4, 'Password must be at least 4 characters'),
  phone: z.string().optional(),
  store_id: z.string().optional(),
  sub_role: z.enum(['cook', 'cashier', 'waiter', '']).optional(),
});

type WorkerFormData = z.infer<typeof workerSchema>;

interface AddWorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: Store[];
  onSuccess: () => void;
}

export function AddWorkerDialog({ open, onOpenChange, stores, onSuccess }: AddWorkerDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      phone: '',
      store_id: '',
      sub_role: '',
    },
  });

  const onSubmit = async (data: WorkerFormData) => {
    setSubmitting(true);
    try {
      const { error } = await OfflineTeamService.createUser({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone: data.phone || undefined,
        role: 'worker',
        sub_role: data.sub_role === '' ? undefined : (data.sub_role as any),
        store_id: data.store_id === 'none' ? undefined : data.store_id,
        store_name: data.store_id === 'none' ? undefined : (stores.find((s) => s.id === data.store_id)?.name || undefined),
      });

      if (error) {
        toast({
          title: t('common.error'),
          description: error.message || t('team.errors.createWorker'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('common.success'),
          description: t('team.success.createWorker'),
        });
        form.reset();
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('team.errors.createWorker'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('team.dialog.addWorkerTitle')}</DialogTitle>
          <DialogDescription>{t('team.dialog.addWorkerDescription')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.form.fullName')} *</FormLabel>
                  <FormControl>
                    <Input placeholder={t('team.form.fullNamePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.form.email')} *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder={t('team.form.emailPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.form.password')} *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={t('team.form.passwordPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.form.phone')}</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder={t('team.form.phonePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="store_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.form.assignStore')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('team.form.selectStore')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('team.form.noStore')}</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sub_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rôle Resto</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Aucun (Tout voir)</SelectItem>
                      <SelectItem value="cashier">Caissier / Cashier</SelectItem>
                      <SelectItem value="cook">Cuisinier / Cook</SelectItem>
                      <SelectItem value="waiter">Serveur / Waiter</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
