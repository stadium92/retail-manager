import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface PortionsGaugeProps {
  dishName: string;
  maxPortions: number;
  limitingIngredient?: string;
}

export function PortionsGauge({ dishName, maxPortions, limitingIngredient }: PortionsGaugeProps) {
  // Compute visual score for a scale of 0 to 20 portions
  const percentage = Math.min(100, (maxPortions / 20) * 100);
  
  let statusColor = 'bg-teal';
  let badgeColor = 'bg-teal text-white border-none';
  let badgeText = 'Suffisant';
  let icon = '🟢';

  if (maxPortions <= 2) {
    statusColor = 'bg-red-500';
    badgeColor = 'bg-red-500 text-white border-none';
    badgeText = 'Rupture';
    icon = '🔴';
  } else if (maxPortions <= 9) {
    statusColor = 'bg-amber-500';
    badgeColor = 'bg-amber-500 text-white border-none';
    badgeText = 'Faible';
    icon = '🟡';
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/10 transition-colors shadow-sm">
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-black text-sm text-foreground uppercase tracking-tight">{dishName}</span>
            <span className="text-[10px] text-muted-foreground">
              {limitingIngredient && limitingIngredient !== '—' ? (
                <>Limité par : <strong className="text-primary">{limitingIngredient}</strong></>
              ) : (
                'Ingrédients suffisants'
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-black">{maxPortions} portions</span>
            <Badge className={`${badgeColor} text-[8px] tracking-widest font-black uppercase`}>
              {icon} {badgeText}
            </Badge>
          </div>
        </div>

        <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${statusColor} rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
