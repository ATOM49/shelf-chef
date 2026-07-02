import {
  generateStructuredObject,
  generateStructuredObjectFromImage,
} from "../ai/structured";
import {
  parseStockApiResponseForReview,
  stockApiResponseSchema,
} from "@/lib/stocking/schema";

export async function generateStockParseResponse(
  prompt: string,
) {
  const response = await generateStructuredObject({
    prompt,
    schema: stockApiResponseSchema,
  });

  return parseStockApiResponseForReview(response);
}

export async function generateStockImageParseResponse(
  prompt: string,
  image: { data: string; mimeType: string },
) {
  const response = await generateStructuredObjectFromImage({
    image,
    prompt,
    schema: stockApiResponseSchema,
  });

  return parseStockApiResponseForReview(response);
}

export async function generateStockPresetResponse(
  prompt: string,
) {
  const response = await generateStructuredObject({
    enableGoogleSearch: true,
    prompt,
    schema: stockApiResponseSchema,
  });

  return parseStockApiResponseForReview(response);
}
