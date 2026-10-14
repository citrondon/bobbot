#!/usr/bin/env node
// add-core-exports.mjs — gibt die neuen Engine-Module als Subpath-Exporte frei,
// damit `@bobbot/core/bot-templates` in der Web-App aufloesbar ist. Idempotent.
import { readFileSync, writeFileSync } from "node:fs";

const F = "packages/core/package.json";
const pkg = JSON.parse(readFileSync(F, "utf8"));
pkg.exports = pkg.exports ?? {};

function entry(file) {
  return {
    types: "./src/" + file + ".ts",
    development: "./src/" + file + ".ts",
    default: "./src/" + file + ".ts",
  };
}

let changed = false;
for (const name of ["bot-templates", "sandbox-templates"]) {
  const key = "./" + name;
  if (!pkg.exports[key]) {
    pkg.exports[key] = entry(name);
    changed = true;
  }
}

if (changed) {
  writeFileSync(F, JSON.stringify(pkg, null, 2) + "\n");
  console.log("exports ergaenzt.");
} else {
  console.log("exports schon vollstaendig.");
}
