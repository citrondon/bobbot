# Known issues

Open follow-ups that are not fixed yet. Keep entries short: symptom, cause, fix.

## A stdio MCP preset cannot be added on a new self-hosted deployment

**Symptom.** The "1-Klick Connectors" tiles (Web fetch, Structured reasoning, Notion)
read *"Set MCP_STDIO_ENABLED=true on the server to start this connector."*, and clicking
one answers *"Only the deployment owner can add a stdio MCP server"*.

**Cause.** Two independent gates in `apps/api/src/router.ts`:

1. `mcp.servers.stdioStatus` reports `enabled: env.mcpStdioEnabled === true`. While
   `MCP_STDIO_ENABLED` is unset or empty the UI disables every stdio preset.
2. `mcp.servers.create` refuses a `command` (stdio) server unless
   `actor.isDeploymentOwner`. The owner is the single `deployment_settings.ownerUserId`,
   which is not necessarily the account that is signed in.

Both gates exist on purpose: a stdio MCP server runs inside the API/worker container,
next to the database and the encryption keys, so it stays with the deployment owner and
behind the allow-list.

**Fix — pick one.**

- *Enable and own it.*
  1. `.env`: `MCP_STDIO_ENABLED=true` and add `npx` to `MCP_STDIO_ALLOWED_COMMANDS`.
  2. Point `deployment_settings.ownerUserId` at the account that should hold this power.
  3. Restart `api` and `worker`.
- *Drop the presets.* The managed catalog already offers web search and Notion over OAuth,
  so the stdio presets are redundant for a deployment that has the catalog.

**Watch out.** These presets pull a package from npm at runtime; keep every `args` version
pinned (no `npx -y <pkg>` without a version), because the code executes beside the database.

## A custom OpenAI-compatible connection exposes only its own model id

**Symptom.** With several models behind one gateway, the bot's model picker offers only the
id that was typed when the endpoint was connected, and `bots/update` answers
*"Unknown model for that provider"* for any other id.

**Cause.** `packages/adapters/src/pi-models.ts` marks every custom connection
`placeholder: true` and emits exactly one catalog entry — the entered id. Compatibility
metadata does not prove an endpoint serves a model, so the catalog stays scoped to what the
operator entered.

**Fix — pick one.**

- *One connection per model id.* The runtime does not validate a run against the declared id,
  so a bot keeps working on an older id as long as the gateway serves it; only the write path
  is restricted. See `docs/spook-setup.md`.
- *Expose the probed list.* Teach the connection to carry every id the probe returned and emit
  one catalog entry each, instead of a single placeholder.

## SpooK cuts large prompts at 120 s with a Cloudflare 524

**Symptom.** A run fails with *"Server requested 120s retry delay (max: 60s). 524 status code
(no body)"*, sometimes after minutes of silence with no model event, and the run's usage row
keeps NULL tokens.

**Cause.** Upstream latency on a big prompt; Cloudflare closes the edge request at 120 s. The
retry-delay message is BobBot refusing a back-off longer than its cap, not the model failing.

**Fix.** Shrink the prompt — connector scoping took our bots from ~55 000 to ~11 000 input
tokens per call — retry the run, or move the bot to a faster catalog model.

## CI does not run on every pull request

**Symptom.** A pull request shows only the CodeRabbit check; `gh run list --branch <branch>`
is empty, and the last runs on `main` (2026-10-08) ended in `failure`.

**Cause.** Not diagnosed. `ci.yml` does declare a `pull_request` trigger, so the gap is either
Actions permissions/minutes for the repository or a workflow that predates the branch.

**Fix.** Run the gate locally before merging (`pnpm lint`, `pnpm check`, `pnpm test`) and
treat a green CI badge as absent until a run actually appears.

## `pnpm lint` is red in `scripts/`

**Symptom.** `pnpm lint` ends with `Found 8 errors` (and ~56 warnings) while every file under
`packages/` and `apps/` is clean. The entries are `lint/style/useTemplate` and
`lint/correctness/noUnused*` in `scripts/*.mjs` — `add-core-exports.mjs`,
`gen-imported-templates.mjs`, `import-bot-library.mjs`, `import-grokbot-roster.mjs`,
`patch-index.mjs`, `wire-templates.mjs`, `cli-reuse-bridge.mjs`.

**Cause.** Those helper scripts predate the current biome rules and are not covered by the
per-package checks.

**Fix.** `pnpm biome check --write scripts` once, review the (mechanical) diff, and keep the lint
gate meaningful for everyone. Until then, judge a change by the files it touches:
`npx biome check <paths>`.

## `pnpm check` fails on the mobile package (expo dependency drift)

**Symptom.** `pnpm check` reports `Failed: @bobbot/mobile#check` and lists eight expo packages
one patch behind the installed SDK, e.g. `expo@57.0.28 - expected version: ~57.0.30`.

**Cause.** `apps/mobile`'s `check` script runs `expo install --check`, which exits non-zero for
any package the SDK wants bumped. No TypeScript error is involved — every other package in the
run typechecks. The drift exists on `main` and is unrelated to the model work.

**Fix.** `pnpm --filter @bobbot/mobile exec expo install --fix`, then re-run `pnpm check` and
verify the mobile app still builds.
