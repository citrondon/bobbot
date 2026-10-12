# BobBot von unterwegs erreichen — Tailscale für PC und Handy

BobBot läuft auf dem PC zuhause. Dieses Netz-Programm **Tailscale** verbindet PC und
Handy so, als wären sie im selben Raum — auch wenn du unterwegs bist. Deine Adresse
funktioniert dann zuhause und im Zug gleich.

Du brauchst: ein Tailscale-Konto (kostenlos), den BobBot-PC und das Handy.

---

## 1. Tailscale auf dem PC (Linux Mint)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Beim Anmelden öffnet sich ein Link zum Browser — dort mit E-Mail-Adresse anmelden
(Google/Microsoft/GitHub geht auch). Danach zeigt der PC seine Nummer:

```bash
tailscale ip -4     # zum Beispiel: 100.101.102.103
tailscale status    # oben steht der Name, z. B. mint-pc.tailnet-1234.ts.net
```

Notiere den Namen mit `.ts.net` — den brauchst du gleich zweimal.

## 2. Tailscale auf dem Handy

App **Tailscale** aus dem Play Store installieren, mit **demselben Konto** anmelden
und den Schalter einschalten. In der App muss der PC als verbunden auftauchen.

## 3. BobBot im Tailscale-Netz freigeben

Auf dem PC:

```bash
sudo tailscale serve --bg http://127.0.0.1:5173
```

Antwort zum Beispiel:

```text
Available within your tailnet:
https://mint-pc.tailnet-1234.ts.net/
```

Kommt stattdessen ein Hinweis, dass HTTPS noch nicht aktiv ist: den angezeigten Link
im Browser öffnen und bestätigen (einmalig). Falls gar nichts geht, nimm Abschnitt 6.

Was das macht: Tailscale nimmt Anfragen aus deinem privaten Netz an und gibt sie an
BobBot auf dem PC weiter. Von außen (echtes Internet) ist BobBot dabei **nicht**
erreichbar — nur deine eigenen Geräte. Das ist Absicht.

## 4. BobBot auf die neue Adresse einstellen

Auf dem PC, im Ordner `~/bobbot`, die Datei `.env` öffnen:

```bash
cd ~/bobbot
nano .env
```

Diese vier Zeilen auf den Namen aus Schritt 1 setzen (mit `https://`, ohne `/` am Ende):

```text
BETTER_AUTH_URL=https://mint-pc.tailnet-1234.ts.net
WEB_ORIGIN=https://mint-pc.tailnet-1234.ts.net
API_URL=https://mint-pc.tailnet-1234.ts.net
BOBBOT_HOST=mint-pc.tailnet-1234.ts.net
```

Speichern (`Strg+O`, `Enter`, `Strg+X`) und neu starten:

```bash
cd ~/bobbot && bash install-linux-mint.sh
```

**Warum alle vier:** `BOBBOT_HOST` ist der Name, den der Web-Server annimmt
(bei einem anderen Namen kommt „Blocked request"); die drei anderen Zeilen sind die
Adresse, auf die sich Anmeldung und Anwendung beziehen. Deshalb danach einmal neu
anmelden.

## 5. Ausprobieren

- **PC:** Browser öffnen: `https://mint-pc.tailnet-1234.ts.net`
- **Handy:** BobBot-App → Server-Adresse eingeben → `https://mint-pc.tailnet-1234.ts.net`

Die App verbindet sich auf demselben Anschluss wie der Browser; der API-Anschluss
`3100` bleibt zu und muss nicht geöffnet werden (siehe „Für Techniker" unten). Genau diesen
Weg sieht die Betriebsanleitung vor: „enter the same HTTPS origin as `WEB_ORIGIN`"
(`docs/self-host.md`).

## 6. Wenn HTTPS-Zertifikate nicht aktiviert werden können

Dann unverschlüsselt, aber weiter nur im Tailscale-Netz:

```bash
sudo tailscale serve --bg --http=80 http://127.0.0.1:5173
```

Als Adresse verwendest du dann die **Nummer** aus Schritt 1 (`http://100.101.102.103`,
ohne Anschluss-Nummer) und setzt in `.env`:

```text
BETTER_AUTH_URL=http://100.101.102.103
WEB_ORIGIN=http://100.101.102.103
API_URL=http://100.101.102.103
BOBBOT_HOST=100.101.102.103
```

Die BobBot-App erlaubt unverschlüsseltes `http` nur für lokale Adressen und für
Tailscale-Nummern (`100.x.y.z`) — ein Name wie `mint-pc.tailnet-1234.ts.net` würde
deshalb abgelehnt („Public servers need https://").

## 7. Fernwartung durch eine zweite Person

Damit dir jemand helfen kann, muss er im selben Tailscale-Netz sein: In der
Tailscale-Verwaltung (`login.tailscale.com`) den PC für das zweite Konto
**freigeben** („Share"), oder die Person als Benutzer ins eigene Netz einladen.
Danach ist auf dem PC auch ein Fernzugriff mit Textkonsole möglich:

```bash
sudo tailscale up --ssh     # einmalig, danach: ssh benutzer@mint-pc.tailnet-1234.ts.net
```

Das ist schnell und braucht wenig Daten — aber du siehst dabei nicht, was auf dem
Bildschirm passiert. Wer mitlesen will, nimmt zusätzlich **AnyDesk** (Bildschirm
zeigen und bedienen):

```bash
# .deb passend zur Linux-Version herunterladen: https://anydesk.com/de-de/downloads/linux
sudo apt install -y ~/Downloads/anydesk-*.deb
```

Danach AnyDesk starten und die angezeigte Nummer (9 Ziffern) an den Helfer geben.
Unter **Unattended access** kann ein Passwort hinterlegt werden, dann muss niemand am
Rechner sitzen und zustimmen. Wichtig für Mint: AnyDesk arbeitet mit **X11** (der
Standard bei Mint Cinnamon) gut; läuft der Rechner mit **Wayland**, gibt es wie bei
TeamViewer Probleme — dann am Anmeldebildschirm die Sitzungsart auf „Cinnamon (X11)"
umstellen. Alternative ohne fremde Firma: **RustDesk** (quelloffen, ähnliche
Bedienung, `https://rustdesk.com`), das den PC auch direkt über die Tailscale-Nummer
(`100.101.102.103`) erreichen kann.

**Beides zusammen** ist die angenehmste Fernhilfe: Bildschirm teilen und parallel die
Textkonsole offen haben.

## 8. Prüfen, ändern, abschalten

```bash
tailscale status            # wer ist im Netz, welche Adresse
tailscale serve status      # was ist gerade freigegeben
sudo tailscale serve reset  # Freigabe komplett zurücknehmen
tailscale down              # Tailscale am PC ausschalten (BobBot bleibt lokal erreichbar)
tailscale up                # wieder einschalten
```

## 9. Wenn etwas nicht geht

| Beobachtung | Ursache und Abhilfe |
|---|---|
| „Blocked request. This host is not allowed" im Browser | `BOBBOT_HOST` passt nicht zur Adresse in der Adresszeile. Beide gleich schreiben, `.env` speichern, neu starten. |
| Handy: „Public servers need https://" | Adresse mit `http://` und einem Namen statt einer `100.x.y.z`-Nummer. Entweder `https://` benutzen (Abschnitt 3) oder die Nummer (Abschnitt 6). |
| „Could not reach that server" in der App | Läuft Tailscale auf dem Handy? Ist der PC an? `tailscale status` auf dem PC. |
| Sieht gut aus, aber Anmeldung schlägt fehl oder man wird ständig abgemeldet | Nach dem Umstellen der Adresse einmal `cd ~/bobbot && bash install-linux-mint.sh` ausführen und neu anmelden. |
| Nach einem Neustart des PCs nicht mehr erreichbar | `tailscale serve --bg` ist dauerhaft, `tailscale status` zeigen lassen; BobBot selbst startet über Docker (siehe `docs/bobbot-erste-schritte.md`). |

## Für Techniker (warum das so gebaut ist)

- Dass die App denselben Ursprung wie der Browser benutzt, ist die dokumentierte Vorgabe
  (`docs/self-host.md`: „The iOS and Android app can also point at a self-hosted origin at
  runtime. On the sign-in screen, tap **Use a custom server** and enter the same HTTPS origin
  as `WEB_ORIGIN`"). Die Adresse `http://127.0.0.1:3100` aus `docs/bobbot-erste-schritte.md`
  erreicht von einem echten Handy dagegen nur das Handy selbst; sie gilt für einen Emulator auf
  demselben Rechner. Für Handy im WLAN oder Tailnet ist der Ursprung richtig.
- Das Images-Compose bindet `web` an `127.0.0.1:5173` und `api` an `127.0.0.1:3100`
  (`infra/compose/docker-compose.images.yml`). Beide Anschlüsse sind also nur lokal
  erreichbar; auch im eigenen WLAN kommt kein anderes Gerät heran. Der dokumentierte
  Weg ist ein TLS-Abschluss auf dem Host (`docs/self-host.md`, Abschnitt „Published
  images"), und Tailscale Serve ist genau so ein Abschluss — nur mit Zertifikat vom
  Tailscale-Netz statt von einer eigenen Domain.
- Nur `:5173` wird freigegeben, weil Vite-Preview `/api` und `/rpc` im selben
  Ursprung weiterreicht; `:3100` bleibt zu. Deshalb funktioniert das Handy gegen
  denselben Ursprung wie der Browser.
- `BOBBOT_HOST` ist genau ein Name (`allowedHosts: [BOBBOT_HOST]` in
  `apps/web/vite.config.ts`), also nicht Name und Nummer gleichzeitig.
- Die App akzeptiert `http://` nur für `localhost`, `127.0.0.1`, `::1`, `*.local`,
  `10.x`, `192.168.x`, `172.16–31.x` und `100.64–127.x` (`apps/mobile/lib/endpoint.ts`).
  Tailscale-Adressen sind `100.64.0.0/10`, deshalb ist die Variante in Abschnitt 6
  zulässig und die HTTPS-Variante trotzdem die schönere.
