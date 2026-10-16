/**
 * Prove whether a run really published to LinkedIn or Instagram.
 *
 * A model can write "published" without calling a tool — for a brand, the silent non-post is
 * the most expensive failure this installation has. This script reads the run receipt and its
 * tool events, not the reply: it asks the API for `runs/receipt` and looks for a call to
 * LINKEDIN_CREATE_LINKED_IN_POST or INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH.
 *
 *   BOBBOT_API_TOKEN=<session token> npx tsx scripts/verify-social-post.ts <runId>
 *
 * Exit codes:
 *   0  a publish tool ran
 *   1  no publish tool was called, a tool failed, or the publish is parked on an approval
 *   2  the run id is missing or the API does not know it
 *
 * A call that was parked at an approval gate counts as not published: the receipt folds such a
 * call as `calls: 1, failures: 0, paused: 1`, and the check fires when every call to a gated tool
 * was parked, so the tool never executed. That case gets its own message, so "never called" and
 * "called but never executed" do not look alike in a log. `paused` counts paused completions over
 * the run's history, not a current state, so a tool that was parked, approved, and then executed
 * carries `calls: 2, paused: 1`; the check reads the parked count against the call count and
 * leaves that run to report the post, because a call did run.
 *
 * Instagram stages a post over two calls: the container call INSTAGRAM_POST_IG_USER_MEDIA, then
 * the publish call INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH. A run parked at the container step never
 * reaches the publish call, so reading only the publish tools reports it as "no publish tool was
 * called" — the right exit code for the wrong reason, and it hides the card a human must answer.
 * GATED_TOOLS holds the publish tools plus the container step, so a park on any of them is named
 * as an approval gate. PUBLISH_TOOLS still decides what counts as a post.
 *
 * Environment:
 *   BOBBOT_API_URL    API base URL. Default http://127.0.0.1:3100
 *   BOBBOT_API_TOKEN  better-auth session token (required)
 */
import type { RunReceipt } from "@bobbot/contracts";
import { rpc } from "./lib/api.js";

/** Tools whose call produces a post. */
const PUBLISH_TOOLS = new Set([
  "LINKEDIN_CREATE_LINKED_IN_POST",
  "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
]);

/**
 * Tools a post is staged through: the publish tools plus the Instagram container step that runs
 * before the publish. A park on any of them is an approval gate waiting on a human.
 */
const GATED_TOOLS = new Set([...PUBLISH_TOOLS, "INSTAGRAM_POST_IG_USER_MEDIA"]);

async function main(): Promise<void> {
  const runId = process.argv[2];
  if (!runId) {
    console.error("usage: npx tsx scripts/verify-social-post.ts <runId>");
    process.exitCode = 2;
    return;
  }
  const receipt = await rpc<RunReceipt | null>("runs/receipt", { runId });
  if (!receipt) {
    console.error(`no run with id ${runId}`);
    process.exitCode = 2;
    return;
  }
  const called = receipt.tools.map((tool) => `${tool.name}x${tool.calls}`);
  const published = receipt.tools.filter((tool) => PUBLISH_TOOLS.has(tool.name));
  const failed = receipt.tools.filter((tool) => tool.failures > 0);
  // Every call to a gated tool parked at an approval gate: nothing executed, so there is no post.
  const parked = receipt.tools.filter(
    (tool) => GATED_TOOLS.has(tool.name) && tool.paused > 0 && tool.paused >= tool.calls,
  );
  console.log(`run ${runId}: ${receipt.status} · ${called.join(", ") || "no tools"}`);
  if (failed.length > 0) {
    console.error(`FAILED: ${failed.map((tool) => tool.name).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (parked.length > 0) {
    const detail = parked.map((tool) => `${tool.name} (${tool.paused}/${tool.calls} calls parked)`);
    console.error(`WAITING FOR APPROVAL: ${detail.join(", ")} — not counted as a post`);
    process.exitCode = 1;
    return;
  }
  if (published.length === 0) {
    console.error("NOT PUBLISHED: no publish tool was called");
    process.exitCode = 1;
    return;
  }
  console.log(`published over ${published.map((tool) => tool.name).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
