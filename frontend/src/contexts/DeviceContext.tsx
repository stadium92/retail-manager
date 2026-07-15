import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useDeviceType, type DeviceInfo, type DeviceType } from '@/hooks/use-device-type';

interface DeviceContextValue extends DeviceInfo {}

const DeviceContext = createContext<DeviceContextValue | null>(null);

interface DeviceProviderProps {
  children: ReactNode;
  /**
   * Override for testing/Storybook. Pass 'mobile', 'tablet', 'desktop', or 'tauri'.
   * In production, omit this — the hook auto-detects.
   */
  forceDeviceType?: DeviceType;
}

export function DeviceProvider({ children, forceDeviceType }: DeviceProviderProps) {
  const detected = useDeviceType();

  const value = useMemo(() => {
    if (!forceDeviceType) return detected;

    // Build a synthetic DeviceInfo from the forced type
    const forced: DeviceInfo = {
      type:            forceDeviceType,
      width:           forceDeviceType === 'mobile' ? 390
                     : forceDeviceType === 'tablet' ? 900
                     : 1440,
      isTauri:         forceDeviceType === 'tauri',
      isMobile:        forceDeviceType === 'mobile',
      isTablet:        forceDeviceType === 'tablet',
      isDesktopBrowser:forceDeviceType === 'desktop',
      isDesktop:       forceDeviceType === 'desktop' || forceDeviceType === 'tauri',
      isTouchDevice:   forceDeviceType === 'mobile' || forceDeviceType === 'tablet',
    };
    return forced;
  }, [detected, forceDeviceType]);

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

/**
 * useDevice — consume the current device context.
 * Must be inside <DeviceProvider>.
 */
export function useDevice(): DeviceContextValue {
  const ctx = useContext(DeviceContext);
  if (!ctx) {
    throw new Error(
      'useDevice() called outside <DeviceProvider>. ' +
      'Ensure <DeviceProvider> wraps your application root in App.tsx.'
    );
  }
  return ctx;
}
