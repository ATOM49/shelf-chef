import { normalizeIngredientName } from "@/lib/inventory/normalize";
import type { Recipe } from "@/lib/planner/types";

/**
 * Known dish-name aliases.  Keys are normalised input strings; values are
 * normalised target recipe titles (also lowercased for matching).
 */
const DISH_ALIASES: Record<string, string> = {
  "egg burji": "egg bhurji",
  "scrambled eggs": "egg bhurji",
  "curd rice": "curd rice",
  "thayir sadam": "curd rice",
  "spinach paneer": "palak paneer",
  "paneer spinach": "palak paneer",
  "saag paneer": "palak paneer",
  "spinach chickpea": "spinach chickpea curry",
  "chana palak": "spinach chickpea curry",
  "lemon rice": "lemon rice",
  "chitranna": "lemon rice",
  "paneer scramble": "paneer bhurji",
  "semolina porridge": "upma",
  "rava upma": "upma",
  "flattened rice": "poha",
  "beaten rice": "poha",
  "rajma chawal": "rajma rice",
  "toor dal rice": "dal rice",
  "dal chawal": "dal rice",
};

function normalizeDishQuery(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Attempt to resolve a free-text dish name to a Recipe in the supplied dataset.
 *
 * Resolution order:
 *  1. Exact normalised title match
 *  2. Alias map lookup → then exact title match on the alias
 *  3. Partial title match (recipe title contains the query, or query contains recipe title)
 *
 * Returns the first matching Recipe or null if nothing found.
 */
export function resolveRecipeByDishName(name: string, recipeList: Recipe[]): Recipe | null {
  const query = normalizeDishQuery(name);
  if (!query) return null;

  // Step 1: exact normalised title match
  const exactMatch = recipeList.find((r) => r.title.toLowerCase() === query);
  if (exactMatch) return exactMatch;

  // Step 2: alias map
  const aliasTarget = DISH_ALIASES[query];
  if (aliasTarget) {
    const aliasMatch = recipeList.find((r) => r.title.toLowerCase() === aliasTarget);
    if (aliasMatch) return aliasMatch;
  }

  // Step 3: partial match — recipe title contains the query words
  const queryWords = query.split(" ").filter(Boolean);
  const partialMatch = recipeList.find((r) => {
    const titleLower = r.title.toLowerCase();
    return queryWords.every((word) => titleLower.includes(word));
  });
  if (partialMatch) return partialMatch;

  // Step 4: reverse partial — query contains all recipe title words (catches "palak paneer" → "Palak Paneer")
  const reverseMatch = recipeList.find((r) => {
    const titleWords = r.title.toLowerCase().split(" ").filter(Boolean);
    return titleWords.every((word) => query.includes(word));
  });
  if (reverseMatch) return reverseMatch;

  // Step 5: ingredient-level alias — normalise the query as an ingredient name and check tags/titles
  const normalisedQuery = normalizeIngredientName(name);
  const ingredientTitleMatch = recipeList.find((r) =>
    r.title.toLowerCase().includes(normalisedQuery),
  );
  if (ingredientTitleMatch) return ingredientTitleMatch;

  return null;
}
