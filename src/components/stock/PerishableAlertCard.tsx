import { AlertCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PerishableAlertCardProps {
  ingredientName: string;
  expiryDate?: string | null;
}

export function PerishableAlertCard({ ingredientName, expiryDate }: PerishableAlertCardProps) {
  if (!expiryDate) return null;

  const exp = new Date(expiryDate);
  const today = new Date();
  const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let urgencyColor = 'border-amber-500/20 bg-amber-500/5 text-amber-600';
  let dotColor = 'bg-amber-500';
  let desc = `expire dans ${daysLeft} jours`;

  if (daysLeft === 0) {
    urgencyColor = 'border-red-500/30 bg-red-500/10 text-red-600';
    dotColor = 'bg-red-500';
    desc = 'expire aujourd\'hui';
  } else if (daysLeft === 1) {
    urgencyColor = 'border-red-500/30 bg-red-500/5 text-red-600';
    dotColor = 'bg-red-500';
    desc = 'expire demain';
  } else if (daysLeft < 0) {
    urgencyColor = 'border-destructive/30 bg-destructive/10 text-destructive';
    dotColor = 'bg-destructive';
    desc = `périmé depuis ${Math.abs(daysLeft)} jours`;
  }

  const formattedDate = format(exp, 'dd MMMM yyyy', { locale: fr });

  return (
    <div className={`flex items-start gap-3 p-3 border-2 rounded-xl transition-all shadow-sm ${urgencyColor}`}>
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor} animate-pulse`} />
      <div className="flex-1 space-y-1">
        <h4 className="font-bold text-sm leading-none">{ingredientName}</h4>
        <div className="flex flex-col gap-0.5 text-xs opacity-80">
          <span>{desc}</span>
          <span className="flex items-center gap-1 text-[10px]">
            <Calendar className="h-3 w-3" /> {formattedDate}
          </span>
        </div>
      </div>
    </div>
  );
}
