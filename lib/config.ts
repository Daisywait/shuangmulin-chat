import { ModelConfig } from "./types";

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getModelConfig(): ModelConfig[] {
  const raw = process.env.MODEL_CONFIG_JSON;
  if (!raw) {
    return [
      { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", supportsImages: true },
      { id: "claude-3-5-sonnet", label: "Claude Sonnet", provider: "anthropic", supportsImages: true }
    ];
  }

  const parsed = JSON.parse(raw) as ModelConfig[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("MODEL_CONFIG_JSON must be a non-empty JSON array.");
  }

  for (const model of parsed) {
    if (!model.id || !model.label || !["openai", "anthropic"].includes(model.provider)) {
      throw new Error("Each model config needs id, label, and provider=openai|anthropic.");
    }
  }

  return parsed;
}

export function getModelById(id: string) {
  const model = getModelConfig().find((item) => item.id === id);
  if (!model) {
    throw new Error(`Model is not allowed: ${id}`);
  }
  return model;
}
