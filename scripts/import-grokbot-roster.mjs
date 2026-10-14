import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rakazoRoot = path.resolve(__dirname, "..");
const rosterDir = "/tmp/grokbot-field-notes/roster";
const botLibraryDir = path.join(rakazoRoot, "bot-library");

function parseMarkdownRole(content, filename) {
  const lines = content.split("\n");
  const slug = filename.replace(/\.md$/, "");

  // Title: # Name ...
  const titleLine = lines.find((l) => l.startsWith("# "));
  let rawName = titleLine ? titleLine.replace(/^#\s+/, "").trim() : slug;
  // Clean up title, e.g. "CI / Alert Auto-Fix (on-call bot)" -> "CI & Alert Auto-Fix"
  rawName = rawName
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\//g, "&")
    .trim();
  const name = rawName || slug;

  // Category: **Category:** ...
  const categoryLine = lines.find((l) => l.includes("**Category:**"));
  let category = "productivity";
  if (categoryLine) {
    const catMatch = categoryLine.match(/\*\*Category:\*\*\s*([A-Za-z -]+)/);
    if (catMatch) {
      const rawCat = catMatch[1].trim().toLowerCase();
      if (rawCat.includes("engineering")) category = "engineering";
      else if (rawCat.includes("sales") || rawCat.includes("support")) category = "sales";
      else if (rawCat.includes("marketing") || rawCat.includes("creative")) category = "creative";
      else if (rawCat.includes("research") || rawCat.includes("data")) category = "research";
      else category = "productivity";
    }
  }

  // Sections
  const sections = {};
  let currentSection = "_header";
  sections[currentSection] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      currentSection = line
        .replace(/^##\s+/, "")
        .trim()
        .toLowerCase();
      sections[currentSection] = [];
    } else {
      sections[currentSection].push(line);
    }
  }

  // Short description
  const headerLines = sections["_header"] || [];
  let desc = "";
  for (let i = 0; i < headerLines.length; i++) {
    const l = headerLines[i].trim();
    if (l && !l.startsWith("#") && !l.startsWith("**Seen") && !l.startsWith("**Category")) {
      desc = l;
      break;
    }
  }
  if (!desc) {
    desc = `Specialist bot for ${name}.`;
  }
  // Trim description to max 250 chars
  if (desc.length > 250) {
    desc = desc.slice(0, 247) + "...";
  }

  // Helper to extract bullets
  function getBullets(secKey) {
    const sec = sections[secKey];
    if (!sec) return [];
    return sec
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- "))
      .map((l) => l.replace(/^-\s+/, "").trim())
      .filter(Boolean);
  }

  const owns = getBullets("owns");
  const doesNotOwn = getBullets("does not own");
  const needsApproval = getBullets("needs approval for");

  // Boundaries
  const boundaries = [];
  for (const item of needsApproval.slice(0, 5)) {
    const text = `Requires approval for: ${item}`;
    if (text.length <= 200) boundaries.push(text);
  }
  for (const item of doesNotOwn.slice(0, 5)) {
    const text = `Does not handle: ${item}`;
    if (text.length <= 200) boundaries.push(text);
  }

  // Instructions
  const ownsText =
    owns.length > 0 ? owns.map((o) => `- ${o}`).join("\n") : `- Core tasks for ${name}`;
  const doesNotOwnText =
    doesNotOwn.length > 0 ? doesNotOwn.map((d) => `- ${d}`).join("\n") : "- Out of scope tasks";

  const instructions = `# ${name}

You are ${name}. ${desc}

## What you do
${ownsText}

## What you do not do
${doesNotOwnText}

## How you work
- Lead with the result and keep answers concise and actionable
- Do not invent facts, metrics, or citations
- Ask before taking destructive or irreversible actions

## First task
When the user first messages you without a task, introduce your specialty in one sentence and ask how you can help.`.trim();

  // Integrations
  const integrations = [];
  const fullText = content.toLowerCase();
  if (
    fullText.includes("github") ||
    fullText.includes("pr ") ||
    fullText.includes("pull request")
  ) {
    integrations.push("GitHub");
  }
  if (fullText.includes("slack")) {
    integrations.push("Slack");
  }
  if (fullText.includes("notion")) {
    integrations.push("Notion");
  }

  return {
    slug,
    category,
    manifest: {
      version: 1,
      exportedAt: "2026-10-14T08:00:00.000Z",
      bot: {
        name,
        title: "",
        description: desc,
        instructions,
      },
      boundaries: boundaries.slice(0, 10),
      integrations,
      skills: [],
      memory: [],
      routines: [],
      files: [],
      history: [],
    },
  };
}

async function run() {
  if (!existsSync(rosterDir)) {
    console.error("Roster dir does not exist:", rosterDir);
    process.exit(1);
  }

  const files = readdirSync(rosterDir).filter((f) => f.endsWith(".md") && f !== "README.md");
  console.log(`Found ${files.length} roster files.`);

  const importedByCategory = {
    productivity: [],
    engineering: [],
    research: [],
    sales: [],
    creative: [],
    personal: [],
  };

  let createdCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const filePath = path.join(rosterDir, file);
    const content = readFileSync(filePath, "utf8");
    const { slug, category, manifest } = parseMarkdownRole(content, file);

    const targetFile = path.join(botLibraryDir, `${slug}.v1.json`);
    if (existsSync(targetFile)) {
      skippedCount++;
    } else {
      writeFileSync(targetFile, JSON.stringify(manifest, null, 2) + "\n", "utf8");
      createdCount++;
    }

    if (importedByCategory[category]) {
      importedByCategory[category].push(slug);
    } else {
      importedByCategory.productivity.push(slug);
    }
  }

  console.log(`Created ${createdCount} new presets, skipped ${skippedCount} existing.`);
  console.log(
    "Categories breakdown:",
    Object.fromEntries(Object.entries(importedByCategory).map(([k, v]) => [k, v.length])),
  );

  // Write mapping to a file for updating UI
  writeFileSync(
    path.join(__dirname, "imported-categories.json"),
    JSON.stringify(importedByCategory, null, 2),
  );
}

run().catch(console.error);
