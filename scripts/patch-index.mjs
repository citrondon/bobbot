#!/usr/bin/env node
// patch-index.mjs — exportiert die neuen Engine-Module aus @bobbot/core.
// Idempotent.
import { readFileSync, writeFileSync } from "node:fs";

const F = "packages/core/src/index.ts";
let s = readFileSync(F, "utf8");
const orig = s;

const lines = [
  'export * from "./bot-templates.js";',
  'export * from "./sandbox-templates.js";',
  'export * from "./bot-library-import.js";',
  'export * from "./imported-bot-templates.js";',
];

for (const line of lines) {
  if (!s.includes(line)) {
    s += line + "\n";
  }
}

if (s === orig) {
  console.log("index.ts schon vollstaendig.");
} else {
  writeFileSync(F, s);
  console.log("index.ts ergaenzt.");
}
