import { useState, useEffect } from 'react';
import { SalesService } from '@/services/SalesService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Coins, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';

const MONTHLY_TARGET = 10000;

export default function AnalyticsPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatCurrency, formatPercent } = useFormatters();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    
    const { todaySales, weekSales, monthSales, error } = await SalesService.getSalesMetrics();
    
    if (error) {
      toast({
        title: t('common.error'),
        description: t('analytics.errors.loadAnalytics'),
        variant: 'destructive',
      });
    } else {
      setMetrics({ todaySales, weekSales, monthSales });
    }
    
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const averageDaily = metrics.weekSales > 0 ? metrics.weekSales / 7 : 0;
  const weeklyGrowth = metrics.weekSales > 0 && averageDaily > 0 ? (metrics.todaySales / averageDaily) * 100 : 0;
  const monthlyProgress = MONTHLY_TARGET > 0 ? (metrics.monthSales / MONTHLY_TARGET) * 100 : 0;

  const todayMessageKey = metrics.todaySales > averageDaily
    ? 'analytics.insights.today.above'
    : 'analytics.insights.today.below';

  const weeklyPerformanceKey = metrics.weekSales > 1000
    ? 'analytics.insights.weekly.strong'
    : 'analytics.insights.weekly.focus';

  const monthlyPerformanceKey = metrics.monthSales > MONTHLY_TARGET / 2
    ? 'analytics.insights.monthly.onTrack'
    : 'analytics.insights.monthly.increase';

  return (
    <div className="mobile-container py-4 px-4 lg:px-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>
        <p className="text-muted-foreground">{t('analytics.description')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.cards.todayTitle')}</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.todaySales)}</div>
            <p className="text-xs text-muted-foreground">{t('analytics.cards.todaySubtitle')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.cards.weekTitle')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.weekSales)}</div>
            <p className="text-xs text-muted-foreground">{t('analytics.cards.weekSubtitle')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.cards.monthTitle')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.monthSales)}</div>
            <p className="text-xs text-muted-foreground">{t('analytics.cards.monthSubtitle')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('analytics.overview.title')}
          </CardTitle>
          <CardDescription>
            {t('analytics.overview.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{t('analytics.overview.averageTitle')}</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(averageDaily)}
                </p>
                <p className="text-xs text-muted-foreground">{t('analytics.overview.averageSubtitle')}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{t('analytics.overview.weeklyTitle')}</p>
                <p className="text-2xl font-bold">
                  {formatPercent(weeklyGrowth)}
                </p>
                <p className="text-xs text-muted-foreground">{t('analytics.overview.weeklySubtitle')}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{t('analytics.overview.monthlyTitle')}</p>
                <p className="text-2xl font-bold">
                  {formatPercent(monthlyProgress)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('analytics.overview.monthlyTarget', { target: formatCurrency(MONTHLY_TARGET) })}
                </p>
              </div>
              <Coins className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.insights.title')}</CardTitle>
          <CardDescription>{t('analytics.insights.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>{t('analytics.insights.today.heading')} </strong>
                {t(todayMessageKey, {
                  average: formatCurrency(averageDaily),
                  amount: formatCurrency(metrics.todaySales),
                })}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>{t('analytics.insights.weekly.heading')} </strong>
                {t('analytics.insights.weekly.summary', { amount: formatCurrency(metrics.weekSales) })}{' '}
                {t(weeklyPerformanceKey)}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>{t('analytics.insights.monthly.heading')} </strong>
                {t('analytics.insights.monthly.summary', {
                  achieved: formatCurrency(metrics.monthSales),
                  target: formatCurrency(MONTHLY_TARGET),
                })}{' '}
                {t(monthlyPerformanceKey)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
