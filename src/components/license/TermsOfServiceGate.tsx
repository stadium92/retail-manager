import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Scale, Lock } from 'lucide-react';

import { getDataClient } from '@/lib/dataClient';

interface TermsOfServiceGateProps {
  children: React.ReactNode;
}

export function TermsOfServiceGate({ children }: TermsOfServiceGateProps) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const dc = getDataClient();
    if (!dc.isLocalFirst) {
      setAccepted(true);
      setOpen(false);
      return;
    }
    const hasAccepted = localStorage.getItem('jati_terms_accepted');
    if (!hasAccepted) {
      setOpen(true);
    } else {
      setAccepted(true);
    }
  }, []);

  const handleAccept = () => {
    if (checked) {
      localStorage.setItem('jati_terms_accepted', 'true');
      setAccepted(true);
      setOpen(false);
    }
  };

  if (accepted && !isOpen) {
    return <>{children}</>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden border-4 border-primary">
        <DialogHeader className="p-6 bg-primary text-primary-foreground shrink-0">
          <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tighter">
            <ShieldCheck className="h-8 w-8" />
            Djati Technologies SARL
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/80 font-bold">
            Contrat de Licence & Protection des Données
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 font-mono text-sm leading-relaxed bg-muted/30">
          <div className="space-y-6">
            <section>
              <h3 className="font-black flex items-center gap-2 text-primary mb-2">
                <Lock className="h-4 w-4" /> 1. PROPRIÉTÉ INTELLECTUELLE
              </h3>
              <p>Ce logiciel est la propriété exclusive de <strong>Djati Technologies SARL</strong>. Toute tentative de copie, modification ou revente est strictement interdite et passible de poursuites judiciaires.</p>
            </section>

            <section>
              <h3 className="font-black flex items-center gap-2 text-primary mb-2">
                <ShieldCheck className="h-4 w-4" /> 2. PROTECTION DE VOTRE VIE PRIVÉE
              </h3>
              <p>Nous respectons votre secret commercial. Djati Technologies <strong>ne collecte JAMAIS</strong> vos prix d'achat, vos prix de vente, vos bénéfices ou vos chiffres d'affaires détaillés.</p>
              <p className="mt-2 text-xs italic">Seules les désignations de produits et noms de catégories sont synchronisées pour améliorer les performances de votre assistant intelligent.</p>
            </section>

            <section>
              <h3 className="font-black flex items-center gap-2 text-primary mb-2">
                <Scale className="h-4 w-4" /> 3. RESPONSABILITÉ LIMITÉE
              </h3>
              <p>L'Intelligence Artificielle est une aide à la décision. L'utilisateur est seul responsable de vérifier l'exactitude des stocks et des calculs avant toute validation finale.</p>
              <p className="mt-2 font-bold text-destructive">La responsabilité de Djati Technologies est limitée au montant payé pour la licence.</p>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-background border-t flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="terms" 
              checked={checked} 
              onCheckedChange={(val) => setChecked(!!val)} 
              className="border-primary data-[state=checked]:bg-primary"
            />
            <label
              htmlFor="terms"
              className="text-xs font-black uppercase leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              J'accepte les conditions de licence Djati
            </label>
          </div>
          <Button 
            onClick={handleAccept} 
            disabled={!checked}
            className="px-10 font-black uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            CONFIRMER ET ACCÉDER
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
