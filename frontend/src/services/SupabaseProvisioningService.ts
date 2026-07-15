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

/**
 * SupabaseProvisioningService - INERT
 * Cloud provisioning is disabled. User creation is handled entirely
 * by the local bridge (/auth/workers endpoint).
 */
export class SupabaseProvisioningService {
  static async provisionUser(_payload: ProvisionUserPayload): Promise<ProvisionUserResult> {
    console.warn('[SupabaseProvisioningService] Cloud provisioning disabled. Use local bridge.');
    return {
      success: false,
      error: 'Cloud provisioning is disabled. Users are created via the local bridge.',
    };
  }
}
