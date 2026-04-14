import type { StockingDraft } from "./types";

const UNIT_ALIASES: Record<string, string> = {
  gram: "g",
  grams: "g",
  kilogram: "kg",
  kilograms: "kg",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  cups: "cup",
};

const UNIT_PATTERN =
  /^(count|g|kg|ml|l|tbsp|tsp|cup|cups|grams?|kilograms?|milliliters?|millilitres?|liters?|litres?|tablespoons?|teaspoons?)$/i;

/**
 * Parses multi-line free-form text into StockingDraft objects.
 *
 * Recognised patterns (per line):
 *   "3 eggs"            → { name: "eggs", quantity: 3 }
 *   "2 kg rice"         → { name: "rice", quantity: 2, unit: "kg" }
 *   "500ml yogurt"      → { name: "yogurt", quantity: 500, unit: "ml" }
 *   "milk"              → { name: "milk" }
 *   "- 4 onions"        → { name: "onions", quantity: 4 }
 */
export function parseStockingText(text: string): StockingDraft[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .map(parseLine)
    .filter((d): d is StockingDraft => d !== null);
}

function normalizeUnit(raw: string): string {
  const lower = raw.toLowerCase();
  return UNIT_ALIASES[lower] ?? lower;
}

function parseLine(line: string): StockingDraft | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Pattern: <qty><unit?> <name>  (unit may be attached to number or space-separated)
  // e.g. "500ml yogurt", "2kg rice", "3 eggs", "2 kg rice"
  const withUnit = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(count|g|kg|ml|l|tbsp|tsp|cup|cups|grams?|kilograms?|milliliters?|millilitres?|liters?|litres?|tablespoons?|teaspoons?)\s+(.+)$/i,
  );
  if (withUnit) {
    const name = withUnit[3].trim();
    if (!name) return null;
    return {
      name,
      quantity: parseFloat(withUnit[1]),
      unit: UNIT_PATTERN.test(withUnit[2]) ? normalizeUnit(withUnit[2]) : undefined,
    };
  }

  // Pattern: <qty> <name> (no unit)
  const withQty = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (withQty) {
    const name = withQty[2].trim();
    if (!name) return null;
    return { name, quantity: parseFloat(withQty[1]) };
  }

  // Just a name
  return { name: trimmed };
}
