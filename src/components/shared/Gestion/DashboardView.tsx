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


export interface DashboardViewProps {
    dateRange: any; setDateRange: any; kpis: any; lowStockQuery: any; weeklyRevenue: any; stockHealthData: any[]; topProducts: any[]; categoryData: any[]; formatCurrency: any; OfflineIndicator: any; t: any;
  }

export function DashboardView({ dateRange, setDateRange, kpis, lowStockQuery, weeklyRevenue, stockHealthData, topProducts, categoryData, formatCurrency, OfflineIndicator, t }: DashboardViewProps) {
return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 font-mono">
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                          </>
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
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] h-7 px-2 uppercase"
                    onClick={() => setDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}
                  >
                    {t('menu.program.today')}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] h-7 px-2 uppercase"
                    onClick={() => setDateRange({ from: startOfDay(subDays(new Date(), 7)), to: endOfDay(new Date()) })}
                  >
                    {t('menu.program.last7Days')}
                  </Button>
                </div>
              </div>
              <OfflineIndicator />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-primary">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Coins className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('menu.program.revenue')}</p>
                      <p className="text-lg font-bold">{formatCurrency(kpis.totalRevenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-success">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/20">
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('menu.program.potentialMargin')}</p>
                      <p className="text-lg font-bold text-success">+{formatCurrency(kpis.totalProfit)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-amber-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <ShoppingCart className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('sidebar.sales')}</p>
                      <p className="text-lg font-bold text-amber-600">{kpis.orderCount} {t('menu.program.bills')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-warning">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/20">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('inventory.stockAlerts')}</p>
                      <p className="text-lg font-bold text-warning">{lowStockQuery.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('analytics.revenueEvolution')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={weeklyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="date" className="text-[10px] font-mono" />
                      <YAxis className="text-[10px] font-mono" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))', 
                          border: '1px solid hsl(var(--border))',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('menu.management.stockStatus')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stockHealthData.length > 0 ? (
                    <div className="space-y-4">
                      <div className="h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stockHealthData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {stockHealthData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-1 gap-2 pt-2">
                        {stockHealthData.map((item) => (
                          <div key={item.name} className="flex items-center justify-between text-[10px] font-bold uppercase">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                              <span>{item.name}</span>
                            </div>
                            <span className="font-mono">{item.value} {t('menu.program.productsDisplayed')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground uppercase font-mono">
                      {t('common.noData')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               <Card>
                <CardHeader className="py-3 border-b bg-muted/20">
                  <CardTitle className="text-xs uppercase">{t('analytics.topProductsVolume')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {topProducts.slice(0, 5).map((p, idx) => (
                        <TableRow key={p.name} className="h-10 border-b last:border-0">
                          <TableCell className="text-xs font-mono w-8 text-muted-foreground">0{idx+1}</TableCell>
                          <TableCell className="text-xs font-bold uppercase">{p.name}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{p.qty} {t('inventory.unitTypes.piece')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
               </Card>

               <Card>
                <CardHeader className="py-3 border-b bg-muted/20">
                  <CardTitle className="text-xs uppercase">{t('analytics.categoryDistribution')}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {categoryData.map((c, idx) => (
                        <TableRow key={c.name} className="h-10 border-b last:border-0">
                          <TableCell className="text-xs font-bold uppercase">{c.name}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{formatCurrency(c.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
               </Card>
            </div>
          </div>
        );
}
