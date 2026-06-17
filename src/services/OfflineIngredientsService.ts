import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from './OfflineAuthService';
import { supabase } from '@/lib/supabase';

// Define the type locally to avoid circular dependencies if any,
// or import it from the types file if available.
export interface Ingredient {
  id: string;
  store_id: string;
  name: string;
  unit: string;
  category: string;
  current_stock: number;
  min_threshold: number;
  cost_per_unit: number;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeIngredient {
  ingredient_id: string;
  ingredient_name: string;
  quantity_needed: number;
  unit: string;
  current_stock: number;
  cost_per_unit: number;
  min_threshold: number;
  default_unit: string;
}

export const OfflineIngredientsService = {
  async getIngredients(storeId: string): Promise<{ data?: Ingredient[]; error?: any }> {
    try {
      const dc = getDataClient();
      if (dc.isLocalFirst) {
        const data = await OfflineAuthService.localBridgeRequest<Ingredient[]>(
          `/rest/v1/ingredients?store_id=${storeId}`,
          { method: 'GET' }
        );
        return { data: data ?? [] };
      } else {
        const { data, error } = await supabase
          .from('ingredients')
          .select('*')
          .eq('restaurant_id', storeId)
          .order('name', { ascending: true });
        if (error) throw error;

        // Map restaurant_id to store_id for consistency
        const mapped = (data || []).map((i: any) => ({
          ...i,
          store_id: i.restaurant_id
        })) as Ingredient[];
        
        return { data: mapped };
      }
    } catch (error) {
      console.error('[OfflineIngredientsService] getIngredients error:', error);
      return { error };
    }
  },

  async getRecipeIngredients(dishId: string): Promise<{ data?: RecipeIngredient[]; error?: any }> {
    try {
      const dc = getDataClient();
      if (dc.isLocalFirst) {
        const res = await OfflineAuthService.localBridgeRequest<RecipeIngredient[]>(
          `/rest/v1/recipes?dish_id=${dishId}`,
          { method: 'GET' }
        );
        return { data: res || [] };
      } else {
        const { data, error } = await supabase
          .from('dish_recipes')
          .select('*, ingredients(*)')
          .eq('dish_id', dishId);
        if (error) throw error;
        
        const mapped = (data || []).map((r: any) => ({
          ingredient_id: r.ingredient_id,
          ingredient_name: r.ingredients?.name || '—',
          quantity_needed: r.quantity_needed,
          unit: r.unit,
          current_stock: r.ingredients?.current_stock || 0,
          cost_per_unit: r.ingredients?.cost_per_unit || 0,
          min_threshold: r.ingredients?.min_threshold || 0,
          default_unit: r.ingredients?.unit || r.unit,
        })) as RecipeIngredient[];
        
        return { data: mapped };
      }
    } catch (error) {
      console.error('[OfflineIngredientsService] getRecipeIngredients error:', error);
      return { error };
    }
  },

  async createIngredient(storeId: string, form: Partial<Ingredient>): Promise<{ data?: Ingredient; error?: any }> {
    try {
      const dc = getDataClient();
      if (dc.isLocalFirst) {
        const data = await OfflineAuthService.localBridgeRequest<Ingredient>(
          `/rest/v1/ingredients`,
          {
            method: 'POST',
            body: JSON.stringify({ store_id: storeId, ...form }),
          }
        );
        return { data: data || undefined };
      } else {
        const payload = {
          ...form,
          restaurant_id: storeId,
          updated_at: new Date().toISOString()
        };
        const id = crypto.randomUUID();
        const { error } = await supabase
          .from('ingredients')
          .insert({
            id,
            ...payload,
            created_at: new Date().toISOString(),
          });
        if (error) throw error;
        return { data: { id, store_id: storeId, ...form } as Ingredient };
      }
    } catch (error) {
      console.error('[OfflineIngredientsService] createIngredient error:', error);
      return { error };
    }
  },

  async updateIngredient(id: string, storeId: string, form: Partial<Ingredient>): Promise<{ data?: Ingredient; error?: any }> {
    try {
      const dc = getDataClient();
      if (dc.isLocalFirst) {
        const data = await OfflineAuthService.localBridgeRequest<Ingredient>(
          `/rest/v1/ingredients/${id}`,
          { method: 'PATCH', body: JSON.stringify(form) }
        );
        return { data: data || undefined };
      } else {
        const payload = {
          ...form,
          restaurant_id: storeId,
          updated_at: new Date().toISOString()
        };
        const { error } = await supabase
          .from('ingredients')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
        return { data: { id, store_id: storeId, ...form } as Ingredient };
      }
    } catch (error) {
      console.error('[OfflineIngredientsService] updateIngredient error:', error);
      return { error };
    }
  },

  async deleteIngredient(id: string): Promise<{ error?: any }> {
    try {
      const dc = getDataClient();
      if (dc.isLocalFirst) {
        await OfflineAuthService.localBridgeRequest<void>(
          `/rest/v1/ingredients/${id}`,
          { method: 'DELETE' }
        );
        return {};
      } else {
        const { error } = await supabase
          .from('ingredients')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return {};
      }
    } catch (error) {
      console.error('[OfflineIngredientsService] deleteIngredient error:', error);
      return { error };
    }
  }
};
