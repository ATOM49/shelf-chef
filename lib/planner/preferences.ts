import { normalizeIngredientName } from "@/lib/inventory/normalize";

export type ParsedPreferences = {
  preferredTags: string[];
  preferredCuisines: string[];
  excludedIngredients: string[];
  boostedIngredients: string[];
};

function collectListFromMatch(match: string | undefined) {
  if (!match) return [];

  return match
    .split(/,| and /)
    .map((item) => normalizeIngredientName(item))
    .filter(Boolean);
}

export function parsePreferences(preferences: string): ParsedPreferences {
  const text = preferences.toLowerCase();
  const preferredTags = new Set<string>();
  const preferredCuisines = new Set<string>();

  if (text.includes("high protein")) preferredTags.add("high-protein");
  if (text.includes("vegetarian")) preferredTags.add("vegetarian");
  if (text.includes("quick")) preferredTags.add("quick");
  if (text.includes("spicy")) preferredTags.add("spicy");

  if (text.includes("indian")) preferredCuisines.add("indian");
  if (text.includes("mediterranean")) preferredCuisines.add("mediterranean");
  if (text.includes("mexican")) preferredCuisines.add("mexican");
  if (text.includes("italian")) preferredCuisines.add("italian");

  const avoidMatch = text.match(/avoid ([a-z\s,]+)/i)?.[1];
  const useSoonMatch = text.match(/use ([a-z\s,]+)(?: soon| this week|$)/i)?.[1];

  return {
    preferredTags: [...preferredTags],
    preferredCuisines: [...preferredCuisines],
    excludedIngredients: collectListFromMatch(avoidMatch),
    boostedIngredients: collectListFromMatch(useSoonMatch),
  };
}
