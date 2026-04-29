/**
 * Mappings from app data types to Notion database row property shapes.
 *
 * The Notion API represents property values differently from how they are
 * defined in the schema.  For example, a "select" property in the schema
 * becomes `{ select: { name: "..." } }` in a row creation/update payload.
 *
 * These helpers convert PlannedMeal and GroceryCartItem objects into the
 * property maps expected by createDatabaseRow / updateDatabaseRow.
 */

import type { PlannedMeal, GroceryCartItem } from "@/lib/planner/types";

// ---------------------------------------------------------------------------
// Weekly Plan row properties
// ---------------------------------------------------------------------------

/** Builds the Notion property payload for a single planned meal row. */
export function plannedMealToRowProperties(
  meal: PlannedMeal,
): Record<string, unknown> {
  const missingIngredients = meal.validation.missingItems.join(", ");
  const syncedAt = new Date().toISOString();

  return {
    Name: {
      title: [{ text: { content: meal.recipe.title } }],
    },
    Day: {
      select: { name: capitalize(meal.day) },
    },
    "Meal Type": {
      select: { name: capitalize(meal.mealType) },
    },
    Status: {
      select: { name: capitalize(meal.status) },
    },
    "Can Cook": {
      checkbox: meal.validation.canCook,
    },
    ...(meal.recipe.referenceUrl
      ? { "Recipe URL": { url: meal.recipe.referenceUrl } }
      : {}),
    "Missing Ingredients": {
      rich_text: [{ text: { content: missingIngredients } }],
    },
    "App Meal ID": {
      rich_text: [{ text: { content: meal.id } }],
    },
    "Synced At": {
      date: { start: syncedAt },
    },
  };
}

// ---------------------------------------------------------------------------
// Shopping Cart row properties
// ---------------------------------------------------------------------------

/** Builds the Notion property payload for a single grocery cart item row. */
export function groceryItemToRowProperties(
  item: GroceryCartItem,
): Record<string, unknown> {
  const syncedAt = new Date().toISOString();

  return {
    Item: {
      title: [{ text: { content: item.displayName } }],
    },
    "Quantity Needed": {
      number: item.neededQuantity,
    },
    Unit: {
      rich_text: [{ text: { content: item.unit } }],
    },
    Reason: {
      select: { name: capitalize(item.reason) },
    },
    "Linked Meals": {
      rich_text: [{ text: { content: item.recipeTitles.join(", ") } }],
    },
    Purchased: {
      checkbox: item.checked,
    },
    "App Item ID": {
      rich_text: [{ text: { content: item.id } }],
    },
    "Synced At": {
      date: { start: syncedAt },
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Row property readers (for upsert lookups)
// ---------------------------------------------------------------------------

/** Extracts the "App Meal ID" plain-text value from a Notion row properties map. */
export function extractAppMealId(
  properties: Record<string, unknown>,
): string | undefined {
  return extractRichTextValue(properties, "App Meal ID");
}

/** Extracts the "App Item ID" plain-text value from a Notion row properties map. */
export function extractAppItemId(
  properties: Record<string, unknown>,
): string | undefined {
  return extractRichTextValue(properties, "App Item ID");
}

function extractRichTextValue(
  properties: Record<string, unknown>,
  key: string,
): string | undefined {
  const prop = properties[key] as
    | { rich_text: Array<{ plain_text: string }> }
    | undefined;
  return prop?.rich_text?.[0]?.plain_text || undefined;
}
