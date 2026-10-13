# Fremde Grok-Bot-Rebuilds: geprüft, nicht übernommen

Geprüft am 2026-10-13. Anlass: `anonymous.4open.science/r/open-grokbot` (anonym gehostetes
Repository, das sich als Rekonstruktion der Grok-Bot-Desktop-App ausgibt).

## Befund

- **Keine Lizenz.** Im Wurzelverzeichnis liegen nur `.gitignore`, `README.md`, `package-lock.json`,
  `package.json`, `rea/`, `scripts/`, `src/`, `tests/` und `tsconfig.json` — keine `LICENSE`, keine
  `COPYING`, kein `NOTICE`, und im `package.json` unter `rea/recovered/` kein `license`-Feld. Ohne
  Lizenz gibt es kein Nutzungsrecht, auch nicht für Teile.
- **Ableitung von Proprietär-Code.** Rekonstruktion der Desktop-App in Version 0.66.0 mit dem
  Werkzeug REA 6.3.0. Das `package.json` unter `rea/recovered/` nennt als Autor weiterhin
  `SpaceXAI`, als Homepage `cursor.com` und steht auf `private`.
- **Keine Source Maps**, also kein Original-TypeScript. Die Dateien unter `src/ported/` tragen
  erschlossene Typen; der `tsconfig` schließt sie vom Typecheck aus. Der Build braucht die
  installierte App als Vorlage (`GROKBOT_TEMPLATE`).
- **Herkunft ungeklärt.** Anonymes Hosting, kein Autor, im README zuerst eine Spendenadresse.

## Entscheidung

Wir übernehmen **keinen Code** und **keine Dateien** daraus, und wir verlinken es nicht als Quelle.
Dieses Repository ist öffentlich und Apache-2.0, die Website bewirbt BobBot als Grok-Bot-Alternative
(`apps/www/src/grok-alternative.ts`). Fremden, unlizenzierten Code zu übernehmen passt nicht zu
dieser Position und wäre ein Lizenzrisiko.

Zwei Dinge daraus sind trotzdem brauchbar:

1. **Methodik.** Reverse Engineering ist unser eigenes Werkzeug
   (`~/.agents/skills/reverse-engineer-anything/SKILL.md`, Version 23) — also neuer als die dort
   verwendete 6.3.0. Wir brauchen die Rekonstruktion dafür nicht.
2. **Produktwissen** im Umfang öffentlicher Quellen: Die öffentliche Doku beschreibt Aufbau,
   Freigaben, Computer und Grenzen bereits (siehe `docs/grokbot-features-guide.md`). Wo die Doku
   schweigt, ist das selbst ein Befund — und keine Lücke, die man mit rekonstruiertem Code
   schließen müsste.

## Wann wir erneut hinsehen

Nur wenn eine Upstream-Lizenz oder eine ausdrückliche Freigabe vorliegt, oder wenn dort eine
Funktion rekonstruiert ist, die wir aus öffentlicher Doku nicht beantworten können. Alles andere
findet sich über die offiziellen Seiten, die wir auf der Vergleichsseite als Quellen führen.
