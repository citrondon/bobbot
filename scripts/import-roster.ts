/**
 * Import this installation's bot roster from the presets that ship in the repo.
 *
 * A fresh checkout has the library but no bots. Importing twelve presets by hand and then
 * setting each model and connector scope is the step an operator gets wrong, so this does it
 * in one pass. It is safe to re-run: an existing bot keeps everything except the model and
 * the scope, which are only written when they differ.
 *
 *   BOBBOT_API_TOKEN=<session token> npx tsx scripts/import-roster.ts [--dry-run]
 *
 * Run it after the model connection exists (docs/handover-checklist.md, step 3): the API
 * validates a bot's model against the connection's own model id, so the custom endpoint has
 * to be connected first. `--dry-run` validates the presets and prints the plan only.
 *
 * Environment:
 *   BOBBOT_API_URL        API base URL. Default http://127.0.0.1:3100
 *   BOBBOT_API_TOKEN      better-auth session token (required)
 *   BOBBOT_ROSTER_PROVIDER  Model provider for every bot. Default openai-compatible
 */
import type { Bot } from "@bobbot/contracts";
import { importPreset, listBots, rpc } from "./lib/api.js";

const SOCIAL = ["linkedin", "instagram"] as const;
const NONE: readonly string[] = [];

type RosterEntry = { slug: string; name: string; model: string; toolkits: readonly string[] };

/** The roster this deployment runs — models and connector scopes as configured in production.
 *
 * Eleven of the twelve carry no connector toolkit on purpose: they work with the builtin tools
 * (web_fetch, web_search, files, memory) and would otherwise drag every connected service's
 * tool list into their prompt. Measured on ExecutiveChief: 24 144 input + 24 808 cache-read
 * tokens per call became 11 370 + 0, and a run went from 47–605 s to 17 s. Only Social Queue
 * needs the connector toolkits, because its routines publish to LinkedIn and Instagram. */
const ROSTER: readonly RosterEntry[] = [
  { slug: "executive-chief", name: "ExecutiveChief", model: "kimi-k3", toolkits: NONE },
  { slug: "grok-coder", name: "GrokCoder", model: "kimi-k3", toolkits: NONE },
  { slug: "social-queue", name: "Social Queue", model: "kimi-k3", toolkits: SOCIAL },
  { slug: "content-remix", name: "Content Remix", model: "kimi-k3", toolkits: NONE },
  { slug: "domain-engineer", name: "Domain Engineer", model: "kimi-k3", toolkits: NONE },
  { slug: "website-ops", name: "Website Ops", model: "kimi-k3", toolkits: NONE },
  { slug: "bug-reproduction", name: "Bug Reproduction", model: "kimi-k3", toolkits: NONE },
  { slug: "competitor-watch", name: "Competitor Watch", model: "kimi-k3", toolkits: NONE },
  {
    slug: "creative-director",
    name: "Creative Director & Media Explorer",
    model: "kimi-k3",
    toolkits: NONE,
  },
  {
    slug: "permit-researcher",
    name: "Permit & Red-Tape Researcher",
    model: "kimi-k3",
    toolkits: NONE,
  },
  { slug: "project-manager", name: "Project Manager", model: "kimi-k3", toolkits: NONE },
  { slug: "pr-reviewer", name: "PR Reviewer", model: "claude-sonnet-4-6", toolkits: NONE },
];

function sameScope(current: readonly string[] | null, wanted: readonly string[]): boolean {
  const normalize = (ids: readonly string[]) => [...ids].sort().join(",");
  return normalize(current ?? []) === normalize(wanted);
}

function scopeLabel(entry: RosterEntry): string {
  return entry.toolkits.length === 0 ? "no toolkits" : entry.toolkits.join("+");
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const provider = process.env.BOBBOT_ROSTER_PROVIDER ?? "openai-compatible";

  const catalog = await rpc<Array<{ slug: string; name: string }>>("bots/presets");
  const known = new Set(catalog.map((row) => row.slug));
  let bots = await listBots();
  let imported = 0;
  let configured = 0;
  let unchanged = 0;
  let missing = 0;

  for (const entry of ROSTER) {
    if (!known.has(entry.slug)) {
      missing += 1;
      console.log(`MISSING  ${entry.slug} (${entry.name}) — not in the preset catalog`);
      continue;
    }
    const existing = bots.find((bot) => bot.name === entry.name);
    const settled =
      existing?.modelProvider === provider &&
      existing?.modelId === entry.model &&
      sameScope(existing?.allowedToolkits ?? null, entry.toolkits);
    const label = `${entry.name} · ${entry.model} · ${scopeLabel(entry)}`;

    if (existing && settled) {
      unchanged += 1;
      console.log(`ok       ${label}`);
      continue;
    }
    if (dryRun) {
      console.log(`${existing ? "set      " : "import   "} ${label}`);
      continue;
    }

    const bot = existing ?? (await importPreset(entry.slug));
    if (!existing) {
      imported += 1;
      bots = [...bots, bot];
    }
    const updated = await rpc<Bot>("bots/update", {
      botId: bot.id,
      modelProvider: provider,
      modelId: entry.model,
      allowedToolkits: [...entry.toolkits],
    });
    configured += 1;
    console.log(
      `${existing ? "set      " : "imported "} ${entry.name} · ${updated.modelProvider}/${updated.modelId} · ${scopeLabel(entry)}`,
    );
  }

  const verb = dryRun ? "would change" : "changed";
  console.log(
    `\n${ROSTER.length - missing} of ${ROSTER.length} presets found · ${imported} imported · ${configured} ${verb} · ${unchanged} already correct${missing > 0 ? ` · ${missing} missing` : ""}`,
  );
  if (missing > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
