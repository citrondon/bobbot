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
 * A publish tool that was called but parked at an approval gate counts as not published: the
 * receipt folds such a call as `calls: 1, failures: 0, paused: 1`, and the check fires on any
 * parked call to a publish tool. That case gets its own message, so "never called" and "called
 * but parked" do not look alike in a log. The check reads the parked count, not whether a later
 * call to the same tool succeeded, so a run whose publish was parked and then approved also
 * exits 1.
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
  // Called but held at an approval gate: a parked publish is not a post, whatever else ran.
  const parked = published.filter((tool) => tool.paused > 0);
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
