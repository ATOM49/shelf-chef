import { z } from "zod";
import { PRESET_ORDER } from "@/lib/inventory/presets";
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from "@/lib/inventory/types";
import { normalizeIngredientName } from "@/lib/inventory/normalize";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MARKUP_LIKE_TEXT_PATTERN = /```|<[^>]+>/;
const MAX_REVIEW_ITEMS = 80;
const DEFAULT_QUANTITY = 1;
const DEFAULT_UNIT = "count";
const DEFAULT_CATEGORY = "other";
const MAX_STOCK_IMAGE_BASE64_LENGTH = 12_000_000;
const ACCEPTED_STOCK_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

const UNIT_ALIASES: Record<string, (typeof INVENTORY_UNITS)[number]> = {
  cup: "cup",
  cups: "cup",
  count: "count",
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
};

const CATEGORY_ALIASES: Record<string, (typeof INVENTORY_CATEGORIES)[number]> = {
  condiment: "condiment",
  condiments: "condiment",
  dairy: "dairy",
  fruit: "fruit",
  fruits: "fruit",
  grain: "grain",
  grains: "grain",
  meat: "protein",
  other: "other",
  protein: "protein",
  proteins: "protein",
  spice: "spice",
  spices: "spice",
  vegetable: "vegetable",
  vegetables: "vegetable",
};

const STORAGE_TYPE_ALIASES = {
  fridge: "fridge",
  pantry: "pantry",
  refrigerator: "fridge",
} as const;

export const stockReviewItemSchema = z.object({
  emoji: z.string().trim().emoji().optional(),
  name: z.string().trim().min(1).max(120),
  quantity: z.number().finite().positive().max(100000),
  unit: z.enum(INVENTORY_UNITS),
  category: z.enum(INVENTORY_CATEGORIES),
  storageType: z.enum(["fridge", "pantry"]),
  shelfName: z.string().trim().min(1).max(80),
  expiresAt: z.string().regex(ISO_DATE_PATTERN).optional(),
  flagged: z.boolean(),
}).strict();

export const stockedItemSchema = stockReviewItemSchema.extend({
  id: z.string().trim().min(1),
}).strict();

const stockReviewItemExtractionSchema = z.object({
  emoji: z.string().nullable(),
  name: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  category: z.string().nullable(),
  storageType: z.string().nullable(),
  shelfName: z.string().nullable(),
  expiresAt: z.string().nullable(),
  flagged: z.boolean().nullable(),
}).strip();

export const stockApiResponseSchema = z.object({
  items: z.array(stockReviewItemExtractionSchema),
}).strip();

export const stockTextRequestSchema = z.object({
  input: z.string().trim().min(1).max(4000),
  stapleNames: z.array(z.string().trim()).optional(),
}).strict();

export const stockImageRequestSchema = z.object({
  imageBase64: z.string().trim().min(1).max(MAX_STOCK_IMAGE_BASE64_LENGTH),
  imageMimeType: z.enum(ACCEPTED_STOCK_IMAGE_MIME_TYPES),
  stapleNames: z.array(z.string().trim()).optional(),
}).strict();

export const stockPresetRequestSchema = z.object({
  presetId: z.enum(PRESET_ORDER),
  stapleNames: z.array(z.string().trim()).optional(),
  useSeed: z.boolean().optional(),
}).strict();

export const stockApiResponseJsonSchema = z.toJSONSchema(stockApiResponseSchema, {
  target: "openapi-3.0",
  override(ctx) {
    if (ctx.jsonSchema.anyOf) {
      ctx.jsonSchema.oneOf = ctx.jsonSchema.anyOf;
      delete ctx.jsonSchema.anyOf;
    }
  },
});

export function parseStockApiResponseForReview(payload: unknown) {
  const parsed = stockApiResponseSchema.safeParse(fillMissingStockFields(payload));
  if (!parsed.success) {
    throw new Error("AI returned an invalid stock response. Try again.");
  }

  const items = mergeDuplicateStockItemsForReview(
    normalizeStockItemsForReview(parsed.data.items),
  );
  if (items.length === 0) {
    throw new Error("AI didn't return any usable stock items. Try again.");
  }

  assertStockItemsSafeForReview(items);
  return { items };
}

function normalizeStockItemsForReview(items: Array<z.infer<typeof stockReviewItemExtractionSchema>>) {
  return items
    .map((item) => normalizeStockReviewItem(item))
    .filter((item): item is z.infer<typeof stockReviewItemSchema> => item != null);
}

function mergeDuplicateStockItemsForReview(
  items: Array<z.infer<typeof stockReviewItemSchema>>,
) {
  const merged: Array<z.infer<typeof stockReviewItemSchema>> = [];
  const itemIndexByName = new Map<string, number>();

  for (const item of items) {
    const key = normalizeIngredientName(item.name);
    const existingIndex = itemIndexByName.get(key);
    if (typeof existingIndex === "undefined") {
      itemIndexByName.set(key, merged.length);
      merged.push(item);
      continue;
    }

    merged[existingIndex] = mergeStockReviewItems(merged[existingIndex], item);
  }

  return merged;
}

function mergeStockReviewItems(
  existing: z.infer<typeof stockReviewItemSchema>,
  duplicate: z.infer<typeof stockReviewItemSchema>,
) {
  const convertedQuantity = convertQuantityToUnit(
    duplicate.quantity,
    duplicate.unit,
    existing.unit,
  );
  const canAddQuantity = convertedQuantity != null;

  return {
    ...existing,
    emoji: existing.emoji ?? duplicate.emoji,
    quantity: canAddQuantity
      ? existing.quantity + convertedQuantity
      : existing.quantity,
    expiresAt: earliestDate(existing.expiresAt, duplicate.expiresAt),
    flagged:
      existing.flagged ||
      duplicate.flagged ||
      !canAddQuantity ||
      existing.category !== duplicate.category ||
      existing.storageType !== duplicate.storageType,
  };
}

function convertQuantityToUnit(
  quantity: number,
  fromUnit: z.infer<typeof stockReviewItemSchema>["unit"],
  toUnit: z.infer<typeof stockReviewItemSchema>["unit"],
) {
  if (fromUnit === toUnit) {
    return quantity;
  }

  if (fromUnit === "kg" && toUnit === "g") {
    return quantity * 1000;
  }

  if (fromUnit === "g" && toUnit === "kg") {
    return quantity / 1000;
  }

  if (fromUnit === "l" && toUnit === "ml") {
    return quantity * 1000;
  }

  if (fromUnit === "ml" && toUnit === "l") {
    return quantity / 1000;
  }

  return null;
}

function earliestDate(first?: string, second?: string) {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return first <= second ? first : second;
}

function normalizeStockReviewItem(item: z.infer<typeof stockReviewItemExtractionSchema>) {
  const name = normalizeText(item.name);
  if (!name || looksLikeMalformedText(name)) {
    return null;
  }

  let flagged = item.flagged === true;

  const emoji = normalizeEmoji(item.emoji);
  if (item.emoji && !emoji) {
    flagged = true;
  }

  const quantity = normalizeQuantity(item.quantity);
  if (quantity == null) {
    flagged = true;
  }

  const category = normalizeEnumValue(item.category, CATEGORY_ALIASES);
  const resolvedCategory = category ?? DEFAULT_CATEGORY;
  if (!category) {
    flagged = true;
  }

  const unit = normalizeEnumValue(item.unit, UNIT_ALIASES);
  const resolvedUnit = unit ?? DEFAULT_UNIT;
  if (!unit) {
    flagged = true;
  }

  const storageType = normalizeStorageType(item.storageType)
    ?? inferStorageType(resolvedCategory, item.shelfName);
  if (!normalizeStorageType(item.storageType)) {
    flagged = true;
  }

  const shelfName = normalizeText(item.shelfName)
    ?? defaultShelfName(storageType, resolvedCategory);
  if (!normalizeText(item.shelfName)) {
    flagged = true;
  }

  const expiresAt = normalizeExpiresAt(item.expiresAt);
  if (item.expiresAt && !expiresAt) {
    flagged = true;
  }

  const normalized = stockReviewItemSchema.safeParse({
    emoji,
    name,
    quantity: quantity ?? DEFAULT_QUANTITY,
    unit: resolvedUnit,
    category: resolvedCategory,
    storageType,
    shelfName,
    expiresAt,
    flagged,
  });

  return normalized.success ? normalized.data : null;
}

function assertStockItemsSafeForReview(items: Array<z.infer<typeof stockReviewItemSchema>>) {
  if (items.length > MAX_REVIEW_ITEMS) {
    throw new Error("AI returned too many items to review safely. Try a smaller input.");
  }

  for (const item of items) {
    if (looksLikeMalformedText(item.name) || looksLikeMalformedText(item.shelfName)) {
      throw new Error("AI returned malformed item text. Try again.");
    }
  }
}

function fillMissingStockFields(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const candidate = payload as { items?: unknown };
  if (!Array.isArray(candidate.items)) {
    return payload;
  }

  return {
    ...candidate,
    items: candidate.items.map((item) => ({
      emoji: null,
      name: null,
      quantity: null,
      unit: null,
      category: null,
      storageType: null,
      shelfName: null,
      expiresAt: null,
      flagged: null,
      ...(item && typeof item === "object" ? item : {}),
    })),
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function normalizeEmoji(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = z.string().emoji().safeParse(trimmed);
  return parsed.success ? parsed.data : undefined;
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

function normalizeEnumValue<T extends string>(value: unknown, aliases: Record<string, T>) {
  if (typeof value !== "string") {
    return undefined;
  }

  return aliases[value.trim().toLowerCase()];
}

function normalizeStorageType(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return STORAGE_TYPE_ALIASES[value.trim().toLowerCase() as keyof typeof STORAGE_TYPE_ALIASES];
}

function normalizeExpiresAt(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return ISO_DATE_PATTERN.test(trimmed) ? trimmed : undefined;
}

function inferStorageType(
  category: z.infer<typeof stockReviewItemSchema>["category"],
  shelfName: unknown,
): z.infer<typeof stockReviewItemSchema>["storageType"] {
  const normalizedShelfName = typeof shelfName === "string" ? shelfName.trim().toLowerCase() : "";
  if (normalizedShelfName.includes("fridge") || normalizedShelfName.includes("dairy") || normalizedShelfName.includes("produce")) {
    return "fridge";
  }

  if (normalizedShelfName.includes("pantry") || normalizedShelfName.includes("spice") || normalizedShelfName.includes("grain")) {
    return "pantry";
  }

  return ["vegetable", "fruit", "dairy", "protein"].includes(category)
    ? "fridge"
    : "pantry";
}

function defaultShelfName(
  storageType: z.infer<typeof stockReviewItemSchema>["storageType"],
  category: z.infer<typeof stockReviewItemSchema>["category"],
) {
  if (storageType === "fridge") {
    switch (category) {
      case "dairy":
        return "Dairy";
      case "vegetable":
      case "fruit":
        return "Produce";
      case "protein":
        return "Meat & Fish";
      case "condiment":
        return "Leftovers & Condiments";
      default:
        return "Fridge Shelf";
    }
  }

  switch (category) {
    case "grain":
    case "protein":
      return "Dry Goods & Grains";
    case "spice":
      return "Spices & Herbs";
    case "condiment":
      return "Oils & Condiments";
    default:
      return "Pantry Shelf";
  }
}

function looksLikeMalformedText(value: string) {
  const trimmed = value.trim();
  return !trimmed || MARKUP_LIKE_TEXT_PATTERN.test(trimmed) || trimmed.startsWith("{") || trimmed.startsWith("[");
}
