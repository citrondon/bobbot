import { describe, expect, it } from "vitest";
import { resolveDeploymentModel } from "./deployment-model.js";

describe("resolveDeploymentModel", () => {
  it("pairs the deployment model key with the provider it belongs to", () => {
    const both = {
      OPENROUTER_API_KEY: "or-key",
      ANTHROPIC_API_KEY: "sk-ant-key",
      OPENCODE_API_KEY: "oc-key",
    };
    expect(resolveDeploymentModel(both)).toEqual({
      provider: "openrouter",
      model: "openai/gpt-6-luna",
      key: "or-key",
    });
    // The whole point: switching the provider switches the key with it.
    expect(resolveDeploymentModel({ ...both, PI_DEFAULT_PROVIDER: "anthropic" })).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-5",
      key: "sk-ant-key",
    });
    // An OpenCode Go subscription key resolves to that provider's own default model.
    expect(resolveDeploymentModel({ ...both, PI_DEFAULT_PROVIDER: "opencode-go" })).toEqual({
      provider: "opencode-go",
      model: "deepseek-v4.1-flash",
      key: "oc-key",
    });
    // A provider with no key configured yields no key — never another vendor's.
    expect(
      resolveDeploymentModel({ OPENROUTER_API_KEY: "or-key", PI_DEFAULT_PROVIDER: "anthropic" }),
    ).toEqual({ provider: "anthropic", model: "claude-sonnet-5", key: undefined });
    expect(
      resolveDeploymentModel({
        OPENROUTER_API_KEY: "or-key",
        PI_DEFAULT_PROVIDER: "opencode-go",
      }),
    ).toEqual({ provider: "opencode-go", model: "deepseek-v4.1-flash", key: undefined });
  });
});
