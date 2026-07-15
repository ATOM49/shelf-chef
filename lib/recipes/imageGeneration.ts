import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";

import { LlmConfigurationError } from "@/lib/ai/structured";
import type { Recipe } from "@/lib/planner/types";

const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";
const DEFAULT_IMAGE_MIME_TYPE = "image/png";

type GeneratedImagePayload = {
  data: string;
  mimeType: string;
};

type GenerateRecipeImageInput = {
  recipe: Pick<Recipe, "id" | "title" | "mealType" | "cuisine" | "tags" | "ingredients">;
  prompt: string;
};

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.LLM_API_KEY?.trim()
  );
}

function getGeminiImageModel() {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
}

function getImageFileExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findGeneratedImagePayload(value: unknown): GeneratedImagePayload | null {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (!isRecord(current)) {
      continue;
    }

    const type = current.type;
    const data = current.data;
    const imageBytes = current.imageBytes;
    const mimeType = current.mime_type ?? current.mimeType;

    if (
      type === "image" &&
      typeof data === "string" &&
      data.length > 0
    ) {
      return {
        data,
        mimeType:
          typeof mimeType === "string" ? mimeType : DEFAULT_IMAGE_MIME_TYPE,
      };
    }

    if (typeof imageBytes === "string" && imageBytes.length > 0) {
      return {
        data: imageBytes,
        mimeType:
          typeof mimeType === "string" ? mimeType : DEFAULT_IMAGE_MIME_TYPE,
      };
    }

    queue.push(...Object.values(current));
  }

  return null;
}

export function buildRecipeImagePrompt(
  recipe: Pick<Recipe, "title" | "mealType" | "cuisine" | "tags" | "ingredients">,
) {
  const cuisine = recipe.cuisine ? `${recipe.cuisine} cuisine` : "home-cooked food";
  const ingredients = recipe.ingredients
    .slice(0, 10)
    .map((ingredient) => ingredient.name)
    .join(", ");
  const tags = recipe.tags.slice(0, 6).join(", ");

  return [
    `Create a square realistic food photograph of ${recipe.title}.`,
    `The dish is ${cuisine} for ${recipe.mealType}.`,
    ingredients ? `Use visual cues from these ingredients: ${ingredients}.` : "",
    tags ? `Mood and style cues: ${tags}.` : "",
    "Natural light, appetizing plated dish, clean table setting, realistic texture.",
    "No text, no labels, no watermark, no logo, no hands, no people.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateAndUploadRecipeImage({
  recipe,
  prompt,
}: GenerateRecipeImageInput) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new LlmConfigurationError(
      "No Gemini API key is configured. Set GEMINI_API_KEY to generate recipe images.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const interaction = await ai.interactions.create({
    model: getGeminiImageModel(),
    input: prompt,
    response_modalities: ["image"],
  });
  const image = findGeneratedImagePayload(interaction);
  if (!image) {
    throw new Error("Gemini did not return an image payload.");
  }

  const buffer = Buffer.from(image.data, "base64");
  const extension = getImageFileExtension(image.mimeType);
  const pathname = `recipe-images/${recipe.id}-${Date.now()}.${extension}`;
  const blob = await put(pathname, buffer, {
    access: "private",
    addRandomSuffix: true,
    contentType: image.mimeType,
    cacheControlMaxAge: 60 * 60 * 24 * 30,
  });

  return {
    imageUrl: blob.url,
    mimeType: image.mimeType,
  };
}
