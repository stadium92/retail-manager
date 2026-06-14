import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'tauri';

export interface DeviceInfo {
  type: DeviceType;
  /** Width in px at last measurement */
  width: number;
  /** True if running inside Tauri desktop wrapper */
  isTauri: boolean;
  /** True for mobile phones (< 768px) */
  isMobile: boolean;
  /** True for tablets (768px – 1279px) */
  isTablet: boolean;
  /** True for desktop browsers (≥ 1280px, non-Tauri) */
  isDesktopBrowser: boolean;
  /**
   * TRUE for desktop browsers AND Tauri.
   * Use this in Layout Adapters: render desktop UI when isDesktop is true.
   */
  isDesktop: boolean;
  /**
   * TRUE for mobile AND tablet.
   * Use this anywhere you need "touch screen" logic without caring which size.
   */
  isTouchDevice: boolean;
}

// ─── Tauri Detection ──────────────────────────────────────────────────────────
// Tauri injects window.__TAURI__ at startup. This is stable — check once.
// In Tauri, ALWAYS show desktop UI regardless of window size.
function checkIsTauri(): boolean {
  return false; // TEMPORARILY DISABLED FOR TESTING
  // return typeof window !== 'undefined' && '__TAURI__' in window;
}

// ─── Breakpoint Classification ────────────────────────────────────────────────
// These breakpoints are intentional for a restaurant/retail context:
//   - Tablets (768-1279px) run in kitchens and at counters — they need touch UI
//   - Only true laptops/monitors (≥1280px) and Tauri get the dense desktop UI
function classifyWidth(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width < 768)  return 'mobile';
  if (width < 1280) return 'tablet';
  return 'desktop';
}

function buildDeviceInfo(width: number): DeviceInfo {
  const isTauri = checkIsTauri();

  if (isTauri) {
    return {
      type:            'tauri',
      width,
      isTauri:         true,
      isMobile:        false,
      isTablet:        false,
      isDesktopBrowser:false,
      isDesktop:       true,
      isTouchDevice:   false,
    };
  }

  const sizeType = classifyWidth(width);

  return {
    type:            sizeType,
    width,
    isTauri:         false,
    isMobile:        sizeType === 'mobile',
    isTablet:        sizeType === 'tablet',
    isDesktopBrowser:sizeType === 'desktop',
    isDesktop:       sizeType === 'desktop',
    isTouchDevice:   sizeType === 'mobile' || sizeType === 'tablet',
  };
}

function getInitialDeviceInfo(): DeviceInfo {
  // SSR/build-time guard — default to desktop if no window
  if (typeof window === 'undefined') {
    return buildDeviceInfo(1440);
  }
  return buildDeviceInfo(window.innerWidth);
}

/**
 * useDeviceType — Tracks the current device tier and updates on window resize.
 *
 * Tauri is detected once at mount. Width is measured via ResizeObserver on
 * document.documentElement for accuracy. rAF debounce prevents layout thrash.
 *
 * @example
 * const { isTouchDevice, isDesktop, type } = useDeviceType();
 */
export function useDeviceType(): DeviceInfo {
  const [device, setDevice] = useState(getInitialDeviceInfo);

  useEffect(() => {
    // Tauri windows don't meaningfully change between mobile/desktop widths.
    // Exit early — no listener needed.
    if (checkIsTauri()) return;

    let rafId: number;

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setDevice(buildDeviceInfo(document.documentElement.clientWidth));
      });
    });

    observer.observe(document.documentElement);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, []);

  return device;
}
