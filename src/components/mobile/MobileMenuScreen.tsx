import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ShoppingCart, ShoppingBag, FolderOpen, FileText, BarChart3, Package, LogOut, RefreshCw, Layout } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LocalDatabase } from '@/services/LocalDatabase';

interface MobileMenuScreenProps {
  onSelect: (moduleId: string) => void;
}

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
        { id: 'fiche-produits', label: '📦 Produits' },
        { id: 'clients', label: t('menu.files.clients') || 'Clients' },
        { id: 'fournisseurs', label: t('menu.files.suppliers') || 'Fournisseurs' },
        { id: 'restaurants', label: '🏪 Boutiques' },
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
          { id: 'team', label: `👥 ${t('sidebar.team') || 'Gestion Équipe'}` },
          { id: 'audit-logs', label: '📜 Logs Système' },
          { id: 'invitations', label: '✉️ Invitations' }
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

  // Resolve subRole: direct role rows (cashier/cook/waiter) take precedence over
  // the legacy worker+sub_role pattern and user_metadata fallback.
  const workerRole = roles.find(r => r.role === 'worker');
  const rawSubRole =
    roles.find(r => ['cook', 'cashier', 'waiter', 'waiters'].includes(r.role))?.role ??
    workerRole?.sub_role ??
    (user?.user_metadata?.sub_role as string | null | undefined);
  const subRole = (rawSubRole === 'waiters' ? 'waiter' : rawSubRole) as 'cook' | 'cashier' | 'waiter' | null | undefined;

  let finalSections = menuSections.filter(section => {
    // Workers (non-master) should only access Ventes (sales) and Stock (inventory)
    if (!isMaster) {
      if (section.title !== 'Ventes' && section.title !== 'Stock') {
        return false;
      }
    }
    if (subRole === 'cook') {
      // Cook: only Paramètres section
      return section.title === 'Paramètres';
    }
    if (subRole === 'cashier') {
      // Cashier: Ventes (renamed to Commandes) + Paramètres
      return section.title === 'Ventes' || section.title === 'Paramètres';
    }
    if (subRole === 'waiter') {
      // Waiter: Ventes + Fichiers + Paramètres
      return section.title === 'Ventes' || section.title === 'Fichiers' || section.title === 'Paramètres';
    }
    return true;
  }).map(section => {
    if (!isMaster && section.title === 'Ventes') {
      return {
        ...section,
        items: section.items.filter(item =>
          item.id === 'vente-detail' ||
          item.id === 'fermeture-caisse'
        )
      };
    }
    if (subRole === 'cashier' && section.title === 'Ventes') {
      return {
        ...section,
        title: 'Commandes',
        items: section.items.filter(item =>
          item.id === 'vente-detail' ||
          item.id === 'fermeture-caisse'
        ).map(item => {
          if (item.id === 'vente-detail') {
            return { ...item, label: 'Ticket commande' };
          }
          return item;
        })
      };
    }
    if (subRole === 'waiter') {
      if (section.title === 'Ventes') {
        return {
          ...section,
          items: section.items.filter(item => item.id === 'vente-detail')
        };
      }
      if (section.title === 'Fichiers') {
        return {
          ...section,
          items: section.items.filter(item => item.id === 'fiche-produits')
        };
      }
    }
    return section;
  });

  // No waiter plan additions needed for retail app

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[80px]">
      <header className="flex-shrink-0 h-[56px] bg-[#141414] border-b border-rs-surface-container flex items-center px-4 z-10 sticky top-0">
        <h1 className="text-xl font-bold tracking-tight text-white flex-1">Modules DJATI</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {finalSections.filter(s => s.items.length > 0).map((section, idx) => (
          <div key={idx} className="space-y-3">
            <div className="flex items-center gap-2 text-rs-surface-tint font-bold text-sm tracking-wider uppercase pl-2">
              {section.icon}
              <span>{section.title}</span>
            </div>
            <div className="bg-[#141414] rounded-2xl overflow-hidden border border-rs-surface-container">
              {section.items.map((item, itemIdx) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={`w-full flex items-center justify-between p-4 text-left hover:bg-rs-surface-container-highest transition-colors active:scale-95 ${
                    itemIdx !== section.items.length - 1 ? 'border-b border-rs-surface-container' : ''
                  }`}
                >
                  <span className="text-rs-on-surface font-medium">{item.label}</span>
                  <ChevronRight className="w-5 h-5 text-rs-on-surface-variant" />
                </button>
              ))}
            </div>
          </div>
        ))}

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
