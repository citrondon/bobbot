# Karo Social Publishing — Test- und Ausbauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Publishing-Pfad für Karos Tattoo-Brand (Fineline/Linework, Mannheim) von der Playtest-Konfiguration auf echte Inhalte umstellen — LinkedIn und Instagram mit Karos Konto, echten Bildern und nachweisbarer Veröffentlichung.

**Architecture:** Die Mechanik steht bereits und ist erprobt: Social Queue hat die Composio-Toolkits `linkedin` + `instagram` gescoped, zwei Routinen lesen ein Markdown im Team-Home und veröffentlichen. Dieser Plan ersetzt die drei Platzhalter (Inhaltsdatei, Testbilder, Konto) durch Karo-Daten, schärft die Routine-Prompts um Nachweis-Pflicht, ergänzt ein Verifikationsskript im Repo und aktiviert die Routinen erst nach einem echten Testpost.

**Tech Stack:** BobBot (Spi runtime auf SpooK, `kimi-k3`), Composio-Connector (LinkedIn + Instagram), Graphile-Worker (Routinen), Auto-Review-Gate über Jev/OpenRouter, Team-Home `data/homes/team-e7c6d161a53b0b63d7313c2fdb51ff40/shared/`.

**Evidenz-Regel für jeden Task:** Für jeden Zustand, den du behauptest, den **exakten Befehl und
die vollständige Rohausgabe** wörtlich berichten — Vorher- und Nachher-Snapshot gleichermaßen,
damit ein Prüfer es nachfahren und identisch sehen kann. Keine Zusammenfassungen von Zahlen.
Für jedes Prüfkommando gilt: selbst ausführen und **Rohausgabe plus Exit-Code** wörtlich berichten;
niemals ein erwartetes Ergebnis als beobachtetes schreiben — was du nicht ausgeführt hast, steht
als „nicht ausgeführt" da.

---

## Ist-Stand (verifiziert am 16.10.2026)

**Was funktioniert — mit Belegen aus der Datenbank:**

| Pfad | Beleg |
|---|---|
| LinkedIn-Post | Lauf 15.10. 14:30 (Routine): `LINKEDIN_CREATE_LINKED_IN_POST` + `LINKEDIN_GET_MY_INFO` + `read_file` → `completed` |
| Instagram-Post | Lauf 15.10. 18:53 (Routine): `INSTAGRAM_GET_USER_INFO`, `INSTAGRAM_POST_IG_USER_MEDIA`, `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` → `completed` (Container + Publish) |
| Verbindungen | `linkedin` = connected, `instagram` = connected |
| Routinen | Instagram (täglich 08:35), LinkedIn (täglich 08:30) — aktuell **inaktiv** (waren Playtest) |
| Scoping | Social Queue behält als einziger Bot `linkedin,instagram`; alle anderen Bots fahren ohne Connector-Werkzeuge |

**Was fehlt:**

1. **Inhalt ist kein Platzhalter mehr (Task 4).** `shared/social-queue.md` war der Playtest-Text; seit Task 4 ist sie nur noch ein Verweis auf `shared/karo/social-plan.md` — fünf Blöcke Mo–Fr mit Motiv, Stichpunkten, Hashtags und Ort. Die Bild-URLs fehlen bis Task 5.
2. **Bilder sind Testbilder von GitHub.** Die Routine-Prompts nennen feste URLs aus `citrondon/bobbot-social-test-images` (`01-montag.jpg` …). Instagram braucht eine **öffentlich erreichbare** Bild-URL — für Karos Fotos ist das eine offene Entscheidung (Datenschutz!).
3. **Kein Nachweis in der Antwort.** Ein Lauf hat am 15.10. „veröffentlicht, Medien-IDs …" geschrieben, **ohne ein einziges Werkzeug aufzurufen** (0 `agent.tool.called`). Bei einer Brand ist ein stiller Nicht-Post der schlimmste Fehler.
4. **Konto geprüft (Task 1, 16.10.).** Verbunden sind **nicht** Karos Konten: ein privates LinkedIn-Profil (Pascal Hintermaier) und Instagram `@beyond_averagerdaily` (`MEDIA_CREATOR`). Belege in `shared/karo/social-accounts.md`.
5. **Aufräum-Reste.** Die zweite Instagram-Verbindung ist `revoked` (Task 2); `twitter` ist `revoked`.
6. **Keine Bildquelle.** Es gibt kein Bildgenerierungs-Werkzeug im Werkzeugkasten — Karos Fotos müssen aus seinem Bestand kommen (oder extern erzeugt werden).
7. **Keine Verifikation im Repo.** Ob ein Post wirklich draußen ist, prüft heute nur ein Blick in die DB von Hand.

## Entscheidungen, die vor Task 5 fallen müssen

1. **Konto:** Verbunden sind die Konten des Operators — ein **privates** LinkedIn-Profil (Pascal Hintermaier, keine Unternehmensseite) und Instagram `@beyond_averagerdaily` (creator). Entscheiden: mit diesen posten, oder Karos Instagram-Business-Account und eine LinkedIn-Seite verbinden? Technisch ist der Instagram-Account bereit (`MEDIA_CREATOR`).
2. **Medien:** Wo liegen Karos Fotos öffentlich? Optionen: ein privates GitHub-Repo mit Raw-URLs (wie der Playtest), der BobBot-Artefakt-Store, oder ein eigener Webspace. Instagram verlangt eine öffentliche URL, LinkedIn nicht.
3. **Freigabe:** Soll die Routine direkt posten, oder soll jeder Post als Freigabekarte bei dir landen (Auto-Review fragt bei folgenreichen Aktionen ohnehin nach)?
4. **Kadenz:** Täglich Mo–Fr wie im Playtest, oder z. B. Di/Do/Fr mit je einem Karussell?
5. **X/Twitter:** außen vor, solange die Verbindung `revoked` ist — oder wieder verbinden?

---

## Task 1: Verbundene Konten identifizieren

**Files:**
- Create (Team-Home, nicht im Repo): `data/homes/team-e7c6d161a53b0b63d7313c2fdb51ff40/shared/karo/social-accounts.md`

- [ ] **Step 1: Session-Token holen**

```bash
cd /home/phh/rakazo
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -t -A -c \
  "select token from session order by \"expiresAt\" desc limit 1;" > /tmp/bobbot.token
chmod 600 /tmp/bobbot.token
```

- [ ] **Step 2: Social Queue nach den Konten fragen**

```bash
curl -s -X POST http://127.0.0.1:3100/rpc/threads/send \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:3100' \
  -H "authorization: Bearer $(cat /tmp/bobbot.token)" \
  -d '{"json":{"botId":"cpzhafryiu1zhlv68bravdiw5","clientNonce":"karo-accounts-1","text":"Rufe genau zweimal ein Werkzeug auf: LINKEDIN_GET_MY_INFO und danach INSTAGRAM_GET_USER_INFO. Sonst nichts. Antworte dann mit einer Zeile pro Konto: Plattform, Name/Handle, Kontotyp (privat/business/creator)."}}'
```

Erwartet: `{"json":{"taskId":"…","runId":"…","seq":…}}` — die `runId` notieren.

- [ ] **Step 3: Werkzeugaufrufe prüfen (nicht dem Text glauben)**

```bash
RID=<runId aus Step 2>
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -c \
  "select type, payload->>'name' as tool from events where \"runId\"='$RID' and type like 'agent.tool%' order by seq;"
```

Erwartet: `agent.tool.called` **zweimal**, mit `LINKEDIN_GET_MY_INFO` und `INSTAGRAM_GET_USER_INFO`.
Kommt keine Zeile: Verbindung in der UI neu aufbauen (Task 2 zeigt das Aufräumen).

- [ ] **Step 4: Antwort und Kontotyp festhalten**

```bash
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -t -A -c \
  "select m.blocks->0->>'text' from messages m where m.\"threadId\"=(select \"threadId\" from runs where id='$RID') and m.role='bot' order by m.\"createdAt\" desc limit 1;"
```

Ergebnis nach `shared/karo/social-accounts.md`: Plattform, Handle, Kontotyp, Datum.

**Achtung:** Ist der **verbundene** Instagram-Account nicht `business` oder `creator`, kann die
Graph-API keine Posts anlegen. Der aktuell verbundene Account (`@beyond_averagerdaily`) ist
`MEDIA_CREATOR` — technisch also bereit, aber er gehört dem Operator, nicht Karo. Für Task 9 heißt
das: entweder mit diesem Konto posten (Entscheidung 1), oder Karo verbindet ihre eigenen Konten,
bevor der Test läuft.

## Task 2: Doppelte Instagram-Verbindung aufräumen

**Files:** keine (DB und Verbindung)

- [ ] **Step 1: Beide Instagram-Zeilen ansehen**

```bash
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -c \
  "select id, status, \"providerRef\", \"createdAt\"::timestamp(0) from connections where provider='instagram' order by \"createdAt\";"
```

Erwartet **vor** Task 2: eine `connected`-Zeile (`ca_4wbQYfOXofMA`) und eine `pending`-Zeile (`ca_x__oyfB7ViIX`). Nach Task 2: eine `connected`-Zeile und eine `revoked`-Zeile. Die Zeile bleibt als `revoked` stehen — das ist der Normalzustand hier (`pickReusableConnection` gibt sie nie zurück, `connections/tools` liest nur `connected`, und ein Test erwartet genau dieses Muster).

- [ ] **Step 2: Die pending-Zeile zurückziehen**

```bash
CID=<id der pending-Zeile>
curl -s -X POST http://127.0.0.1:3100/rpc/connections/revoke \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:3100' \
  -H "authorization: Bearer $(cat /tmp/bobbot.token)" \
  -d "{\"json\":{\"connectionId\":\"$CID\"}}"
```

Erwartet: `{"json":{"ok":true}}`.

- [ ] **Step 3: Gegenprüfen**

```bash
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -t -A -c \
  "select count(*) from connections where provider='instagram' and status='pending';"
```

Erwartet: `0`.

## Task 3: Verfügbare Werkzeuge dokumentieren

**Files:**
- Create (Team-Home): `data/homes/team-e7c6d161a53b0b63d7313c2fdb51ff40/shared/karo/social-tools.md`

- [ ] **Step 1: LinkedIn- und Instagram-Werkzeuge abfragen**

```bash
cd /home/phh/rakazo
for P in linkedin instagram; do
  echo "== $P"
  curl -s -X POST http://127.0.0.1:3100/rpc/connections/tools \
    -H 'content-type: application/json' -H 'origin: http://127.0.0.1:3100' \
    -H "authorization: Bearer $(cat /tmp/bobbot.token)" \
    -d "{\"json\":{\"connectorId\":\"composio\",\"provider\":\"$P\"}}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); [print("  ", t["name"]) for t in (d.get("json") or [])]'
done
```

Erwartet unter anderem: `LINKEDIN_CREATE_LINKED_IN_POST`, `LINKEDIN_GET_MY_INFO`,
`INSTAGRAM_GET_USER_INFO`, `INSTAGRAM_POST_IG_USER_MEDIA`, `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH`.

- [ ] **Step 2: Namen mit Zweck und Parametern festhalten**

Eine Zeile pro Werkzeug in `social-tools.md`: **alle** Werkzeuge namentlich, und die des
Publishing-Pfads zusätzlich mit belegten Parametern. Aus Task 3 belegt: Instagram braucht eine
öffentlich erreichbare `image_url` und eine `caption`; LinkedIn heißt der Text-Parameter
**`commentary`** (nicht `text`). Für die übrigen ~50 Werkzeuge genügt der Name — Task 6 nennt
ohnehin nur Werkzeuge, die dort stehen.
**Diese Datei ist die Wahrheit für Task 6** — die Routine-Prompts dürfen nur Werkzeuge nennen,
die hier stehen.

## Task 4: Karos echten Content-Plan anlegen

**Files:**
- Create (Team-Home): `…/shared/karo/social-plan.md`
- Create (Team-Home): `…/shared/karo/social-plan-pruefen.sh`
- Modify (Team-Home): `…/shared/social-queue.md` — nur noch ein Verweis auf Karos Plan

- [ ] **Step 1: Den Plan aus den vorhandenen Karo-Artefakten schreiben**

Quellen liegen schon im Team-Home: `shared/karo/name.md` (Markenname),
`shared/karo/instagram-analyse.md` (Wettbewerber-Auftritte), `shared/karo/markt-wettbewerber.md`
(Markt Mannheim), `shared/recht-lage-karo-1410.md` (rechtliche Lage).

Struktur, ein Block je Werktag:

```markdown
## Donnerstag
- Motiv: Motivwahl: mit einer Idee kommen, nicht mit einem fertigen Bild
- Bild: https://<öffentliche URL zu Karos Foto>/04-motivwahl.jpg
- Stichpunkte: eine Idee beschreiben statt eine Vorlage kopieren; Referenzbild als Richtung, nicht als Auftrag
- Hashtags: #fineline #linework #tattoomannheim
- Ort: Mannheim
```

- [ ] **Step 2: Prüfskript schreiben, das die Struktur erzwingt**

```bash
cat > /home/phh/rakazo/data/homes/team-e7c6d161a53b0b63d7313c2fdb51ff40/shared/karo/social-plan-pruefen.sh <<'SH'
#!/usr/bin/env bash
# Prüft Karos Social-Plan: je Werktag ein Block mit Bild-URL, Hashtags und Ort.
set -uo pipefail
PLAN="$(dirname "$0")/social-plan.md"
fail=0
for TAG in Montag Dienstag Mittwoch Donnerstag Freitag; do
  BLOCK=$(awk -v t="## $TAG" '$0==t{f=1;next} /^## /{f=0} f' "$PLAN")
  [ -z "$BLOCK" ] && { echo "FEHLT: Block $TAG"; fail=1; continue; }
  echo "$BLOCK" | grep -qE '^- Bild: https://' || { echo "FEHLT: Bild-URL bei $TAG"; fail=1; }
  echo "$BLOCK" | grep -qE '^- Hashtags: .*#'   || { echo "FEHLT: Hashtags bei $TAG"; fail=1; }
  echo "$BLOCK" | grep -qE '^- Ort: \S'          || { echo "FEHLT: Ort bei $TAG"; fail=1; }
done
[ "$fail" -eq 0 ] && echo "Plan vollständig: 5 Werktage mit Bild, Hashtags und Ort."
exit "$fail"
SH
chmod +x /home/phh/rakazo/data/homes/team-e7c6d161a53b0b63d7313c2fdb51ff40/shared/karo/social-plan-pruefen.sh
```

- [ ] **Step 3: Prüfskript laufen lassen — erst rot, dann grün**

```bash
/home/phh/rakazo/data/homes/team-e7c6d161a53b0b63d7313c2fdb51ff40/shared/karo/social-plan-pruefen.sh
```

Erwartet **vor** Task 5: `FEHLT: Bild-URL bei Montag` … und Exit-Code 1.
Erwartet **nach** Task 5: `Plan vollständig: 5 Werktage mit Bild, Hashtags und Ort.` und Exit-Code 0.

- [ ] **Step 4: `shared/social-queue.md` ersetzen**

Die Platzhalterdatei wird zu:

```markdown
# Social Queue — Content-Quelle

Karos Plan liegt in `shared/karo/social-plan.md`. Der Eintrag zum heutigen Wochentag gilt.
```

Damit kann kein Lauf mehr versehentlich den Playtest-Text posten.

## Task 5: Karos Fotos auf öffentliche URLs bringen

**Files:**
- Modify (Team-Home): `…/shared/karo/social-plan.md` — die `Bild:`-Zeilen füllen

Instagram akzeptiert beim Anlegen eines Containers **nur eine öffentlich erreichbare URL**
(`image_url`). LinkedIn braucht keine. Der Playtest nutzte dafür ein GitHub-Repo mit Raw-URLs.

- [ ] **Step 1: Hosting entscheiden und anlegen** (Entscheidung 2 aus der Liste oben)

**Variante A — GitHub-Repo wie im Playtest** (schnell, aber die Fotos sind dann öffentlich):

```bash
gh repo create <konto>/karo-social-images --private --description "Karos Social-Bilder"
```

`--private` liefert **keine** funktionierende Raw-URL. Für die Graph-API muss das Repo
öffentlich sein (oder ein eigener Webspace davor). Dürfen Karos Bilder nicht öffentlich sein,
ist Variante B Pflicht.

**Variante B — eigener Webspace:** Fotos unter einer HTTPS-Domain ablegen, die ohne Login
erreichbar ist, z. B. `https://bilder.<deine-domain>/karo/04-motivwahl.jpg`.

- [ ] **Step 2: Fotos ablegen und die URLs prüfen**

```bash
# Variante A
cd /tmp && git clone git@github.com:<konto>/karo-social-images.git && cd karo-social-images
cp "/pfad/zu/karos/fotos/"*.jpg .
git add . && git commit -m "Karos Social-Bilder" && git push
curl -sI https://raw.githubusercontent.com/<konto>/karo-social-images/main/04-motivwahl.jpg | head -3
```

Erwartet: `HTTP/2 200` und `content-type: image/jpeg`. Eine 404 heißt: Pfad oder Branch falsch —
**nicht** weiter, sonst bricht der Instagram-Post bei jedem Lauf ab.

- [ ] **Step 3: URLs in Karos Plan eintragen**

Die fünf `- Bild:`-Zeilen in `shared/karo/social-plan.md` füllen, dann:

```bash
/home/phh/rakazo/data/homes/team-e7c6d161a53b0b63d7313c2fdb51ff40/shared/karo/social-plan-pruefen.sh
```

Erwartet: `Plan vollständig: 5 Werktage mit Bild, Hashtags und Ort.`

- [ ] **Step 4: Betreuung dokumentieren**

In `social-accounts.md` notieren, wo die Bilder liegen und wer sie austauscht (Karo oder du) —
sonst steht die Routine irgendwann auf einem gelöschten Bild und bricht ab.

## Task 6: Routine-Prompts auf Karo umschreiben

**Files:** keine Repo-Datei (DB über `routines/update`)

Beide Prompts bekommen **Pflicht-Nachweis** hinein: ein Werkzeugaufruf ist Pflicht, und die
Antwort muss die ID aus der Werkzeug-Antwort nennen. Das ist die Antwort auf den Fall vom 15.10.,
wo ein Lauf „veröffentlicht, Medien-IDs …" schrieb, ohne ein Werkzeug zu rufen.

**Werkzeugnamen aus Task 3** (`shared/karo/social-tools.md`): der Instagram-Container heißt
`INSTAGRAM_POST_IG_USER_MEDIA` — die Composio-Beschreibung verweist auf ein
`INSTAGRAM_CREATE_MEDIA_CONTAINER`, **das es nicht gibt**. Belegte Parameter: Instagram
`ig_user_id`, `image_url`, `caption`; Publish `ig_user_id`, `creation_id` (aus `data.id` des
Containers); LinkedIn `author` (`urn:li:person:<id>` aus `LINKEDIN_GET_MY_INFO`), `commentary`.

- [ ] **Step 1: LinkedIn-Prompt ersetzen**

```bash
cd /home/phh/rakazo
RID=$(docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -t -A -c \
  "select rt.id from routines rt join bots b on b.id=rt.\"botId\" where b.name='Social Queue' and rt.name ilike '%LinkedIn%' limit 1;" | tr -d ' ')
python3 - "$RID" > /tmp/routine.json <<'PY'
import json, sys
prompt = """Schreibe den heutigen LinkedIn-Post fuer Karos Tattoo-Studio und veroeffentliche ihn.

Vorgehen, genau so:
1. Lies shared/karo/social-plan.md EINMAL. Nimm den Block zum heutigen Wochentag.
2. Formuliere daraus einen deutschen Post in Karos Stimme: drei bis fuenf Saetze, ruhig, konkret,
   kein Werbeton, keine Emojis. Uebernimm Hashtags und Ort aus dem Block.
3. Veroeffentliche ihn ueber LinkedIn in EINEM Aufruf (LINKEDIN_CREATE_LINKED_IN_POST).

Pflicht-Nachweis:
- Rufe das Werkzeug wirklich auf. Eine Antwort ohne Werkzeugaufruf gilt als Fehlschlag.
- Schreibe in deine Antwort die Post-URN aus der Werkzeug-Antwort. Ohne URN ist der Lauf nicht fertig.

Regeln:
- Nur LinkedIn in diesem Lauf, kein Bild, kein Instagram.
- Lies keine Datei zweimal und suche kein zweites Mal nach Werkzeugen.
- Benutze keine Shell in diesem Lauf.
- Erfinde keine Zahlen, Preise, Zusagen, Namen oder Kundenstimmen.
- Schlaegt der Aufruf fehl, brich ab und schreibe den Fehler in den Thread. Kein zweiter Versuch."""
print(json.dumps({"json": {"routineId": sys.argv[1], "prompt": prompt}}))
PY
curl -s -X POST http://127.0.0.1:3100/rpc/routines/update \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:3100' \
  -H "authorization: Bearer $(cat /tmp/bobbot.token)" --data-binary @/tmp/routine.json \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("ok" if d.get("json") else d)'
```

Erwartet: `ok`.

- [ ] **Step 2: Instagram-Prompt ersetzen**

```bash
cd /home/phh/rakazo
RID=$(docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -t -A -c \
  "select rt.id from routines rt join bots b on b.id=rt.\"botId\" where b.name='Social Queue' and rt.name ilike '%Instagram%' limit 1;" | tr -d ' ')
python3 - "$RID" > /tmp/routine.json <<'PY'
import json, sys
prompt = """Veroeffentliche den heutigen Instagram-Post fuer Karos Tattoo-Studio.

Vorgehen, genau so:
1. Lies shared/karo/social-plan.md EINMAL. Nimm den Block zum heutigen Wochentag.
2. Nimm die Bild-URL aus der Zeile "Bild:" dieses Blocks — fertig, nichts suchen.
3. Formuliere daraus eine deutsche Caption in Karos Stimme: zwei bis vier Saetze, ruhig, konkret,
   kein Werbeton. Uebernimm Hashtags und Ort aus dem Block.
4. Veroeffentliche ueber Instagram: erst den Container anlegen (INSTAGRAM_POST_IG_USER_MEDIA, mit
   image_url und caption), dann veroeffentlichen (INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH).

Pflicht-Nachweis:
- Rufe beide Werkzeuge wirklich auf. Eine Antwort ohne Werkzeugaufruf gilt als Fehlschlag.
- Schreibe in deine Antwort die Medien-ID aus der Publish-Antwort. Ohne ID ist der Lauf nicht fertig.

Regeln:
- Nur Instagram in diesem Lauf, kein LinkedIn.
- Lies keine Datei zweimal und suche kein zweites Mal nach Werkzeugen.
- Benutze keine Shell in diesem Lauf. Die Bild-URL steht fertig im Plan.
- Erfinde keine Zahlen, Preise, Zusagen, Namen oder Kundenstimmen.
- Schlaegt ein Aufruf fehl, brich ab und schreibe den Fehler in den Thread. Kein zweiter Versuch."""
print(json.dumps({"json": {"routineId": sys.argv[1], "prompt": prompt}}))
PY
curl -s -X POST http://127.0.0.1:3100/rpc/routines/update \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:3100' \
  -H "authorization: Bearer $(cat /tmp/bobbot.token)" --data-binary @/tmp/routine.json \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("ok" if d.get("json") else d)'
```

Erwartet: `ok`.

- [ ] **Step 3: Beide Prompts zurücklesen**

```bash
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -c \
  "select rt.name, length(rt.prompt) as zeichen, rt.active from routines rt join bots b on b.id=rt.\"botId\" where b.name='Social Queue' order by rt.name;"
```

Erwartet: zwei Zeilen mit den neuen Längen (LinkedIn ~1 100, Instagram ~1 450 Zeichen) und
weiterhin `active = f`.

## Task 7: Verifikationsskript im Repo (der Nachweis)

**Files:**
- Create: `scripts/verify-social-post.ts`
- Modify: `package.json` (Skript-Eintrag)

Grund: Ein Lauf kann behaupten zu posten, ohne ein Werkzeug zu rufen. Bei einer Brand ist der
stille Nicht-Post der teuerste Fehler. Das Skript prüft die **Ereignisse**, nicht den Text.

- [ ] **Step 1: Skript schreiben**

```ts
/**
 * Prüft, ob ein Lauf wirklich veröffentlicht hat.
 *
 * Ein Modell kann „veröffentlicht" schreiben, ohne ein Werkzeug zu rufen — bei einem Brand ist
 * der stille Nicht-Post der teuerste Fehler. Dieses Skript liest den Lauf-Beleg und die
 * Werkzeug-Ereignisse, nicht die Antwort.
 *
 *   BOBBOT_API_TOKEN=<token> npx tsx scripts/verify-social-post.ts <runId>
 *
 * Exit 0 = veröffentlicht, Exit 1 = nicht veröffentlicht (oder fehlgeschlagen).
 */
import type { RunReceipt } from "@bobbot/contracts";
import { rpc } from "./lib/api.js";

/** Werkzeuge, deren Aufruf einen Post erzeugt. */
const PUBLISH_TOOLS = new Set([
  "LINKEDIN_CREATE_LINKED_IN_POST",
  "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
]);

async function main(): Promise<void> {
  const runId = process.argv[2];
  if (!runId) {
    console.error("usage: npx tsx scripts/verify-social-post.ts <runId>");
    process.exitCode = 2;
    return;
  }
  const receipt = await rpc<RunReceipt | null>("runs/receipt", { runId });
  if (!receipt) {
    console.error(`kein Lauf mit id ${runId}`);
    process.exitCode = 2;
    return;
  }
  const called = receipt.tools.map((tool) => `${tool.name}x${tool.calls}`);
  const published = receipt.tools.filter((tool) => PUBLISH_TOOLS.has(tool.name));
  const failed = receipt.tools.filter((tool) => tool.failures > 0);
  console.log(`Lauf ${runId}: ${receipt.status} · ${called.join(", ") || "kein Werkzeug"}`);
  if (failed.length > 0) {
    console.error(`FEHLGESCHLAGEN: ${failed.map((tool) => tool.name).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (published.length === 0) {
    console.error("NICHT VERÖFFENTLICHT: kein Publish-Werkzeug aufgerufen");
    process.exitCode = 1;
    return;
  }
  console.log(`veröffentlicht über ${published.map((tool) => tool.name).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Einzeiler eintragen**

In `package.json` direkt unter `"smoke:spook"`:

```json
    "verify:social": "tsx scripts/verify-social-post.ts",
```

- [ ] **Step 3: Prüfen und formatieren**

```bash
cd /home/phh/rakazo
npx biome check --write scripts/verify-social-post.ts
npx tsc --noEmit -p scripts/tsconfig.json   # erwartet: keine Ausgabe
```

- [ ] **Step 4: Gegen einen echten, guten Lauf testen**

```bash
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -t -A -c \
  "select r.id from runs r where r.\"routineId\" is not null and r.status='completed' \
   and exists (select 1 from events e where e.\"runId\"=r.id and e.payload->>'name' like 'INSTAGRAM%PUBLISH') \
   order by r.\"createdAt\" desc limit 1;"
```

Erwartet: eine `runId`. Damit:

```bash
BOBBOT_API_TOKEN=$(cat /tmp/bobbot.token) pnpm verify:social <runId>
```

Erwartet: `veröffentlicht über INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH`, Exit 0.

- [ ] **Step 5: Gegen den Fehlfall testen (der Lauf vom 15.10. mit 0 Werkzeugen)**

```bash
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -t -A -c \
  "select r.id from runs r where r.\"botId\"=(select id from bots where name='Social Queue') \
   and not exists (select 1 from events e where e.\"runId\"=r.id and e.type='agent.tool.called') \
   and r.status='completed' order by r.\"createdAt\" desc limit 1;"
```

Erwartet: eine `runId`. Damit:

```bash
BOBBOT_API_TOKEN=$(cat /tmp/bobbot.token) pnpm verify:social <runId>
```

Erwartet: `NICHT VERÖFFENTLICHT: kein Publish-Werkzeug aufgerufen`, Exit 1.

- [ ] **Step 6: Committen**

```bash
git add scripts/verify-social-post.ts package.json
git commit -m "chore(scripts): prove a social post from the run events, not the reply"
```

## Task 8: Freigabe-Flow klären (Entscheidung 3)

**Files:** keine

Eine Routine feuert um 08:30 unbeaufsichtigt. Ist Auto-Review an (`BOBBOT_AUTO_REVIEW=true` ist
gesetzt), bewertet Jev jeden folgenreichen Aufruf — ein Post ist folgenreich. Antwortet der
Richter „ask", **parkt der Lauf auf einer Freigabekarte**, und niemand antwortet um 08:30: der Post
fällt still aus. Genau dieses Muster gab es in den letzten 24 Stunden 17-mal (`run.waiting_input`).

- [ ] **Step 1: Aktuellen Zustand feststellen**

```bash
curl -s -X POST http://127.0.0.1:3100/rpc/autoReview/get \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:3100' \
  -H "authorization: Bearer $(cat /tmp/bobbot.token)" -d '{"json":{}}'
```

Erwartet: `{"json":{"enabled":true,"checkerAvailable":true}}`.

- [ ] **Step 2: Entscheiden und einstellen**

- **Direkt posten** (empfohlen für eine Routine): eine Freigabe-Regel anlegen, die
  `LINKEDIN_CREATE_LINKED_IN_POST` und `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` erlaubt
  (Einstellungen → Aktionen/Freigaben; Tabelle `action_approval_rules`).
- **Immer fragen:** nichts ändern — dann muss der Post manuell angestoßen werden (Task 9, Step 1),
  damit du die Karte siehst.

- [ ] **Step 3: Verhalten prüfen**

Nach dem Testpost aus Task 9:

```bash
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -c \
  "select type, count(*) from events where \"runId\"='<runId aus Task 9>' group by 1 order by 2 desc;"
```

Erwartet bei „direkt posten": `agent.tool.completed` vorhanden, **kein** `run.waiting_input`.
Erwartet bei „immer fragen": genau ein `run.waiting_input`.

## Task 9: Ende-zu-Ende-Test und Aktivierung

**Files:** keine

- [ ] **Step 1: Routine in drei Minuten feuern lassen**

Cron auf „jetzt + 3 Minuten" in der Zeitzone der Routine (`Europe/Berlin`) setzen und scharf
schalten:

```bash
cd /home/phh/rakazo
# Zielzeit in Berliner Zeit bestimmen
TZ=Europe/Berlin date '+%M %H'   # z. B. "05 09"
```

```bash
RID=$(docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -t -A -c \
  "select rt.id from routines rt join bots b on b.id=rt.\"botId\" where b.name='Social Queue' and rt.name ilike '%Instagram%' limit 1;" | tr -d ' ')
curl -s -X POST http://127.0.0.1:3100/rpc/routines/update \
  -H 'content-type: application/json' -H 'origin: http://127.0.0.1:3100' \
  -H "authorization: Bearer $(cat /tmp/bobbot.token)" \
  -d "{\"json\":{\"routineId\":\"$RID\",\"crons\":[\"05 09 * * *\"],\"active\":true}}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); r=d.get("json"); print(r["active"], r["crons"]) if r else print(d)'
```

Erwartet: `True ['05 09 * * *']` (mit deinen Werten).

- [ ] **Step 2: Auf den Lauf warten und ihn prüfen**

```bash
sleep 240
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -c \
  "select id, status, \"createdAt\"::timestamp(0) from runs where \"routineId\"='$RID' order by \"createdAt\" desc limit 1;"
```

Erwartet: eine `runId` mit `status` = `completed` (oder `failed` — dann die Fehlermeldung lesen).

```bash
BOBBOT_API_TOKEN=$(cat /tmp/bobbot.token) pnpm verify:social <runId>
```

Erwartet: `veröffentlicht über INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH`, Exit 0.

- [ ] **Step 3: Den Post in der App gegenprüfen**

Instagram öffnen, den Post sehen (oder die Medien-ID aus der Antwort aufrufen).
**Nur wenn er wirklich da ist**, weiter — sonst ist die Antwort des Bots wertlos.

- [ ] **Step 4: Echte Kadenz setzen (Entscheidung 4)**

```bash
cd /home/phh/rakazo
LRID=$(docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -t -A -c \
  "select rt.id from routines rt join bots b on b.id=rt.\"botId\" where b.name='Social Queue' and rt.name ilike '%LinkedIn%' limit 1;" | tr -d ' ')
# Beispiel: LinkedIn Di/Do 08:30, Instagram Di/Do 08:35 (Berliner Zeit)
curl -s -X POST http://127.0.0.1:3100/rpc/routines/update -H 'content-type: application/json' \
  -H 'origin: http://127.0.0.1:3100' -H "authorization: Bearer $(cat /tmp/bobbot.token)" \
  -d "{\"json\":{\"routineId\":\"$LRID\",\"crons\":[\"30 8 * * 2,4\"],\"active\":true}}"
curl -s -X POST http://127.0.0.1:3100/rpc/routines/update -H 'content-type: application/json' \
  -H 'origin: http://127.0.0.1:3100' -H "authorization: Bearer $(cat /tmp/bobbot.token)" \
  -d "{\"json\":{\"routineId\":\"$RID\",\"crons\":[\"35 8 * * 2,4\"],\"active\":true}}"
```

- [ ] **Step 5: Zustand festhalten**

```bash
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -c \
  "select left(b.name,14) as bot, rt.name, rt.crons, rt.active, rt.\"nextRunAt\"::timestamp(0) \
   from routines rt join bots b on b.id=rt.\"botId\" where b.name='Social Queue' order by rt.name;"
```

Ergebnis in `docs/handover-checklist.md` (Abschnitt 5) nachtragen, damit der Kollege denselben Stand sieht.
Dort **nur Kadenz und Zustand** eintragen — keine Kontodaten: Namen und Handles sind
personenbezogen, und `docs/` ist (anders als `data/`) versioniert.

## Rollback

- Routinen wieder aus: `{"routineId":"<id>","active":false}` über `routines/update` — wirkt sofort,
  ein laufender Wakeup-Job wird übersprungen (`executor.ts` claimt nur mit `active: true`).
- Prompts zurück: die Playtest-Texte sind nirgends versioniert — **vor** Task 6 einmal sichern:

```bash
docker exec -i compose-postgres-1 psql -U rakazo -d rakazo -t -A -c \
  "select name||E'\n---\n'||prompt from routines where \"botId\"=(select id from bots where name='Social Queue');" \
  > /tmp/social-queue-routinen-$(date +%Y%m%d).txt
```
- Ein versehentlich veröffentlichter Testpost wird in der App gelöscht; die Medien-ID aus der
  Bot-Antwort hilft beim Finden.

## Was nicht in diesem Plan steht

- **X/Twitter** — Verbindung ist `revoked`; eigener Task, wenn gewünscht.
- **Bildgenerierung** — es gibt kein Bildwerkzeug im Werkzeugkasten. Ohne Karos Fotos braucht es
  einen externen Schritt (oder ein eigenes Werkzeug).
- **Karussells/Mehrbild-Posts** — die Routine postet ein Bild; mehrere Bilder sind ein eigener Ausbau.
- **Kommentare, DMs, Analytics** — nicht Teil dieses Pfads.
- **Automatischer Austausch der Bilder** — Task 5 dokumentiert die Betreuung nur.
