import { invoke } from '@tauri-apps/api/core';
import { LocalDatabase } from './LocalDatabase';
import { getDataClient, smartFetch } from '@/lib/dataClient';

export interface LicenseStore {
    store_id: string;
    store_name: string;
    activated_at: string;
}

export interface LicenseStatus {
    status: 'active' | 'trial' | 'expired' | 'blocked';
    days_remaining: number;
    stores: LicenseStore[];
    device_hash: string;
}

export class LicenseService {
    static async getStatus(): Promise<LicenseStatus> {
        try {
            // DeLorean Time Check
            const isTimeValid = await this.checkTimeManipulation();
            if (!isTimeValid) {
                return {
                    status: 'blocked',
                    days_remaining: 0,
                    stores: [],
                    device_hash: await this.getDeviceHash(),
                };
            }

            // Fallback for web development
            if (!(window as any).__TAURI_INTERNALS__) {
                return {
                    status: 'trial',
                    days_remaining: 30,
                    stores: [],
                    device_hash: 'DEV-MODE',
                };
            }
            return await invoke<LicenseStatus>('get_license_status_command');
        } catch (error) {
            console.error('Failed to get license status:', error);
            return {
                status: 'expired',
                days_remaining: 0,
                stores: [],
                device_hash: 'ERROR',
            };
        }
    }

    static async validateKey(key: string): Promise<boolean> {
        try {
            return await invoke<boolean>('validate_license_command', { key });
        } catch (error: any) {
            throw new Error(error || 'Invalid activation key');
        }
    }

    static async activate(key: string, storeName: string): Promise<void> {
        try {
            await invoke('activate_license_command', { key, store_name: storeName });
        } catch (error: any) {
            throw new Error(error || 'Activation failed');
        }
    }

    static async getDeviceHash(): Promise<string> {
        try {
            if (!(window as any).__TAURI_INTERNALS__) return 'DEV-HASH';
            return await invoke<string>('get_device_hash_command');
        } catch (error) {
            return 'UNKNOWN';
        }
    }

    static async checkTimeManipulation(): Promise<boolean> {
        try {
            await LocalDatabase.init();
            const lastKnownTime = await LocalDatabase.getSystemSetting('last_known_time');
            const now = new Date().getTime();
            
            // 1. Check if current system time is before last known time
            // We allow a small 5-minute grace period for minor clock adjustments
            if (lastKnownTime && now < (lastKnownTime - 300000)) {
                console.error('[DeLorean] System clock rollback detected! LKT:', new Date(lastKnownTime).toISOString(), 'Now:', new Date(now).toISOString());
                return false;
            }

            // 2. Check against Local Bridge time (if available)
            const dc = getDataClient();
            try {
                const res = await smartFetch(`${dc.localBridgeBaseUrl}/rest/v1/ping`);
                if (res.ok) {
                    const data = await res.json();
                    const serverTime = new Date(data.time).getTime();
                    
                    if (lastKnownTime && serverTime < (lastKnownTime - 300000)) {
                        console.error('[DeLorean] Bridge reports earlier time than LKT!');
                        return false;
                    }
                    
                    // Update LKT to the latest of either
                    const latest = Math.max(now, serverTime, lastKnownTime || 0);
                    await LocalDatabase.saveSystemSetting('last_known_time', latest);
                } else {
                    const latest = Math.max(now, lastKnownTime || 0);
                    await LocalDatabase.saveSystemSetting('last_known_time', latest);
                }
            } catch (e) {
                const latest = Math.max(now, lastKnownTime || 0);
                await LocalDatabase.saveSystemSetting('last_known_time', latest);
            }

            return true;
        } catch (error) {
            console.error('Time check failed:', error);
            return true; 
        }
    }
}
