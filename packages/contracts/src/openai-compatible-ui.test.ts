import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ExportManifestSchema } from "./domain.js";
import {
  formatOpenAiCompatibleModelLabel,
  isTokenPackModel,
  openAiCompatibleConnectReady,
  openAiCompatibleProbeSuccessMessage,
  sortProbedModels,
} from "./openai-compatible-ui.js";

describe("openAiCompatibleConnectReady", () => {
  it("allows a new connection with base URL and explicit model id", () => {
    expect(
      openAiCompatibleConnectReady({
        baseUrl: "http://127.0.0.1:8000/v1",
        modelId: "qwen",
      }),
    ).toBe(true);
  });

  it("rejects empty base URL or model id", () => {
    expect(
      openAiCompatibleConnectReady({
        baseUrl: "  ",
        modelId: "qwen",
      }),
    ).toBe(false);
    expect(
      openAiCompatibleConnectReady({
        baseUrl: "http://127.0.0.1:8000/v1",
        modelId: "",
      }),
    ).toBe(false);
  });

  it("guides manual entry when a successful probe lists no models", () => {
    expect(openAiCompatibleProbeSuccessMessage(0)).toBe("Server found. Enter a model name.");
  });

  it("identifies SpooK token-pack models and formats their labels", () => {
    expect(isTokenPackModel("claude-sonnet-5")).toBe(true);
    expect(isTokenPackModel("kimi-k3")).toBe(true);
    expect(isTokenPackModel("grok-4.6")).toBe(true);
    expect(isTokenPackModel("glm-5.3-flash")).toBe(true);
    // A retired id still matches the vendor-prefix heuristic, so the label stays a
    // hint about billing — never a promise that the endpoint serves the model.
    expect(isTokenPackModel("deepseek-v4-flash")).toBe(true);

    expect(formatOpenAiCompatibleModelLabel("claude-sonnet-5")).toBe(
      "claude-sonnet-5  📦 [Token-Paket]",
    );
    expect(formatOpenAiCompatibleModelLabel("kimi-k3")).toBe("kimi-k3  📦 [Token-Paket]");
  });

  it("sorts token-pack models to the front with claude-sonnet-5 first", () => {
    const list = ["grok-4.6", "claude-haiku-4-5-20251001", "kimi-k3", "claude-sonnet-5"];
    const sorted = sortProbedModels(list);
    expect(sorted).toEqual(["claude-sonnet-5", "kimi-k3", "grok-4.6", "claude-haiku-4-5-20251001"]);
  });
});

describe("bot-library presets", () => {
  it("validates all 5 bot presets against ExportManifestSchema", () => {
    const presets = [
      "openresearch.v1.json",
      "grok-coder.v1.json",
      "trend-scout.v1.json",
      "executive-chief.v1.json",
      "data-analyst.v1.json",
    ];
    for (const filename of presets) {
      const candidates = [
        path.resolve(process.cwd(), "bot-library", filename),
        path.resolve(process.cwd(), "../../bot-library", filename),
        path.resolve(
          fileURLToPath(new URL(".", import.meta.url)),
          "../../../bot-library",
          filename,
        ),
      ];
      const filePath = candidates.find((p) => fs.existsSync(p));
      expect(filePath, `Preset file not found: ${filename}`).toBeDefined();
      const raw = fs.readFileSync(filePath!, "utf-8");
      const parsed = ExportManifestSchema.parse(JSON.parse(raw));
      expect(parsed.version).toBe(1);
      expect(parsed.bot.name.length).toBeGreaterThan(0);
      expect(parsed.memory.length).toBeGreaterThan(0);
      expect(parsed.routines.length).toBeGreaterThan(0);
    }
  });
});
