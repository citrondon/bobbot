# Übergabe-Checkliste (BobBot auf SpooK)

Diese Liste ist für den Fall „frischer Checkout auf einem neuen Rechner". Alles, was
das Repo mitbringt, steht in Schritt 1–5; alles, was **nicht** mitkommt, in Schritt 7.

Kurzfassung: `.env` füllen → SpooK verbinden → Bots aus der Bibliothek importieren →
Modelle setzen → `pnpm smoke:spook` muss grün sein.

## 1. Repo und Umgebung

```bash
git clone <repo-url> && cd rakazo      # oder: git pull   (Branch: main)
pnpm install
cp .env.example .env
```

In `.env` setzen (die ersten fünf sind Pflicht, sonst startet nichts):

```
POSTGRES_PASSWORD=<frei wählbar>            # derselbe Wert in DATABASE_URL
BETTER_AUTH_SECRET=<mindestens 32 Zeichen>
ENCRYPTION_KEY=<64 Hex-Zeichen>             # credentials werden damit verschlüsselt
SCREEN_PROXY_SECRET=<mindestens 32 Zeichen>
SANDBOX_SUPERVISOR_TOKEN=<frei wählbar>
```

Dazu diese vier, sonst läuft der Modell-Pfad nicht:

```
BOBBOT_OPENAI_COMPAT_ALLOW_PUBLIC=1          # ohne den Riegel wird api.spookapi.xyz geblockt
PI_DEFAULT_PROVIDER=openai-compatible
PI_DEFAULT_MODEL=kimi-k3                     # Fallback für Compaction/Vision/Review
# Auto-Review über Jev auf OpenRouter (so läuft es hier):
BOBBOT_AUTO_REVIEW=true
BOBBOT_AUTO_REVIEW_PROVIDER=jev
BOBBOT_JEV_URL=https://openrouter.ai/api/alpha/decisions
OPENROUTER_API_KEY=<eigener Key>             # der Judge liest diesen Key, nicht TYPESAFE_API_KEY
BOBBOT_AUTO_REVIEW_TIMEOUT_MS=10000          # 1500 ms Default ist zu kurz für einen Netzaufruf
```

## 2. Datenbank und Start

```bash
pnpm db:generate
pnpm db:migrate        # legt u. a. bots.allowedToolkits + bots.toolkitsScoped an
pnpm dev               # web 127.0.0.1:5173, api, worker, sandbox-supervisor
```

Anforderungen: Node 22.22.2 (oder 24.x/26+), pnpm 9, Docker. Node 23.x/25.x werden nicht
unterstützt.

## 3. SpooK verbinden

Im Browser: **Modell verbinden → OpenAI-kompatibel**, dann

```
Base URL:  https://api.spookapi.xyz/v1
API-Key:   eigener Token- oder Credit-Key aus dem SpooK-Dashboard
Modell-ID: kimi-k3
```

Details, Katalog und Fallen: `docs/spook-setup.md`. Merke: eine Custom-Verbindung kennt
**genau eine** Modell-ID. Für ein zweites Modell eine zweite Verbindung anlegen.

## 4. Bots importieren (Roster)

Alle zwölf Bots dieser Installation haben ein Preset im Repo (`bot-library/`). Entweder in
der Bot-Bibliothek einzeln importieren — **Modell danach in den Bot-Einstellungen setzen**,
das Preset bringt keins mit — oder das Roster in einem Durchgang setzen:

```bash
BOBBOT_API_TOKEN=<session-token> pnpm roster:import --dry-run   # zeigt nur, was es täte
BOBBOT_API_TOKEN=<session-token> pnpm roster:import             # importiert und konfiguriert
```

Das Skript ist idempotent: einen vorhandenen Bot lässt es stehen, Modell und Scope schreibt
es nur, wenn sie abweichen. Es prüft den Modellsatz gegen die verbundene Verbindung — also
erst Schritt 3 erledigen.

| Bot | Preset | Modell | Connector-Toolkits |
|---|---|---|---|
| ExecutiveChief | `executive-chief.v1.json` | `kimi-k3` | keine |
| GrokCoder | `grok-coder.v1.json` | `kimi-k3` | keine |
| Social Queue | `social-queue.v1.json` | `kimi-k3` | linkedin, instagram |
| Content Remix | `content-remix.v1.json` | `kimi-k3` | keine |
| Domain Engineer | `domain-engineer.v1.json` | `kimi-k3` | keine |
| Website Ops | `website-ops.v1.json` | `kimi-k3` | keine |
| Bug Reproduction | `bug-reproduction.v1.json` | `kimi-k3` | keine |
| Competitor Watch | `competitor-watch.v1.json` | `kimi-k3` | keine |
| Creative Director & Media Explorer | `creative-director.v1.json` | `kimi-k3` | keine |
| Permit & Red-Tape Researcher | `permit-researcher.v1.json` | `kimi-k3` | keine |
| Project Manager | `project-manager.v1.json` | `kimi-k3` | keine |
| PR Reviewer | `pr-reviewer.v1.json` | `claude-sonnet-4-6` | keine |

**„Keine Toolkits" ist Absicht**, nicht ein fehlender Connector: Diese Bots arbeiten mit
den Builtin-Werkzeugen (`web_fetch`, `web_search`, Dateien, Memory) und tragen sonst die
Werkzeuglisten aller verbundenen Dienste im Prompt. Gemessen: ~55 000 → ~11 000
Input-Tokens pro Aufruf. Builtin-Werkzeuge sind vom Scope nicht betroffen.

Nur **Social Queue** braucht die Connector-Toolkits, weil seine Routinen wirklich
veröffentlichen. ExecutiveChief und GrokCoder trugen die LinkedIn- und Instagram-Werkzeuge
eine Zeit lang mit, ohne sie je zu benutzen: 24 144 Input + 24 808 Cache-Read-Tokens pro
Aufruf wurden zu 11 370 + 0, und ein Lauf auf dem Chief-Thread fiel von 47–605 s auf 17 s.
Aufgefallen ist es an den Cache-Read-Tokens in `usage/month` — genau dafür lohnt der Blick
dort.

## 5. Routinen prüfen

Nach dem Import unter *Routinen* prüfen, ob die geplanten Läufe aktiv sind (Zeitzone
Europe/Berlin):

| Bot | Routine | Cron |
|---|---|---|
| ExecutiveChief | Software Factory | `0 8-20/3 * * 1-5` |
| Social Queue | Täglicher LinkedIn-Post | `30 8 * * 1-5` |
| Social Queue | Täglicher Instagram-Post | `35 8 * * 1-5` |

Routinen laufen erst, wenn sie aktiv geschaltet sind.

## 6. Verifizieren

```bash
BOBBOT_API_TOKEN=<session-token> pnpm smoke:spook
```

Erwartet: `all checks passed`. Das Skript prüft Modellverbindung, Auto-Review, einen
echten Tool-Call, eine Delegation (Chief → Domain Engineer) und die Monatssumme. Harte
Fehler beenden mit Exit-Code 1; Warnungen melden, was das Modell auch lassen darf
(Antwort ohne Werkzeug, Aufgabe selbst übernommen, Budget über 80 %).

Den Session-Token bekommt man aus dem Browser (eingeloggt) oder lokal aus der Datenbank:

```sql
select token from session order by "expiresAt" desc limit 1;
```

## 7. Was **nicht** mitkommt

| Was | Warum |
|---|---|
| SpooK-Key, OpenRouter-Key | Secrets bleiben beim jeweiligen Konto; jeder verbindet seinen eigenen |
| Bot-Roster, Modelle, Scopes, Routinen | Das ist Datenbank-Zustand; kommt über den Import in Schritt 4 |
| Chat-Verläufe, Erinnerungen, Artefakte, Computer-Homes | Laufzeitdaten unter `data/` |
| Die 8 toten Queue-Jobs (25/25 Versuche, ältester 05.10.) | Lokale Altlast, hat auf einer frischen DB keine Entsprechung |
| Die opencode-go-Zeile im Space-Default | Zeigt auf ein aufgebrauchtes Kontingent; kein Bot nennt den Provider, sie ist inert |

Wird stattdessen die **Datenbank** mitkopiert, muss `ENCRYPTION_KEY` **identisch** sein —
sonst sind alle gespeicherten Zugangsdaten unlesbar. `BETTER_AUTH_SECRET` ebenso, sonst
sind die Sitzungen ungültig.

## 8. Bekannte Fallen (Details in `docs/KNOWN-ISSUES.md`)

1. **SpooK schneidet langsame Aufrufe ab:** `520`/`522`/`524 status code` in `runs.error`
   sind Cloudflare-Edge-Fehler bei langen Prompts (>120 s), kein BobBot-Bug. Der Fix ist
   ein kleinerer Prompt (Scoping) oder ein erneuter Versuch. Ein Run auf einem 68k-Token-
   Thread kann dabei 5–10 Minuten brauchen.
2. **`pnpm check` ist rot** am Mobile-Paket (`expo install --check`, 8 Pakete ein Patch
   hinter dem SDK) — vorbestehend, kein TypeScript-Fehler.
3. **`pnpm lint` ist rot** in `scripts/*.mjs` (8 Fehler, `useTemplate`/`noUnused*`) —
   vorbestehend; für die eigene Änderung `npx biome check <pfade>` nutzen.
4. **CI läuft nicht auf Pull Requests** — lokal prüfen (`pnpm lint`, `pnpm check`,
   `pnpm test`) statt auf ein grünes Häkchen zu warten. `pnpm test` ist aktuell
   8347 grün / 230 übersprungen; ein Chromium-Lifecycle-Test in
   `packages/core/src/node/desktop-runtime.test.ts` ist unter Last flaky und isoliert grün.
5. **Eine Modell-ID pro Custom-Connection** — siehe Schritt 3.
