# Grok-Bot-Skill-Katalog: 307 fremde Routinen, gefunden und abgeglichen

Erhoben am 2026-10-14. Anlass: Frage nach „den besten Bots für Grok Bot“.

## Weg dorthin (und was nicht funktionierte)

Die Webz.io-Suche nach **Bot-Namen** ist eine Sackgasse: `"GrokCoder"` und
`"ExecutiveChief"` liefern **0 Treffer**. Die internen Rollen aus unseren Field Notes
kommen in öffentlichen Web-Daten nicht vor — kein Blog, kein Forum, keine News nennt sie.
Wer „die besten Bots“ über Namenssuche finden will, sucht etwas, das öffentlich nicht existiert.

Die Suche nach **Bauplänen** funktioniert dagegen. Auslöser war:
`"Grok Bot" (profile OR template OR preset)` → 45 Treffer. Darunter
`botskillstack.com`, ein Katalog mit **307 Grok-Bot-Skills**. Über die Kategorieseiten
vollständig erhoben; die Zahl deckt sich exakt mit der Eigenangabe „307+ SKILLS“.

`docs/grokbot-skill-catalog.json` enthält alle 307 Einträge samt Titel, Kategorie,
Nachfrage-Stufe, benötigten Verbindungen und Prompt-Vorschau.

## Umfang

- **307 Skills**, alle als *Verified Routine* ausgewiesen, alle mit Skill-ID (`GROK-SKILL-NNN`).
- Neun Kategorien:

| Kategorie | Skills | davon neu für uns |
| :--- | ---: | ---: |
| productivity | 77 | 69 |
| marketing | 50 | 48 |
| sales | 45 | 39 |
| personal-assistants | 35 | 33 |
| executive-ops | 32 | 22 |
| engineering | 22 | 20 |
| mcp-tools | 20 | 20 |
| customer-success | 14 | 10 |
| market-research | 12 | 11 |
| **Summe** | **307** | **272** |

## Abgleich mit unserer `bot-library`

- **35** Skills haben eine Entsprechung in unserer Bibliothek (Namensmatch).
- **272** sind neu. Davon gehören viele zur B2B-Vertriebs- und Marketing-Familie,
  die wir nur in Ansätzen abdecken.

Bereits abgedeckt (Auswahl):

- `call-followup` ← Automated B2B - Call Follow-Up Drafter Agent
- `competitor-watch` ← Automated B2B - Competitor Watch Agent
- `chief-of-staff` ← Automated B2B - Enterprise GTM Chief of Staff Agent
- `linkedin-signal-watch` ← Automated B2B - LinkedIn Signal Watch Agent
- `meeting-prep` ← Automated B2B - Meeting Prep Brief Agent
- `win-loss` ← Automated B2B - Win/Loss Memo Agent
- `security-questionnaire` ← Autonomous DevOps - Security Questionnaire Agent
- `security-auditor` ← Autonomous DevOps - security-auditor
- `reddit-comment-finder` ← AI Growth Engine - Reddit Comment Finder Agent
- `viral-tweet-scout` ← AI Growth Engine - Viral Tweet Scout

## Datenqualität: 22 Einträge sind keine Routinen

Die 20 Einträge der Kategorie `mcp-tools` sind **von smithery.ai gescraped**, keine
Grok-Bot-Routinen. Der „Prompt“ enthält die Websitenavigation (`Smithery MCPs Skills Docs
Pricing Publish Login …`). Dazu kommen zwei weitere in `engineering` und `market-research`.
Das Feld `is_mcp` markiert sie im JSON.

**Es bleiben 285 echte Routinen.** Alle 285 beginnen mit einer Anweisung wie „Set up a new
bot for me that runs weekly …“ — das ist der tatsächliche Zuschnitt.

## Holen sich Bots gegenseitig? Nein.

Geprüft über die Prompts aller 285 Routinen:

| Muster | Treffer |
| :--- | ---: |
| nennt einen anderen Bot namentlich | **0** |
| delegiert an einen anderen Bot | **1** |
| nennt einen Skill/eine Routine | 3 |

Bots ziehen **keine anderen Bots** nach. Die geteilte Schicht ist eine andere:

1. **Grok-Primitive** — `Web Search`, `Grok Native Routine`, `X Feed`, `Grok 3/4 CLI`,
   `Slash Commands`, `Web UI`. Eingebaut, kein Setup. Von 57 Skills verlangt (Web Search),
   38-mal die Native Routine.
2. **Externe Verbindungen** — 25 verschiedene, 358 Nennungen. `X` (98), `Slack` (42),
   `Gmail` (38), `Notion` (21), `GitHub` (18), `Salesforce` (14). Das sind OAuth-Verbindungen
   **pro Konto**, nicht pro Bot: einmal verbunden, nutzen sie alle Bots.
3. **MCP-Server** — 22 Verweise. Das ist die einzige „Infrastruktur, die andere nachladen“,
   aber es sind MCP-Server, keine Bots.

Wer also etwas einmal einrichtet, damit alle Bots davon profitieren, richtet
**Verbindungen** ein — nicht Bots.

## Wonach sich „am besten nutzen“ entscheiden lässt

Die Nachfrage-Stufe taugt nicht als Ranking. Nutzbar sind drei harte Kriterien:

| Kriterium | Verteilung | Bedeutung |
| :--- | ---: | :--- |
| Fremd-Verbindungen | 120 ohne / 165 mit | **0 = läuft sofort**, jede weitere kostet OAuth-Setup |
| Zeitsteuerung | 38 autonom | Rest läuft auf Zuruf |
| Prompt echt | 285 von 307 | die 22 MCP-Einträge sind unbrauchbar |

**Die 120 Routinen ohne Fremd-Verbindung sind der beste Einstieg** — sie brauchen nur
Web Search und die Native Routine. Darunter die gesamte Recherche-Familie
(`Competitor Watch`, `Lead Research`, `Content Research`, `SEO Watch`, `Customer Mining`),
die unserem `TrendScout`/`OpenResearch` am nächsten kommt.

## Zur Nachfrage-Stufe

BotSkillStack gibt je Skill ein „Monthly Search Volume“ an. Das ist **kein feines Maß**:
es existieren nur drei Stufen (1.200 / 850 / 450). Wir verwenden es als grobe
Priorisierung, nicht als Ranking. Wer wirklich nach Relevanz sortieren will, muss den
Prompt lesen und gegen unsere Roadmap halten. Die JSON-Datei ist nach Volumen
vorsortiert; `existing_preset` zeigt je Eintrag, ob wir den Skill schon haben.

## Nächster Schritt

Die Prompts sind mit erhoben (`prompt`-Feld). Vor einem Import ist zu klären:

1. **Lizenz.** `botskillstack.com` nennt keine. Der Katalog ist als Quelle nutzbar,
   fremde Prompts zu übernehmen ist es nicht — dieselbe Linie wie in
   `grokbot-rebuilds.md`. Der Katalog taugt als **Vorbild und Lückenliste**, nicht als
   Textspende.
2. **Importweg.** Vorhanden ist `scripts/import-grokbot-profiles.mjs` für `awesome-grokbot`
   (CC0-1.0, 56 Profile) — dort ist die Lizenzlage geklärt. Dieser Weg bleibt der sichere.
3. **Prompt-Lesen.** Die Prompt-Vorschauen zeigen den Zuschnitt (Routine, Trigger,
   JSON-Ausgabe), nicht den Volltext. Für eine eigene Umsetzung reicht das oft.
