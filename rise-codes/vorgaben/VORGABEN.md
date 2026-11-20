# Vorgaben für Rise-Codes

Diese Datei hält fest, wie jeder HTML-Code für Rise aufgebaut sein muss. Claude Code richtet sich beim Umbauen neuer Codes nach diesen Vorgaben. Das Prüfscript kontrolliert sie.

## Ordner

| Ordner / Datei | Inhalt |
|---|---|
| `rise-codes/eingang/` | Originale, die umgebaut werden sollen (werden nicht verändert) |
| `rise-codes/codes/` | Fertige, umgebaute Codes. Das ist die Ablage. |
| `rise-codes/vorgaben/VORGABEN.md` | Diese Datei: alle Regeln |
| `rise-codes/vorgaben/bausteine/corporate-design.css` | **Farben, Schrift, Textgrössen**. Nur hier ändern. |
| `rise-codes/vorgaben/bausteine/sprachsystem.html` | Baustein: zeigt die Texte in der richtigen Sprache |
| `rise-codes/vorgaben/bausteine/lektoratsmodus.html` | Baustein: Lektoratsmodus (Ctrl+Alt+L) |
| `rise-codes/vorgaben/vorlage.html` | Leere Vorlage für neue Codes |
| `rise-codes/codes/vier-fragen.html` | Mustercode: so sieht ein fertiger Code aus |
| `rise-codes/lektorat-werkzeug.html` | Werkzeug: Korrekturen und Excel übernehmen |
| `rise-codes/pruefen.js` | Prüfscript |

---

## 1. Corporate Design

Alle Farben, die Schrift, die Textgrössen und die Eckenrundung stehen in **`bausteine/corporate-design.css`**. Jede Grafik verwendet ausschliesslich diese Werte über `var(--cd-…)`.

| Variable | Verwendung |
|---|---|
| `--cd-primaer` | Hauptfarbe: Titel, Buttons, dunkle Flächen |
| `--cd-primaer-80` … `--cd-primaer-10` | Abstufungen der Hauptfarbe, von dunkel nach hell |
| `--cd-hintergrund` | Seitenhintergrund, Zeilen |
| `--cd-flaeche` | Karten, Panels |
| `--cd-text` | Fliesstext |
| `--cd-text-hell` | Text auf dunklen Flächen |
| `--cd-linie` | Rahmen, Trennlinien |
| `--cd-schrift` | Schriftfamilie |
| `--cd-gewicht-normal / -mittel / -fett / -extra` | Schriftstärken 400 / 600 / 700 / 800 |
| `--cd-titel` | Haupttitel der Grafik |
| `--cd-untertitel` | Einleitung unter dem Titel |
| `--cd-zwischentitel` | Titel von Karten, Stufen, Fragen |
| `--cd-text-gross / -normal / -klein` | Text 16 / 14 / 13 px |
| `--cd-label` | kleine Labels (12 px) |
| `--cd-radius` | Eckenrundung |

**Corporate Design ändern:**
1. Werte in `bausteine/corporate-design.css` anpassen. Für eine andere Schrift auch die `@import`-Zeile (Google Fonts) ersetzen.
2. Claude Code bitten: «Bausteine in allen Codes aktualisieren». Claude führt dafür `node rise-codes/pruefen.js --aktualisieren` aus.
3. Alle geänderten Codes in die Ablage und in alle Sprachkurse in Rise übernehmen.

Neue Variablen nur mit Absprache ergänzen und dann hier in der Tabelle dokumentieren.

---

## 2. Sprachen

| Code | Sprache | Anrede | Besonderheiten |
|---|---|---|---|
| `de` | Deutsch (Schweiz), Original | Sie | «ss» statt «ß», Anführungszeichen « » |
| `fr` | Français (Suisse) | vous | Vor `? ! : ; %` normale Leerzeichen tippen, das System setzt geschützte Leerzeichen. Apostroph ’ |
| `it` | Italiano (Svizzera) | Lei | Prozent ohne Leerzeichen: `8%`. Apostroph ’ |
| `en` | English (UK) | you | Britische Schreibweise: colour, flavour, organisation. Prozent `8%` |

**Übersetzungsregeln**
- Der deutsche Text ist das Original. Er wird beim Umbau **nicht verändert**, auch nicht stilistisch. Auffälligkeiten (Tippfehler, Unklarheiten) werden nur gemeldet.
- Bedeutung vor Wörtlichkeit, aber gleicher Ton und gleiche Kürze. Übersetzungen sollen ungefähr gleich lang sein wie das Deutsche, damit das Layout hält.
- Fachbegriffe gemäss Glossar (Abschnitt 8). Neue Fachbegriffe werden als Vorschlag gemeldet und erst nach Bestätigung ins Glossar aufgenommen.
- Eigennamen, Abkürzungen und Herkunftsbezeichnungen bleiben unverändert (z. B. TBA, VDN, PX, Fino, Oloroso, Tawny).
- Platzhalter wie `{n}` bleiben genau so im Text.

---

## 3. Aufbau jedes Codes

Reihenfolge im Code (siehe Mustercode `codes/vier-fragen.html`):

1. `<head>` mit `<title>`
2. **Einstellungen**: `SPRACHE`, `CODE_ID`, `STAND`
3. **Sprachblock** `const TEXTE = { de:{…}, fr:{…}, it:{…}, en:{…} };`
4. **Baustein sprachsystem** (unverändert aus `bausteine/`)
5. `<style>`: zuerst **Baustein corporate-design**, danach das individuelle Design der Grafik
6. `<body>`: HTML der Grafik, **ohne Texte**
7. `<script>`: individuelle Logik der Grafik (Aufbau, Verhalten, `LABELS`)
8. **Baustein lektoratsmodus** (unverändert aus `bausteine/`)

Bausteine stehen zwischen den Markierungen `BAUSTEIN:name START` und `BAUSTEIN:name ENDE` und werden im Code nie von Hand verändert.

| Einstellung | Bedeutung |
|---|---|
| `const SPRACHE = 'de';` | Sprache des Kurses. Die einzige Zeile, die pro Sprachkurs angepasst wird. |
| `const CODE_ID = 'vier-fragen';` | Eindeutiger Name der Grafik, gleich wie der Dateiname |
| `const STAND = '…';` | Version. Wird vom Werkzeug bzw. Prüfscript gesetzt, nie von Hand. Beim Umbau: `'TT.MM.JJJJ · Umbau'` |

---

## 4. Regeln für den individuellen Teil

**Texte**
- Jeder sichtbare Text steht im Sprachblock, nie direkt im HTML oder als Text im JavaScript. Das gilt auch für Rückmeldungen, Fehlermeldungen, Button-Beschriftungen und Texte, die erst nach einem Klick erscheinen.
- Jedes Textelement bekommt `data-key="pfad.im.sprachblock"`. Für Texte mit Nummer `{n}` zusätzlich `data-n="3"`.
- Unsichtbare Texte über Attribute: `data-key-aria-label`, `data-key-alt`, `data-key-title`, `data-key-placeholder`.
- Nach dem Aufbau der Grafik `renderAll()` aufrufen.
- `const LABELS = { … }` übersetzt die Schlüssel in lesbare Namen für Lektoratsmodus und Werkzeug (z. B. `fazit:'Fazit'`).

**Lektoratsmodus**
- Im Lektoratsmodus (`body.lektorat`) müssen **alle Texte sichtbar** sein: Akkordeons offen, Rückseiten von Karten sichtbar, Tabs und Schritte untereinander. Dafür im individuellen CSS Regeln mit `body.lektorat …` ergänzen.
- Klicks werden im Lektoratsmodus abgefangen. Die Grafik muss dafür nichts tun.

**Design**
- Nur `var(--cd-…)` für Farben, Schrift und Schriftgrössen. Keine festen Farbwerte (`#…`, `rgb(…)`) im individuellen Teil.
- SVG-Farben über `style="fill:var(--cd-…)"` bzw. `style="stroke:var(--cd-…)"`, nicht über `fill="#…"`.
- Eigene Variablen für Abstände und Masse sind erlaubt (z. B. `--indent`).
- Layout und Verhalten des Originals bleiben erhalten. Die Grafik muss ab 320 px Breite funktionieren.
- Bedienbar mit Tastatur, sichtbarer Fokus, Buttons sind `<button>`.
- Keine externen Skripte. Schriften nur über den Baustein corporate-design.

---

## 5. Schlüssel im Sprachblock

- Sprechende Namen in Kleinbuchstaben, zusammengesetzt in camelCase: `titel`, `intro`, `weiterZu`.
- Wiederkehrende Elemente als Liste: `fragen: [ { frage, stichwort, zeilen:[[…, …]], fazit }, … ]`.
- Standardschlüssel, sofern vorhanden: `seitentitel` (Browser-Tab, Pflicht), `titel`, `intro`, `anleitung`.
- Alle Sprachen haben genau dieselben Schlüssel wie Deutsch.

---

## 6. Name und Datei

- `CODE_ID` aus dem Titel der Grafik ableiten: Kleinbuchstaben, Bindestriche, ohne Umlaute (`ä → ae`, `ö → oe`, `ü → ue`), kurz. Beispiel: «Vier Fragen» → `vier-fragen`.
- Die Datei heisst gleich: `codes/vier-fragen.html`.
- Der Name bleibt für immer gleich, auch wenn sich der Titel ändert. Lektoratskommentare und das Werkzeug erkennen die Grafik daran.

---

## 7. Stand

Der Stand zeigt, welche Version eines Codes wo läuft. Er erscheint im Lektoratsmodus in der Leiste.
- Beim Umbau: `'TT.MM.JJJJ · Umbau'`
- Das Lektorats-Werkzeug setzt ihn bei jeder Korrekturübernahme: `'20.11.2026 10:25 · FR 3, IT 1'`
- Das Prüfscript setzt ihn beim Aktualisieren der Bausteine: `'… · Bausteine aktualisiert'`

---

## 8. Glossar

Verbindliche Übersetzungen von Fachbegriffen. Status «zu prüfen» heisst: Vorschlag, noch nicht von einer Fachperson bestätigt.

| Deutsch | Français (CH) | Italiano (CH) | English (UK) | Status |
|---|---|---|---|---|
| Süsswein | vin doux | vino dolce | sweet wine | zu prüfen |
| Fortified Wine | vin muté | vino fortificato | fortified wine | zu prüfen |
| Weinbrand (zum Aufspriten) | eau-de-vie de vin | acquavite di vino | grape spirit | zu prüfen |
| Edelfäule / Pilz (Botrytis) | pourriture noble | muffa nobile | noble rot | zu prüfen |
| Botrytis | botrytis | botrite | botrytis | zu prüfen |
| Trocknung | passerillage | appassimento | drying | zu prüfen |
| Most | moût | mosto | must | zu prüfen |
| Hefe | levures | lieviti | yeast | zu prüfen |
| Gärung | fermentation | fermentazione | fermentation | zu prüfen |
| Fass | fût | botte | cask | zu prüfen |
| Depot | dépôt | deposito | sediment | zu prüfen |
| Flor | voile de flor | flor | flor | zu prüfen |
| oxidativ | oxydatif | ossidativo | oxidative | zu prüfen |
| Sherry | xérès | Sherry | Sherry | zu prüfen |
| Port | porto | Porto | Port | zu prüfen |
| Madeira | madère | Madeira | Madeira | zu prüfen |
| Muscat | muscat | moscato | Muscat | zu prüfen |
| Eiswein | Eiswein | Eiswein | Eiswein | zu prüfen |
| kühle / warme Herkunft | origine fraîche / chaude | provenienza fresca / calda | cool / warm climate | zu prüfen |

---

## 9. Ablage und Korrekturen

- Die Ablage (`codes/` bzw. euer Laufwerk) ist massgebend. Rise bekommt den Code immer aus der Ablage.
- Im Code-Block in Rise wird nie direkt etwas geändert.
- Ein neuer Code kommt immer in alle vier Sprachkurse, jeweils mit angepasster Zeile `SPRACHE`.
- Korrekturen laufen über Lektoratsmodus → Kommentar → Lektorats-Werkzeug → Ablage → Rise.

---

## 10. Prüfen

Jeder umgebaute Code muss das Prüfscript ohne Fehler (✖) bestehen:

```bash
node rise-codes/pruefen.js
```

Hinweise (⚠) werden einzeln beurteilt und im Bericht erwähnt.
