export const OPENAI_COMPATIBLE_BASE_URL_HINT =
  "Paste the OpenAI-compatible address from your server. BobBot adds /v1 if needed.";

/** Connect when base URL and model id are set. */
export function openAiCompatibleConnectReady(input: { baseUrl: string; modelId: string }): boolean {
  return Boolean(input.baseUrl.trim() && input.modelId.trim());
}

export function openAiCompatibleProbeSuccessMessage(modelCount: number): string {
  return modelCount
    ? `Found ${modelCount} model${modelCount === 1 ? "" : "s"}.`
    : "Server found. Enter a model name.";
}

/** Models covered under SpooK API Token Packs (Prepaid / 90% discount).
 *
 * Mirror of the live catalog at <https://spookapi.xyz/docs/models> (verified
 * 16.10.2026). SpooK retires ids without notice, so a stale entry here offers a
 * model the endpoint answers with `404 Requested model is not available`. Refresh
 * this list whenever the catalog changes; it only drives the picker's
 * `📦 [Token-Paket]` label and its sort order, never a request. */
export const SPOOK_TOKEN_PACK_MODELS: ReadonlySet<string> = new Set([
  // Claude
  "claude-fable-5-1",
  "claude-fable-5",
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-5",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  // OpenAI
  "gpt-6-astra",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-5.6-luna",
  // Qwen, Kimi, Grok, GLM
  "qwen3.8-max",
  "qwen3.8-flash",
  "kimi-k3",
  "grok-4.6",
  "glm-5.3-flash",
  "glm-5.3",
]);

export function isTokenPackModel(modelId: string): boolean {
  const normalized = modelId.trim().toLowerCase();
  return (
    SPOOK_TOKEN_PACK_MODELS.has(normalized) ||
    normalized.startsWith("claude-") ||
    normalized.startsWith("deepseek-") ||
    normalized.startsWith("gpt-") ||
    normalized.startsWith("gemini-") ||
    normalized.startsWith("qwen") ||
    normalized.startsWith("glm-") ||
    normalized.startsWith("kimi-") ||
    normalized.startsWith("grok-") ||
    normalized.startsWith("cursor-")
  );
}

export function formatOpenAiCompatibleModelLabel(modelId: string): string {
  const trimmed = modelId.trim();
  if (isTokenPackModel(trimmed)) {
    return `${trimmed}  📦 [Token-Paket]`;
  }
  return trimmed;
}

/** Sorts models so that top Token-Pack models (especially claude-sonnet-5) are placed first. */
export function sortProbedModels(modelIds: readonly string[]): string[] {
  const priorityOrder: Record<string, number> = {
    "claude-sonnet-5": 1,
    "claude-sonnet-4-6": 2,
    "claude-opus-5": 3,
    "claude-opus-4-8": 4,
    "claude-opus-4-7": 5,
    "claude-opus-4-6": 6,
    "claude-fable-5": 7,
    "claude-fable-5-1": 8,
    "gpt-6-astra": 9,
    "gpt-5.6-sol": 10,
    "gpt-5.6-terra": 11,
    "gpt-5.6-luna": 12,
    "kimi-k3": 13,
    "glm-5.3": 14,
    "glm-5.3-flash": 15,
    "qwen3.8-max": 16,
    "qwen3.8-flash": 17,
    "grok-4.6": 18,
    "claude-haiku-4-5-20251001": 19,
  };

  return [...modelIds].sort((a, b) => {
    const aPriority = priorityOrder[a] ?? 100;
    const bPriority = priorityOrder[b] ?? 100;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.localeCompare(b);
  });
}
