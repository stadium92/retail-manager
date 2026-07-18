import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight, ShoppingCart, ShoppingBag, FolderOpen, FileText, BarChart3, Package,
  LogOut, RefreshCw, Layout, Receipt, Lock, CalendarDays, Boxes, Users, Truck, Store,
  ClipboardList, PackageCheck, PenLine, CreditCard, AlertTriangle, History, UserCog,
  ScrollText, Mail, LayoutDashboard, KeyRound,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LocalDatabase } from '@/services/LocalDatabase';

interface MobileMenuScreenProps {
  onSelect: (moduleId: string) => void;
}

// One accent per section — used for the section header chip, the card's
// top accent bar, and each item's icon tint within that section.
const SECTION_ACCENTS: Record<string, string> = {
  'Ventes': 'hsl(150,70%,45%)',
  'Commandes': 'hsl(150,70%,45%)',
  'Fichiers': 'hsl(270,70%,62%)',
  'Stock': 'hsl(30,90%,55%)',
  'Achats': 'hsl(210,90%,58%)',
  'Settings': 'hsl(350,80%,62%)',
  'Gestion': 'hsl(190,80%,50%)',
  'Paramètres': 'hsl(220,10%,62%)',
};

const ITEM_ICONS: Record<string, React.ReactNode> = {
  'vente-detail': <Receipt className="w-[18px] h-[18px]" />,
  'fermeture-caisse': <Lock className="w-[18px] h-[18px]" />,
  'suivi-ventes-jour': <CalendarDays className="w-[18px] h-[18px]" />,
  'fiche-produits': <Boxes className="w-[18px] h-[18px]" />,
  'clients': <Users className="w-[18px] h-[18px]" />,
  'fournisseurs': <Truck className="w-[18px] h-[18px]" />,
  'boutiques': <Store className="w-[18px] h-[18px]" />,
  'inventaire-stock': <ClipboardList className="w-[18px] h-[18px]" />,
  'reception-achats': <PackageCheck className="w-[18px] h-[18px]" />,
  'commande-manuelle': <PenLine className="w-[18px] h-[18px]" />,
  'reglement-fournisseurs': <CreditCard className="w-[18px] h-[18px]" />,
  'besoins-achats': <AlertTriangle className="w-[18px] h-[18px]" />,
  'historique-achats': <History className="w-[18px] h-[18px]" />,
  'team': <UserCog className="w-[18px] h-[18px]" />,
  'audit-logs': <ScrollText className="w-[18px] h-[18px]" />,
  'invitations': <Mail className="w-[18px] h-[18px]" />,
  'tableau-bord': <LayoutDashboard className="w-[18px] h-[18px]" />,
  'mots-de-passe': <KeyRound className="w-[18px] h-[18px]" />,
};

export function MobileMenuScreen({ onSelect }: MobileMenuScreenProps) {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  const { roles, user } = useAuth();
  const isMaster = roles?.some(r => r.role === 'master');

  const menuSections = [
    {
      title: 'Ventes',
      icon: <ShoppingCart className="w-5 h-5" />,
      items: [
        { id: 'vente-detail', label: t('menu.sales.retail') || 'Vente Détail' },
        { id: 'fermeture-caisse', label: t('menu.sales.closeCash') || 'Fermeture Caisse' },
        { id: 'suivi-ventes-jour', label: t('menu.edition.dailySales') || 'Commandes journalières' },
      ],
    },
    {
      title: 'Fichiers',
      icon: <FolderOpen className="w-5 h-5" />,
      items: [
        { id: 'fiche-produits', label: 'Produits' },
        { id: 'clients', label: t('menu.files.clients') || 'Clients' },
        { id: 'fournisseurs', label: t('menu.files.suppliers') || 'Fournisseurs' },
        { id: 'boutiques', label: 'Boutiques' },
      ],
    },
    {
      title: 'Stock',
      icon: <Package className="w-5 h-5" />,
      items: [
        { id: 'inventaire-stock', label: 'Inventaire' },
      ],
    },
    {
      title: 'Achats',
      icon: <ShoppingBag className="w-5 h-5" />,
      items: [
        { id: 'reception-achats', label: t('menu.purchases.reception') || 'Réception Achats' },
        { id: 'commande-manuelle', label: t('menu.purchases.manualOrder') || 'Commande Manuelle' },
        { id: 'reglement-fournisseurs', label: t('menu.purchases.supplierSettlement') || 'Règlement Fournisseurs' },
        { id: 'besoins-achats', label: t('menu.purchases.replenishmentNeeds') || 'Besoins en réapprovisionnement' },
        { id: 'historique-achats', label: 'Historique des Achats' },
      ],
    },
    {
      title: 'Settings',
      icon: <FileText className="w-5 h-5" />,
      items: [
        ...(isMaster ? [
          { id: 'team', label: t('sidebar.team') || 'Gestion Équipe' },
          { id: 'audit-logs', label: 'Logs Système' },
          { id: 'invitations', label: 'Invitations' }
        ] : [])
      ],
    },
    {
      title: 'Gestion',
      icon: <BarChart3 className="w-5 h-5" />,
      items: [
        { id: 'tableau-bord', label: t('menu.management.dashboard') || 'Tableau de Bord' },
      ],
    },
    {
      title: 'Paramètres',
      icon: <Layout className="w-5 h-5" />,
      items: [
        { id: 'mots-de-passe', label: t('menu.program.passwords') || 'Mots de passe' },
      ],
    },
  ];

  // Resolve subRole: direct role rows (cashier) take precedence over the
  // legacy worker+sub_role pattern and user_metadata fallback.
  const workerRole = roles.find(r => r.role === 'worker');
  const subRole = (
    roles.find(r => r.role === 'cashier')?.role ??
    workerRole?.sub_role ??
    (user?.user_metadata?.sub_role as string | null | undefined)
  ) as 'cashier' | null | undefined;

  let finalSections = menuSections.filter(section => {
    // Workers (non-master) should only access Ventes (sales) and Stock (inventory)
    if (!isMaster) {
      if (section.title !== 'Ventes' && section.title !== 'Stock') {
        return false;
      }
    }
    if (subRole === 'cashier') {
      // Cashier: Ventes (renamed to Commandes) + Paramètres
      return section.title === 'Ventes' || section.title === 'Paramètres';
    }
    return true;
  }).map(section => {
    if (!isMaster && section.title === 'Ventes') {
      return {
        ...section,
        items: section.items.filter(item =>
          item.id === 'vente-detail' ||
          item.id === 'fermeture-caisse' ||
          item.id === 'suivi-ventes-jour'
        )
      };
    }
    if (subRole === 'cashier' && section.title === 'Ventes') {
      return {
        ...section,
        title: 'Commandes',
        items: section.items.filter(item =>
          item.id === 'vente-detail' ||
          item.id === 'fermeture-caisse' ||
          item.id === 'suivi-ventes-jour'
        ).map(item => {
          if (item.id === 'vente-detail') {
            return { ...item, label: 'Ticket commande' };
          }
          return item;
        })
      };
    }
    return section;
  });

  const roleLabel = isMaster
    ? (t('roles.master') || 'Master')
    : subRole === 'cashier' ? (t('roles.cashier') || 'Caissier')
    : (t('roles.worker') || 'Vendeur');

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[80px]">
      <header className="flex-shrink-0 bg-[#141414] border-b border-rs-surface-container px-4 pt-safe sticky top-0 z-10">
        <div className="h-[64px] flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-white leading-tight">Modules DJATI</h1>
            <span className="text-xs text-rs-on-surface-variant font-medium">{roleLabel}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-rs-surface-tint/15 border border-rs-surface-tint/30 flex items-center justify-center text-rs-surface-tint font-bold text-sm">
            {(user?.email?.[0] || roleLabel[0] || '?').toUpperCase()}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {finalSections.filter(s => s.items.length > 0).map((section, idx) => {
          const accent = SECTION_ACCENTS[section.title] ?? 'hsl(220,10%,62%)';
          return (
            <div key={idx} className="space-y-2.5">
              <div className="flex items-center gap-2 pl-1">
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                  style={{ backgroundColor: `${accent}1f`, color: accent }}
                >
                  {section.icon}
                </div>
                <span className="font-bold text-sm tracking-wider uppercase text-rs-on-surface">{section.title}</span>
              </div>
              <div
                className="bg-[#141414] rounded-2xl overflow-hidden border border-rs-surface-container border-l-[3px]"
                style={{ borderLeftColor: accent }}
              >
                {section.items.map((item, itemIdx) => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={`w-full flex items-center gap-3 p-4 text-left hover:bg-rs-surface-container-highest transition-colors active:scale-[0.98] ${
                      itemIdx !== section.items.length - 1 ? 'border-b border-rs-surface-container' : ''
                    }`}
                  >
                    <div
                      className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                      style={{ backgroundColor: `${accent}1f`, color: accent }}
                    >
                      {ITEM_ICONS[item.id] ?? <ChevronRight className="w-[18px] h-[18px]" />}
                    </div>
                    <span className="flex-1 text-rs-on-surface font-medium">{item.label}</span>
                    <ChevronRight className="w-5 h-5 text-rs-on-surface-variant shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div className="pt-4 pb-8 space-y-3">
          <button
            onClick={async () => {
              if (window.confirm("Attention: Cela va vider le cache de l'application (IndexedDB et LocalStorage) pour supprimer les anciennes données de test. Continuer ?")) {
                try {
                  await LocalDatabase.clearAll();
                  localStorage.clear();
                  alert("Cache vidé avec succès. Rechargement...");
                  window.location.reload();
                } catch (e) {
                  alert("Échec de la suppression du cache");
                }
              }
            }}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-[#1a1510] text-[#e0a96d] border border-[#e0a96d]/20 font-bold hover:opacity-90 active:scale-95 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Réinitialiser le cache</span>
          </button>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-rs-error-container text-rs-on-error-container font-bold hover:opacity-90 active:scale-95 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>{t('auth.signOut') || 'Déconnexion'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
