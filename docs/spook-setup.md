# SpooK api als Modell-Anbieter

Diese Anleitung beschreibt, wie BobBot gegen **SpooK api** (`api.spookapi.xyz`)
läuft — der Weg, den wir nutzen, nachdem das OpenCode-Go-Kontingent aufgebraucht
war. Sie ist für den Betrieb gedacht: alles passiert in `.env` und im Browser.

## Wie BobBot mit SpooK spricht

SpooK stellt zwei Endpunkt-Formate an derselben Base URL bereit:

- `/v1/messages` — Anthropic-nativ (für Claude Code, Cline, Cursor)
- `/v1/chat/completions` — OpenAI-kompatibel

BobBot nutzt die **OpenAI-kompatible** Seite über den Provider `openai-compatible`
(Custom-Endpunkt). Eingetragen wird:

```
Base URL:  https://api.spookapi.xyz/v1      (BobBot ergänzt /v1 bei Bedarf selbst)
Modell-ID: eine ID aus dem Katalog unten
API-Key:   Token-Key oder Credit-Key aus dem SpooK-Dashboard
```

## Pflicht-Schalter im Server-Env

```
BOBBOT_OPENAI_COMPAT_ALLOW_PUBLIC=1
```

Ohne diesen Wert blockt BobBot **jeden** öffentlichen Hostnamen
(*"Public model endpoints are blocked…"*). Geschrieben wird `1`, nicht `true`.
Endpunkte, die einen Key senden, müssen zusätzlich `https://` sein — das prüft
der Server unabhängig von diesem Schalter.

## Schlüsseltypen und Abrechnung

- **Token-Key** — Flatrate über Token-Pakete; Cache-Reads 70 % Rabatt, Pakete
  verfallen nie. Wird im Dashboard unter *Aufladen* verwaltet.
- **Credit-Key** — Abrechnung pro Aufruf zum Tarif des jeweiligen Modells.

Beide funktionieren an derselben Base URL. In BobBot wandert der Key beim
Verbinden in den verschlüsselten Secret-Store: **`ENCRYPTION_KEY` muss stabil
bleiben**, sonst sind alle gespeicherten Zugangsdaten unlesbar.

## Modellkatalog (Stand 16.10.2026, 19 Modelle)

```
claude-fable-5-1        claude-fable-5          claude-opus-5
claude-opus-4-8         claude-opus-4-7         claude-opus-4-6
claude-sonnet-5         claude-sonnet-4-6       claude-haiku-4-5-20251001
qwen3.8-max             qwen3.8-flash           kimi-k3
grok-4.6                gpt-6-astra             gpt-5.6-terra
gpt-5.6-sol             gpt-5.6-luna            glm-5.3-flash
glm-5.3
```

**Kein DeepSeek, kein Gemini, kein mimo** — diese IDs gehören zu anderen
Gateways (z. B. OpenCode Go) und liefern auf SpooK
`404 upstream_http_404: Requested model is not available`.

Quelle ist immer `/docs/models` im SpooK-Dashboard ("Live-Katalog, kann sich
ändern"); `curl https://api.spookapi.xyz/v1/models -H "Authorization: Bearer $KEY"`
gibt dieselbe Liste maschinenlesbar zurück.

## Eine Verbindung kennt genau EINE Modell-ID

`packages/adapters/src/pi-models.ts` behandelt jede Custom-Verbindung als
Platzhalter mit der eingetragenen Modell-ID. Folgen:

- Der Modell-Wähler bietet für `openai-compatible` **nur die ID der Verbindung**
  an. Eine andere ID lässt sich per API nicht setzen
  (*"Unknown model for that provider"*).
- Für mehrere Modelle legt man **mehrere Verbindungen** an, z. B.
  „SpooK kimi-k3" und „SpooK claude-sonnet-4-6", jede mit eigener ID.
- Ein Bot, der noch eine ID aus einer früheren Verbindung trägt, läuft weiter,
  solange SpooK die ID kennt — geprüft wird nur der Schreibweg.

## Einrichten, in dieser Reihenfolge

1. `.env`: `BOBBOT_OPENAI_COMPAT_ALLOW_PUBLIC=1`, `PI_DEFAULT_PROVIDER=openai-compatible`,
   `PI_DEFAULT_MODEL=<Katalog-ID>`.
2. **api und worker neu starten** — beide lesen `.env` nur beim Start.
3. Im Browser: Modell verbinden → *OpenAI-kompatibel* → Base URL, Key, Modell-ID.
   Die Modellliste holt BobBot per Probe; ohne gültigen Key antwortet SpooK mit
   `401` (*"You can still Connect with an explicit model id"*).
4. Bot-Einstellungen → Modell wählen.
5. Bots aus der Bot-Bibliothek importieren. Die Presets bringen Routinen mit, und
   der Import scopet die Connector-Toolkits automatisch auf die Dienste, die das
   Preset nennt **und** die im Konto verbunden sind.

## Verifizieren

Der schnellste Weg ist das Skript — es fährt die vier Pfade über die API und endet mit
Exit-Code 0, wenn alles steht:

```bash
BOBBOT_API_TOKEN=<session-token> pnpm smoke:spook            # Bot wird automatisch gewählt
BOBBOT_API_TOKEN=<session-token> pnpm smoke:spook "Website Ops"   # oder ein bestimmter Bot
```

Es prüft Modellverbindung, Auto-Review, einen echten Tool-Call, eine Delegation und die
Monatsabrechnung. Harte Fehler (Exit 1) sind: kein Run kommt durch, keine Tokens gemeldet,
ein aufgerufenes Werkzeug ist fehlgeschlagen, keine Monatssummen. Warnungen sind das, was
das Modell auch einfach lassen kann: eine Antwort ohne Werkzeug, oder eine Aufgabe, die es
selbst übernimmt statt sie abzugeben.

| Was | Wie |
|---|---|
| Auto-Review aktiv | `POST /rpc/autoReview/get` → `{enabled: true, checkerAvailable: true}` |
| Lauf gelaufen | ein Chat-Run im UI, dann `select status, "modelProvider", "modelId" from runs order by "createdAt" desc limit 3;` |
| Abrechnung | `select model, "inputTokens", "totalTokens", "usageSource" from usage_records order by "createdAt" desc limit 5;` — `provider-reported-via-pi` heißt: die Zahlen kommen vom Anbieter |
| Prompt-Größe | `inputTokens` pro Lauf ist der beste Frühindikator: ungescopte Bots (alle Toolkits im Prompt) lagen bei **~55 000**, gescopte bei **~11 000** |

Ein Lauf, der `completed` ist und dessen Antwort zur Frage passt, ist der
belastbarste Test — Status und Antwort stehen in `runs.status` und in der
letzten Bot-Nachricht des Threads (`messages.blocks`).

## Connector-Scoping (Prompt-Größe)

Jeder Bot hat `allowedToolkits` + `toolkitsScoped`. Beide zusammen ergeben den
Scope (`packages/core/src/toolkit-scope.ts`):

- `toolkitsScoped=false` → **alles** ist sichtbar (Altbestand).
- `toolkitsScoped=true` + leere Liste → **kein** Connector-Toolkit.
- `toolkitsScoped=true` + Liste → genau diese.

Builtin-Werkzeuge (`web_fetch`, `web_search`, Dateien, Memory) sind vom Scope
**nicht** betroffen. Ein Bot, der nur recherchiert, braucht deshalb kein einziges
Connector-Toolkit — die leere Liste ist dort die richtige Wahl und spart rund
80 % der Input-Tokens pro Aufruf.

## Bekannte Eigenheiten

- **Latenz:** SpooK braucht bei großen Prompts gelegentlich länger als 120 s.
  Dann schneidet Cloudflare ab und der Lauf scheitert mit
  *"Server requested 120s retry delay (max: 60s). 524 status code"*. Der Fix ist
  ein **kleinerer Prompt** (Scoping) oder ein erneuter Versuch — es ist kein
  BobBot-Fehler.
- **Modell-IDs wandern:** SpooK mustert IDs aus. Ein `404 Requested model is not
  available` heißt fast immer: die ID steht nicht mehr im Katalog.
- **Der Hinweis „📦 [Token-Paket]"** im Modell-Wähler kommt aus einer gepflegten
  Liste in `packages/contracts/src/openai-compatible-ui.ts` und ist nur eine
  Beschriftung/Sortierung — er garantiert nicht, dass der Endpunkt das Modell
  führt.
- **Kein `openrouter`-Zwang:** Läuft alles über SpooK, setzt man
  `PI_DEFAULT_PROVIDER=openai-compatible`. Bleibt der Wert auf einem anderen
  Anbieter stehen, zeigen Compaction-, Vision- und Auto-Review-Fallbacks dorthin.
