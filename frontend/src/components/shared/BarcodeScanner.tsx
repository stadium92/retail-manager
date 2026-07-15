import { useZxing } from 'react-zxing';
import { X, Camera, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
  isScanning: boolean;
}

export function BarcodeScanner({ onResult, onClose, isScanning }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);

  const { ref } = useZxing({
    paused: !isScanning,
    onResult(result) {
      setScanSuccess(true);
      setTimeout(() => {
        onResult(result.getText());
        onClose();
      }, 300);
    },
    onError(error) {
      if (error?.message?.includes('Permission')) {
        setHasPermission(false);
      }
    },
  });

  useEffect(() => {
    if (isScanning) {
      setScanSuccess(false);
      navigator.mediaDevices?.getUserMedia({ video: true })
        .then(() => setHasPermission(true))
        .catch(() => setHasPermission(false));
    }
  }, [isScanning]);

  if (!isScanning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-4">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 text-white bg-black/50 hover:bg-black/70 rounded-full"
        >
          <X className="h-5 w-5" />
        </Button>

        {hasPermission === false ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {t('scanner.cameraAccessDenied', 'Camera Access Required')}
            </h3>
            <p className="text-white/70 text-sm">
              {t('scanner.enableCamera', 'Please enable camera access in your browser settings to scan products.')}
            </p>
            <Button
              variant="outline"
              onClick={onClose}
              className="mt-6"
            >
              {t('common.close', 'Close')}
            </Button>
          </div>
        ) : (
          <>
            {/* Scanner Frame */}
            <div className="relative overflow-hidden rounded-lg">
              {/* Video Element */}
              <video
                ref={ref}
                className={`w-full aspect-square object-cover rounded-lg transition-all duration-200 ${
                  scanSuccess ? 'border-4 border-green-500' : 'border-2 border-white/20'
                }`}
              />

              {/* Scanning Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner Markers */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />

                {/* Scan Line Animation */}
                {!scanSuccess && (
                  <div className="absolute left-4 right-4 h-0.5 bg-primary/80 animate-pulse top-1/2" />
                )}
              </div>

              {/* Success Overlay */}
              {scanSuccess && (
                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center animate-in zoom-in duration-200">
                  <div className="bg-green-500 rounded-full p-4">
                    <Camera className="h-8 w-8 text-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-4 text-center">
              <p className="text-white/90 text-sm flex items-center justify-center gap-2">
                <Camera className="h-4 w-4" />
                {t('scanner.instructions', 'Point camera at barcode')}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
