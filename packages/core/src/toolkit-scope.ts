/**
 * A bot's connector scope. `null` is "not scoped": every connected toolkit stays visible.
 * An empty list is a deliberate "no connector", a list is exactly those.
 */
export type ConnectorToolkitScope = string[] | null;

/**
 * Compose the two stored columns into that one scope.
 *
 * `toolkitsScoped` is false for a bot created before scoping existed, where an empty list meant
 * every toolkit. Those must stay unscoped, so the flag wins over the list — reading the list
 * alone would silently strip every connector from a bot that never asked to be scoped.
 */
export function connectorToolkitScope(row: {
  toolkitsScoped?: boolean | null;
  allowedToolkits?: readonly string[] | null;
}): ConnectorToolkitScope {
  if (!row.toolkitsScoped) return null;
  return [...(row.allowedToolkits ?? [])];
}

/**
 * The columns to write for a scope — the inverse of `connectorToolkitScope`. Both write paths
 * (creating a bot and saving its settings) go through this so the pair can never drift: an
 * unscoped bot written without the flag would silently keep every connector, and one written
 * with the flag but no list is a bot that uses none.
 */
export function toolkitScopeColumns(scope: ConnectorToolkitScope): {
  toolkitsScoped: boolean;
  allowedToolkits?: string[];
} {
  if (scope === null) return { toolkitsScoped: false };
  return { toolkitsScoped: true, allowedToolkits: [...scope] };
}
