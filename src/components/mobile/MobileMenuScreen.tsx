import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ShoppingCart, ShoppingBag, FolderOpen, FileText, BarChart3, Package, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface MobileMenuScreenProps {
  onSelect: (moduleId: string) => void;
}

export function MobileMenuScreen({ onSelect }: MobileMenuScreenProps) {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  const menuSections = [
    {
      title: 'Ventes',
      icon: <ShoppingCart className="w-5 h-5" />,
      items: [
        { id: 'vente-detail', label: t('menu.sales.retail') || 'Vente Détail' },
        { id: 'fermeture-caisse', label: t('menu.sales.closeCash') || 'Fermeture Caisse' },
      ],
    },
    {
      title: 'Achats',
      icon: <ShoppingBag className="w-5 h-5" />,
      items: [
        { id: 'reception-achats', label: t('menu.purchases.reception') || 'Réception Achats' },
        { id: 'commande-manuelle', label: t('menu.purchases.manualOrder') || 'Commande Manuelle' },
        { id: 'reglement-fournisseurs', label: t('menu.purchases.supplierSettlement') || 'Règlement Fournisseurs' },
      ],
    },
    {
      title: 'Fichiers',
      icon: <FolderOpen className="w-5 h-5" />,
      items: [
        { id: 'fiche-produits', label: '🍔 Menu / Produits' },
        { id: 'listing-stock', label: '📦 Listing Stock' },
        { id: 'clients', label: t('menu.files.clients') || 'Clients' },
        { id: 'fournisseurs', label: t('menu.files.suppliers') || 'Fournisseurs' },
      ],
    },
    {
      title: 'Éditions',
      icon: <FileText className="w-5 h-5" />,
      items: [
        { id: 'suivi-ventes-jour', label: t('menu.edition.dailySales') || 'Suivi Ventes / Jour' },
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
      title: 'Stock',
      icon: <Package className="w-5 h-5" />,
      items: [
        { id: 'inventaire-stock', label: t('menu.stock.inventory') || 'Inventaire Physique' },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] pb-[80px]">
      <header className="flex-shrink-0 h-[56px] bg-[#141414] border-b border-rs-surface-container flex items-center px-4 z-10 sticky top-0">
        <h1 className="text-xl font-bold tracking-tight text-white flex-1">Modules DJATI</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {menuSections.map((section, idx) => (
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

        <div className="pt-4 pb-8">
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
