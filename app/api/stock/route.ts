import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { NextRequest } from "next/server";
import type { StockingDraft } from "@/lib/stocking/types";
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from "@/lib/inventory/types";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY is not configured on this server." }, { status: 500 });
  }

  let body: { items: StockingDraft[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: "No items provided" }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Cleaned item name" },
                quantity: { type: SchemaType.NUMBER, description: "Numeric quantity" },
                unit: {
                  type: SchemaType.STRING,
                  format: "enum",
                  enum: [...INVENTORY_UNITS],
                  description: "Best-fit unit from the allowed list",
                },
                category: {
                  type: SchemaType.STRING,
                  format: "enum",
                  enum: [...INVENTORY_CATEGORIES],
                  description: "Best-fit category from the allowed list",
                },
                storageType: {
                  type: SchemaType.STRING,
                  format: "enum",
                  enum: ["fridge", "pantry"],
                  description: "Where this item is typically stored",
                },
                shelfName: {
                  type: SchemaType.STRING,
                  description: "Descriptive shelf name for grouping similar items",
                },
                expiresAt: {
                  type: SchemaType.STRING,
                  description: "ISO date YYYY-MM-DD based on typical shelf life; omit for shelf-stable items",
                },
                flagged: {
                  type: SchemaType.BOOLEAN,
                  description: "True when the item name is ambiguous or fields cannot be confidently assigned",
                },
              },
              required: ["name", "quantity", "unit", "category", "storageType", "shelfName", "flagged"],
            },
          },
        },
        required: ["items"],
      },
    },
  });

  const prompt = buildPrompt(items);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as { items: unknown[] };
    return Response.json({ items: parsed.items });
  } catch (err) {
    return Response.json(
      { error: "LLM call failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

function buildPrompt(items: StockingDraft[]): string {
  const today = new Date().toISOString().split("T")[0];
  const itemList = items
    .map((item, i) => {
      let line = `${i + 1}. "${item.name}"`;
      if (item.quantity != null) line += ` — quantity: ${item.quantity}`;
      if (item.unit) line += ` ${item.unit}`;
      return line;
    })
    .join("\n");

  return `You are a smart kitchen inventory assistant. For each food item below, fill in all missing details so it can be stored in a kitchen inventory system.

Today's date: ${today}

Allowed units: ${INVENTORY_UNITS.join(", ")}
Allowed categories: ${INVENTORY_CATEGORIES.join(", ")}

Storage type rules:
- "fridge": perishables, dairy, eggs, fresh produce, meat, fish, open drinks, leftovers
- "pantry": dry goods, grains, canned goods, spices, oils, flour, sugar, cereals

Shelf naming guidelines (suggest a concise, descriptive shelf name to group similar items):
- Fridge shelves: "Dairy", "Produce", "Meat & Fish", "Beverages", "Leftovers & Condiments"
- Pantry shelves: "Dry Goods & Grains", "Canned Goods", "Spices & Herbs", "Oils & Condiments", "Baking"
(You may suggest a custom shelf name if none of the above fits well.)

For each item:
1. Keep or clean the name (correct obvious typos).
2. If quantity is not given, infer a sensible default (e.g. 1 for count items, 500 for ml/g items).
3. Pick the best unit from the allowed list (e.g. eggs → count, milk → ml, rice → g).
4. Assign the most fitting category.
5. Decide fridge vs. pantry.
6. Suggest a shelf name.
7. Estimate expiresAt (YYYY-MM-DD) based on typical shelf life from today — omit the field entirely for shelf-stable dry goods, spices, and canned items.
8. Set flagged: true if the name is unclear, ambiguous, or you cannot confidently assign all fields.

Items to enrich:
${itemList}

Return enriched data for all ${items.length} items in the same order as the input.`;
}
