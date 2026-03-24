export interface DiningProfile {
  clerk_id: string;
  gender: 'male' | 'female';
  weight_lbs: number;
  height_in: number;
  waist_in: number;
  neck_in: number;
  hip_in?: number;
  age: number;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal_weight_lbs?: number;
  goal_date?: string;
  meal_split?: {
    breakfast: number;
    lunch: number;
    dinner: number;
  };
  bodyFatPct?: number;
}

export interface FoodItem {
  id?: number;
  name: string;
  source: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  location?: string;
  meal_period?: string;
  quantity?: number;
  scaledNutrients?: Record<string, number>;
}

export interface MealLogEntry {
  id: number;
  date: string;
  meal_period: string;
  label: string;
  foods_json: string | FoodItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DiningTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
}
