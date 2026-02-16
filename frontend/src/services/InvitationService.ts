import { supabase } from '@/integrations/supabase/client';
import { getDataClient } from '@/lib/dataClient';
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

        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/worker_invitations`, {
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

      // Generate secure token client-side (temporary solution until RPC function is created)
      const token = btoa(crypto.getRandomValues(new Uint8Array(32)).toString()).replace(/[+/=]/g, '').slice(0, 40);

      const { data: invitation, error } = await supabase
        .from('worker_invitations' as any)
        .insert({
          email: data.email,
          role: data.role,
          store_id: data.store_id,
          token: token,
        })
        .select()
        .single();

      if (error || !invitation) return { error: error || new Error('Failed to create invitation') };

      return { data: invitation };
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
        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/worker_invitations?${params.toString()}`, {
          headers: { ...headers },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { error: payload };
        return { data: payload };
      }

      let query = supabase
        .from('worker_invitations' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;
      return { data: data || [], error };
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

        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/worker_invitations/${id}/resend`, {
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

        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/worker_invitations/${id}/cancel`, {
          method: 'POST',
          headers: { ...headers },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return { error: payload };
        return {};
      }

      const { error } = await supabase
        .from('worker_invitations' as any)
        .update({ status: 'cancelled' })
        .eq('id', id);

      return { error };
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

        const response = await fetch(`${dataClient.localBridgeBaseUrl}/rest/v1/worker_invitations/accept`, {
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { error: { message: 'User not authenticated' } };
      }

      const { error } = await supabase.rpc('accept_invitation' as any, {
        _token: token,
        _user_id: user.id,
      });

      if (!error) {
        return { error };
      }

      const fallback = await supabase
        .from('worker_invitations' as any)
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('token', token)
        .eq('email', user.email || '');

      return { error: fallback.error || error };
    } catch (error) {
      return { error };
    }
  }
}
