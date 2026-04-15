import { buildPresetGenerationPrompt, PRESET_METADATA, type PresetId } from "@/lib/inventory/presets";
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from "@/lib/inventory/types";

export function buildStockParsePrompt(input: string): string {
  const today = new Date().toISOString().split("T")[0];

  return `You are a smart kitchen inventory assistant. Parse the raw input below into distinct food inventory items, then fill in all missing details so each one can be stored in a kitchen inventory system.

Today's date: ${today}

Allowed units: ${INVENTORY_UNITS.join(", ")}
Allowed categories: ${INVENTORY_CATEGORIES.join(", ")}

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
1. Parse the ingredient name and clean obvious typos.
2. If quantity is not given, infer a sensible default (e.g. 1 for count items, 500 for ml/g items).
3. Pick the best unit from the allowed list (e.g. eggs -> count, milk -> ml, rice -> g).
4. Assign the most fitting category.
5. Decide fridge vs. pantry.
6. Suggest a shelf name.
7. Estimate expiresAt (YYYY-MM-DD) based on typical shelf life from today and omit the field for shelf-stable dry goods, spices, and canned items.
8. Set flagged: true if the name is unclear, ambiguous, or you cannot confidently assign all fields.
9. If a field is genuinely unknown, return the item anyway, omit that field instead of inventing a random value, and keep flagged: true.

Raw input to parse and enrich:
${input.trim()}

Return JSON with one enriched item object per parsed food item.`;
}

export function buildPresetStockPrompt(presetId: PresetId): string {
  const today = new Date().toISOString().split("T")[0];
  const meta = PRESET_METADATA[presetId];
  const presetBrief = buildPresetGenerationPrompt(presetId);

  return `You are a smart kitchen inventory assistant. Generate a realistic starter inventory for a typical urban Indian household based on the preset brief below, then return review-ready items for the inventory table.

Today's date: ${today}

Allowed units: ${INVENTORY_UNITS.join(", ")}
Allowed categories: ${INVENTORY_CATEGORIES.join(", ")}

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
1. Provide a clear item name.
2. Choose a realistic household quantity.
3. Pick the best unit from the allowed list.
4. Assign the best-fit category.
5. Decide fridge vs. pantry.
6. Suggest a shelf name.
7. Estimate expiresAt (YYYY-MM-DD) for perishables and omit it for shelf-stable items.
8. Set flagged: true only when an item is genuinely ambiguous or uncertain.
9. If a field is genuinely unknown, return the item anyway, omit that field instead of inventing a random value, and keep flagged: true.

Return JSON with one enriched item object per generated food item.`;
}