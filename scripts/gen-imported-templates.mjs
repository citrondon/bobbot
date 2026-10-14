#!/usr/bin/env node
// gen-imported-templates.mjs — wandelt bot-library/compiled-templates.json
// in ein TS-Modul um (packages/core/src/imported-bot-templates.ts), das die
// Engine (bot-templates.ts) importieren kann. So landen die Templates im Bundle.
//
// Aufruf: node scripts/gen-imported-templates.mjs
import { readFileSync, writeFileSync } from "node:fs";

const IN = "bot-library/compiled-templates.json";
const OUT = "packages/core/src/imported-bot-templates.ts";

const templates = JSON.parse(readFileSync(IN, "utf8"));
// _dropped wird nicht mit exportiert (nur interne Nachverfolgung).
const clean = templates.map(({ _dropped, ...t }) => t);

const banner = [
  "// AUTOGENERIERT von scripts/gen-imported-templates.mjs — nicht von Hand editieren.",
  "// Quelle: bot-library/compiled-templates.json (" + clean.length + " Templates).",
  '// Regenerieren: node scripts/gen-imported-templates.mjs',
  'import type { BotTemplate } from "./bot-templates.js";',
  "",
  "export const IMPORTED_BOT_TEMPLATES: BotTemplate[] = " + JSON.stringify(clean, null, 2) + ";",
  "",
].join("\n");

writeFileSync(OUT, banner);
console.log("Geschrieben: " + OUT + " (" + clean.length + " Templates)");
