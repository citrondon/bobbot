/**
 * Prüft, ob ein Lauf wirklich veröffentlicht hat.
 *
 * Ein Modell kann „veröffentlicht" schreiben, ohne ein Werkzeug zu rufen — bei einem Brand ist
 * der stille Nicht-Post der teuerste Fehler. Dieses Skript liest den Lauf-Beleg und die
 * Werkzeug-Ereignisse, nicht die Antwort.
 *
 *   BOBBOT_API_TOKEN=<token> npx tsx scripts/verify-social-post.ts <runId>
 *
 * Exit 0 = veröffentlicht, Exit 1 = nicht veröffentlicht (oder fehlgeschlagen).
 */
import type { RunReceipt } from "@bobbot/contracts";
import { rpc } from "./lib/api.js";

/** Werkzeuge, deren Aufruf einen Post erzeugt. */
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
    console.error(`kein Lauf mit id ${runId}`);
    process.exitCode = 2;
    return;
  }
  const called = receipt.tools.map((tool) => `${tool.name}x${tool.calls}`);
  const published = receipt.tools.filter((tool) => PUBLISH_TOOLS.has(tool.name));
  const failed = receipt.tools.filter((tool) => tool.failures > 0);
  console.log(`Lauf ${runId}: ${receipt.status} · ${called.join(", ") || "kein Werkzeug"}`);
  if (failed.length > 0) {
    console.error(`FEHLGESCHLAGEN: ${failed.map((tool) => tool.name).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (published.length === 0) {
    console.error("NICHT VERÖFFENTLICHT: kein Publish-Werkzeug aufgerufen");
    process.exitCode = 1;
    return;
  }
  console.log(`veröffentlicht über ${published.map((tool) => tool.name).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
