import { useState, useEffect, useCallback } from 'react';
import { Monitor, RotateCcw } from 'lucide-react';

interface MinWidthGateProps {
  /**
   * Minimum screen width in pixels required to show children.
   * Defaults to 675px (suitable for the desktop POS/retail app, reduced by 25% from 900px).
   */
  minWidth?: number;
  /** Content to render when the screen is wide enough */
  children: React.ReactNode;
}

/**
 * MinWidthGate
 * Blocks the app content on screens narrower than `minWidth` and shows a
 * friendly "Please use a larger screen" overlay instead.
 *
 * This is intentional for the WorkerLayout desktop app which requires
 * at least ~900px to be usable.
 */
export function MinWidthGate({ minWidth = 675, children }: MinWidthGateProps) {
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1920
  );

  const handleResize = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const isTooNarrow = windowWidth < minWidth;

  if (!isTooNarrow) {
    return <>{children}</>;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background px-8"
      aria-live="polite"
    >
      {/* Animated icon */}
      <div className="relative">
        <div className="absolute -inset-4 rounded-full bg-primary/10 animate-pulse" />
        <div className="relative w-20 h-20 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Monitor className="w-10 h-10 text-primary" />
        </div>
      </div>

      {/* Text */}
      <div className="text-center space-y-2 max-w-xs">
        <h2 className="text-xl font-black uppercase tracking-tight text-foreground">
          Écran trop petit
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Cette application est conçue pour les grands écrans.
          Veuillez agrandir votre fenêtre ou utiliser un appareil avec un écran
          d'au moins <span className="text-primary font-bold">{minWidth}px</span> de large.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Taille actuelle : <span className="font-mono text-foreground/50">{windowWidth}px</span>
          {' '}/ requis : <span className="font-mono text-primary/70">{minWidth}px</span>
        </p>
      </div>

      {/* Live width indicator bar */}
      <div className="w-full max-w-xs space-y-1.5">
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>0</span>
          <span>{minWidth}px</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-red-500 transition-all duration-300"
            style={{
              width: `${Math.min((windowWidth / minWidth) * 100, 100)}%`,
              backgroundColor: windowWidth >= minWidth * 0.8 ? 'rgb(var(--primary))' : '#ef4444',
            }}
          />
        </div>
        <p className="text-center text-[10px] text-muted-foreground">
          <RotateCcw className="inline w-3 h-3 mr-1 opacity-50" />
          La page se débloquera automatiquement
        </p>
      </div>
    </div>
  );
}
