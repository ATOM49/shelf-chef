import { buildPresetGenerationPrompt, PRESET_METADATA, type PresetId } from "@/lib/inventory/presets";
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from "@/lib/inventory/types";

function buildStapleExclusionClause(stapleNames: string[]): string {
  if (stapleNames.length === 0) return "";
  return `\nDo not include the following items - they are always assumed to be in stock and tracking them is unnecessary:\n${stapleNames.join(", ")}\n`;
}

export function buildStockParsePrompt(input: string, stapleNames: string[] = []): string {
  const today = new Date().toISOString().split("T")[0];
  const exclusionClause = buildStapleExclusionClause(stapleNames);

  return `You are a smart kitchen inventory assistant. Parse the raw input below into distinct food inventory items, then fill in all missing details so each one can be stored in a kitchen inventory system.

Today's date: ${today}

Allowed units: ${INVENTORY_UNITS.join(", ")}
Allowed categories: ${INVENTORY_CATEGORIES.join(", ")}
${exclusionClause}
This input comes from a user's stocking note. It may be a sentence, a messy list, comma-separated phrases, or one item per line. Parse it into distinct food items before enriching them.

Storage type rules:
- "fridge": perishables, dairy, eggs, fresh produce, meat, fish, open drinks, leftovers
- "pantry": dry goods, grains, canned goods, spices, oils, flour, sugar, cereals

Shelf naming guidelines (suggest a concise, descriptive shelf name to group similar items):
- Fridge shelves: "Dairy", "Produce", "Meat & Fish", "Beverages", "Leftovers & Condiments"
- Pantry shelves: "Dry Goods & Grains", "Canned Goods", "Spices & Herbs", "Oils & Condiments", "Baking"
(You may suggest a custom shelf name if none of the above fits well.)

Parsing rules:
- Split combined phrases into separate items.
- Ignore non-food chatter and headings.
- Keep the output order aligned with the order items appear in the raw input.
- If the same ingredient appears more than once in the raw input, keep each occurrence so the client can merge duplicates deliberately later.

For each item:
1. Choose one representative food emoji for the item (e.g. eggs -> 🥚, milk -> 🥛, spinach -> 🥬); omit emoji if uncertain.
2. Parse the ingredient name and clean obvious typos.
3. If quantity is not given, infer a sensible default (e.g. 1 for count items, 500 for ml/g items).
4. Pick the best unit from the allowed list (e.g. eggs -> count, milk -> ml, rice -> g).
5. Assign the most fitting category.
6. Decide fridge vs. pantry.
7. Suggest a shelf name.
8. Estimate expiresAt (YYYY-MM-DD) based on typical shelf life from today and omit the field for shelf-stable dry goods, spices, and canned items.
9. Set flagged: true if the name is unclear, ambiguous, or you cannot confidently assign all fields.
10. If a field is genuinely unknown, return the item anyway, omit that field instead of inventing a random value, and keep flagged: true.

Raw input to parse and enrich:
${input.trim()}

Return JSON with one enriched item object per parsed food item.`;
}

export function buildStockImagePrompt(stapleNames: string[] = []): string {
  const today = new Date().toISOString().split("T")[0];
  const exclusionClause = buildStapleExclusionClause(stapleNames);

  return `You are a smart kitchen inventory assistant. Carefully examine the provided photo of food items, groceries, or a fridge/pantry, then identify all visible food items and enrich each one so it can be stored in a kitchen inventory system.

Today's date: ${today}

Allowed units: ${INVENTORY_UNITS.join(", ")}
Allowed categories: ${INVENTORY_CATEGORIES.join(", ")}
${exclusionClause}
Photo analysis instructions:
- Identify every distinct food item visible in the image.
- If quantity is visible (e.g. a pack of 6 eggs, a 500ml bottle), use that; otherwise infer a sensible default.
- If a label or brand is visible, use the generic ingredient name (e.g. "Amul Butter" → "Butter").
- Group duplicates of the same item into one entry with the appropriate quantity.
- Ignore non-food items (packaging materials, appliances, utensils, etc.).
- If an item is partially obscured or hard to identify, include it with flagged: true.

Storage type rules:
- "fridge": perishables, dairy, eggs, fresh produce, meat, fish, open drinks, leftovers
- "pantry": dry goods, grains, canned goods, spices, oils, flour, sugar, cereals

Shelf naming guidelines (suggest a concise, descriptive shelf name to group similar items):
- Fridge shelves: "Dairy", "Produce", "Meat & Fish", "Beverages", "Leftovers & Condiments"
- Pantry shelves: "Dry Goods & Grains", "Canned Goods", "Spices & Herbs", "Oils & Condiments", "Baking"
(You may suggest a custom shelf name if none of the above fits well.)

For each identified item:
1. Choose one representative food emoji (e.g. eggs -> 🥚, milk -> 🥛, spinach -> 🥬); omit if uncertain.
2. Write a clean generic ingredient name.
3. Set a realistic quantity based on what is visible; default to 1 for count items.
4. Pick the best unit from the allowed list.
5. Assign the most fitting category.
6. Decide fridge vs. pantry.
7. Suggest a shelf name.
8. Estimate expiresAt (YYYY-MM-DD) based on typical shelf life from today; omit for shelf-stable dry goods, spices, and canned items.
9. Set flagged: true if the item is unclear, ambiguous, or you cannot confidently assign all fields.
10. If a field is genuinely unknown, omit that field instead of inventing a value and keep flagged: true.

Return JSON with one enriched item object per identified food item.`;
}

export function buildPresetStockPrompt(presetId: PresetId, stapleNames: string[] = []): string {
  const today = new Date().toISOString().split("T")[0];
  const meta = PRESET_METADATA[presetId];
  const presetBrief = buildPresetGenerationPrompt(presetId);
  const exclusionClause = buildStapleExclusionClause(stapleNames);

  return `You are a smart kitchen inventory assistant. Generate a realistic starter inventory for a typical urban Indian household based on the preset brief below, then return review-ready items for the inventory table.

Today's date: ${today}

Allowed units: ${INVENTORY_UNITS.join(", ")}
Allowed categories: ${INVENTORY_CATEGORIES.join(", ")}
${exclusionClause}
Preset label: ${meta.label}
Preset brief:
${presetBrief}

Generation rules:
- Generate a practical household inventory for a typical urban Indian home that cooks regularly.
- Scale the number of items and quantities to match the preset intensity.
- Include a sensible balance of perishables and pantry staples unless the preset clearly leans in one direction.
- Use familiar Indian kitchen ingredients where appropriate, but keep the list practical and not excessive.
- Use current public web information when it helps keep the inventory realistic for a contemporary urban Indian household.
- Return only item rows in JSON. Do not include explanations, notes, or markdown.

Storage type rules:
- "fridge": perishables, dairy, eggs, fresh produce, meat, fish, open drinks, leftovers
- "pantry": dry goods, grains, canned goods, spices, oils, flour, sugar, cereals

Shelf naming guidelines:
- Fridge shelves: "Dairy", "Produce", "Meat & Fish", "Beverages", "Leftovers & Condiments"
- Pantry shelves: "Dry Goods & Grains", "Canned Goods", "Spices & Herbs", "Oils & Condiments", "Baking"

For each generated item:
1. Choose one representative food emoji for the item (e.g. eggs -> 🥚, milk -> 🥛, spinach -> 🥬); omit emoji if uncertain.
2. Provide a clear item name.
3. Choose a realistic household quantity.
4. Pick the best unit from the allowed list.
5. Assign the best-fit category.
6. Decide fridge vs. pantry.
7. Suggest a shelf name.
8. Estimate expiresAt (YYYY-MM-DD) for perishables and omit it for shelf-stable items.
9. Set flagged: true only when an item is genuinely ambiguous or uncertain.
10. If a field is genuinely unknown, return the item anyway, omit that field instead of inventing a random value, and keep flagged: true.

Return JSON with one enriched item object per generated food item.`;
}