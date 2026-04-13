import type { InventoryUnit } from "@/lib/inventory/types";

export type RecipeSource = "system" | "user-requested" | "user-saved";

export type RecipeIngredient = {
  name: string;
  normalizedName: string;
  quantity: number;
  unit: InventoryUnit;
  optional?: boolean;
};

export type Recipe = {
  id: string;
  title: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  cuisine?: string;
  tags: string[];
  ingredients: RecipeIngredient[];
  instructions?: string[];
  referenceUrl?: string;
  source: RecipeSource;
};

export type IngredientMatch = {
  ingredientName: string;
  normalizedName: string;
  neededQuantity: number;
  neededUnit: InventoryUnit;
  availableQuantity: number;
  availableUnit: InventoryUnit | "unknown";
  status: "enough" | "low" | "missing" | "unit_mismatch";
  matchedInventoryItemId?: string;
  optional?: boolean;
};

export type MealValidation = {
  canCook: boolean;
  matches: IngredientMatch[];
  missingItems: string[];
  lowItems: string[];
};

export type PlannedMeal = {
  id: string;
  day: string;
  mealType: Recipe["mealType"];
  recipe: Recipe;
  status: "planned" | "completed";
  validation: MealValidation;
};

export type PreferredDishRequest = {
  id: string;
  name: string;
  mealType?: Recipe["mealType"];
  status: "pending" | "resolved" | "failed";
  resolvedRecipeId?: string;
};

export type GroceryCartItem = {
  id: string;
  normalizedName: string;
  displayName: string;
  neededQuantity: number;
  unit: InventoryUnit;
  reason: "missing" | "low";
  recipeIds: string[];
  recipeTitles: string[];
  checked: boolean;
};

export type PlannerState = {
  preferences: string;
  preferredDishes: PreferredDishRequest[];
  weeklyPlan: PlannedMeal[];
  groceryCart: GroceryCartItem[];
  selectedMealId?: string;
};
