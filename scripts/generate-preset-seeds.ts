/**
 * Regenerates lib/inventory/preset-seeds.ts by calling the actual LLM API for
 * each preset and writing the results as static seed data.
 *
 * Usage:
 *   npx tsx scripts/generate-preset-seeds.ts
 *
 * Requires a valid LLM API key configured via environment variables
 * (GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY) plus the DATABASE_URL
 * env var for Prisma generation. See .env.example.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const PRESET_IDS = ["scarce", "fridge-heavy", "pantry-heavy", "well-stocked"] as const;
type PresetId = (typeof PRESET_IDS)[number];

async function fetchPresetItems(baseUrl: string, presetId: PresetId) {
  const res = await fetch(`${baseUrl}/api/stock/preset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ presetId, useSeed: false }),
  });

  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(`Failed to fetch preset "${presetId}": ${err.error ?? res.status}`);
  }

  const data = (await res.json()) as { items: unknown[] };
  return data.items;
}

function renderItems(items: unknown[]) {
  return JSON.stringify(items, null, 4)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n")
    .trimStart();
}

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log(`Generating preset seeds from ${baseUrl} …`);

  const results: Partial<Record<PresetId, unknown[]>> = {};

  for (const presetId of PRESET_IDS) {
    console.log(`  Fetching "${presetId}" …`);
    try {
      results[presetId] = await fetchPresetItems(baseUrl, presetId);
      console.log(`  ✓ "${presetId}" — ${results[presetId]!.length} items`);
    } catch (err) {
      console.error(`  ✗ "${presetId}" failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }

  const outputLines: string[] = [
    `import type { StockReviewItem } from "@/lib/stocking/types";`,
    `import type { PresetId } from "@/lib/inventory/presets";`,
    ``,
    `/**`,
    ` * Pre-generated seed inventory items for each preset.`,
    ` *`,
    ` * These items are served directly by the /api/stock/preset endpoint so that`,
    ` * new users can stock their shelves immediately without waiting for an LLM`,
    ` * call. Run \`npm run generate:preset-seeds\` to regenerate this file using the`,
    ` * actual LLM API.`,
    ` */`,
    `export const PRESET_SEEDS: Record<PresetId, StockReviewItem[]> = {`,
  ];

  for (const presetId of PRESET_IDS) {
    const items = results[presetId]!;
    outputLines.push(`  "${presetId}": ${renderItems(items)},`);
    outputLines.push(``);
  }

  outputLines.push(`};`);
  outputLines.push(``);

  const outputPath = path.resolve(__dirname, "../lib/inventory/preset-seeds.ts");
  await fs.writeFile(outputPath, outputLines.join("\n"), "utf-8");
  console.log(`\nWrote ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
