#!/usr/bin/env node
// translate-templates.mjs — traegt deutsche Uebersetzungen fuer die
// Template-Seite in src/locales/de/messages.po ein. Nur leere msgstr werden
// gefuellt; bereits uebersetzte bleiben unberuehrt. Idempotent.
import { readFileSync, writeFileSync } from "node:fs";

const F = "src/locales/de/messages.po";
const MAP = {
  Back: "Zurück",
  "Bot Templates": "Bot-Vorlagen",
  "Choose a starting point for your next bot": "Wähle einen Startpunkt für deinen nächsten Bot",
  Custom: "Eigene",
  Marketplace: "Marktplatz",
  "All sources": "Alle Quellen",
  "Filter by source": "Nach Quelle filtern",
  "Search templates": "Vorlagen durchsuchen",
  "Search templates…": "Vorlagen durchsuchen…",
  "No templates match your filters": "Keine Vorlagen passen zu deinen Filtern",
  "Use template": "Vorlage verwenden",
};

let s = readFileSync(F, "utf8");
let changed = 0;
let skipped = 0;

for (const [id, de] of Object.entries(MAP)) {
  // Ziel: die Zeile `msgid "<id>"` gefolgt von `msgstr ""`.
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp('(msgid "' + esc + '"\\nmsgstr )""', "g");
  if (re.test(s)) {
    s = s.replace(re, '$1"' + de.replace(/"/g, '\\"') + '"');
    changed++;
  } else {
    skipped++;
  }
}

writeFileSync(F, s);
console.log("Uebersetzt: " + changed + ", uebersprungen (schon da/fehlt): " + skipped);
