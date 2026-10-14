#!/usr/bin/env node
// wire-templates.mjs — verdrahtet die Template-Seite: Knopf neben "Bot library" + Route.
// Idempotent.
import { readFileSync, writeFileSync } from "node:fs";

// --- 1. Shell.tsx: Knopf neben dem Bot-library-Knopf ---
const S = "apps/web/src/pages/Shell.tsx";
let s = readFileSync(S, "utf8");
if (s.includes('data-testid="open-bot-templates"')) {
  console.log("Shell.tsx: Knopf schon da.");
} else {
  const anchor =
    '              <Library size={15} strokeWidth={1.8} aria-hidden="true" />\n            </button>';
  const count = s.split(anchor).length - 1;
  if (count !== 1) {
    console.error("ABBRUCH: Anker " + count + "x gefunden (erwartet 1). Keine Aenderung.");
    process.exit(1);
  }
  const button =
    anchor +
    "\n" +
    "            <button\n" +
    '              type="button"\n' +
    '              className="app-no-drag flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground/75"\n' +
    "              aria-label={t`Bot templates`}\n" +
    "              title={t`Bot templates`}\n" +
    '              data-testid="open-bot-templates"\n' +
    "              onClick={() => {\n" +
    "                setMobileSidebarOpen(false);\n" +
    '                navigate("/templates");\n' +
    "              }}\n" +
    "            >\n" +
    '              <Grid size={15} strokeWidth={1.8} aria-hidden="true" />\n' +
    "            </button>";
  s = s.replace(anchor, button);
  writeFileSync(S, s);
  console.log("Shell.tsx: Knopf eingefuegt.");
}

// --- 2. App.tsx: Import + Route ---
const A = "apps/web/src/App.tsx";
let a = readFileSync(A, "utf8");
let changedA = false;

if (!a.includes('from "./pages/Templates"')) {
  a = a.replace(
    'import { ShellPage } from "./pages/Shell";',
    'import { ShellPage } from "./pages/Shell";\nimport { TemplatesPage } from "./pages/Templates";',
  );
  changedA = true;
}

if (!a.includes('path="/templates"')) {
  a = a.replace(
    '<Route path="/app/:botId" element={<ShellPage />} />',
    '<Route path="/app/:botId" element={<ShellPage />} />\n            <Route path="/templates" element={<TemplatesPage />} />',
  );
  changedA = true;
}

if (changedA) {
  writeFileSync(A, a);
  console.log("App.tsx: Import + Route ergaenzt.");
} else {
  console.log("App.tsx: schon verdrahtet.");
}
