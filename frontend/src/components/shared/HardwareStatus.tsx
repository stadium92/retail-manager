import React from 'react';
import { Printer as PrinterIcon, Scan as ScannerIcon } from 'lucide-react';
import { usePrinter } from '@/contexts/PrinterContext';
import { useScanner } from '@/contexts/ScannerContext';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function HardwareStatus() {
  const { defaultPrinterId } = usePrinter();
  const { isHardwareConnected: isScannerConnected } = useScanner();
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 mr-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "p-1.5 rounded-full",
            defaultPrinterId ? "text-green-600 bg-green-50" : "text-muted-foreground bg-muted/30"
          )}>
            <PrinterIcon className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{defaultPrinterId ? t('hardware.printerOnlineLabel') : t('hardware.printerNotConfiguredLabel')}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "p-1.5 rounded-full",
            isScannerConnected ? "text-green-600 bg-green-50" : "text-muted-foreground bg-muted/30"
          )}>
            <ScannerIcon className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isScannerConnected ? t('hardware.scannerReady') : t('hardware.scannerHIDOnly')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
