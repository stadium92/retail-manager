import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile, UserRole, Store } from '@/types';
import { OfflineTeamService } from './OfflineTeamService';

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: AppRole;
  store_id?: string;
  store_name?: string;
  vehicle_type?: string;
  is_active: boolean;
  created_at: string;
  sales_count?: number;
  total_revenue?: number;
  deliveries_completed?: number;
  deliveries_total?: number;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'worker' | 'deliverer';
  store_id?: string;
  store_name?: string;
  vehicle_type?: string;
}

export class TeamService {
  /**
   * Get all workers with their profile and performance data
   */
  static async getWorkers(): Promise<{ data?: TeamMember[]; error?: any }> {
    // Use offline-capable service
    return OfflineTeamService.getWorkers();
  }

  /**
   * Get all deliverers with their profile and performance data
   */
  static async getDeliverers(): Promise<{ data?: TeamMember[]; error?: any }> {
    // Use offline-capable service
    return OfflineTeamService.getDeliverers();
  }

  /**
   * Create a new user (worker or deliverer) via Edge Function
   * Works offline - queues for later sync
   */
  static async createUser(payload: CreateUserPayload): Promise<{ data?: any; error?: any }> {
    // Use offline-capable service
    return OfflineTeamService.createUser(payload);
  }

  /**
   * Update user status (enable/disable)
   */
  static async updateUserStatus(userId: string, isActive: boolean): Promise<{ success: boolean; error?: any }> {
    return OfflineTeamService.updateUserStatus(userId, isActive);
  }

  /**
   * Delete a team member (removes role, profile stays for audit)
   */
  static async deleteTeamMember(roleId: string, userId: string): Promise<{ error?: any }> {
    try {
      // Remove the role assignment
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      return {};
    } catch (error) {
      console.error('TeamService.deleteTeamMember error:', error);
      return { error };
    }
  }

  /**
   * Update team member's store assignment
   */
  static async updateStoreAssignment(roleId: string, storeId: string | null): Promise<{ error?: any }> {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ store_id: storeId })
        .eq('id', roleId);

      if (error) throw error;
      return {};
    } catch (error) {
      console.error('TeamService.updateStoreAssignment error:', error);
      return { error };
    }
  }

  /**
   * Get team counts for overview cards
   */
  static async getTeamCounts(): Promise<{ workers: number; deliverers: number; error?: any }> {
    try {
      const { count: workersCount, error: workersError } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'worker');

      const { count: deliverersCount, error: deliverersError } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'deliverer');

      if (workersError) throw workersError;
      if (deliverersError) throw deliverersError;

      return {
        workers: workersCount || 0,
        deliverers: deliverersCount || 0,
      };
    } catch (error) {
      console.error('TeamService.getTeamCounts error:', error);
      return { workers: 0, deliverers: 0, error };
    }
  }
}
