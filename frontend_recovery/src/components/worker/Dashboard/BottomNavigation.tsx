import { ShoppingCart, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function WorkerBottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50 safe-area-bottom md:hidden">
      <div className="grid grid-cols-3 h-16">
        <Button
          variant="ghost"
          className={cn(
            "flex flex-col items-center justify-center h-full rounded-none gap-1",
            activeTab === 'sales' && "bg-primary/10 text-primary"
          )}
          onClick={() => onTabChange('sales')}
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="text-xs">{t('worker.dashboard.tabs.sales')}</span>
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "flex flex-col items-center justify-center h-full rounded-none gap-1",
            activeTab === 'inventory' && "bg-primary/10 text-primary"
          )}
          onClick={() => onTabChange('inventory')}
        >
          <Package className="h-5 w-5" />
          <span className="text-xs">{t('worker.dashboard.tabs.inventory')}</span>
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "flex flex-col items-center justify-center h-full rounded-none gap-1",
            activeTab === 'deliveries' && "bg-primary/10 text-primary"
          )}
          onClick={() => onTabChange('deliveries')}
        >
          <Truck className="h-5 w-5" />
          <span className="text-xs">{t('worker.dashboard.tabs.deliveries')}</span>
        </Button>
      </div>
    </nav>
  );
}