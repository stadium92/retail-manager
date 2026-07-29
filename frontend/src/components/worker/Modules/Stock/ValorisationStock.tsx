import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calculator, ArrowDownLeft, ArrowUpRight, Layers } from 'lucide-react';
import { OfflineDataService } from '@/services/OfflineDataService';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { MasterPasswordGate } from '@/components/shared/MasterPasswordGate';

/* -----------------------------------------------------------------------------
 * WORKED EXAMPLE for the Djati colour system (src/styles/djati-palette.css).
 *
 * Before: four KPI cards railed blue / primary / amber / success. The colours
 * encoded nothing — blue was not "cold", amber was not "warning", and the green
 * margin card was green even when the margin was negative.
 *
 * After, applying the ledger rule:
 *   - Valeur d'achat      money that LEFT   -> supply side -> module.achats (cobalt)
 *   - Valeur de vente     money that ARRIVES-> sell side   -> module.ventes (gold)
 *   - Valeur de gros      same money, secondary channel    -> gold, muted step
 *   - Marge potentielle   not a side of the ledger, a JUDGEMENT about one.
 *                         Rail stays neutral; the semantic colour goes on the
 *                         badge, where it carries a sign and a word, and it
 *                         flips to `danger` when the margin is negative.
 *
 * Note what is NOT coloured: every currency figure is --djati-fg. A number is
 * not good or bad. Colouring the numbers is what made the old screen unreadable
 * at a glance, because everything competed.
 * -------------------------------------------------------------------------- */

interface ValorisationStockProps {
  storeId: string;
}

type Valuation = {
  total_cost: number;
  total_retail: number;
  total_wholesale: number;
  total_resale: number;
  item_count: number;
};

const EMPTY: Valuation = {
  total_cost: 0,
  total_retail: 0,
  total_wholesale: 0,
  total_resale: 0,
  item_count: 0,
};

/** A KPI tile. `accent` is a Tailwind class from the `module`/`djati` scales —
 *  applied ONLY to the 3px rail and the icon, per the usage rules. */
function KpiTile({
  label,
  value,
  accentRail,
  accentIcon,
  icon: Icon,
  children,
}: {
  label: string;
  value: string;
  accentRail: string;
  accentIcon: string;
  icon: typeof Calculator;
  children?: React.ReactNode;
}) {
  return (
    <Card className={`border-l-[3px] ${accentRail} bg-djati-surface border-djati-border`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-2 gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-djati-fg-muted">
            {label}
          </p>
          <Icon className={`h-4 w-4 shrink-0 ${accentIcon}`} aria-hidden="true" />
        </div>
        <p className="text-xl font-bold data-cell text-djati-fg">{value}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export function ValorisationStock({ storeId }: ValorisationStockProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatters();
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await OfflineDataService.getStockValuation(storeId);
      setValuation(data || EMPTY);
    } catch (err) {
      console.error('[ValorisationStock] Fetch error:', err);
      setValuation(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchData();
    const handleRefresh = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string }>).detail;
      if (detail?.type === 'inventory' || detail?.type === 'product' || detail?.type === 'sale') {
        fetchData();
      }
    };
    window.addEventListener('localDbDataUpdated', handleRefresh);
    return () => window.removeEventListener('localDbDataUpdated', handleRefresh);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3">
        <Calculator className="h-8 w-8 text-djati-fg-subtle" aria-hidden="true" />
        <span className="text-djati-fg-muted">{t('common.loading')}</span>
      </div>
    );
  }

  if (!valuation) {
    // Error state: the colour is attached to a word, not floating on its own.
    return (
      <div className="m-4 flex items-center gap-2 rounded-md border border-djati-border bg-djati-surface-2 p-4">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-djati-danger text-djati-on-fill">
          {t('common.error')}
        </span>
      </div>
    );
  }

  const margin = valuation.total_retail - valuation.total_cost;
  const marginPercent = valuation.total_cost > 0 ? (margin / valuation.total_cost) * 100 : 0;
  // The old version hardcoded `text-success` and a literal "+", so a loss-making
  // stock rendered green and read "+-12.4%". The sign now drives the semantic.
  const marginIsPositive = margin >= 0;
  const marginBadge = marginIsPositive
    ? 'bg-djati-success text-djati-on-fill'
    : 'bg-djati-danger text-djati-on-fill';

  return (
    <MasterPasswordGate moduleName={t('menu.program.stockValuation', 'Valorisation du Stock')}>
      <div className="space-y-4 p-2">
        {/* Module header. The accent identifies the module, once, and then gets
            out of the way — it is not repeated on every element below. */}
        <div className="flex items-center gap-2 border-b border-djati-border pb-2">
          <Layers className="h-4 w-4 text-module-stock" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-wide text-djati-fg">
            {t('menu.program.stockValuation', 'Valorisation du Stock')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile
            label={t('menu.program.purchaseValue')}
            value={formatCurrency(valuation.total_cost)}
            accentRail="border-l-module-achats"
            accentIcon="text-module-achats"
            icon={ArrowDownLeft}
          />

          <KpiTile
            label={t('menu.program.sellingValue')}
            value={formatCurrency(valuation.total_retail)}
            accentRail="border-l-module-ventes"
            accentIcon="text-module-ventes"
            icon={ArrowUpRight}
          />

          <KpiTile
            label={t('edition.wholesaleValue')}
            value={formatCurrency(valuation.total_wholesale)}
            accentRail="border-l-djati-gold-muted"
            accentIcon="text-djati-gold-muted"
            icon={ArrowUpRight}
          />

          <KpiTile
            label={t('menu.program.potentialMargin')}
            value={formatCurrency(margin)}
            accentRail="border-l-djati-border-strong"
            accentIcon="text-djati-fg-muted"
            icon={Calculator}
          >
            <span
              className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold data-cell ${marginBadge}`}
            >
              {marginIsPositive ? '+' : ''}
              {marginPercent.toFixed(1)}%
            </span>
          </KpiTile>
        </div>

        {/* Secondary figures. No rails, no accents: these are context, not
            decisions. Neutral is the correct answer here. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: t('menu.program.itemRefCount'), value: String(valuation.item_count) },
            { label: t('edition.resaleValue'), value: formatCurrency(valuation.total_resale) },
          ].map((row) => (
            <Card key={row.label} className="bg-djati-surface border-djati-border">
              <CardContent className="py-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-djati-fg-muted mb-1">
                  {row.label}
                </p>
                <div className="text-2xl font-bold data-cell text-djati-fg">{row.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MasterPasswordGate>
  );
}
