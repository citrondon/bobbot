#!/usr/bin/env node
// import-bot-library.mjs — konvertiert bot-library/*.v1.json (Laptop-Exportformat)
// in ein BotTemplate-kompatibles JSON, das die PC-Engine (packages/core/src/bot-templates.ts)
// konsumieren kann. Reines Node, keine Dependencies.
//
// Aufruf:  node scripts/import-bot-library.mjs <bot-library-dir> [out.json]
// Default-Out: bot-library/compiled-templates.json
//
// Die Reihenfolge im Output ist stabil (alphabetisch nach id), damit Diffs klein bleiben.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PALETTE = [
  "#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

function idFromFilename(filename) {
  const base = filename.split("/").pop() ?? filename;
  return base.replace(/\.v1\.json$/i, "").replace(/\.json$/i, "");
}

function colorForId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function tagsForId(id) {
  return [...new Set(["imported", "bot-library", ...id.split("-").filter(Boolean)])];
}

function convert(raw, filename) {
  const id = idFromFilename(filename);
  const bot = raw.bot ?? {};
  return {
    id,
    name: bot.name ?? id,
    title: bot.title ?? "",
    description: bot.description ?? "",
    instructions: bot.instructions ?? "",
    color: colorForId(id),
    computerMode: "dedicated",
    tags: tagsForId(id),
    source: "custom",
    _dropped: {
      boundaries: raw.boundaries ?? [],
      memoryCount: (raw.memory ?? []).length,
      routinesCount: (raw.routines ?? []).length,
      skillsCount: (raw.skills ?? []).length,
      integrationsCount: (raw.integrations ?? []).length,
    },
  };
}

const dir = process.argv[2] ?? "bot-library";
const out = process.argv[3] ?? "build/bot-library-compiled.json";

const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const results = [];
let errors = 0;
for (const f of files) {
  try {
    const raw = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    results.push(convert(raw, f));
  } catch (e) {
    errors++;
    console.error("FEHLER bei " + f + ": " + e.message);
  }
}
results.sort((a, b) => a.id.localeCompare(b.id));

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(results, null, 2));
console.log("Konvertiert: " + results.length + " / " + files.length + (errors ? " (" + errors + " Fehler)" : ""));
console.log("Ausgabe: " + out);
