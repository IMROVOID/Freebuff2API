import type { FreebuffModelDefinition } from "../types/freebuff";
import type { ModelData, ModelListResponse } from "../types/openai";

export const FREEBUFF_MODELS: readonly FreebuffModelDefinition[] = [
  {
    id: "z-ai/glm-5.3-flash",
    displayName: "GLM 5.3 Flash",
    ownedBy: "z-ai",
    contextWindow: 131072,
    description: "Default reasoning & coding model on Freebuff",
    isDefault: false,
  },
  {
    id: "deepseek/deepseek-v4-flash",
    displayName: "DeepSeek V4.1 Flash",
    ownedBy: "deepseek",
    contextWindow: 131072,
    description: "Fast code synthesis and agentic tool-use model",
    isDefault: true,
  },
  {
    id: "openai/gpt-6-luna",
    displayName: "GPT-6 Luna",
    ownedBy: "openai",
    contextWindow: 131072,
    description: "High capability flex queue general intelligence",
    isDefault: false,
  },
  {
    id: "xiaomi/mimo-v2.5",
    displayName: "MiMo 2.6 Flash",
    ownedBy: "xiaomi",
    contextWindow: 65536,
    description: "Balanced speed and reasoning efficiency",
    isDefault: false,
  },
  {
    id: "xiaomi/mimo-v2.6-pro",
    displayName: "MiMo 2.6 Pro",
    ownedBy: "xiaomi",
    contextWindow: 131072,
    description: "Advanced deep-thinking architecture",
    isDefault: false,
  },
  {
    id: "google/gemini-3.8-flash",
    displayName: "Gemini 3.8 Flash",
    ownedBy: "google",
    contextWindow: 1048576,
    description: "1M token context window and multimodal reasoning",
    isDefault: false,
  },
  {
    id: "stealth/space-bunny-alpha",
    displayName: "Space Bunny Alpha",
    ownedBy: "stealth",
    contextWindow: 1048576,
    description: "Ultra-long document comprehension model",
    isDefault: false,
  },
  {
    id: "upstage/solar-mini-4",
    displayName: "Solar Mini 4",
    ownedBy: "upstage",
    contextWindow: 32768,
    description: "Ultra-low-latency lightweight model",
    isDefault: false,
  },
  {
    id: "meta/muse-spark-1.2-contributor",
    displayName: "Muse Spark 1.2",
    ownedBy: "meta",
    contextWindow: 65536,
    description: "Rate-limited community allocation model",
    isDefault: false,
  },
] as const;

export const DEFAULT_MODEL_ID = "deepseek/deepseek-v4-flash";

const MODEL_ALIASES: Readonly<Record<string, string>> = {
  "gpt-4o": "deepseek/deepseek-v4-flash",
  "gpt-4o-mini": "deepseek/deepseek-v4-flash",
  "claude-3-5-sonnet": "deepseek/deepseek-v4-flash",
  "claude-3-7-sonnet": "z-ai/glm-5.3-flash",
  "deepseek-chat": "deepseek/deepseek-v4-flash",
  "deepseek-coder": "deepseek/deepseek-v4-flash",
  "glm-4": "z-ai/glm-5.3-flash",
  "gemini-flash": "google/gemini-3.8-flash",
};

/**
 * Resolves standard model names or aliases to upstream Freebuff model IDs.
 */
export function resolveModelId(requestedModel: string): string {
  if (!requestedModel || requestedModel.trim() === "") {
    return DEFAULT_MODEL_ID;
  }
  const clean = requestedModel.trim();
  const directMatch = FREEBUFF_MODELS.find((m) => m.id === clean);
  if (directMatch) {
    return directMatch.id;
  }
  const aliasMatch = MODEL_ALIASES[clean.toLowerCase()];
  if (aliasMatch) {
    return aliasMatch;
  }
  return clean;
}

/**
 * Converts model definitions to OpenAI /v1/models response format.
 */
export function getOpenAIModelList(): ModelListResponse {
  const now = Math.floor(Date.now() / 1000);
  const data: ModelData[] = FREEBUFF_MODELS.map((model) => ({
    id: model.id,
    object: "model",
    created: now,
    owned_by: model.ownedBy,
    permission: [
      {
        id: `modelperm-${model.id}`,
        object: "model_permission",
        created: now,
        allow_create_engine: false,
        allow_sampling: true,
        allow_logprobs: true,
        allow_search_indices: false,
        allow_view: true,
        allow_fine_tuning: false,
        organization: "*",
        group: null,
        is_blocking: false,
      },
    ],
    root: model.id,
    parent: null,
  }));

  return {
    object: "list",
    data,
  };
}
