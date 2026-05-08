import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Cloud, 
  Database, 
  Check, 
  RefreshCw, 
  Lock, 
  Server,
  Globe,
  Wifi,
  Save
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';

export default function CloudSyncPage() {
  const { t } = useTranslation();
  const [machineId, setMachineId] = useState('');
  const [masterToken, setMasterToken] = useState('');
  const [storeTokens, setStoreTokens] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEnv = async () => {
      try {
        const { localBridgeBaseUrl } = getDataClient();
        const headers = await OfflineAuthService.getAuthHeaders();
        const res = await fetch(`${localBridgeBaseUrl}/rest/v1/system/env`, { headers });
        const data = await res.json();
        
        if (res.ok && data.config) {
          setMachineId(data.config.MACHINE_ID || '');
          setMasterToken(data.config.MASTER_TOKEN || '');
          setStoreTokens(data.config.SYNC_STORE_TOKENS || '');
          
          if (data.config.MACHINE_ID && data.config.MASTER_TOKEN) {
            setConnectionStatus('success');
          }
        }
      } catch (e) {
        console.error('Failed to load cloud config', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEnv();
  }, []);

  const handleSaveConfiguration = async () => {
    if (!machineId || !masterToken) {
      toast.error("Veuillez saisir le Machine ID et le Master Token.");
      return;
    }
    setIsSaving(true);
    try {
      const { localBridgeBaseUrl } = getDataClient();
      const headers = await OfflineAuthService.getAuthHeaders();
      const res = await fetch(`${localBridgeBaseUrl}/rest/v1/system/env`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MACHINE_ID: machineId,
          MASTER_TOKEN: masterToken,
          SYNC_STORE_TOKENS: storeTokens
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Configuration Cloud sauvegardée avec succès !");
        setConnectionStatus('success');
      } else {
        throw new Error(data.message);
      }
    } catch (e: any) {
      setConnectionStatus('error');
      toast.error("Échec de la sauvegarde. " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Cloud className="h-8 w-8 text-primary" />
            Infrastructure Cloud Djati
          </h1>
          <p className="text-muted-foreground mt-1">Gérez votre connexion globale et la sauvegarde en temps réel.</p>
        </div>
        <div className={cn(
          "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2",
          connectionStatus === 'success' ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
        )}>
          <Wifi className="h-3 w-3" />
          {connectionStatus === 'success' ? "Configuré" : "Non configuré"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Handshake */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
            <div className="bg-primary/5 h-1 px-0" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Clés de Connexion (D1/Rust Hub)
              </CardTitle>
              <CardDescription>
                Configurez l'identifiant machine et les jetons d'accès pour la synchronisation Cloudflare D1.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Machine ID</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Server className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Ex: MASTER-LAPTOP"
                      value={machineId}
                      onChange={(e) => setMachineId(e.target.value)}
                      className="pl-10 h-11 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Master Token</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="JATI_MASTER_SECRET_..."
                    value={masterToken}
                    onChange={(e) => setMasterToken(e.target.value)}
                    className="pl-10 h-11 font-mono tracking-widest"
                  />
                  {connectionStatus === 'success' && masterToken && (
                    <Check className="absolute right-3 top-3 h-5 w-5 text-success animate-bounce" />
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Store Tokens (Optionnel, séparés par virgule)</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="STORE-A-TOKEN,STORE-B-TOKEN"
                    value={storeTokens}
                    onChange={(e) => setStoreTokens(e.target.value)}
                    className="pl-10 h-11 font-mono tracking-widest"
                  />
                </div>
              </div>
              
              <Button
                onClick={handleSaveConfiguration}
                disabled={isSaving}
                className="w-full h-12 text-lg font-bold transition-all shadow-md"
              >
                {isSaving ? (
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Save className="h-5 w-5 mr-2" />
                )}
                Sauvegarder la Configuration
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <Database className="h-4 w-4" />
                État des Données
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded bg-muted/30">
                <span className="text-sm text-muted-foreground">Dernière sauvegarde Cloud</span>
                <span className="text-sm font-bold">Gérée par Rust Hub</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Info / Help */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/10">
            <h3 className="font-black uppercase tracking-tighter text-lg mb-2">Qu'est-ce que le Handshake ?</h3>
            <p className="text-xs leading-relaxed opacity-80">
              Le Handshake Djati lie votre base de données locale à votre serveur privé sur le Cloud. 
              Cela permet une sauvegarde automatique de vos ventes, de vos stocks et de vos clients en temps réel.
            </p>
            <div className="mt-4 p-3 bg-white/20 rounded-lg border border-white/30">
              <p className="text-[10px] font-mono leading-tight">
                STATUS: EN ATTENTE DE JETON...
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl border-2 border-dashed border-muted flex flex-col items-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="font-bold text-sm">Sécurité de Bout-en-Bout</h4>
            <p className="text-[10px] text-muted-foreground">
              Toutes les données transférées sont chiffrées. Votre clé privée (Sync Token) ne doit jamais être partagée.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
