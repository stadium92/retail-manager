import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/components/ui/menubar';

export type WorkerModule =
  | 'vente-detail'
  | 'facturation-detail'
  | 'facturation-gros'
  | 'proforma'
  | 'fermeture-caisse'
  | 'reglements-bons'
  | 'credits-caisse'
  | 'reception-achats'
  | 'commande-auto'
  | 'commande-manuelle'
  | 'reglement-fournisseurs'
  | 'produits'
  | 'clients'
  | 'services-clients'
  | 'fournisseurs'
  | 'familles'
  | 'situation-client'
  | 'suivi-ventes-jour'
  | 'suivi-ventes-produit'
  | 'suivi-ventes-factures'
  | 'situation-fournisseur'
  | 'suivi-achats-famille'
  | 'suivi-achats-jour'
  | 'suivi-achats-periode'
  | 'consultation-caisse'
  | 'journal-caisse'
  | 'tableau-bord'
  | 'statistiques'
  | 'sorties-pertes'
  | 'fiche-stock'
  | 'mouvements-stock'
  | 'listing-stock'
  | 'regularisation-stock'
  | 'valorisation-stock'
  | 'inventaire-stock'
  | 'preferences'
  | 'programmation-touches'
  | 'mots-de-passe'
  | 'synchronisation';

interface WorkerMenuBarProps {
  activeModule: WorkerModule;
  onModuleChange: (module: WorkerModule) => void;
  className?: string;
  isMaster?: boolean;
}

interface MenuItem {
  labelKey?: string;
  label?: string; // Fallback for hardcoded strings if any
  module?: WorkerModule;
  shortcut?: string;
  separator?: boolean;
  submenu?: MenuItem[];
}

interface MenuSection {
  triggerKey: string;
  highlight?: boolean;
  items: MenuItem[];
}

export function WorkerMenuBar({ activeModule, onModuleChange, className, isMaster = false }: WorkerMenuBarProps) {
  const { t } = useTranslation();

  const menuStructure: MenuSection[] = [
    {
      triggerKey: 'menu.sales.trigger',
      highlight: true,
              items: [
                { labelKey: 'menu.sales.retail', module: 'vente-detail' },
                { labelKey: 'menu.sales.billingRetail', module: 'facturation-detail' },
                { labelKey: 'menu.sales.billingWholesale', module: 'facturation-gros' },
                { labelKey: 'menu.sales.proforma', module: 'proforma' },        { separator: true },
        { labelKey: 'menu.sales.closeCash', module: 'fermeture-caisse', shortcut: 'F12' },
        { labelKey: 'menu.sales.settlement', module: 'reglements-bons' },
        { labelKey: 'menu.sales.cashierCredits', module: 'credits-caisse' },
      ],
    },
    {
      triggerKey: 'menu.purchases.trigger',
      items: [
        { labelKey: 'menu.purchases.reception', module: 'reception-achats' },
        { labelKey: 'menu.purchases.autoOrder', module: 'commande-auto' },
        { labelKey: 'menu.purchases.manualOrder', module: 'commande-manuelle' },
        { separator: true },
        { labelKey: 'menu.purchases.supplierSettlement', module: 'reglement-fournisseurs' },
      ],
    },
    {
      triggerKey: 'menu.files.trigger',
      items: [
        { labelKey: 'menu.files.products', module: 'produits' },
        { labelKey: 'menu.files.clients', module: 'clients' },
        { labelKey: 'menu.files.clientServices', module: 'services-clients' },
        { labelKey: 'menu.files.suppliers', module: 'fournisseurs' },
        { labelKey: 'menu.files.families', module: 'familles' },
      ],
    },
    {
      triggerKey: 'menu.edition.trigger',
      items: [
        {
          labelKey: 'menu.edition.clientStatus',
          submenu: [
            { labelKey: 'menu.edition.accountStatement', module: 'situation-client' },
          ],
        },
        {
          labelKey: 'menu.edition.salesTracking',
          submenu: [
            { labelKey: 'menu.edition.dailySales', module: 'suivi-ventes-jour' },
            { labelKey: 'menu.edition.salesByProduct', module: 'suivi-ventes-produit' },
            { labelKey: 'menu.edition.invoiceList', module: 'suivi-ventes-factures' },
          ],
        },
        {
          labelKey: 'menu.edition.supplierStatus',
          submenu: [
            { labelKey: 'menu.edition.supplierStatement', module: 'situation-fournisseur' },
          ],
        },
        {
          labelKey: 'menu.edition.purchaseTracking',
          submenu: [
            { labelKey: 'menu.edition.purchaseByFamily', module: 'suivi-achats-famille' },
            { labelKey: 'menu.edition.dailyPurchases', module: 'suivi-achats-jour' },
            { labelKey: 'menu.edition.periodPurchases', module: 'suivi-achats-periode' },
          ],
        },
      ],
    },
    {
      triggerKey: 'menu.management.trigger',
      items: [
        { labelKey: 'menu.management.cashConsultation', module: 'consultation-caisse' },
        { labelKey: 'menu.management.cashJournal', module: 'journal-caisse' },
        { separator: true },
        { labelKey: 'menu.management.dashboard', module: 'tableau-bord' },
        { labelKey: 'menu.management.statistics', module: 'statistiques' },
        { separator: true },
        { labelKey: 'menu.management.lossExit', module: 'sorties-pertes' },
      ],
    },
    {
      triggerKey: 'menu.stock.trigger',
      items: [
        { labelKey: 'menu.stock.productSheet', module: 'fiche-stock' },
        { labelKey: 'menu.stock.movements', module: 'mouvements-stock' },
        { separator: true },
        { labelKey: 'menu.stock.listing', module: 'listing-stock' },
        { labelKey: 'menu.stock.regularization', module: 'regularisation-stock' },
        { labelKey: 'menu.stock.valorization', module: 'valorisation-stock' },
        { separator: true },
        { labelKey: 'menu.stock.inventory', module: 'inventaire-stock' },
      ],
    },
    {
      triggerKey: 'menu.program.trigger',
      items: [
        { labelKey: 'menu.program.preferences', module: 'preferences' },
        { labelKey: 'menu.program.keyProgramming', module: 'programmation-touches' },
        { separator: true },
        { labelKey: 'menu.program.passwords', module: 'mots-de-passe' },
      ],
    },
  ];

  const filteredMenuStructure = menuStructure
    .filter(section => {
      if (!isMaster) {
        // Workers only see Sales and Stock menus
        return section.triggerKey === 'menu.sales.trigger' || section.triggerKey === 'menu.stock.trigger';
      }
      return true;
    })
    .map(section => {
      if (!isMaster) {
        if (section.triggerKey === 'menu.sales.trigger') {
          return {
            ...section,
            items: section.items.filter(item => 
              item.separator || (item.module && [
                'vente-detail', 
                'facturation-detail', 
                'facturation-gros', 
                'proforma', 
                'fermeture-caisse'
              ].includes(item.module))
            )
          };
        }
        if (section.triggerKey === 'menu.stock.trigger') {
          return {
            ...section,
            items: section.items.filter(item => 
              item.module === 'inventaire-stock'
            )
          };
        }
      }
      return section;
    });

  const isModuleInSection = (section: MenuSection) => {
    return section.items.some((item) => {
      if (item.module === activeModule) return true;
      if (item.submenu) {
        return item.submenu.some((sub) => sub.module === activeModule);
      }
      return false;
    });
  };

  const renderMenuItem = (item: MenuItem, key: number) => {
    if (item.separator) {
      return <MenubarSeparator key={key} />;
    }

    const label = item.labelKey ? t(item.labelKey) : item.label;

    if (item.submenu) {
      return (
        <MenubarSub key={key}>
          <MenubarSubTrigger className="flex items-center justify-between">
            {label}
            <ChevronRight className="h-4 w-4 ml-2" />
          </MenubarSubTrigger>
          <MenubarSubContent className="bg-popover border-slate-200 shadow-md min-w-[180px] z-[100]">
            {item.submenu.map((subItem, subKey) => {
              const subLabel = subItem.labelKey ? t(subItem.labelKey) : subItem.label;
              return (
                <MenubarItem
                  key={subKey}
                  onClick={() => subItem.module && onModuleChange(subItem.module)}
                  className={cn(
                    'cursor-pointer transition-colors',
                    subItem.module === activeModule && 'bg-primary/20 text-primary'
                  )}
                >
                  {subLabel}
                  {subItem.shortcut && (
                    <span className="ml-auto text-xs text-muted-foreground">{subItem.shortcut}</span>
                  )}
                </MenubarItem>
              );
            })}
          </MenubarSubContent>
        </MenubarSub>
      );
    }

    return (
      <MenubarItem
        key={key}
        onClick={() => item.module && onModuleChange(item.module)}
        className={cn(
          'cursor-pointer transition-colors',
          item.module === activeModule && 'bg-primary/20 text-primary'
        )}
      >
        <span>{label}</span>
        {item.shortcut && (
          <span className="ml-auto text-xs text-muted-foreground">{item.shortcut}</span>
        )}
      </MenubarItem>
    );
  };

  return (
    <Menubar className={cn('h-10 gap-0 p-0 border-none bg-transparent rounded-none', className)}>
      {filteredMenuStructure.map((section, index) => {
        const isActive = isModuleInSection(section);

        return (
          <MenubarMenu key={index}>
            <MenubarTrigger id="worker-menubar-trigger-0"
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-none transition-all cursor-pointer',
                'data-[state=open]:bg-primary data-[state=open]:text-primary-foreground',
                section.highlight && !isActive && 'bg-danger text-danger-foreground',
                isActive && 'bg-primary text-primary-foreground',
                !section.highlight && !isActive && 'hover:bg-muted'
              )}
            >
              {t(section.triggerKey)}
            </MenubarTrigger>
            <MenubarContent
              className="glass-card border-primary/20 min-w-[220px] animate-spring-in"
              align="start"
              sideOffset={0}
            >
              {section.items.map((item, itemIndex) => renderMenuItem(item, itemIndex))}
            </MenubarContent>
          </MenubarMenu>
        );
      })}
    </Menubar>
  );
}