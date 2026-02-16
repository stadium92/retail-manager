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
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    try {
      await activate(key, storeName);
      toast.success("Application activée avec succès !");
      setOpen(false);
    } catch (error) {
      toast.error(error as string || "Clé d'activation invalide");
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
            ACTIVATION REQUISE
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Votre période d'essai de 30 jours est terminée. 
            Veuillez activer votre licence pour continuer sans interruption.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">ID Appareil:</span>
            <span className="font-bold">{deviceHash}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="key">Clé d'Activation</Label>
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
            <Label htmlFor="store">Nom du Magasin</Label>
            <Input
              id="store"
              placeholder="Ex: Ma Boutique"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1">
            Continuer sans clé
          </Button>
          <Button onClick={handleActivate} disabled={loading} className="flex-1 btn-neon">
            {loading ? "Activation..." : "Activer"}
          </Button>
        </DialogFooter>

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            Pas encore de clé ? <Button variant="link" className="h-auto p-0 text-xs">Contactez le support</Button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
