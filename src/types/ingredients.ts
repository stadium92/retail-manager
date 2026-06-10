export interface Ingredient {
  id: string;
  store_id: string;
  name: string;
  unit: 'g' | 'kg' | 'ml' | 'L' | 'pcs';
  category: 'perishable' | 'dry' | 'liquid' | 'condiment';
  current_stock: number;
  min_threshold: number;
  cost_per_unit: number;
  expiry_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  dish_id: string;
  ingredient_id: string;
  ingredient_name: string; // joined from ingredients table
  quantity_needed: number;
  unit: string;
  current_stock: number; // joined from ingredients table
  cost_per_unit: number; // joined from ingredients table
  min_threshold: number; // joined from ingredients table
  default_unit: 'g' | 'kg' | 'ml' | 'L' | 'pcs';
}

export interface DeductionResult {
  success: boolean;
  message?: string;
  deductions: {
    ingredient_id: string;
    name: string;
    deducted: number;
    new_stock: number;
  }[];
  alerts: {
    ingredient_id: string;
    name: string;
    type: 'low_stock' | 'out_of_stock' | 'expiring_soon';
  }[];
  insufficient?: {
    ingredient_id: string;
    name: string;
    available: number;
    needed: number;
  }[];
}

export interface StockDashboard {
  ingredients: Ingredient[];
  portions_remaining: {
    dish_id: string;
    dish_name: string;
    max_portions: number;
    limiting_ingredient?: string;
  }[];
  expiring_soon: Ingredient[];
  low_stock: Ingredient[];
}
