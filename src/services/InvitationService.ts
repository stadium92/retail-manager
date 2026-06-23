import { getDataClient, smartFetch } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';

export interface WorkerInvitation {
  id: string;
  email: string;
  role: 'worker' | 'deliverer';
  store_id?: string;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
}

export class InvitationService {
  static async createInvitation(data: {
    email: string;
    role: 'worker' | 'deliverer';
    store_id?: string;
  }): Promise<{ data?: any; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { error: { message: 'Local admin session required.' } };
        }

        const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/worker_invitations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(data),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { error: payload };
        return { data: payload };
      }

      return { error: { message: 'Cloud invitations are disabled. Use local bridge mode.' } };
    } catch (error) {
      return { error };
    }
  }

  static async getInvitations(storeId?: string): Promise<{ data?: any[]; error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { error: { message: 'Local admin session required.' } };
        }

        const params = new URLSearchParams();
        if (storeId) params.set('store_id', storeId);
        const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/worker_invitations?${params.toString()}`, {
          headers: { ...headers },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { error: payload };
        return { data: payload };
      }

      return { data: [], error: undefined };
    } catch (error) {
      return { error };
    }
  }

  static async resendInvitation(id: string): Promise<{ error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { error: { message: 'Local admin session required.' } };
        }

        const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/worker_invitations/${id}/resend`, {
          method: 'POST',
          headers: { ...headers },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { error: payload };
        return {};
      }

      return { error: { message: 'Invitation emails are disabled in offline-first mode.' } };
    } catch (error) {
      return { error };
    }
  }

  static async cancelInvitation(id: string): Promise<{ error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { error: { message: 'Local admin session required.' } };
        }

        const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/worker_invitations/${id}/cancel`, {
          method: 'POST',
          headers: { ...headers },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { error: payload };
        return {};
      }

      return { error: { message: 'Cloud invitations are disabled.' } };
    } catch (error) {
      return { error };
    }
  }

  static async acceptInvitation(token: string): Promise<{ error?: any }> {
    try {
      const dataClient = getDataClient();
      if (dataClient.isLocalFirst) {
        const headers = await OfflineAuthService.getAuthHeaders();
        if (!headers) {
          return { error: { message: 'Local session required.' } };
        }

        const response = await smartFetch(`${dataClient.localBridgeBaseUrl}/rest/v1/worker_invitations/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({ token }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { error: payload };
        return {};
      }

      return { error: { message: 'Cloud invitations are disabled. Use local bridge mode.' } };
    } catch (error) {
      return { error };
    }
  }
}
