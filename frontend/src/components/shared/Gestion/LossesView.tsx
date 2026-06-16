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


export interface LossesViewProps {
    movements: any[]; lossForm: any; setLossForm: any; handleRecordLoss: any; isProductLookupOpen: boolean; setIsProductLookupOpen: any; lowStockQuery: any; storeId: string; OfflineIndicator: any; t: any;
  }

export function LossesView({ movements, lossForm, setLossForm, handleRecordLoss, isProductLookupOpen, setIsProductLookupOpen, lowStockQuery, storeId, OfflineIndicator, t }: LossesViewProps) {
const lossMovements = movements.filter(m => m.type === 'out' && m.reason?.startsWith('Perte'));
        const todayLosses = lossMovements.filter(m => new Date(m.date) >= startOfDay(new Date()));

        return (
          <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
            <div className="space-y-4">
              <Card className="border-danger/30">
                <CardHeader className="py-3 bg-danger/5">
                  <CardTitle className="text-sm flex items-center gap-2 text-danger uppercase font-mono">
                    <Trash2 className="h-4 w-4" />
                    {t('menu.management.recordLoss')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('inventory.table.name')}</Label>
                    <Button 
                      variant="outline" 
                      className={cn("w-full h-11 justify-start text-left font-normal border-2", !lossForm.product && "text-muted-foreground")}
                      onClick={() => setIsProductLookupOpen(true)}
                    >
                      {lossForm.product ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-black uppercase">{lossForm.product.name}</span>
                          <span className="text-[10px] text-muted-foreground">{t('menu.management.currentStock')}: {lossForm.product.quantity} {t('inventory.unitTypes.piece')}</span>
                        </div>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          {t('common.search')}...
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('inventory.table.quantity')}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={lossForm.quantity === 0 ? '' : lossForm.quantity}
                      onChange={(e) => setLossForm(f => ({ ...f, quantity: e.target.value === '' ? '' : parseInt(e.target.value) || 0 }))}
                      onBlur={() => { if (lossForm.quantity === '') setLossForm(f => ({ ...f, quantity: 1 })) }}
                      className="h-11 text-lg font-mono font-bold border-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('menu.program.reason')}</Label>
                    <Select 
                      value={lossForm.reason} 
                      onValueChange={(v: 'expired' | 'broken' | 'theft' | 'other') => setLossForm(f => ({ ...f, reason: v }))}
                    >
                      <SelectTrigger className="h-11 border-2 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expired">{t('menu.management.reasons.expired')}</SelectItem>
                        <SelectItem value="broken">{t('menu.management.reasons.broken')}</SelectItem>
                        <SelectItem value="theft">{t('menu.management.reasons.theft')}</SelectItem>
                        <SelectItem value="other">{t('menu.management.reasons.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tighter text-muted-foreground">{t('menu.program.notes')}</Label>
                    <Textarea
                      value={lossForm.notes}
                      onChange={(e) => setLossForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="..."
                      rows={2}
                      className="border-2"
                    />
                  </div>

                  <Button 
                    onClick={() => {
                      if (confirm(t('menu.management.confirmLoss', { qty: lossForm.quantity, name: lossForm.product?.name }))) {
                        handleRecordLoss();
                      }
                    }} 
                    disabled={!lossForm.product || lossForm.quantity <= 0}
                    className="w-full h-12 bg-danger hover:bg-danger/90 text-white font-bold uppercase tracking-widest"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {t('menu.management.validateLoss')}
                  </Button>
                </CardContent>
              </Card>

              {/* Low stock warning */}
              {lowStockQuery.total > 0 && (
                <Card className="border-warning/50">
                  <CardHeader className="py-2 bg-warning/10">
                    <CardTitle className="text-xs flex items-center gap-2 text-warning uppercase">
                      <AlertTriangle className="h-3 w-3" />
                      {t('inventory.lowStock')} ({lowStockQuery.total})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[150px]">
                      <Table>
                        <TableBody>
                          {lowStockQuery.results.map(p => (
                            <TableRow key={p.id} className="h-8 border-b">
                              <TableCell className="text-[10px] font-bold uppercase truncate max-w-[150px]">{p.name}</TableCell>
                              <TableCell className="text-[10px] text-right text-warning font-bold font-mono">
                                {p.quantity} {t('inventory.unitTypes.piece')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card className="h-full">
                <CardHeader className="py-3 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-xs uppercase font-mono tracking-widest">{t('menu.management.lossHistory')}</CardTitle>
                  <OfflineIndicator />
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background border-b-2 shadow-sm">
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.time')}</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold">{t('sidebar.inventory')}</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-center">{t('inventory.table.quantity')}</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold">{t('menu.program.reason')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {todayLosses.map(mov => (
                          <TableRow key={mov.id} className="h-11 border-b">
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {format(new Date(mov.created_at || mov.date || new Date()), 'HH:mm')}
                            </TableCell>
                            <TableCell className="text-xs font-bold uppercase">{mov.product_name}</TableCell>
                            <TableCell className="text-xs text-center font-bold text-danger font-mono">-{mov.quantity}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[9px] uppercase border-danger text-danger">
                                {t(`menu.management.reasons.${mov.reason?.replace('Perte: ', '')}`) || mov.reason?.replace('Perte: ', '') || t('common.other')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {todayLosses.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-20 text-xs text-muted-foreground uppercase font-mono tracking-widest">
                              {t('menu.management.noLossToday')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            
            <ProductLookupDialog
              open={isProductLookupOpen}
              onOpenChange={setIsProductLookupOpen}
              storeId={storeId}
              mode="retail"
              onSelect={(p) => {
                setLossForm(f => ({ ...f, product: p }));
                setIsProductLookupOpen(false);
              }}
            />
          </div>
        );
}
