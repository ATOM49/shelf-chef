import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogle } from "@langchain/google";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { toJSONSchema, z } from "zod";

const DEFAULT_LLM_PROVIDER = "gemini";
const DEFAULT_LLM_MODEL = "gemini-2.5-flash";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TEMPERATURE = 0;
const SUPPORTED_LLM_PROVIDERS = ["gemini", "openai", "anthropic"] as const;

const GOOGLE_SEARCH_TOOL = {
  googleSearch: {},
};

export const INDIAN_RECIPE_WEBSITES = [
  {
    domain: "indianhealthyrecipes.com",
    name: "Swasthi's Recipes",
    notes: "Strong all-rounder for dependable everyday Indian cooking.",
  },
  {
    domain: "vegrecipesofindia.com",
    name: "Veg Recipes of India",
    notes: "Best for vegetarian Indian home-style recipes.",
  },
  {
    domain: "hebbarskitchen.com",
    name: "Hebbar's Kitchen",
    notes: "Great for quick step-by-step recipes and South Indian dishes.",
  },
  {
    domain: "archanaskitchen.com",
    name: "Archana's Kitchen",
    notes: "Broad recipe coverage and meal planning ideas.",
  },
  {
    domain: "sanjeevkapoor.com",
    name: "Sanjeev Kapoor",
    notes: "Mainstream chef-led Indian recipe source.",
  },
  {
    domain: "ranveerbrar.com",
    name: "Ranveer Brar",
    notes: "Chef-style Indian recipes with more personality.",
  },
  {
    domain: "nishamadhulika.com",
    name: "Nisha Madhulika",
    notes: "Hindi-friendly vegetarian Indian recipe site.",
  },
] as const;

export const WEBSITE_CONTEXT_COLLECTIONS = {
  indianRecipes: INDIAN_RECIPE_WEBSITES.map((site) => site.domain),
} as const;

type SupportedLlmProvider = (typeof SUPPORTED_LLM_PROVIDERS)[number];

const PROVIDER_API_KEY_ENV_KEYS: Record<SupportedLlmProvider, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  gemini: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  openai: ["OPENAI_API_KEY"],
};

type TavilyGroundingOptions = {
  provider?: "tavily";
  query: string;
  includeDomains?: string[];
  maxResults?: number;
  topic?: "general" | "news";
  includeRawContent?: boolean;
};

export type ImageContent = {
  base64: string;
  mimeType: string;
};

type StructuredLlmOptions<TSchema extends z.ZodTypeAny> = {
  prompt: string;
  schema: TSchema;
  enableGoogleSearch?: boolean;
  grounding?: TavilyGroundingOptions;
  image?: ImageContent;
};

type ResolvedModelConfig = {
  provider: SupportedLlmProvider;
  model: string;
  apiKey?: string;
  enableGoogleSearch: boolean;
};

export class LlmConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigurationError";
  }
}

export function isLlmConfigurationError(error: unknown): error is LlmConfigurationError {
  return error instanceof LlmConfigurationError;
}

export async function generateStructuredObject<TSchema extends z.ZodTypeAny>(
  options: StructuredLlmOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const config = resolveModelConfig(options);
  const groundedPrompt = await maybeGroundPrompt(options.prompt, options.grounding);

  return runStructuredGenerationGraph(groundedPrompt, (prompt) =>
    invokeStructuredModel(prompt, options.schema, config, options.image),
  );
}

async function maybeGroundPrompt(
  prompt: string,
  grounding?: TavilyGroundingOptions,
) {
  if (!grounding || grounding.provider === undefined) {
    return prompt;
  }

  if (grounding.provider !== "tavily") {
    return prompt;
  }

  const apiKey = firstDefinedEnv("TAVILY_API_KEY");
  if (!apiKey) {
    throw new LlmConfigurationError(
      'No Tavily API key is configured. Set TAVILY_API_KEY to use Tavily grounding.',
    );
  }

  const searchResults = await searchWithTavily({
    apiKey,
    includeDomains: grounding.includeDomains,
    includeRawContent: grounding.includeRawContent ?? true,
    maxResults: grounding.maxResults ?? 5,
    query: grounding.query,
    topic: grounding.topic ?? "general",
  });

  if (searchResults.length === 0) {
    return prompt;
  }

  const sources = searchResults
    .map((result, index) => {
      const content = (result.raw_content || result.content || "").trim();
      return [
        `Source ${index + 1}: ${result.title || result.url}`,
        `URL: ${result.url}`,
        `Content: ${content || "No content returned."}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return [
    prompt,
    "",
    "Use the grounded web context below when producing the structured response.",
    "Prefer these sources when they are relevant and sufficient.",
    "",
    "Grounded context:",
    sources,
  ].join("\n");
}

type TavilySearchInput = {
  apiKey: string;
  query: string;
  includeDomains?: string[];
  maxResults: number;
  topic: "general" | "news";
  includeRawContent: boolean;
};

type TavilySearchResult = {
  title?: string;
  url: string;
  content?: string;
  raw_content?: string;
};

async function searchWithTavily(input: TavilySearchInput): Promise<TavilySearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      query: input.query,
      topic: input.topic,
      max_results: input.maxResults,
      include_domains: input.includeDomains,
      include_raw_content: input.includeRawContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily search failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { results?: TavilySearchResult[] };
  return data.results ?? [];
}

async function invokeStructuredModel<TSchema extends z.ZodTypeAny>(
  prompt: string,
  schema: TSchema,
  config: ResolvedModelConfig,
  image?: ImageContent,
) {
  switch (config.provider) {
    case "gemini":
      return invokeGeminiStructuredModel(prompt, schema, config, image);
    case "openai":
      return invokeOpenAIStructuredModel(prompt, schema, config, image);
    case "anthropic":
      return invokeAnthropicStructuredModel(prompt, schema, config, image);
  }
}

async function invokeGeminiStructuredModel<TSchema extends z.ZodTypeAny>(
  prompt: string,
  schema: TSchema,
  config: ResolvedModelConfig,
  image?: ImageContent,
) {
  ensureApiKey(config);

  if (config.enableGoogleSearch) {
    const model = new ChatGoogle({
      apiKey: config.apiKey,
      maxRetries: DEFAULT_MAX_RETRIES,
      model: config.model,
      temperature: DEFAULT_TEMPERATURE,
      tools: [GOOGLE_SEARCH_TOOL],
    });

    const response = await model.invoke(
      buildPromptStructuredJsonRequest(prompt, schema),
    );
    return parseStructuredResponse(schema, parseJsonText(extractResponseText(response)));
  }

  if (image) {
    const model = new ChatGoogle({
      apiKey: config.apiKey,
      maxRetries: DEFAULT_MAX_RETRIES,
      model: config.model,
      temperature: DEFAULT_TEMPERATURE,
    });

    const jsonPrompt = buildPromptStructuredJsonRequest(prompt, schema);
    const response = await model.invoke([
      ["human", [
        { type: "text", text: jsonPrompt },
        { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
      ]],
    ]);
    return parseStructuredResponse(schema, parseJsonText(extractResponseText(response)));
  }

  const model = new ChatGoogle({
    apiKey: config.apiKey,
    maxRetries: DEFAULT_MAX_RETRIES,
    model: config.model,
    responseSchema: schema,
    temperature: DEFAULT_TEMPERATURE,
  });

  const response = await model.invoke(prompt);
  return parseStructuredResponse(schema, parseJsonText(extractResponseText(response)));
}

async function invokeOpenAIStructuredModel<TSchema extends z.ZodTypeAny>(
  prompt: string,
  schema: TSchema,
  config: ResolvedModelConfig,
  image?: ImageContent,
) {
  ensureApiKey(config);

  const model = new ChatOpenAI({
    apiKey: config.apiKey,
    maxRetries: DEFAULT_MAX_RETRIES,
    model: config.model,
    temperature: DEFAULT_TEMPERATURE,
  });

  if (image) {
    const jsonPrompt = buildPromptStructuredJsonRequest(prompt, schema);
    const response = await model.invoke([
      ["human", [
        { type: "text", text: jsonPrompt },
        { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
      ]],
    ]);
    return parseStructuredResponse(schema, parseJsonText(extractResponseText(response)));
  }

  const structuredModel = model.withStructuredOutput(schema);
  const response = await structuredModel.invoke(prompt);
  return parseStructuredResponse(schema, response);
}

async function invokeAnthropicStructuredModel<TSchema extends z.ZodTypeAny>(
  prompt: string,
  schema: TSchema,
  config: ResolvedModelConfig,
  image?: ImageContent,
) {
  ensureApiKey(config);

  const model = new ChatAnthropic({
    apiKey: config.apiKey,
    maxRetries: DEFAULT_MAX_RETRIES,
    model: config.model,
    temperature: DEFAULT_TEMPERATURE,
  });

  if (image) {
    const jsonPrompt = buildPromptStructuredJsonRequest(prompt, schema);
    const response = await model.invoke([
      ["human", [
        { type: "text", text: jsonPrompt },
        { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
      ]],
    ]);
    return parseStructuredResponse(schema, parseJsonText(extractResponseText(response)));
  }

  const structuredModel = model.withStructuredOutput(schema);
  const response = await structuredModel.invoke(prompt);
  return parseStructuredResponse(schema, response);
}

function parseStructuredResponse<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  response: unknown,
) {
  const parsed = schema.safeParse(response);
  if (!parsed.success) {
    throw new Error("AI returned an invalid structured response. Try again.");
  }

  return parsed.data;
}

function buildPromptStructuredJsonRequest<TSchema extends z.ZodTypeAny>(
  prompt: string,
  schema: TSchema,
) {
  const jsonSchema = JSON.stringify(toJSONSchema(schema), null, 2);

  return [
    prompt,
    "",
    "Return only valid JSON that matches the schema below.",
    "Do not include markdown fences, commentary, or citations outside the JSON.",
    "",
    "JSON schema:",
    jsonSchema,
  ].join("\n");
}

async function runStructuredGenerationGraph<T>(
  prompt: string,
  generate: (prompt: string) => Promise<T>,
) {
  const GenerationState = Annotation.Root({
    prompt: Annotation<string>,
    result: Annotation<T | undefined>,
  });

  const graph = new StateGraph(GenerationState)
    .addNode("generate", async (state: typeof GenerationState.State) => ({
      result: await generate(state.prompt),
    }))
    .addEdge(START, "generate")
    .addEdge("generate", END)
    .compile();

  const result = await graph.invoke({ prompt, result: undefined });
  if (typeof result.result === "undefined") {
    throw new Error("AI returned an empty response. Try again.");
  }

  return result.result;
}

function resolveModelConfig<TSchema extends z.ZodTypeAny>(
  options: StructuredLlmOptions<TSchema>,
): ResolvedModelConfig {
  const configuredModel = firstDefinedEnv("LLM_MODEL") ?? DEFAULT_LLM_MODEL;
  const parsedModel = parseModelSpecifier(configuredModel);
  const provider = normalizeProvider(
    parsedModel.provider ?? firstDefinedEnv("LLM_PROVIDER") ?? DEFAULT_LLM_PROVIDER,
  );
  const enableGoogleSearch =
    options.enableGoogleSearch === true
    && provider === "gemini"
    && firstDefinedEnv("LLM_ENABLE_GOOGLE_SEARCH") !== "false";
  const apiKey = resolveApiKey(provider);

  return {
    apiKey,
    enableGoogleSearch,
    model: parsedModel.model,
    provider,
  };
}

function resolveApiKey(provider: SupportedLlmProvider) {
  return firstDefinedEnv(
    "LLM_API_KEY",
    ...(PROVIDER_API_KEY_ENV_KEYS[provider] ?? []),
  );
}

function ensureApiKey(config: ResolvedModelConfig) {
  if (config.apiKey) {
    return;
  }

  const envKeys = [
    "LLM_API_KEY",
    ...(PROVIDER_API_KEY_ENV_KEYS[config.provider] ?? []),
  ];
  if (envKeys.length === 0) {
    return;
  }

  throw new LlmConfigurationError(
    `No API key is configured for provider \"${config.provider}\". Set one of: ${envKeys.join(", ")}.`,
  );
}

function normalizeProvider(provider: string): SupportedLlmProvider {
  switch (provider.trim().toLowerCase()) {
    case "anthropic":
      return "anthropic";
    case "gemini":
    case "google":
    case "google-genai":
      return "gemini";
    case "open_ai":
    case "openai":
      return "openai";
    default:
      throw new LlmConfigurationError(
        `Unsupported LLM provider \"${provider}\". Supported providers: ${SUPPORTED_LLM_PROVIDERS.join(", ")}.`,
      );
  }
}

function parseModelSpecifier(value: string) {
  const trimmed = value.trim();
  const separatorIndex = trimmed.indexOf(":");

  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return { model: trimmed };
  }

  return {
    model: trimmed.slice(separatorIndex + 1),
    provider: trimmed.slice(0, separatorIndex).toLowerCase(),
  };
}

function extractResponseText(response: { text?: string; content?: unknown }) {
  if (typeof response.text === "string" && response.text.trim()) {
    return response.text;
  }

  if (typeof response.content === "string" && response.content.trim()) {
    return response.content;
  }

  throw new Error("AI returned an empty response. Try again.");
}

function parseJsonText(text: string) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1].trim()) as unknown;
    }

    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1)) as unknown;
    }

    throw new Error("AI returned invalid JSON. Try again.");
  }
}

function firstDefinedEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}