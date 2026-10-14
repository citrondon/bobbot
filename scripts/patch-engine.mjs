#!/usr/bin/env node
// patch-engine.mjs — verbindet die importierten Templates mit der Engine.
// Idempotent: mehrfaches Ausfuehren aendert nichts.
import { readFileSync, writeFileSync } from "node:fs";

const F = "packages/core/src/bot-templates.ts";
let s = readFileSync(F, "utf8");
const orig = s;

// 1. Import ergaenzen (nach dem contracts-Import).
if (!s.includes("imported-bot-templates.js")) {
  s = s.replace(
    'import type { ComputerMode } from "@bobbot/contracts";',
    'import type { ComputerMode } from "@bobbot/contracts";\nimport { IMPORTED_BOT_TEMPLATES } from "./imported-bot-templates.js";',
  );
}

// 2. getAllBotTemplates: importierte Templates mit zurueckgeben.
if (s.includes("return BUILTIN_BOT_TEMPLATES;")) {
  s = s.replace(
    "return BUILTIN_BOT_TEMPLATES;",
    "return [...BUILTIN_BOT_TEMPLATES, ...IMPORTED_BOT_TEMPLATES];",
  );
}

if (s === orig) {
  console.log("Keine Aenderung noetig (schon gepatcht).");
} else {
  writeFileSync(F, s);
  console.log("bot-templates.ts gepatcht.");
}
