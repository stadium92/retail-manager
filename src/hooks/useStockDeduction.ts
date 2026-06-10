import { OfflineAuthService } from '@/services/OfflineAuthService';
import { toast } from '@/hooks/use-toast';
import { DeductionResult } from '@/types/ingredients';

export function useStockDeduction() {
  const deduct = async (dishId: string, quantitySold: number, orderId?: string): Promise<DeductionResult> => {
    try {
      const result = await OfflineAuthService.localBridgeRequest<DeductionResult>('/rpc/deduct_stock_for_sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishId, quantitySold, orderId }),
      });

      if (!result.success) {
        // Strict out-of-stock check
        const names = result.insufficient?.map(i => i.name).join(', ') ?? '';
        toast({
          variant: 'destructive',
          title: '⛔ Stock d\'ingrédients insuffisant',
          description: `Ingrédients manquants : ${names}. La déduction a échoué.`,
        });
        return result;
      }

      if (result.alerts && result.alerts.length > 0) {
        result.alerts.forEach(alert => {
          if (alert.type === 'out_of_stock') {
            toast({
              variant: 'destructive',
              title: `⛔ Rupture de stock — ${alert.name}`,
              description: `L'ingrédient ${alert.name} est épuisé dans le système.`,
            });
          } else if (alert.type === 'low_stock') {
            toast({
              variant: 'default',
              title: `⚠️ Stock faible — ${alert.name}`,
              description: `Le niveau de stock de ${alert.name} est en dessous du seuil d'alerte.`,
            });
          } else if (alert.type === 'expiring_soon') {
            toast({
              variant: 'default',
              title: `⏰ Péremption proche — ${alert.name}`,
              description: `${alert.name} expire bientôt. Veuillez vérifier le stock.`,
            });
          }
        });
      }

      return result;
    } catch (err: any) {
      console.error('[useStockDeduction] Error during deduction:', err);
      return {
        success: false,
        deductions: [],
        alerts: [],
      };
    }
  };

  return { deduct };
}
