import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { LicenseService, LicenseStatus } from "@/services/LicenseService";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ActivationDialogProps {
    status: LicenseStatus;
    onActivated: () => void;
}

export function ActivationDialog({ status, onActivated }: ActivationDialogProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [key, setKey] = useState('');
    const [storeName, setStoreName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deviceHash, setDeviceHash] = useState(status.device_hash);

    useEffect(() => {
        if (status.status === 'expired') {
            setOpen(true);
        }
    }, [status]);

    const handleActivate = async () => {
        if (!key || !storeName) {
            toast.error(t('common.error'), { description: t('license.fillAllFieldsError') });
            return;
        }

        setIsSubmitting(true);
        try {
            await LicenseService.activate(key, storeName);
            toast.success(t('common.success'), { description: t('license.activatedSuccessDesc') });
            setOpen(false);
            onActivated();
        } catch (error: any) {
            toast.error(t('common.error'), { description: error.message || t('license.activationFailed') });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={status.status === 'expired' ? undefined : setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                        <ShieldAlert className="h-6 w-6 text-amber-600" />
                    </div>
                    <DialogTitle className="text-center text-xl">{t('license.activationRequired')}</DialogTitle>
                    <DialogDescription className="text-center">
                        {t('license.trialExpiredShort')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="p-3 bg-muted rounded-lg border flex items-center justify-between">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('license.deviceIdShort')}</div>
                        <code className="text-sm font-bold bg-background px-2 py-0.5 rounded border">{deviceHash}</code>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="store_name">{t('license.storeName')}</Label>
                        <Input
                            id="store_name"
                            placeholder={t('license.storePlaceholder')}
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="key">{t('license.activationKey')}</Label>
                        <Input
                            id="key"
                            placeholder="RM-YYYY-SSSS-HHHH-VVVV"
                            value={key}
                            onChange={(e) => setKey(e.target.value.toUpperCase())}
                        />
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-col gap-2">
                    <Button 
                        onClick={handleActivate} 
                        className="w-full" 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? t('license.activatingDots') : t('license.activateNow')}
                    </Button>
                    <Button 
                        variant="ghost" 
                        onClick={() => setOpen(false)} 
                        className="w-full text-muted-foreground"
                    >
                        {t('license.continueWithoutKeyShort')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
