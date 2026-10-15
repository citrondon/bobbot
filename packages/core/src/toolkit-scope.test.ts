import { describe, expect, it } from "vitest";
import {
  type ConnectorToolkitScope,
  connectorToolkitScope,
  toolkitScopeColumns,
} from "./toolkit-scope.js";

describe("connectorToolkitScope", () => {
  it("stays unscoped for a bot that never declared a scope", () => {
    // The pre-existing case: an empty list used to mean every connected toolkit, so reading it
    // as "none" would strip every connector from a bot that never asked to be scoped.
    expect(connectorToolkitScope({ toolkitsScoped: false, allowedToolkits: [] })).toBeNull();
    expect(connectorToolkitScope({})).toBeNull();
    expect(connectorToolkitScope({ allowedToolkits: ["gmail"] })).toBeNull();
  });

  it("reports no connectors for a bot scoped to none", () => {
    expect(connectorToolkitScope({ toolkitsScoped: true, allowedToolkits: [] })).toEqual([]);
  });

  it("returns the declared toolkits for a scoped bot", () => {
    expect(
      connectorToolkitScope({ toolkitsScoped: true, allowedToolkits: ["linkedin", "instagram"] }),
    ).toEqual(["linkedin", "instagram"]);
  });

  it("does not hand back the stored array itself", () => {
    const stored = ["gmail"];
    const scope = connectorToolkitScope({ toolkitsScoped: true, allowedToolkits: stored });
    expect(scope).toEqual(stored);
    expect(scope).not.toBe(stored);
  });
});

describe("toolkitScopeColumns", () => {
  it("clears the flag without touching the list when a bot is unscoped", () => {
    // Leaving the list alone keeps the selection for the next time the scope is switched on.
    expect(toolkitScopeColumns(null)).toEqual({ toolkitsScoped: false });
  });

  it("writes the flag with an empty list for a bot that uses no connector", () => {
    expect(toolkitScopeColumns([])).toEqual({ toolkitsScoped: true, allowedToolkits: [] });
  });

  it("writes the flag with the list for a scoped bot", () => {
    expect(toolkitScopeColumns(["linkedin"])).toEqual({
      toolkitsScoped: true,
      allowedToolkits: ["linkedin"],
    });
  });

  it("round-trips with connectorToolkitScope", () => {
    const scopes: ConnectorToolkitScope[] = [null, [], ["gmail", "notion"]];
    for (const scope of scopes) {
      const columns = toolkitScopeColumns(scope);
      expect(
        connectorToolkitScope({
          toolkitsScoped: columns.toolkitsScoped,
          allowedToolkits: columns.allowedToolkits,
        }),
      ).toEqual(scope);
    }
  });
});
