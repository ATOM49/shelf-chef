import { GoogleGenAI, type Tool } from "@google/genai";
import {
  stockApiResponseJsonSchema,
  parseStockApiResponseForReview,
} from "@/lib/stocking/schema";

const STOCK_PARSE_MODEL = "gemini-2.5-flash";
const STOCK_PRESET_MODEL = "gemini-3-flash-preview";

const groundingTool: Tool = {
  googleSearch: {},
};

function createClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

async function generateStockResponse(
  prompt: string,
  apiKey: string,
  model: string,
  tools?: Tool[],
) {
  const ai = createClient(apiKey);
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: stockApiResponseJsonSchema,
      tools,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("AI returned an empty stock response. Try again.");
  }
  console.log({ result: JSON.parse(text) });
  return parseStockApiResponseForReview(JSON.parse(text) as unknown);
}

export async function generateStockParseResponse(
  prompt: string,
  apiKey: string,
) {
  return generateStockResponse(prompt, apiKey, STOCK_PARSE_MODEL);
}

export async function generateStockPresetResponse(
  prompt: string,
  apiKey: string,
) {
  return generateStockResponse(prompt, apiKey, STOCK_PRESET_MODEL, [
    groundingTool,
  ]);
}
