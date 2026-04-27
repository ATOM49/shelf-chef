import { normalizeIngredientName } from "@/lib/inventory/normalize";

/**
 * Normalized names of ingredients that are assumed to be present in any
 * household kitchen and should never be flagged as "missing" during meal
 * validation or added to the grocery cart unless they are explicitly tracked
 * in inventory (and running low).
 *
 * The list is intentionally narrow — only items that virtually every cook
 * keeps on hand without actively restocking.
 */
const STAPLE_INGREDIENTS: ReadonlySet<string> = new Set([
  "water",
  "salt",
  "oil",
  "cooking oil",
  "vegetable oil",
  "olive oil",
  "pepper",
  "black pepper",
  "white pepper",
  "sugar",
  "white sugar",
  "table salt",
  "sea salt",
  "kosher salt",
]);

/**
 * Returns true when the supplied ingredient name is a universally-assumed
 * kitchen staple. Accepts both pre-normalized and raw ingredient names.
 */
export function isStaple(ingredientName: string): boolean {
  const key = normalizeIngredientName(ingredientName);
  return STAPLE_INGREDIENTS.has(key);
}
