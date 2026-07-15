import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { MonitoringService } from '@/services/MonitoringService';

export type LogSeverity = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
    action_type: string;
    entity_affected?: string;
    entity_id?: string;
    old_value?: string;
    new_value?: string;
    severity?: LogSeverity;
    notes?: string;
    store_id?: string;
}

export class Logger {
    private static appVersion = '1.0.0';
    private static hardwareId: string | null = null;

    private static async getHardwareId(): Promise<string> {
        if (this.hardwareId) return this.hardwareId;
        const { LicenseService } = await import('@/services/LicenseService');
        this.hardwareId = await LicenseService.getDeviceHash();
        return this.hardwareId;
    }

    static async log(entry: LogEntry) {
        const { isLocalFirst, localBridgeBaseUrl } = getDataClient();
        const hid = await this.getHardwareId();
        
        // Always log to console in development
        const consoleMethod = entry.severity === 'ERROR' ? 'error' : entry.severity === 'WARN' ? 'warn' : 'log';
        console[consoleMethod](`[${entry.severity || 'INFO'}] ${entry.action_type}:`, entry);

        // Forward to Sentry
        if (entry.severity === 'ERROR') {
            MonitoringService.captureException(new Error(entry.action_type), {
                ...entry,
                source: 'Logger'
            });
        } else if (entry.severity === 'WARN') {
            MonitoringService.captureMessage(entry.action_type, 'warning', {
                ...entry,
                source: 'Logger'
            });
        }

        if (isLocalFirst) {
            try {
                const headers = await OfflineAuthService.getAuthHeaders();
                await fetch(`${localBridgeBaseUrl}/rest/v1/audit_logs`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(headers || {})
                    },
                    body: JSON.stringify({
                        ...entry,
                        timestamp: new Date().toISOString(),
                        app_version: this.appVersion,
                        severity: entry.severity || 'INFO',
                        ip_address: hid // Use ip_address field to store Hardware ID for now
                    })
                });
            } catch (err) {
                console.warn('Failed to send log to LocalBridge:', err);
            }
        }
    }

    static info(action: string, entry: Partial<LogEntry> = {}) {
        return this.log({ ...entry, action_type: action, severity: 'INFO' });
    }

    static warn(action: string, entry: Partial<LogEntry> = {}) {
        return this.log({ ...entry, action_type: action, severity: 'WARN' });
    }

    static error(action: string, entry: Partial<LogEntry> = {}) {
        return this.log({ ...entry, action_type: action, severity: 'ERROR' });
    }

    /**
     * Low-level system trace for debugging (database queries, state syncs, etc.)
     */
    static trace(action: string, entry: Partial<LogEntry> = {}) {
        // Only log to backend if severity is elevated or explicitly requested
        // For now, treat as INFO but with a technical prefix
        return this.log({ ...entry, action_type: `TRACE_${action}`, severity: 'INFO' });
    }
}
