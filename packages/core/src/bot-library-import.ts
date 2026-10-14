/**
 * Laptop-Export-Format (bot-library/*.v1.json, Version 1) -> PC-BotTemplate.
 *
 * Laptop-Format (reichhaltig):
 *   { version, exportedAt, bot:{name,title,description,instructions},
 *     boundaries[], integrations[], skills[], memory[], routines[], files[], history[] }
 * PC-BotTemplate (flach, packages/core/src/bot-templates.ts):
 *   { id, name, title, description, instructions, color, computerMode,
 *     modelProvider?, modelId?, thinkingLevel?, tags[], source, icon? }
 *
 * Mapping-Regeln:
 * - id: aus Dateiname ableiten (account-specialist.v1.json -> "account-specialist")
 * - name/title/description/instructions: aus bot.* (Fallback: leere Strings)
 * - color: deterministisch aus id hashen (stabile Palette, keine Zufallsfarbe)
 * - computerMode: "dedicated" (die JSONs beschreiben keine Desktop-Steuerung)
 * - tags: ["imported", "bot-library"] + Dateiname-Teile (z.B. "account" aus "account-specialist")
 * - source: "custom" (sie stammen nicht aus dem PC-Builtin-Katalog)
 * - boundaries/memory/routines/skills: EXPLIZIT NICHT VERWORFEN, sondern in einer
 *   separaten Metadatei dokumentiert (siehe toBotTemplateWithMeta). Die PC-Engine
 *   kennt diese Felder nicht; sie gehen beim reinen Mapping verloren.
 */

export interface LaptopBotExport {
  version: number;
  exportedAt: string;
  bot: {
    name: string;
    title?: string;
    description?: string;
    instructions?: string;
  };
  boundaries?: string[];
  integrations?: unknown[];
  skills?: unknown[];
  memory?: unknown[];
  routines?: unknown[];
  files?: unknown[];
  history?: unknown[];
}

export interface BotTemplateLike {
  id: string;
  name: string;
  title: string;
  description: string;
  instructions: string;
  color: string;
  computerMode: string;
  tags: string[];
  source: "builtin" | "marketplace" | "custom";
}

export interface ImportResult extends BotTemplateLike {
  /** Felder, die die PC-Engine NICHT kennt – zur Nachverfolgung aufbewahrt. */
  _dropped: {
    boundaries: string[];
    memoryCount: number;
    routinesCount: number;
    skillsCount: number;
    integrationsCount: number;
  };
}

const PALETTE = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#84cc16",
] as const;

/** Dateiname "account-specialist.v1.json" -> id "account-specialist". */
export function idFromFilename(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  return base.replace(/\.v1\.json$/i, "").replace(/\.json$/i, "");
}

/** Stabile Farbe aus id (kein Zufall, gleiche id = gleiche Farbe). */
export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length] ?? PALETTE[0];
}

/** Tags: Basis + Wortbestandteile der id (Bindestrich getrennt). */
export function tagsForId(id: string): string[] {
  const parts = id.split("-").filter(Boolean);
  return [...new Set(["imported", "bot-library", ...parts])];
}

export function convertLaptopExport(raw: LaptopBotExport, filename: string): ImportResult {
  const id = idFromFilename(filename);
  const bot = raw.bot ?? ({} as LaptopBotExport["bot"]);
  return {
    id,
    name: bot.name ?? id,
    title: bot.title ?? "",
    description: bot.description ?? "",
    instructions: bot.instructions ?? "",
    color: colorForId(id),
    computerMode: "dedicated",
    tags: tagsForId(id),
    source: "custom",
    _dropped: {
      boundaries: raw.boundaries ?? [],
      memoryCount: (raw.memory ?? []).length,
      routinesCount: (raw.routines ?? []).length,
      skillsCount: (raw.skills ?? []).length,
      integrationsCount: (raw.integrations ?? []).length,
    },
  };
}
