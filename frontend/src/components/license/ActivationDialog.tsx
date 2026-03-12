import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLicense } from "@/contexts/LicenseContext";
import { useTranslation } from "react-i18next";
import { ScrollText, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function ActivationDialog() {
  const { license, activate, getDeviceHash } = useLicense();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [storeName, setStoreName] = useState('');
  const [deviceHash, setDeviceHash] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (license?.status === 'expired') {
      setOpen(true);
    }
    
    getDeviceHash().then(setDeviceHash);
  }, [license]);

  const handleActivate = async () => {
    if (!key || !storeName) {
      alert("Missing Information: Please provide both an Activation Key and a Store Name.");
      toast.error(t('license.fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      await activate(key, storeName);
      toast.success(t('license.activatedSuccess'));
      setOpen(false);
    } catch (error) {
      const msg = (error as Error).message || "Unknown Error";
      alert("ACTIVATION FAILED: \n" + msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!license || license.status === 'active') return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-amber-500" />
            {t('license.required')}
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {t('license.trialExpired')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">{t('license.deviceId')}:</span>
            <span className="font-bold">{deviceHash}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="key">{t('license.activationKey')}</Label>
            <Input
              id="key"
              placeholder="RM-2026-XXXX-XXXX-XXXX"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              className="font-mono uppercase"
            />
            <p className="text-[10px] text-muted-foreground">
              Format: RM-YYYY-SSSS-HHHH-VVVV
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="store">{t('license.storeName')}</Label>
            <Input
              id="store"
              placeholder={t('license.storePlaceholder')}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1">
            {t('license.continueWithoutKey')}
          </Button>
          <Button onClick={handleActivate} disabled={loading} className="flex-1 btn-neon">
            {loading ? t('license.activating') : t('license.activate')}
          </Button>
        </DialogFooter>

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            {t('license.noKey')} <Button variant="link" className="h-auto p-0 text-xs">{t('license.contactSupport')}</Button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
