/**
 * One-shot smoke test for a SpooK-backed deployment.
 *
 * Answers "does this installation actually run?" without SQL: it drives the API the same
 * way the web app does and checks the paths a fresh checkout gets wrong — the model call,
 * a tool call, a delegation round-trip and usage accounting.
 *
 *   BOBBOT_API_TOKEN=<session token> pnpm smoke:spook [bot] [delegating bot]
 *
 * Hard checks (a failure exits 1): the API answers, a credential is connected, a run
 * completes and reports tokens, a tool that was called did not fail, and the month ledger
 * has totals. Warnings cover what a model may simply choose not to do: answering without a
 * tool, or taking the task instead of handing it to another bot.
 *
 * The driven bot defaults to the one with the shortest instructions, because a long prompt
 * on a long thread is exactly what makes an upstream call time out.
 *
 * Environment:
 *   BOBBOT_API_URL              API base URL. Default http://127.0.0.1:3100
 *   BOBBOT_API_TOKEN            better-auth session token (required)
 *   BOBBOT_SMOKE_TIMEOUT_MS     Per-run wait. Default 240000
 *   BOBBOT_SMOKE_DELEGATE_FROM  Bot that should hand a task off. Default ExecutiveChief
 *   BOBBOT_SMOKE_DELEGATE_TO    Bot that should receive it. Default Domain Engineer
 *
 * Each run is sent twice at most: Cloudflare cuts a slow upstream call at 120 s, and that
 * is worth one retry before the installation is called broken. A run that outlives the
 * wait is reported as `timed-out` instead of throwing.
 */
import type {
  Bot,
  RunActivityRow,
  RunReceipt,
  RunsListOutput,
  UsageMonth,
} from "@bobbot/contracts";

import { isTerminal } from "@bobbot/core";
import { findBotByName, listBots, rpc, sendToThread, waitForRun } from "./lib/api.js";

type Outcome = "ok" | "warn" | "fail" | "skip";
const failures: string[] = [];
const warnings: string[] = [];
const timeoutMs = Number(process.env.BOBBOT_SMOKE_TIMEOUT_MS ?? 240_000);

function record(outcome: Outcome, name: string, detail: string): void {
  const mark =
    outcome === "ok" ? "ok  " : outcome === "fail" ? "FAIL" : outcome === "warn" ? "warn" : "skip";
  console.log(`${mark}  ${name.padEnd(24)} ${detail}`);
  if (outcome === "fail") failures.push(name);
  if (outcome === "warn") warnings.push(name);
}

function elapsedSeconds(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return "?";
  const elapsed = Date.parse(to) - Date.parse(from);
  return Number.isFinite(elapsed) ? `${Math.round(elapsed / 1000)}s` : "?";
}

function receiptFor(runId: string): Promise<RunReceipt | null> {
  return rpc<RunReceipt | null>("runs/receipt", { runId });
}

/** A run status, or the fact that we stopped waiting for it. */
type AttemptOutcome = RunActivityRow["status"] | "timed-out" | "busy";

/** Wait for a run this process did not start: a delegation lands on the target's own thread.
 * Returns null when nothing matched in time, so the caller can report it. */
async function waitForDelegatedRun(
  predicate: (row: RunActivityRow) => boolean,
): Promise<RunActivityRow | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { runs } = await rpc<RunsListOutput>("runs/list", { filter: "recent" });
    const match = runs.find(predicate);
    if (match && isTerminal(match.status)) return match;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  return null;
}

async function checkConnection(provider: string): Promise<void> {
  const credentials =
    await rpc<Array<{ provider: string; baseUrl?: string; modelId?: string }>>(
      "models/credentials",
    );
  const match = credentials.find((row) => row.provider === provider);
  if (!match) {
    record("fail", "model connection", `no ${provider} credential is connected`);
    return;
  }
  const baseUrl = match.baseUrl ?? "(none)";
  if (baseUrl.startsWith("http://") && !/localhost|127\.0\.0\.1/.test(baseUrl)) {
    record("fail", "model connection", `${baseUrl} would send an API key over plain http`);
    return;
  }
  record("ok", "model connection", `${baseUrl} · model ${match.modelId ?? "(none)"}`);
}

async function checkAutoReview(): Promise<void> {
  const status = await rpc<{ enabled: boolean; checkerAvailable: boolean }>("autoReview/get");
  const detail = `enabled=${status.enabled} checkerAvailable=${status.checkerAvailable}`;
  if (status.enabled && !status.checkerAvailable) {
    record("fail", "auto review", `${detail} — a gated action would fail closed`);
    return;
  }
  record("ok", "auto review", detail);
}

/** Send a prompt and wait for the run. One retry: the upstream cuts slow calls at 120 s.
 * A run that outlives the wait is reported as `timed-out` instead of throwing. */
async function sendAndWait(
  bot: Bot,
  text: string,
): Promise<{ runId: string; status: AttemptOutcome; attempts: number }> {
  let last: { runId: string; status: AttemptOutcome } | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    // A thread with an active run answers threads/send with that run, so sending now would
    // either measure someone else's work or pile another message onto a busy bot.
    const active = (await rpc<RunsListOutput>("runs/list", { filter: "active" })).runs;
    if (active.some((row) => row.botId === bot.id)) {
      return { runId: "", status: "busy", attempts: attempt };
    }
    const known = new Set(
      (await rpc<RunsListOutput>("runs/list", { filter: "recent" })).runs.map((row) => row.runId),
    );
    const { runId } = await sendToThread({ botId: bot.id, text });
    if (known.has(runId)) return { runId, status: "busy", attempts: attempt };
    try {
      const run = await waitForRun(runId, { timeoutMs });
      if (run.status === "completed") return { runId, status: run.status, attempts: attempt };
      last = { runId, status: run.status };
    } catch {
      last = { runId, status: "timed-out" };
    }
  }
  if (!last) throw new Error("no attempt was made");
  return { ...last, attempts: 2 };
}

async function checkToolRun(bot: Bot): Promise<void> {
  const run = await sendAndWait(
    bot,
    "Rufe zwingend das Tool web_fetch fuer https://example.com auf, auch wenn du die Antwort zu kennen glaubst, und nenne dann die Hauptueberschrift. Antworte in einem Satz.",
  );
  if (run.status === "busy") {
    record("skip", "model call", `${bot.name}'s thread already had an active run`);
    return;
  }
  const receipt = await receiptFor(run.runId);
  const tools = receipt?.tools ?? [];
  const called =
    tools
      .map(
        (tool) =>
          `${tool.name}x${tool.calls}${tool.failures > 0 ? ` (${tool.failures} failed)` : ""}`,
      )
      .join(", ") || "no tool";
  const retried = run.attempts > 1 ? " · retried" : "";
  const detail = `${run.status} · ${elapsedSeconds(receipt?.startedAt, receipt?.completedAt)} · ${receipt?.tokens?.totalTokens ?? "no"} tokens · ${called}${retried}`;
  if (run.status !== "completed") {
    record("fail", "model call", `${detail} · ${receipt?.stopReason ?? "run did not complete"}`);
    return;
  }
  if (!receipt?.tokens) {
    record("fail", "model call", `${detail} — the endpoint reported no tokens`);
    return;
  }
  const broken = tools.filter((tool) => tool.failures > 0);
  if (broken.length > 0) {
    record("fail", "tool call", `${detail} — ${broken.map((tool) => tool.name).join(", ")} failed`);
    return;
  }
  if (tools.length === 0) {
    // The model chose not to use a tool. That is behaviour, not a broken installation.
    record("warn", "tool call", `${detail} — the model answered without a tool call`);
    return;
  }
  record("ok", "tool call", detail);
}

/** Tool names the runtime exposes for handing a task to another bot. */
const HANDOFF_TOOLS = new Set(["message_bot", "handoff_to_bot"]);

async function checkDelegation(chiefName: string, targetName: string): Promise<void> {
  const bots = await listBots();
  const chief = bots.find((candidate) => candidate.name === chiefName);
  const target = bots.find((candidate) => candidate.name === targetName);
  if (!chief || !target || chief.id === target.id) {
    record("skip", "delegation", `needs two bots named "${chiefName}" and "${targetName}"`);
    return;
  }
  // Only a run that did not exist before counts: a delegation from an earlier session
  // sits in the same recent list and would pass for the wrong reason.
  const before = new Set(
    (await rpc<RunsListOutput>("runs/list", { filter: "recent" })).runs.map((row) => row.runId),
  );
  const chiefRun = await sendAndWait(
    chief,
    `Nutze das Tool message_bot, um diese Aufgabe an ${targetName} zu delegieren: Pruefe per RDAP kurz, ob example.com registriert ist. Fasse danach das Ergebnis in einem Satz zusammen.`,
  );
  if (chiefRun.status === "busy") {
    record("skip", "delegation", `${chief.name}'s thread already had an active run`);
    return;
  }
  const receipt = await receiptFor(chiefRun.runId);
  const called = (receipt?.tools ?? []).map((tool) => tool.name).join(", ") || "no tool";
  const handoffCalled = (receipt?.tools ?? []).some((tool) => HANDOFF_TOOLS.has(tool.name));
  if (!handoffCalled) {
    // Either the model took the task itself (behaviour, not a broken installation) or its
    // run died before it could ask anyone (upstream, on a long thread).
    if (chiefRun.status !== "completed") {
      record("fail", "delegation", `${chiefRun.status} (${chief.name}) · ${called}`);
      return;
    }
    record("warn", "delegation", `${chief.name} answered itself (${called}) — handoff not tried`);
    return;
  }
  const delegated = await waitForDelegatedRun(
    (row) => !before.has(row.runId) && row.botName === targetName && row.trigger === "bot_message",
  );
  if (!delegated) {
    record(
      "fail",
      "delegation",
      `no ${targetName} run within ${Math.round(timeoutMs / 1000)}s after the handoff`,
    );
    return;
  }
  const childReceipt = await receiptFor(delegated.runId);
  const detail = `${targetName}: ${delegated.status} · ${childReceipt?.tokens?.totalTokens ?? "no"} tokens · ${elapsedSeconds(childReceipt?.startedAt, childReceipt?.completedAt)}`;
  if (delegated.status !== "completed") {
    record("fail", "delegation", detail);
    return;
  }
  if (chiefRun.status !== "completed") {
    // The handoff and the other bot both worked; only the sender's own run died, which on a
    // long thread is the upstream 120 s cut. The model call check already covers that.
    record(
      "warn",
      "delegation",
      `chief -> ${detail} · the ${chief.name} run ended ${chiefRun.status}`,
    );
    return;
  }
  record("ok", "delegation", `chief -> ${detail}`);
}

/** The month ledger, not usage/summary: that one returns null as soon as a single
 * usage row has no tokens (a failed run), which is honest but useless as a check. */
async function checkAccounting(): Promise<void> {
  const month = await rpc<UsageMonth>("usage/month");
  const totals = month.totals;
  if (!totals.totalTokens) {
    record("fail", "usage accounting", "this month has no token totals");
    return;
  }
  record(
    "ok",
    "usage accounting",
    `${totals.totalTokens} tokens this month · ${totals.runs} runs · ${month.bots.length} bots`,
  );
  const hot = month.bots
    .filter((row) => row.monthlyTokenBudget && (row.usedPercent ?? 0) >= 80)
    .map((row) => `${row.botName} ${row.usedPercent}% of ${row.monthlyTokenBudget}`);
  if (hot.length > 0) record("warn", "budget watch", hot.join(", "));
}

async function main(): Promise<void> {
  console.log(`smoke: ${process.env.BOBBOT_API_URL ?? "http://127.0.0.1:3100"}\n`);

  const bots = await listBots();
  // Default to the bot with the shortest instructions: a smoke test should be quick, and
  // a long prompt on a long thread is exactly what makes an upstream call time out.
  const bot = process.argv[2]
    ? await findBotByName(process.argv[2])
    : bots
        .filter((candidate) => candidate.modelProvider && candidate.modelId)
        .sort((left, right) => left.instructions.length - right.instructions.length)[0];
  if (!bot) {
    record("fail", "bot roster", "no bot has a model assigned");
    return;
  }
  record("ok", "bot roster", `${bot.name} (${bot.modelProvider}/${bot.modelId})`);

  await checkConnection(bot.modelProvider ?? "openai-compatible");
  await checkAutoReview();
  await checkToolRun(bot);
  await checkDelegation(
    process.argv[3] ?? process.env.BOBBOT_SMOKE_DELEGATE_FROM ?? "ExecutiveChief",
    process.env.BOBBOT_SMOKE_DELEGATE_TO ?? "Domain Engineer",
  );
  await checkAccounting();

  const summary = [
    failures.length === 0
      ? "all checks passed"
      : `${failures.length} failed: ${failures.join(", ")}`,
    warnings.length > 0 ? `${warnings.length} warning(s): ${warnings.join(", ")}` : "",
  ].filter(Boolean);
  console.log(`\n${summary.join(" · ")}`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
