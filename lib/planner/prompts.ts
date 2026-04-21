import { INVENTORY_UNITS } from "@/lib/inventory/types";
import { buildInventoryUnitHints } from "@/lib/inventory/units";
import {
  PLANNED_MEAL_TYPES,
  PLANNER_WEEK_DAYS,
  type CustomRecipeGenerationRequest,
  type PlannerGenerationRequest,
  type Recipe,
} from "@/lib/planner/types";

const MAX_RECIPE_BOOK_PROMPT_ITEMS = 60;

function summarizeRecipeBook(recipes: Recipe[]) {
  if (recipes.length === 0) {
    return "- No saved recipe book entries yet.";
  }

  const prioritizedRecipes = [...recipes].sort((left, right) => {
    const leftPriority = left.source === "user-saved" ? 0 : left.source === "user-requested" ? 1 : 2;
    const rightPriority = right.source === "user-saved" ? 0 : right.source === "user-requested" ? 1 : 2;
    return (
      leftPriority - rightPriority ||
      left.mealType.localeCompare(right.mealType, "en-US") ||
      left.title.localeCompare(right.title, "en-US")
    );
  });

  return prioritizedRecipes
    .slice(0, MAX_RECIPE_BOOK_PROMPT_ITEMS)
    .map((recipe) => {
      const ingredients = recipe.ingredients
        .slice(0, 6)
        .map((ingredient) => ingredient.normalizedName)
        .join(", ");
      return `- ${recipe.title} (${recipe.mealType}, ${recipe.source})${ingredients ? ` | ingredients: ${ingredients}` : ""}`;
    })
    .join("\n");
}

export function buildRecipeGenerationPrompt({
  inventory,
  preferences,
  preferredDishes,
  recipeBook,
}: PlannerGenerationRequest) {
  const today = new Date().toISOString().split("T")[0];
  const inventoryUnitHints = buildInventoryUnitHints(inventory);
  const inventoryLines =
    inventory.length > 0
      ? inventory
          .map((item) => {
            const expiry = item.expiresAt ? `, expires ${item.expiresAt}` : "";
            const category = item.category ? `, category ${item.category}` : "";
            const normalizedName = item.normalizedName
              ? `, normalized ${item.normalizedName}`
              : "";
            return `- ${item.name}: ${item.quantity} ${item.unit}${category}${normalizedName}${expiry}`;
          })
          .join("\n")
      : "- No current inventory items were provided. Generate practical recipes that still fit the user's preferences.";
  const inventoryUnitRuleLines =
    inventoryUnitHints.length > 0
      ? inventoryUnitHints
          .map((hint) => {
            if (hint.preferredUnit) {
              return `- ${hint.normalizedName}: use ${hint.preferredUnit} when this ingredient appears in a recipe and comes from current inventory`;
            }

            return `- ${hint.normalizedName}: inventory currently uses multiple units (${hint.units.join(", ")}); if you use this ingredient, choose one of those exact units and do not invent a different unit`;
          })
          .join("\n")
      : "- No inventory unit rules available.";

  const preferredDishLines =
    preferredDishes.length > 0
      ? preferredDishes
          .map(
            (dish) =>
              `- ${dish.name}${dish.mealType ? ` (${dish.mealType})` : ""}`,
          )
          .join("\n")
      : "- None specified";

  const preferenceSummary =
    preferences.trim() || "No additional preferences supplied.";
  const recipeBookLines = summarizeRecipeBook(recipeBook);

  return `You are a meal-planning assistant for a home kitchen app.

Today's date: ${today}

Use Google Search grounding when helpful to keep recipes realistic, current, and commonly cooked.

Generate a practical weekly recipe pool for this user.

Requirements:
- Return JSON only with a top-level recipes array.
- Generate 12 to 18 recipes total.
- Cover breakfast, lunch, and dinner. Ensure at least 4 breakfast recipes, 4 lunch recipes, and 4 dinner recipes.
- Treat the existing recipe book as already available to the user. Do not regenerate exact or lightly renamed duplicates of recipes already in that book.
- If a recipe idea already exists in the recipe book, generate a different recipe instead of repeating it.
- Prefer recipes that use the inventory on hand, especially items that expire soon.
- Respect the user preferences and preferred dishes when possible.
- Use clear household ingredient quantities.
- Allowed units: ${INVENTORY_UNITS.join(", ")}.
- If a recipe ingredient matches an inventory ingredient by normalized name, use the inventory unit rule for that ingredient.
- Do not switch an in-inventory ingredient to a different measurement group or a different household unit when an inventory unit is already provided.
- Prefer exact inventory units for stocked ingredients even when another unit would also be common in recipes.
- Each recipe must include: title, mealType, tags, ingredients.
- Include cuisine, instructions, and referenceUrl when you can do so confidently.
- Keep recipe titles concise and natural.
- Do not include markdown or explanation text.

User preferences:
${preferenceSummary}

Preferred dishes:
${preferredDishLines}

Existing recipe book:
${recipeBookLines}

Inventory unit rules:
${inventoryUnitRuleLines}

Current inventory:
${inventoryLines}`;
}

export function buildCustomRecipeGenerationPrompt({
  inventory,
  preferences,
  dishName,
  recipeBook,
}: CustomRecipeGenerationRequest) {
  const today = new Date().toISOString().split("T")[0];
  const inventoryUnitHints = buildInventoryUnitHints(inventory);
  const inventoryLines = inventory
    .map((item) => {
      const normalizedName = item.normalizedName ? `, normalized ${item.normalizedName}` : "";
      return `- ${item.name}: ${item.quantity} ${item.unit}${normalizedName}`;
    })
    .join("\n");
  const inventoryUnitRuleLines =
    inventoryUnitHints.length > 0
      ? inventoryUnitHints
          .map((hint) => {
            if (hint.preferredUnit) {
              return `- ${hint.normalizedName}: use ${hint.preferredUnit}`;
            }

            return `- ${hint.normalizedName}: use one of these inventory units only: ${hint.units.join(", ")}`;
          })
          .join("\n")
      : "- No inventory unit rules available.";
  const preferenceSummary = preferences.trim() || "No additional preferences supplied.";
  const recipeBookLines = summarizeRecipeBook(recipeBook);
  const requestedDishLine = dishName?.trim()
    ? `Requested dish name: ${dishName.trim()}`
    : "Requested dish name: none provided. Choose a natural title based on the selected inventory.";

  return `You are a home kitchen recipe assistant.

Today's date: ${today}

Use Google Search grounding when helpful to keep recipes realistic and commonly cooked.

Generate exactly one recipe using the selected inventory subset.

Requirements:
- Return JSON only with a top-level recipes array containing exactly one recipe.
- Use the selected inventory subset as the primary ingredient context.
- Respect the user's preferences and requested dish name when possible.
- Do not generate a duplicate of an existing recipe-book entry.
- Allowed units: ${INVENTORY_UNITS.join(", ")}.
- If an ingredient matches an inventory ingredient by normalized name, use the inventory unit rule for that ingredient.
- Include: title, mealType, tags, ingredients.
- Include cuisine, instructions, and referenceUrl when you can do so confidently.
- Keep the recipe practical for a home kitchen.

${requestedDishLine}

User preferences:
${preferenceSummary}

Existing recipe book:
${recipeBookLines}

Inventory unit rules:
${inventoryUnitRuleLines}

Selected inventory subset:
${inventoryLines}`;
}

export function buildWeeklyPlannerPrompt({
  preferences,
  preferredDishes,
  recipes,
}: {
  preferences: string;
  preferredDishes: PlannerGenerationRequest["preferredDishes"];
  recipes: Recipe[];
}) {
  const preferredDishLines =
    preferredDishes.length > 0
      ? preferredDishes
          .map(
            (dish) =>
              `- ${dish.name}${dish.mealType ? ` (${dish.mealType})` : ""}`,
          )
          .join("\n")
      : "- None specified";

  const recipeCatalog = recipes
    .map((recipe) => {
      const ingredients = recipe.ingredients
        .map((ingredient) => ingredient.normalizedName)
        .join(", ");
      const tags = recipe.tags.join(", ");
      return `- id: ${recipe.id} | title: ${recipe.title} | mealType: ${recipe.mealType} | cuisine: ${recipe.cuisine ?? "n/a"} | tags: ${tags || "n/a"} | ingredients: ${ingredients}`;
    })
    .join("\n");

  const preferenceSummary =
    preferences.trim() || "No additional preferences supplied.";

  return `You are a weekly meal planner for a home kitchen app.

Create a 7-day plan using only the provided recipe ids.

Requirements:
- Return JSON only with a top-level mealSlots array.
- Produce exactly ${PLANNER_WEEK_DAYS.length * PLANNED_MEAL_TYPES.length} slots.
- Cover every day from Monday to Sunday.
- For each day include exactly one breakfast, one lunch, and one dinner.
- Use only recipe ids from the catalog below.
- Prefer variety across the week.
- Include preferred dishes when suitable.
- Respect the user preferences.
- Do not invent recipe ids, titles, or extra fields.

User preferences:
${preferenceSummary}

Preferred dishes:
${preferredDishLines}

Allowed days: ${PLANNER_WEEK_DAYS.join(", ")}
Allowed meal types: ${PLANNED_MEAL_TYPES.join(", ")}

Recipe catalog:
${recipeCatalog}`;
}
