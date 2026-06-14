// Delegating to useDeviceType for consistency.
// All existing imports of this hook continue to work with zero changes.
import { useDeviceType } from './use-device-type';

/**
 * @deprecated For new code, use useDevice() from DeviceContext instead.
 * Kept for backward compatibility with existing desktop components.
 */
export function useIsMobile(): boolean {
  return useDeviceType().isMobile;
}
