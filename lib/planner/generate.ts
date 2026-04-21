import { GoogleGenAI, type Tool } from "@google/genai";
import type {
  PlannerInventoryContextItem,
  PlannerPreferredDishInput,
  Recipe,
} from "@/lib/planner/types";
import {
  parsePlannerMealSlotsModelResponse,
  parseRecipeGenerationModelResponse,
  plannerMealSlotsModelJsonSchema,
  recipeGenerationModelJsonSchema,
} from "@/lib/planner/schema";

const GROUNDED_PLANNER_MODEL = "gemini-3-flash-preview";

const groundingTool: Tool = {
  googleSearch: {},
};

function createClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

async function generateStructuredPlannerResponse<T>(params: {
  prompt: string;
  apiKey: string;
  responseJsonSchema: object;
  parse: (payload: unknown) => T;
}) {
  const ai = createClient(params.apiKey);
  const response = await ai.models.generateContent({
    model: GROUNDED_PLANNER_MODEL,
    contents: params.prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: params.responseJsonSchema,
      tools: [groundingTool],
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("AI returned an empty planner response. Try again.");
  }

  return params.parse(JSON.parse(text) as unknown);
}

export async function generateRecipeResponse(
  prompt: string,
  apiKey: string,
  preferredDishes: PlannerPreferredDishInput[],
  inventory: PlannerInventoryContextItem[],
) {
  return generateStructuredPlannerResponse({
    prompt,
    apiKey,
    responseJsonSchema: recipeGenerationModelJsonSchema,
    parse: (payload) => parseRecipeGenerationModelResponse(payload, preferredDishes, inventory),
  });
}

export async function generateWeeklyPlannerResponse(
  prompt: string,
  apiKey: string,
  recipes: Recipe[],
) {
  return generateStructuredPlannerResponse({
    prompt,
    apiKey,
    responseJsonSchema: plannerMealSlotsModelJsonSchema,
    parse: (payload) => parsePlannerMealSlotsModelResponse(payload, recipes),
  });
}

export async function generateCustomRecipeResponse(
  prompt: string,
  apiKey: string,
  inventory: PlannerInventoryContextItem[],
) {
  const response = await generateStructuredPlannerResponse({
    prompt,
    apiKey,
    responseJsonSchema: recipeGenerationModelJsonSchema,
    parse: (payload) => parseRecipeGenerationModelResponse(payload, [], inventory),
  });

  const recipe = response.recipes[0];
  if (!recipe) {
    throw new Error("AI didn't return a usable recipe. Try again.");
  }

  return { recipe };
}