import type { InventoryCategory, InventoryUnit } from "@/lib/inventory/types";

export const RECIPE_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export const PLANNED_MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
export const PLANNER_WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type RecipeMealType = (typeof RECIPE_MEAL_TYPES)[number];
export type PlannedMealType = (typeof PLANNED_MEAL_TYPES)[number];
export type PlannerWeekDay = (typeof PLANNER_WEEK_DAYS)[number];

export type RecipeSource = "user-requested" | "user-saved";

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
  mealType: RecipeMealType;
  cuisine?: string;
  servings?: number;
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
  resolvedNeededQuantity: number;
  resolvedNeededUnit: InventoryUnit;
  measurementSource: "inventory" | "canonical";
  usesHeuristic: boolean;
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
  mealType: PlannedMealType;
  recipe: Recipe;
  status: "planned" | "completed";
  validation: MealValidation;
};

export type PreferredDishRequest = {
  id: string;
  name: string;
  mealType?: RecipeMealType;
  status: "pending" | "resolved" | "failed";
  resolvedRecipeId?: string;
};

export type PlannerInventoryContextItem = {
  name: string;
  normalizedName?: string;
  quantity: number;
  unit: InventoryUnit;
  category?: InventoryCategory | string;
  expiresAt?: string;
};

export type PlannerPreferredDishInput = {
  name: string;
  mealType?: RecipeMealType;
};

export type PlannerConfigSnapshot = {
  preferences: string;
  preferredDishes: PlannerPreferredDishInput[];
};

export type PlannerGenerationRequest = {
  inventory: PlannerInventoryContextItem[];
  preferences: string;
  preferredDishes: PlannerPreferredDishInput[];
  recipeBook: Recipe[];
};

export type CustomRecipeGenerationRequest = {
  inventory: PlannerInventoryContextItem[];
  preferences: string;
  dishName?: string;
  recipeBook: Recipe[];
};

export type PlannerMealSlot = {
  day: PlannerWeekDay;
  mealType: PlannedMealType;
  recipeId: string;
};

export type RecipeGenerationApiResponse = {
  recipes: Recipe[];
};

export type PlannerGenerationApiResponse = {
  recipes: Recipe[];
  mealSlots: PlannerMealSlot[];
};

export type CustomRecipeGenerationApiResponse = {
  recipe: Recipe;
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
  lastGeneratedConfig?: PlannerConfigSnapshot;
};
