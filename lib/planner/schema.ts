import { z } from "zod";
import { normalizeIngredientName } from "@/lib/inventory/normalize";
import { INVENTORY_UNITS } from "@/lib/inventory/types";
import {
  buildInventoryUnitHints,
  convertQuantityDetailed,
  type InventoryUnitHint,
} from "@/lib/inventory/units";
import { resolveRecipeByDishName } from "@/lib/recipes/resolve";
import type {
  CustomRecipeGenerationApiResponse,
  PlannerGenerationApiResponse,
  PlannerMealSlot,
  PlannerPreferredDishInput,
  PlannedMealType,
  PlannerWeekDay,
  Recipe,
  RecipeGenerationApiResponse,
  RecipeIngredient,
  RecipeMealType,
} from "@/lib/planner/types";
import {
  PLANNED_MEAL_TYPES,
  PLANNER_WEEK_DAYS,
  RECIPE_MEAL_TYPES,
} from "@/lib/planner/types";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const URL_PATTERN = /^https?:\/\/\S+$/i;
const MARKUP_LIKE_TEXT_PATTERN = /```|<[^>]+>/;
const MAX_RECIPES = 24;
const MAX_RECIPE_BOOK_RECIPES = 240;
const MAX_TAGS = 10;
const MAX_INGREDIENTS = 20;
const MAX_INSTRUCTIONS = 12;
const DEFAULT_INGREDIENT_UNIT = "count";
const DEFAULT_INGREDIENT_QUANTITY = 1;

const UNIT_ALIASES: Record<string, (typeof INVENTORY_UNITS)[number]> = {
  count: "count",
  counts: "count",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  cup: "cup",
  cups: "cup",
};

const RECIPE_MEAL_TYPE_ALIASES: Record<string, RecipeMealType> = {
  breakfast: "breakfast",
  brunch: "breakfast",
  brekkie: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  supper: "dinner",
  main: "dinner",
  snack: "snack",
  snacks: "snack",
};

const WEEK_DAY_ALIASES: Record<string, PlannerWeekDay> = {
  monday: "Monday",
  mon: "Monday",
  tuesday: "Tuesday",
  tue: "Tuesday",
  tues: "Tuesday",
  wednesday: "Wednesday",
  wed: "Wednesday",
  thursday: "Thursday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  friday: "Friday",
  fri: "Friday",
  saturday: "Saturday",
  sat: "Saturday",
  sunday: "Sunday",
  sun: "Sunday",
};

const recipeIngredientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  normalizedName: z.string().trim().min(1).max(120),
  quantity: z.number().finite().positive().max(100000),
  unit: z.enum(INVENTORY_UNITS),
  optional: z.boolean().optional(),
}).strict();

const recipeSchema = z.object({
  id: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(160),
  mealType: z.enum(RECIPE_MEAL_TYPES),
  cuisine: z.string().trim().min(1).max(80).optional(),
  servings: z.number().int().positive().max(100).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(MAX_TAGS),
  ingredients: z.array(recipeIngredientSchema).min(1).max(MAX_INGREDIENTS),
  instructions: z.array(z.string().trim().min(1).max(240)).max(MAX_INSTRUCTIONS).optional(),
  referenceUrl: z.string().url().startsWith("https://").optional(),
  source: z.enum(["user-requested", "user-saved"]),
}).strict();

const plannerMealSlotSchema = z.object({
  day: z.enum(PLANNER_WEEK_DAYS),
  mealType: z.enum(PLANNED_MEAL_TYPES),
  recipeId: z.string().trim().min(1).max(160),
}).strict();

export const plannerInventoryContextItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  normalizedName: z.string().trim().min(1).max(120).optional(),
  quantity: z.number().finite().positive().max(100000),
  unit: z.enum(INVENTORY_UNITS),
  category: z.string().trim().min(1).max(80).optional(),
  expiresAt: z.string().regex(ISO_DATE_PATTERN).optional(),
}).strip();

export const plannerPreferredDishInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mealType: z.enum(RECIPE_MEAL_TYPES).optional(),
}).strip();

export const plannerGenerateRequestSchema = z.object({
  inventory: z.array(plannerInventoryContextItemSchema).max(200),
  preferences: z.string().trim().max(4000),
  preferredDishes: z.array(plannerPreferredDishInputSchema).max(30),
  recipeBook: z.array(recipeSchema).max(MAX_RECIPE_BOOK_RECIPES),
}).strict();

export const customRecipeGenerateRequestSchema = z.object({
  inventory: z.array(plannerInventoryContextItemSchema).min(0).max(60),
  preferences: z.string().trim().max(4000),
  dishName: z.string().trim().min(1).max(120).optional(),
  recipeBook: z.array(recipeSchema).max(MAX_RECIPE_BOOK_RECIPES),
}).strict();

export const recipeGenerationApiResponseSchema = z.object({
  recipes: z.array(recipeSchema).min(1).max(MAX_RECIPE_BOOK_RECIPES),
}).strict();

export const plannerGenerationApiResponseSchema = z.object({
  recipes: z.array(recipeSchema).min(1).max(MAX_RECIPE_BOOK_RECIPES),
  mealSlots: z.array(plannerMealSlotSchema).length(PLANNER_WEEK_DAYS.length * PLANNED_MEAL_TYPES.length),
}).strict();

export const customRecipeGenerationApiResponseSchema = z.object({
  recipe: recipeSchema,
}).strict();

const maybeStringSchema = z.string().nullable().optional();
const maybeNumberSchema = z.union([z.number(), z.string()]).nullable().optional();
const maybeStringListSchema = z.union([z.array(z.string().nullable()), z.string(), z.null()]).optional();

const recipeIngredientExtractionSchema = z.object({
  name: maybeStringSchema,
  normalizedName: maybeStringSchema,
  quantity: maybeNumberSchema,
  unit: maybeStringSchema,
  optional: z.union([z.boolean(), z.string()]).nullable().optional(),
}).strip();

const recipeExtractionSchema = z.object({
  id: maybeStringSchema,
  title: maybeStringSchema,
  mealType: maybeStringSchema,
  cuisine: maybeStringSchema,
  servings: maybeNumberSchema,
  tags: maybeStringListSchema,
  ingredients: z.array(recipeIngredientExtractionSchema).nullable().optional(),
  instructions: maybeStringListSchema,
  referenceUrl: maybeStringSchema,
}).strip();

const plannerMealSlotExtractionSchema = z.object({
  day: maybeStringSchema,
  mealType: maybeStringSchema,
  recipeId: maybeStringSchema,
  recipeTitle: maybeStringSchema,
}).strip();

export const recipeGenerationModelResponseSchema = z.object({
  recipes: z.array(recipeExtractionSchema),
}).strip();

export const plannerMealSlotsModelResponseSchema = z.object({
  mealSlots: z.array(plannerMealSlotExtractionSchema),
}).strip();

export const recipeGenerationModelJsonSchema = z.toJSONSchema(recipeGenerationModelResponseSchema, {
  target: "openapi-3.0",
  override(ctx) {
    if (ctx.jsonSchema.anyOf) {
      ctx.jsonSchema.oneOf = ctx.jsonSchema.anyOf;
      delete ctx.jsonSchema.anyOf;
    }
  },
});

export const plannerMealSlotsModelJsonSchema = z.toJSONSchema(plannerMealSlotsModelResponseSchema, {
  target: "openapi-3.0",
  override(ctx) {
    if (ctx.jsonSchema.anyOf) {
      ctx.jsonSchema.oneOf = ctx.jsonSchema.anyOf;
      delete ctx.jsonSchema.anyOf;
    }
  },
});

export function parseRecipeGenerationApiResponse(payload: unknown): RecipeGenerationApiResponse {
  const parsed = recipeGenerationApiResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Planner API returned an invalid recipe response. Try again.");
  }
  return parsed.data satisfies RecipeGenerationApiResponse;
}

export function parsePlannerGenerationApiResponse(payload: unknown): PlannerGenerationApiResponse {
  const parsed = plannerGenerationApiResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Planner API returned an invalid weekly plan. Try again.");
  }
  return parsed.data satisfies PlannerGenerationApiResponse;
}

export function parseCustomRecipeGenerationApiResponse(
  payload: unknown,
): CustomRecipeGenerationApiResponse {
  const parsed = customRecipeGenerationApiResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Planner API returned an invalid custom recipe. Try again.");
  }
  return parsed.data satisfies CustomRecipeGenerationApiResponse;
}

export function parseRecipeGenerationModelResponse(
  payload: unknown,
  preferredDishes: PlannerPreferredDishInput[],
  inventory: z.infer<typeof plannerInventoryContextItemSchema>[],
): RecipeGenerationApiResponse {
  const parsed = recipeGenerationModelResponseSchema.safeParse(fillMissingRecipeFields(payload));
  if (!parsed.success) {
    throw new Error("AI returned an invalid recipe payload. Try again.");
  }

  const inventoryUnitHints = buildInventoryUnitHints(inventory);
  const recipes = normalizeRecipes(parsed.data.recipes, preferredDishes, inventoryUnitHints);
  if (recipes.length === 0) {
    throw new Error("AI didn't return any usable recipes. Try again.");
  }

  return { recipes };
}

export function parsePlannerMealSlotsModelResponse(
  payload: unknown,
  recipes: Recipe[],
): { mealSlots: PlannerMealSlot[] } {
  const parsed = plannerMealSlotsModelResponseSchema.safeParse(fillMissingMealSlotFields(payload));
  if (!parsed.success) {
    throw new Error("AI returned an invalid weekly schedule. Try again.");
  }

  const mealSlots = normalizeMealSlots(parsed.data.mealSlots, recipes);
  assertCompleteWeeklySchedule(mealSlots);
  return { mealSlots };
}

function fillMissingRecipeFields(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const candidate = payload as { recipes?: unknown };
  if (!Array.isArray(candidate.recipes)) {
    return payload;
  }

  return {
    ...candidate,
    recipes: candidate.recipes.map((recipe) => ({
      id: null,
      title: null,
      mealType: null,
      cuisine: null,
      tags: null,
      ingredients: [],
      instructions: null,
      referenceUrl: null,
      ...(recipe && typeof recipe === "object" ? recipe : {}),
    })),
  };
}

function fillMissingMealSlotFields(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const candidate = payload as { mealSlots?: unknown };
  if (!Array.isArray(candidate.mealSlots)) {
    return payload;
  }

  return {
    ...candidate,
    mealSlots: candidate.mealSlots.map((slot) => ({
      day: null,
      mealType: null,
      recipeId: null,
      recipeTitle: null,
      ...(slot && typeof slot === "object" ? slot : {}),
    })),
  };
}

function normalizeRecipes(
  recipes: Array<z.infer<typeof recipeExtractionSchema>>,
  preferredDishes: PlannerPreferredDishInput[],
  inventoryUnitHints: InventoryUnitHint[],
) {
  const normalizedRecipes: Recipe[] = [];
  const seenKeys = new Set<string>();
  const seenIds = new Map<string, number>();

  for (const recipe of recipes) {
    const normalized = normalizeRecipe(recipe, preferredDishes, inventoryUnitHints);
    if (!normalized) {
      continue;
    }

    const dedupeKey = `${normalized.mealType}:${normalized.title.toLowerCase()}`;
    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenKeys.add(dedupeKey);
    normalized.id = ensureUniqueRecipeId(normalized.id, seenIds);
    normalizedRecipes.push(normalized);

    if (normalizedRecipes.length === MAX_RECIPES) {
      break;
    }
  }

  return normalizedRecipes;
}

function normalizeRecipe(
  recipe: z.infer<typeof recipeExtractionSchema>,
  preferredDishes: PlannerPreferredDishInput[],
  inventoryUnitHints: InventoryUnitHint[],
): Recipe | null {
  const title = normalizeText(recipe.title);
  if (!title || looksLikeMalformedText(title)) {
    return null;
  }

  const tags = normalizeTagList(recipe.tags);
  const mealType =
    normalizeRecipeMealType(recipe.mealType) ??
    inferMealTypeFromPreferredDishes(title, preferredDishes) ??
    inferMealTypeFromTitle(title, tags) ??
    "dinner";

  const ingredients = normalizeIngredients(recipe.ingredients, inventoryUnitHints);
  if (ingredients.length === 0) {
    return null;
  }

  const cuisine = normalizeText(recipe.cuisine);
  const instructions = normalizeInstructionList(recipe.instructions);
  const referenceUrl = normalizeReferenceUrl(recipe.referenceUrl);
  const servings = normalizeServings(recipe.servings);

  const normalized = recipeSchema.safeParse({
    id: buildRecipeId(title, mealType),
    title,
    mealType,
    cuisine,
    servings,
    tags,
    ingredients,
    instructions: instructions.length > 0 ? instructions : undefined,
    referenceUrl,
    source: "user-requested",
  });

  return normalized.success ? normalized.data : null;
}

function normalizeIngredients(
  value: Array<z.infer<typeof recipeIngredientExtractionSchema>> | null | undefined,
  inventoryUnitHints: InventoryUnitHint[],
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const ingredients: RecipeIngredient[] = [];
  const seen = new Set<string>();
  const inventoryUnitHintMap = new Map(
    inventoryUnitHints.map((hint) => [hint.normalizedName, hint]),
  );

  for (const ingredient of value) {
    const normalized = normalizeIngredient(ingredient, inventoryUnitHintMap);
    if (!normalized) {
      continue;
    }

    const key = `${normalized.normalizedName}:${normalized.unit}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    ingredients.push(normalized);

    if (ingredients.length === MAX_INGREDIENTS) {
      break;
    }
  }

  return ingredients;
}

function normalizeIngredient(
  ingredient: z.infer<typeof recipeIngredientExtractionSchema>,
  inventoryUnitHintMap: Map<string, InventoryUnitHint>,
) {
  const name = normalizeText(ingredient.name);
  if (!name || looksLikeMalformedText(name)) {
    return null;
  }

  const normalizedName = normalizeIngredientName(
    normalizeText(ingredient.normalizedName) || name,
  );
  if (!normalizedName) {
    return null;
  }

  const quantity = normalizeQuantity(ingredient.quantity) ?? DEFAULT_INGREDIENT_QUANTITY;
  const unit = normalizeUnit(ingredient.unit) ?? DEFAULT_INGREDIENT_UNIT;
  const optional = normalizeBoolean(ingredient.optional);
  const alignedMeasurement = alignIngredientToInventoryUnitHint(
    normalizedName,
    quantity,
    unit,
    inventoryUnitHintMap,
  );

  const normalized = recipeIngredientSchema.safeParse({
    name,
    normalizedName,
    quantity: alignedMeasurement.quantity,
    unit: alignedMeasurement.unit,
    optional: optional || undefined,
  });

  return normalized.success ? normalized.data : null;
}

function alignIngredientToInventoryUnitHint(
  normalizedName: string,
  quantity: number,
  unit: (typeof INVENTORY_UNITS)[number],
  inventoryUnitHintMap: Map<string, InventoryUnitHint>,
) {
  const hint = inventoryUnitHintMap.get(normalizedName);
  if (!hint?.preferredUnit || hint.preferredUnit === unit) {
    return { quantity, unit };
  }

  const converted = convertQuantityDetailed(quantity, unit, hint.preferredUnit, normalizedName);
  if (converted?.method !== "direct") {
    return { quantity, unit };
  }

  return {
    quantity: Number(converted.quantity.toFixed(2)),
    unit: hint.preferredUnit,
  };
}

function normalizeMealSlots(
  slots: Array<z.infer<typeof plannerMealSlotExtractionSchema>>,
  recipes: Recipe[],
) {
  const normalizedSlots: PlannerMealSlot[] = [];
  const seen = new Set<string>();

  for (const slot of slots) {
    const day = normalizeWeekDay(slot.day);
    const mealType = normalizePlannedMealType(slot.mealType);
    const recipe = resolveMealSlotRecipe(slot, recipes);
    if (!day || !mealType || !recipe) {
      continue;
    }

    const normalized = plannerMealSlotSchema.safeParse({
      day,
      mealType,
      recipeId: recipe.id,
    });
    if (!normalized.success) {
      continue;
    }

    const key = `${normalized.data.day}:${normalized.data.mealType}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedSlots.push(normalized.data);
  }

  const dayOrder = Object.fromEntries(PLANNER_WEEK_DAYS.map((day, index) => [day, index]));
  const mealTypeOrder: Record<PlannedMealType, number> = {
    breakfast: 0,
    lunch: 1,
    dinner: 2,
  };

  return normalizedSlots.sort(
    (a, b) =>
      dayOrder[a.day] - dayOrder[b.day] ||
      mealTypeOrder[a.mealType] - mealTypeOrder[b.mealType],
  );
}

function resolveMealSlotRecipe(
  slot: z.infer<typeof plannerMealSlotExtractionSchema>,
  recipes: Recipe[],
) {
  const requestedId = normalizeText(slot.recipeId);
  if (requestedId) {
    const byId = recipes.find((recipe) => recipe.id === requestedId);
    if (byId) {
      return byId;
    }
  }

  const recipeHint = normalizeText(slot.recipeTitle) || requestedId;
  if (!recipeHint) {
    return null;
  }

  return resolveRecipeByDishName(recipeHint, recipes);
}

function assertCompleteWeeklySchedule(mealSlots: PlannerMealSlot[]) {
  const expectedSlots = new Set<string>();
  for (const day of PLANNER_WEEK_DAYS) {
    for (const mealType of PLANNED_MEAL_TYPES) {
      expectedSlots.add(`${day}:${mealType}`);
    }
  }

  for (const slot of mealSlots) {
    expectedSlots.delete(`${slot.day}:${slot.mealType}`);
  }

  if (expectedSlots.size > 0) {
    throw new Error("AI returned an incomplete weekly meal schedule. Try again.");
  }
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed || undefined;
}

function normalizeQuantity(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().replaceAll(",", "");
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeUnit(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return UNIT_ALIASES[value.trim().toLowerCase()];
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "optional"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "required"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizeRecipeMealType(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return RECIPE_MEAL_TYPE_ALIASES[value.trim().toLowerCase()];
}

function normalizePlannedMealType(value: unknown): PlannedMealType | undefined {
  const normalized = normalizeRecipeMealType(value);
  if (!normalized || normalized === "snack") {
    return undefined;
  }
  return normalized;
}

function normalizeWeekDay(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return WEEK_DAY_ALIASES[value.trim().toLowerCase()];
}

function normalizeTagList(value: unknown) {
  return normalizeStringList(value, {
    lowercase: true,
    transform: (tag) => tag.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-"),
    maxItems: MAX_TAGS,
  });
}

function normalizeInstructionList(value: unknown) {
  return normalizeStringList(value, { maxItems: MAX_INSTRUCTIONS });
}

function normalizeStringList(
  value: unknown,
  options: {
    lowercase?: boolean;
    transform?: (value: string) => string;
    maxItems: number;
  },
) {
  const rawValues = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : typeof value === "string"
      ? value.split(/\n|,|;/)
      : [];

  const seen = new Set<string>();
  const normalizedValues: string[] = [];

  for (const rawValue of rawValues) {
    let normalized = normalizeText(rawValue);
    if (!normalized || looksLikeMalformedText(normalized)) {
      continue;
    }

    if (options.lowercase) {
      normalized = normalized.toLowerCase();
    }

    if (options.transform) {
      normalized = options.transform(normalized);
    }

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    normalizedValues.push(normalized);
    if (normalizedValues.length === options.maxItems) {
      break;
    }
  }

  return normalizedValues;
}

function normalizeReferenceUrl(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized || !normalized.startsWith("https://") || !URL_PATTERN.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizeServings(value: unknown) {
  const qty = normalizeQuantity(value);
  if (qty == null) return undefined;
  const rounded = Math.round(qty);
  return rounded >= 1 && rounded <= 100 ? rounded : undefined;
}

function inferMealTypeFromPreferredDishes(
  title: string,
  preferredDishes: PlannerPreferredDishInput[],
): RecipeMealType | undefined {
  const normalizedTitle = title.trim().toLowerCase();
  const matchingDish = preferredDishes.find((dish) => {
    const normalizedDish = dish.name.trim().toLowerCase();
    return normalizedDish === normalizedTitle || normalizedDish.includes(normalizedTitle) || normalizedTitle.includes(normalizedDish);
  });

  return matchingDish?.mealType;
}

function inferMealTypeFromTitle(title: string, tags: string[]) {
  const normalizedTitle = title.toLowerCase();
  const normalizedTags = new Set(tags.map((tag) => tag.toLowerCase()));

  if (
    ["omelette", "omelet", "toast", "poha", "upma", "oats", "paratha", "smoothie"].some((token) => normalizedTitle.includes(token)) ||
    normalizedTags.has("breakfast")
  ) {
    return "breakfast";
  }

  if (
    ["rice", "dal", "bowl", "khichdi", "salad", "thali"].some((token) => normalizedTitle.includes(token)) ||
    normalizedTags.has("lunch")
  ) {
    return "lunch";
  }

  if (
    ["curry", "pasta", "wrap", "stir fry", "soup"].some((token) => normalizedTitle.includes(token)) ||
    normalizedTags.has("dinner")
  ) {
    return "dinner";
  }

  return undefined;
}

function buildRecipeId(title: string, mealType: RecipeMealType) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 96);
  return `ai-${mealType}-${slug || "recipe"}`;
}

function ensureUniqueRecipeId(id: string, seenIds: Map<string, number>) {
  const existing = seenIds.get(id) ?? 0;
  seenIds.set(id, existing + 1);
  return existing === 0 ? id : `${id}-${existing + 1}`;
}

function looksLikeMalformedText(value: string) {
  const trimmed = value.trim();
  return !trimmed || MARKUP_LIKE_TEXT_PATTERN.test(trimmed) || trimmed.startsWith("{") || trimmed.startsWith("[");
}
