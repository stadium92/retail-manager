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
import { ProductLookupDialog } from '../worker/Sales/ProductLookupDialog';


export interface CashJournalViewProps {
    dateRange: any; setDateRange: any; isPettyCashOpen: boolean; setIsPettyCashOpen: any; pettyCashForm: any; setPettyCashForm: any; handleRecordPettyCash: any; kpis: any; cashEntries: any[]; formatCurrency: any; OfflineIndicator: any; t: any;
  }

export function CashJournalView({ dateRange, setDateRange, isPettyCashOpen, setIsPettyCashOpen, pettyCashForm, setPettyCashForm, handleRecordPettyCash, kpis, cashEntries, formatCurrency, OfflineIndicator, t }: CashJournalViewProps) {
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
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <Button size="sm" variant="secondary" className="h-9 gap-2" onClick={() => setIsPettyCashOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('menu.management.recordExpense')}
                </Button>
              </div>
              <OfflineIndicator />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/20">
                      <ArrowDownCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.income')}</p>
                      <p className="text-lg font-bold text-success font-mono">{formatCurrency(kpis.totalRevenue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-danger/20">
                      <ArrowUpCircle className="h-5 w-5 text-danger" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.expenses')}</p>
                      <p className="text-lg font-bold text-danger font-mono">{formatCurrency(kpis.totalExpenses)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.creditSale')}</p>
                      <p className="text-lg font-bold font-mono">{formatCurrency(kpis.totalCreditSales)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-primary/10 border-primary">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20 text-primary">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">{t('menu.program.cashBalance')}</p>
                      <p className="text-lg font-bold font-mono">{formatCurrency(kpis.netCash)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-lg border-2 border-primary/20">
              <CardHeader className="py-3 border-b bg-muted/10">
                <CardTitle className="text-sm uppercase tracking-widest font-mono">
                  {t('menu.program.cashJournal')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.time')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('inventory.fields.description')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">{t('inventory.fields.category')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.transaction')}</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">{t('menu.program.runningBalance')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashEntries.map(entry => (
                        <TableRow key={entry.id} className={cn("h-11 border-b hover:bg-muted/10 transition-colors", (entry as any).isCredit && "opacity-60 bg-muted/20 italic")}>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {format(new Date(entry.date), 'HH:mm')}
                          </TableCell>
                          <TableCell className="text-xs font-bold uppercase truncate max-w-[250px]">
                            {entry.description}
                            {(entry as any).method && (
                              <Badge variant="outline" className="ml-2 text-[8px] h-4 py-0 uppercase border-muted-foreground/30">
                                {(entry as any).method}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[10px] uppercase text-muted-foreground font-medium">
                            {entry.category}
                          </TableCell>
                          <TableCell className={cn("text-xs text-right font-bold font-mono", entry.type === 'in' ? "text-success" : "text-danger")}>
                            {entry.type === 'in' ? '+' : '-'}{formatCurrency(entry.amount)}
                          </TableCell>
                          <TableCell className="text-xs text-right font-black font-mono text-primary bg-primary/5">
                            {formatCurrency((entry as any).runningBalance || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {cashEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-24 uppercase font-mono tracking-[0.2em] opacity-50">
                            {t('common.noData')}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            <Dialog open={isPettyCashOpen} onOpenChange={setIsPettyCashOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="uppercase font-mono">{t('menu.management.recordExpense')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('menu.program.amount')}</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={pettyCashForm.amount}
                      onChange={e => setPettyCashForm({...pettyCashForm, amount: e.target.value})}
                      className="h-12 text-2xl font-bold font-mono border-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('menu.program.reason')}</Label>
                    <Select 
                      value={pettyCashForm.category}
                      onValueChange={v => setPettyCashForm({...pettyCashForm, category: v})}
                    >
                      <SelectTrigger className="h-11 border-2 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="petty_cash">Dépense Diverse / Petty Cash</SelectItem>
                        <SelectItem value="supplies">Fournitures / Supplies</SelectItem>
                        <SelectItem value="bills">Factures / Bills</SelectItem>
                        <SelectItem value="salaries">Avance Salaire / Salaries</SelectItem>
                        <SelectItem value="delivery">Frais Livraison / Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase">{t('inventory.fields.description')}</Label>
                    <Textarea 
                      placeholder={t('analytics.expenseDetailPlaceholder')}
                      value={pettyCashForm.description}
                      onChange={e => setPettyCashForm({...pettyCashForm, description: e.target.value})}
                      className="border-2"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPettyCashOpen(false)}>{t('common.cancel')}</Button>
                  <Button 
                    className="bg-danger hover:bg-danger/90 text-white font-bold"
                    onClick={handleRecordPettyCash}
                  >
                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                    {t('common.confirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );
}
