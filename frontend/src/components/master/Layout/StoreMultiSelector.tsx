import React, { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Store as StoreIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useMasterDataStore } from '@/stores/useMasterDataStore';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';
import { useTranslation } from 'react-i18next';
import { OfflineStoreService } from '@/services/OfflineStoreService';

export function StoreMultiSelector() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  
  const { 
    selectedStoreIds, 
    isAllStoresSelected, 
    toggleStoreSelection, 
    setAllStoresSelected 
  } = useMasterDashboardStore();

  useEffect(() => {
    const loadStores = async () => {
      const { data } = await OfflineStoreService.getStores();
      if (data) {
        setAvailableStores(data);
      }
    };
    loadStores();
  }, []);

  const selectedCount = isAllStoresSelected ? availableStores.length : selectedStoreIds.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 justify-between border-2 min-w-[200px] bg-background hover:bg-background/80 transition-all shadow-sm"
        >
          <div className="flex items-center gap-2">
            <StoreIcon className="h-4 w-4 text-primary" />
            <span className="font-bold text-xs uppercase tracking-tight truncate max-w-[120px]">
              {isAllStoresSelected ? t('sales.allStores') : 
               selectedCount === 0 ? t('common.select') :
               selectedCount === 1 ? availableStores.find(s => s.id === selectedStoreIds[0])?.name :
               `${selectedCount} ${t('sidebar.stores')}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {selectedCount > 0 && !isAllStoresSelected && (
              <Badge variant="secondary" className="h-5 px-1 font-mono text-[10px]">
                {selectedCount}
              </Badge>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0 shadow-xl border-2" align="end">
        <Command>
          <CommandInput placeholder={t('common.search')} className="h-9" />
          <CommandList>
            <CommandEmpty>{t('common.noData')}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => setAllStoresSelected(!isAllStoresSelected, availableStores.map(s => s.id))}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox 
                  checked={isAllStoresSelected} 
                  onCheckedChange={() => setAllStoresSelected(!isAllStoresSelected, availableStores.map(s => s.id))}
                />
                <span className="font-bold text-xs uppercase tracking-widest">{t('sales.allStores')}</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup className="max-h-[300px] overflow-y-auto">
              {availableStores.map((store) => (
                <CommandItem
                  key={store.id}
                  onSelect={() => toggleStoreSelection(store.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox 
                    checked={isAllStoresSelected || selectedStoreIds.includes(store.id)} 
                    disabled={isAllStoresSelected}
                    onCheckedChange={() => toggleStoreSelection(store.id)}
                  />
                  <span className="text-xs font-medium truncate">{store.name}</span>
                  {(isAllStoresSelected || selectedStoreIds.includes(store.id)) && (
                    <Check className="ml-auto h-3 w-3 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
