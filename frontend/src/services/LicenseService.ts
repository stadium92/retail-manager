import { invoke } from '@tauri-apps/api/core';

export interface LicenseStore {
    store_id: string;
    store_name: string;
    activated_at: string;
}

export interface LicenseStatus {
    status: 'active' | 'trial' | 'expired';
    days_remaining: number;
    stores: LicenseStore[];
    device_hash: string;
}

export class LicenseService {
    static async getStatus(): Promise<LicenseStatus> {
        try {
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
            await invoke('activate_license_command', { key, storeName });
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
}
