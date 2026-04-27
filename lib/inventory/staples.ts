import { normalizeIngredientName } from "@/lib/inventory/normalize";

/**
 * Default kitchen staples shown in the Staples panel.
 * These are the raw display names — normalized before lookup.
 */
export const DEFAULT_STAPLE_DISPLAY_NAMES: readonly string[] = [
  "Water",
  "Salt",
  "Oil",
  "Pepper",
  "Sugar",
];

/**
 * Normalized names of the default staple ingredients that are assumed to be
 * present in any household kitchen.  The set is intentionally narrow.
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

/**
 * Returns true when the ingredient is either a built-in staple OR appears in
 * the user's custom staple list (raw names, compared after normalization).
 */
export function isStapleOrCustom(
  ingredientName: string,
  customStapleNames: readonly string[],
): boolean {
  const key = normalizeIngredientName(ingredientName);
  if (STAPLE_INGREDIENTS.has(key)) return true;
  return customStapleNames.some(
    (name) => normalizeIngredientName(name) === key,
  );
}
