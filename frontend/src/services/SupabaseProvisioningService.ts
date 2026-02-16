import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types';

export interface ProvisionUserPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'worker' | 'deliverer';
  store_id?: string;
  vehicle_type?: string;
}

export interface ProvisionUserResult {
  success: boolean;
  userId?: string;
  error?: string;
  alreadyExists?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const buildProvisionClient = () => {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Supabase environment variables are missing.');
  }

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

export class SupabaseProvisioningService {
  static async provisionUser(payload: ProvisionUserPayload): Promise<ProvisionUserResult> {
    try {
      const client = buildProvisionClient();
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;

      const { data, error } = await client.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            full_name: payload.full_name,
            phone: payload.phone,
            role: payload.role,
            vehicle_type: payload.vehicle_type,
          },
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
        },
      });

      if (error) {
        const message = error.message || 'Supabase signup failed';
        const normalized = message.toLowerCase();
        const alreadyExists = normalized.includes('already registered') || normalized.includes('already exists');
        return { success: false, error: message, alreadyExists };
      }

      const userId = data.user?.id;
      if (!userId) {
        return { success: false, error: 'Supabase signup did not return a user id.' };
      }

      const targetRole = payload.role as AppRole;
      if (targetRole === 'worker' || targetRole === 'deliverer') {
        // Insert role directly to user_roles table
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: targetRole,
            store_id: payload.store_id ?? null,
          });

        if (roleError) {
          return { success: false, error: roleError.message || 'Failed to assign role.' };
        }
      }

      return { success: true, userId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to provision user.',
      };
    }
  }
}
