import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from "@/components/ui/badge";
import { 
  Coins, TrendingUp, Package, AlertTriangle, ShoppingCart,
  ArrowDownCircle, ArrowUpCircle, Save, Trash2, BarChart3,
  WifiOff, RefreshCw, Search, Calendar as CalendarIcon, Plus
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { ProductLookupDialog } from '@/components/worker/Sales/ProductLookupDialog';


export interface StatisticsViewProps {
    dateRange: any; setDateRange: any; sales: any[]; kpis: any; analytics: any; topProducts: any[]; formatCurrency: any; OfflineIndicator: any; t: any;
  }

export function StatisticsView({ dateRange, setDateRange, sales, kpis, analytics, topProducts, formatCurrency, OfflineIndicator, t }: StatisticsViewProps) {
// Calculate Hourly Distribution
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}h`,
          revenue: 0,
          count: 0
        }));

        sales.forEach(sale => {
          const hour = new Date(sale.created_at).getHours();
          hourlyData[hour].revenue += Number(sale.total_price || 0);
          hourlyData[hour].count += 1;
        });

        const activeHours = hourlyData.filter(h => h.count > 0 || h.revenue > 0);

        // Average Basket Value
        const abv = kpis.orderCount > 0 ? kpis.totalRevenue / kpis.orderCount : 0;
        const avgItems = kpis.orderCount > 0 
          ? sales.reduce((sum, s) => sum + ((s.items?.length ? s.items : s.sale_items) || []).length, 0) / kpis.orderCount 
          : 0;

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 font-mono">
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}</>
                        ) : (
                          format(dateRange.from, "dd/MM/yy")
                        )
                      ) : (
                        <span>{t('menu.program.selectDate')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <OfflineIndicator />
            </div>

            {/* Advanced KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('analytics.avgBasket')}</p>
                    <p className="text-xl font-bold font-mono">{formatCurrency(abv)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary opacity-20" />
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('analytics.itemsPerSale')}</p>
                    <p className="text-xl font-bold font-mono">{avgItems.toFixed(1)}</p>
                  </div>
                  <Package className="h-8 w-8 text-success opacity-20" />
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{t('analytics.creditRate')}</p>
                    <p className="text-xl font-bold font-mono">
                      {kpis.totalRevenue > 0 ? ((kpis.totalCreditSales / (kpis.totalRevenue + kpis.totalCreditSales)) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-warning opacity-20" />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hourly Peak Analysis */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('analytics.hourlyTraffic')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={activeHours}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="hour" className="text-[10px] font-mono" />
                      <YAxis yAxisId="left" className="text-[10px] font-mono" orientation="left" stroke="#888888" />
                      <YAxis yAxisId="right" className="text-[10px] font-mono" orientation="right" stroke="hsl(var(--primary))" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', fontSize: '12px' }}
                      />
                      <Bar yAxisId="left" dataKey="count" name={t('analytics.sales')} fill="#888888" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="revenue" name={t('analytics.revenue')} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Worker Performance */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('analytics.workerPerformance')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow className="bg-muted/20">
                        <TableHead className="text-[10px] uppercase">{t('common.name')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-center">{t('sidebar.sales')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">{t('analytics.revenue')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics?.top_workers?.map(worker => (
                        <TableRow key={worker.name} className="h-11">
                          <TableCell className="text-xs font-bold uppercase">{worker.name}</TableCell>
                          <TableCell className="text-xs text-center font-mono">{worker.sales_count}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-primary">
                            {formatCurrency(worker.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!analytics?.top_workers?.length && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8 uppercase">
                            {t('analytics.noPerformanceData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="py-3 border-b bg-muted/20">
                <CardTitle className="text-xs uppercase">{t('menu.program.topProducts')}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow>
                        <TableHead className="text-[10px] uppercase w-12">#</TableHead>
                        <TableHead className="text-[10px] uppercase">{t('inventory.table.name')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-center">{t('inventory.table.quantity')}</TableHead>
                        <TableHead className="text-[10px] uppercase text-right">Chiffre d'Affaires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((product, idx) => (
                        <TableRow key={product.name} className="h-11">
                          <TableCell className="text-xs font-bold text-primary font-mono">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-bold uppercase">{product.name}</TableCell>
                          <TableCell className="text-xs text-center font-mono">{product.qty}</TableCell>
                          <TableCell className="text-xs text-right font-bold">
                            {formatCurrency(product.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );
}
