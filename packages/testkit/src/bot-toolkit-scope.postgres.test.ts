import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ComposioEmulator } from "@bobbot/adapters";
import type { Bot } from "@bobbot/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { createApp } from "../../../apps/api/src/app.ts";
import { discardBotIntroFromCreate } from "./discard-bot-intro.js";
import { sessionCookieHeader } from "./index.js";

type App = { request: (input: string, init?: RequestInit) => Promise<Response> };
process.env.WAKEUP_DRIVER = "memory";
process.env.SANDBOX_PROVIDER = "fake";
process.env.AGENT_RUNTIME = "scripted";

const hasDb = process.env.VERIFY_DATABASE === "1" && Boolean(process.env.DATABASE_URL);

/**
 * The switch in bot settings writes through `bots/update`. Its two columns decide whether a bot
 * keeps every connected toolkit, none, or a list — and getting the pair wrong is silent: the bot
 * either keeps everything it had or quietly loses connectors. So it is exercised through the
 * product boundary against a real database, not against a mock.
 */
describe.skipIf(!hasDb)("a bot's connector scope over the product boundary", () => {
  let app: App;
  let stop: () => Promise<void>;
  let prisma: Awaited<ReturnType<typeof createApp>>["prisma"];
  let handles: Awaited<ReturnType<typeof createApp>>;
  const stamp = Date.now();
  const dataDir = mkdtempSync(path.join(tmpdir(), "rakazo-toolkit-scope-"));
  const createdAccounts: string[] = [];

  beforeAll(async () => {
    const { createApp } = await import("../../../apps/api/src/app.ts");
    handles = await createApp({
      databaseUrl: process.env.DATABASE_URL!,
      dataDir,
      sandboxProvider: "fake",
      agentRuntime: "scripted",
      composio: new ComposioEmulator(),
    });
    app = handles.app;
    stop = handles.stop;
    prisma = handles.prisma;
  });

  afterAll(async () => {
    // The lane normally hands this file a disposable database, but the same suite is also run
    // against a live one. It created its own accounts, so it removes them rather than leaving
    // test bots behind for the next reader of the workspace. This runs before stop(), which
    // closes the pool.
    for (const email of createdAccounts) {
      const account = await prisma.user.findFirst({ where: { email }, select: { id: true } });
      if (!account) continue;
      const soloOrganizations = await prisma.organization.findMany({
        where: { members: { some: { userId: account.id } } },
        select: { id: true },
      });
      for (const organization of soloOrganizations) {
        // Never touch an organization somebody else belongs to.
        const others = await prisma.member.count({
          where: { organizationId: organization.id, userId: { not: account.id } },
        });
        if (others === 0) await prisma.organization.delete({ where: { id: organization.id } });
      }
      await prisma.user.delete({ where: { id: account.id } });
    }
    await stop?.();
  });

  async function signup(email: string, name: string) {
    const res = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173" },
      body: JSON.stringify({ email, password: "password12", name }),
    });
    if (res.status >= 400) throw new Error(`signup failed ${res.status}: ${await res.text()}`);
    createdAccounts.push(email);
    return sessionCookieHeader(res);
  }

  async function rpc<T>(cookie: string, proc: string, body: unknown = {}): Promise<T> {
    const res = await app.request(`/rpc/${proc}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: "http://127.0.0.1:5173",
      },
      body: JSON.stringify({ json: body }),
    });
    const text = await res.text();
    const parsed = JSON.parse(text) as { json?: T; error?: { message?: string } };
    if (res.status >= 400 || parsed.error) {
      throw new Error(`${proc} ${res.status}: ${parsed.error?.message ?? text}`);
    }
    return parsed.json as T;
  }

  /** The stored pair, which is where a wrong write hides. */
  async function stored(botId: string) {
    const row = await prisma.bot.findUniqueOrThrow({
      where: { id: botId },
      select: { toolkitsScoped: true, allowedToolkits: true },
    });
    return { flag: row.toolkitsScoped, list: row.allowedToolkits };
  }

  async function scopeOf(cookie: string, botId: string) {
    return (await rpc<Bot>(cookie, "bots/get", { botId })).allowedToolkits;
  }

  it("moves through all three states and lands them in the database", async () => {
    const cookie = await signup(`toolkit-scope-${stamp}@rakazo.test`, "Toolkit Scope");
    const created = await discardBotIntroFromCreate(
      handles,
      cookie,
      "bots/create",
      await rpc<Bot>(cookie, "bots/create", {
        name: "Scope probe",
        title: "Scope probe",
        description: "",
        instructions: "",
      }),
    );

    // A fresh bot is unscoped: that is what every bot created before the field means.
    expect(created.allowedToolkits).toBeNull();
    expect(await scopeOf(cookie, created.id)).toBeNull();
    expect(await stored(created.id)).toEqual({ flag: false, list: [] });

    // The switch on with a selection.
    await rpc<Bot>(cookie, "bots/update", {
      botId: created.id,
      allowedToolkits: ["linkedin", "instagram"],
    });
    expect(await scopeOf(cookie, created.id)).toEqual(["linkedin", "instagram"]);
    expect(await stored(created.id)).toEqual({
      flag: true,
      list: ["linkedin", "instagram"],
    });

    // The state that did not exist before: scoped, with nothing allowed.
    await rpc<Bot>(cookie, "bots/update", { botId: created.id, allowedToolkits: [] });
    expect(await scopeOf(cookie, created.id)).toEqual([]);
    expect(await stored(created.id)).toEqual({ flag: true, list: [] });

    // The switch off. The list stays behind so switching on again can restore it, and the flag
    // is what makes the bot unscoped — reading the list alone would call this "no connectors".
    await rpc<Bot>(cookie, "bots/update", { botId: created.id, allowedToolkits: null });
    expect(await scopeOf(cookie, created.id)).toBeNull();
    expect(await stored(created.id)).toEqual({ flag: false, list: [] });
  });

  it("keeps a bot that was never touched unscoped", async () => {
    const cookie = await signup(`toolkit-scope-untouched-${stamp}@rakazo.test`, "Untouched");
    const first = await rpc<Bot>(cookie, "bots/create", {
      name: "First",
      title: "",
      description: "",
      instructions: "",
    });
    const second = await rpc<Bot>(cookie, "bots/create", {
      name: "Second",
      title: "",
      description: "",
      instructions: "",
    });

    await rpc<Bot>(cookie, "bots/update", { botId: first.id, allowedToolkits: [] });

    expect(await scopeOf(cookie, second.id)).toBeNull();
    expect(await stored(second.id)).toEqual({ flag: false, list: [] });
  });
});
