import { useEffect } from 'react';

interface UseBarcodeScannerProps {
    onScan: (barcode: string) => void;
    onError?: (error: Error) => void;
    enabled?: boolean;
}

export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScannerProps) {
    useEffect(() => {
        if (!enabled) return;

        const handleScannerEvent = (event: any) => {
            if (event.detail && event.detail.code) {
                onScan(event.detail.code);
            }
        };

        window.addEventListener('hardwareBarcodeScanned', handleScannerEvent);
        return () => window.removeEventListener('hardwareBarcodeScanned', handleScannerEvent);
    }, [enabled, onScan]);
}
