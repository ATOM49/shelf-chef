export type PresetId = "scarce" | "fridge-heavy" | "pantry-heavy" | "well-stocked";

export const PRESET_METADATA: Record<PresetId, { label: string; description: string }> = {
  scarce: {
    label: "Scarce",
    description: "Bare minimum — a few fresh veggies, eggs and basic dry staples.",
  },
  "fridge-heavy": {
    label: "Fridge-heavy",
    description: "Well-stocked fridge with dairy, eggs and fresh produce, light pantry.",
  },
  "pantry-heavy": {
    label: "Pantry-heavy",
    description: "Full pantry of dry goods, grains and spices; minimal fridge items.",
  },
  "well-stocked": {
    label: "Well-stocked",
    description: "A fully-loaded Indian household kitchen — ready to cook anything.",
  },
};

export const PRESET_ORDER = ["scarce", "fridge-heavy", "pantry-heavy", "well-stocked"] as const satisfies readonly PresetId[];

export function buildPresetGenerationPrompt(presetId: PresetId): string {
  const meta = PRESET_METADATA[presetId];

  return [
    `Generate a realistic starter inventory for a typical urban Indian household based on this preset: "${meta.label}".`,
    meta.description,
    "Assume regular home cooking for a 2 person household and include a sensible mix of fresh produce, dairy, proteins, grains, condiments, and spices that match the preset intensity.",
    "Return only the review-ready inventory items; do not explain the choices.",
  ].join(" ");
}
