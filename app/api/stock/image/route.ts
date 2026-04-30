import type { NextRequest } from "next/server";
import { isLlmConfigurationError } from "@/lib/ai/structured";
import { generateStockImageResponse } from "@/lib/stocking/generate";
import { buildStockImagePrompt } from "@/lib/stocking/prompts";
import { normalizeIngredientName } from "@/lib/inventory/normalize";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const imageFile = formData.get("image");
  if (!(imageFile instanceof File)) {
    return Response.json({ error: "An image file is required" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(imageFile.type)) {
    return Response.json(
      { error: "Unsupported image format. Please use JPEG, PNG, WebP, or HEIC." },
      { status: 400 },
    );
  }

  if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
    return Response.json({ error: "Image is too large (max 10 MB)" }, { status: 400 });
  }

  const stapleNamesRaw = formData.get("stapleNames");
  let stapleNames: string[] = [];
  if (typeof stapleNamesRaw === "string" && stapleNamesRaw.trim()) {
    try {
      const parsed: unknown = JSON.parse(stapleNamesRaw);
      if (Array.isArray(parsed)) {
        stapleNames = parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      // ignore malformed stapleNames – treat as empty
    }
  }

  const normalizedStapleSet = new Set(stapleNames.map(normalizeIngredientName));

  const arrayBuffer = await imageFile.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  // Build base64 in chunks to avoid stack-overflow with large files
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  try {
    const response = await generateStockImageResponse(
      { base64, mimeType: imageFile.type },
      buildStockImagePrompt(stapleNames),
    );
    const filteredItems = response.items.filter(
      (item) => !normalizedStapleSet.has(normalizeIngredientName(item.name)),
    );
    return Response.json({ items: filteredItems });
  } catch (err) {
    const status = isLlmConfigurationError(err) ? 500 : 502;
    return Response.json(
      {
        error: isLlmConfigurationError(err) ? "LLM configuration error" : "LLM call failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status },
    );
  }
}
