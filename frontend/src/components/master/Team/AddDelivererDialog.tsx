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
import { TeamService } from '@/services/TeamService';

const VEHICLE_TYPES = ['bike', 'motorbike', 'van', 'truck'] as const;

const delivererSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(4, 'Password must be at least 4 characters'),
  phone: z.string().optional(),
  vehicle_type: z.string().optional(),
});

type DelivererFormData = z.infer<typeof delivererSchema>;

interface AddDelivererDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddDelivererDialog({ open, onOpenChange, onSuccess }: AddDelivererDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<DelivererFormData>({
    resolver: zodResolver(delivererSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      phone: '',
      vehicle_type: '',
    },
  });

  const onSubmit = async (data: DelivererFormData) => {
    setSubmitting(true);
    try {
      const { error } = await TeamService.createUser({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone: data.phone || undefined,
        role: 'deliverer',
        vehicle_type: data.vehicle_type || undefined,
      });

      if (error) {
        toast({
          title: t('common.error'),
          description: error.message || t('team.errors.createDeliverer'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('common.success'),
          description: t('team.success.createDeliverer'),
        });
        form.reset();
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('team.errors.createDeliverer'),
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
          <DialogTitle>{t('team.dialog.addDelivererTitle')}</DialogTitle>
          <DialogDescription>{t('team.dialog.addDelivererDescription')}</DialogDescription>
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
              name="vehicle_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('team.form.vehicleType')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('team.form.selectVehicle')} />
                      </SelectTrigger>
                    </FormControl>
                                          <SelectContent>
                                            <SelectItem value="none">{t('team.form.noVehicle')}</SelectItem>
                                            {VEHICLE_TYPES.map((type) => (                        <SelectItem key={type} value={type}>
                          {t(`team.vehicleTypes.${type}`)}
                        </SelectItem>
                      ))}
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
