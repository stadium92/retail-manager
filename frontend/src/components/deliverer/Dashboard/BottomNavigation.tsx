import { Truck, MapPin, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function DelivererBottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50 safe-area-bottom md:hidden">
      <div className="grid grid-cols-3 h-16">
        <Button
          variant="ghost"
          className={cn(
            "flex flex-col items-center justify-center h-full rounded-none gap-1 min-h-[48px]",
            activeTab === 'deliveries' && "bg-primary/10 text-primary"
          )}
          onClick={() => onTabChange('deliveries')}
        >
          <Truck className="h-5 w-5" />
          <span className="text-xs">Deliveries</span>
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "flex flex-col items-center justify-center h-full rounded-none gap-1 min-h-[48px]",
            activeTab === 'route' && "bg-primary/10 text-primary"
          )}
          onClick={() => onTabChange('route')}
        >
          <MapPin className="h-5 w-5" />
          <span className="text-xs">Route</span>
        </Button>
        <Button
          variant="ghost"
          className={cn(
            "flex flex-col items-center justify-center h-full rounded-none gap-1 min-h-[48px]",
            activeTab === 'history' && "bg-primary/10 text-primary"
          )}
          onClick={() => onTabChange('history')}
        >
          <History className="h-5 w-5" />
          <span className="text-xs">History</span>
        </Button>
      </div>
    </nav>
  );
}

