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
  | 'kds'
  | 'tables'
  | 'vente-detail'
  | 'facturation-detail'
  | 'facturation-gros'
  | 'proforma'
  | 'fermeture-caisse'
  | 'reglements-bons'
  | 'reception-achats'
  | 'commande-auto'
  | 'commande-manuelle'
  | 'reglement-fournisseurs'
  | 'produits'
  | 'fiche-produits'
  | 'clients'
  | 'services-clients'
  | 'fournisseurs'
  | 'familles'
  | 'ingredients'
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
  subRole?: 'cook' | 'cashier' | 'waiter' | null;
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

export function WorkerMenuBar({ activeModule, onModuleChange, className, subRole }: WorkerMenuBarProps) {
  const { t } = useTranslation();
  const isCashier = subRole === 'cashier';

  const menuStructure: MenuSection[] = [
    {
      triggerKey: 'menu.restaurant.trigger',
      highlight: true,
      items: [
        { labelKey: 'menu.restaurant.kds', module: 'kds' },
        { labelKey: 'menu.restaurant.tables', module: 'tables' },
      ],
    },
    {
      triggerKey: 'menu.sales.trigger',
      highlight: true,
      items: [
        { labelKey: 'menu.sales.retail', module: 'vente-detail' },
        { labelKey: 'menu.sales.billingRetail', module: 'facturation-detail' },
        { labelKey: 'menu.sales.billingWholesale', module: 'facturation-gros' },
        { labelKey: 'menu.sales.proforma', module: 'proforma' },
        { separator: true },
        { labelKey: 'menu.sales.closeCash', module: 'fermeture-caisse', shortcut: 'F12' },
        { labelKey: 'menu.sales.settlement', module: 'reglements-bons' },
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
        { labelKey: 'menu.files.menuModule', module: 'fiche-produits' },
        { labelKey: 'menu.files.products', module: 'produits' },
        { labelKey: 'menu.files.clients', module: 'clients' },
        { labelKey: 'menu.files.clientServices', module: 'services-clients' },
        { labelKey: 'menu.files.suppliers', module: 'fournisseurs' },
        { labelKey: 'menu.files.families', module: 'familles' },
        { separator: true },
        { label: '🧂 Ingrédients', module: 'ingredients' },
      ],
    },
    {
      triggerKey: 'menu.edition.trigger',
      items: [
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
        {
          labelKey: 'menu.edition.clientStatus',
          submenu: [
            { labelKey: 'menu.edition.accountStatement', module: 'situation-client' },
          ],
        },
        { separator: true },
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

  // Filter based on subRole
  const filteredMenuStructure = menuStructure.filter(section => {
    if (subRole === 'cook') {
      return section.triggerKey === 'menu.restaurant.trigger' || section.triggerKey === 'menu.program.trigger';
    }
    if (subRole === 'cashier') {
      return (
        section.triggerKey === 'menu.sales.trigger' ||
        section.triggerKey === 'menu.management.trigger' ||
        section.triggerKey === 'menu.program.trigger'
      );
    }
    return true;
  }).map((section) => {
    if (subRole === 'cook') {
      if (section.triggerKey === 'menu.restaurant.trigger') {
        return {
          ...section,
          items: section.items.filter((item) => item.module === 'kds'),
        };
      }
      if (section.triggerKey === 'menu.program.trigger') {
        return {
          ...section,
          items: section.items.filter((item) => item.module === 'mots-de-passe'),
        };
      }
      return section;
    }

    if (subRole !== 'cashier') {
      return section;
    }

    if (section.triggerKey === 'menu.sales.trigger') {
      return {
        ...section,
        items: section.items.filter((item) =>
          item.module === 'facturation-detail' ||
          item.module === 'fermeture-caisse' ||
          item.module === 'reglements-bons' ||
          item.separator
        ).filter((item, index, items) => {
          if (!item.separator) return true;
          const prev = items[index - 1];
          const next = items[index + 1];
          return Boolean(prev && next && !prev.separator && !next.separator);
        }),
      };
    }

    if (section.triggerKey === 'menu.management.trigger') {
      return {
        ...section,
        items: section.items.filter((item) =>
          item.module === 'consultation-caisse' ||
          item.module === 'journal-caisse' ||
          item.separator
        ).filter((item, index, items) => {
          if (!item.separator) return true;
          const prev = items[index - 1];
          const next = items[index + 1];
          return Boolean(prev && next && !prev.separator && !next.separator);
        }),
      };
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
          <MenubarSubTrigger className={cn('flex items-center justify-between', isCashier && '!text-zinc-300 focus:!text-[#F5C518] focus:!bg-[#F5C518]/15')}>
            {label}
            <ChevronRight className="h-4 w-4 ml-2" />
          </MenubarSubTrigger>
          <MenubarSubContent className={cn('bg-popover border-slate-200 shadow-md min-w-[180px] z-[100]', isCashier && '!bg-[#111111] !border-[#F5C518]/20 !text-zinc-300')}>
            {item.submenu.map((subItem, subKey) => {
              const subLabel = subItem.labelKey ? t(subItem.labelKey) : subItem.label;
              return (
                <MenubarItem
                  key={subKey}
                  onClick={() => subItem.module && onModuleChange(subItem.module)}
                  className={cn(
                    'cursor-pointer transition-colors',
                    isCashier && '!text-zinc-300 focus:!bg-[#F5C518]/15 focus:!text-[#F5C518]',
                    subItem.module === activeModule && (isCashier ? '!bg-[#F5C518]/20 !text-[#F5C518] font-bold' : 'bg-primary/20 text-primary')
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
          isCashier && '!text-zinc-300 focus:!bg-[#F5C518]/15 focus:!text-[#F5C518]',
          item.module === activeModule && (isCashier ? '!bg-[#F5C518]/20 !text-[#F5C518] font-bold' : 'bg-primary/20 text-primary')
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
            <MenubarTrigger id={`worker-menubar-trigger-${index}`}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-none transition-all cursor-pointer',
                isCashier
                  ? 'text-zinc-300 data-[state=open]:bg-[#F5C518]/20 data-[state=open]:text-[#F5C518] hover:bg-white/10 hover:text-white'
                  : 'data-[state=open]:bg-primary data-[state=open]:text-primary-foreground',
                section.highlight && !isActive && (isCashier ? 'bg-[#F5C518]/10 text-[#F5C518]' : 'bg-danger text-danger-foreground'),
                isActive && (isCashier ? 'bg-[#F5C518]/20 text-[#F5C518] font-bold' : 'bg-primary text-primary-foreground'),
                !section.highlight && !isActive && !isCashier && 'hover:bg-muted'
              )}
            >
              {t(section.triggerKey)}
            </MenubarTrigger>
            <MenubarContent
              className={cn(
                'glass-card border-primary/20 min-w-[220px] animate-spring-in',
                isCashier && '!bg-[#111111] !border-[#F5C518]/20 !text-zinc-300'
              )}
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
