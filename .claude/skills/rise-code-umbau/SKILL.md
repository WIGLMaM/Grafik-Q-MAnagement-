---
name: rise-code-umbau
description: Baut HTML-Codes (Grafiken, Interaktionen) für Articulate Rise nach dem verbindlichen System um - mehrsprachig (DE, FR-CH, IT-CH, EN-GB) mit Sprachblock, Corporate Design, Lektoratsmodus und Stand - und prüft sie. Verwenden, wenn ein HTML-Code für Rise hochgeladen, eingefügt oder in rise-codes/eingang/ abgelegt wird, wenn ein Code «umgebaut», «übersetzt», «nach dem System» angepasst werden soll, oder wenn die Bausteine bzw. das Corporate Design in allen Codes aktualisiert werden sollen.
---

# Rise-Codes umbauen

Ziel: Ein bestehender (deutscher) HTML-Code für Rise wird zu einem Code nach dem System. Er enthält alle vier Sprachen, nutzt das Corporate Design, hat den Lektoratsmodus und besteht das Prüfscript ohne Fehler.

Kommunikation mit dem Benutzer auf Deutsch (Schweiz, «ss» statt «ß»).

## 1. Vorgaben laden (immer zuerst)

Lies vollständig, bevor du etwas umbaust:
- `rise-codes/vorgaben/VORGABEN.md`: alle Regeln, inkl. Glossar
- `rise-codes/vorgaben/bausteine/corporate-design.css`: verfügbare `--cd-…`-Variablen
- `rise-codes/codes/vier-fragen.html`: Mustercode, an dem du dich bei Aufbau und Stil orientierst
- `rise-codes/vorgaben/vorlage.html`: minimale Vorlage

Die Bausteine (`sprachsystem.html`, `corporate-design.css`, `lektoratsmodus.html`) werden **wörtlich** eingefügt und nie verändert.

## 2. Eingang

- Codes kommen als hochgeladene Datei, als eingefügter Text oder liegen in `rise-codes/eingang/`.
- Lege jedes Original unverändert in `rise-codes/eingang/` ab (falls es nicht schon dort liegt). Es dient als Referenz.
- Bei mehreren Codes: jeden einzeln nach den Schritten 3 bis 7 umbauen, am Schluss ein gemeinsamer Bericht.

## 3. Analysieren

Bevor du schreibst, halte für dich fest:
- alle sichtbaren und unsichtbaren Texte (inkl. Texte im JavaScript, Rückmeldungen, `aria-label`, `alt`, `title`, `placeholder`)
- das Verhalten (Klicks, Akkordeons, Tabs, Drag & Drop, Quiz-Logik …) und welche Inhalte erst nach einer Aktion sichtbar werden
- verwendete Farben, Schriften und Schriftgrössen
- den Titel → `CODE_ID` gemäss VORGABEN Abschnitt 6

Ist ein Code bereits nach dem System gebaut (hat `CODE_ID` und Bausteine), nicht neu umbauen, sondern nur prüfen und fehlende Sprachen bzw. veraltete Bausteine ergänzen.

## 4. Umbauen

Aufbau exakt in der Reihenfolge von VORGABEN Abschnitt 3.

**Einstellungen:** `SPRACHE = 'de'`, `CODE_ID`, `STAND = 'TT.MM.JJJJ · Umbau'` (heutiges Datum).

**Sprachblock:**
- Deutsche Texte **wörtlich** aus dem Original übernehmen. Nichts umformulieren, nichts korrigieren. Auffälligkeiten nur im Bericht melden.
- Schlüssel gemäss VORGABEN Abschnitt 5. Wiederkehrende Elemente als Listen.
- Übersetzungen FR-CH, IT-CH, EN-GB gemäss VORGABEN Abschnitt 2 und Glossar. Ähnliche Länge wie das Deutsche.
- Texte mit Nummern als Platzhalter `{n}` und im HTML `data-n`.

**HTML und Logik:**
- Struktur, Klassen und Verhalten des Originals möglichst beibehalten.
- Texte aus dem HTML entfernen und durch `data-key` ersetzen (bzw. `data-key-aria-label` usw.).
- Dynamisch erzeugte Texte im JavaScript über Schlüssel lösen: Element mit `data-key` erzeugen und `renderEl(el)` bzw. `renderAll()` aufrufen, oder `fein(rawText('schluessel'))` verwenden. Nie Texte als Strings im JavaScript.
- `const LABELS = { … }` mit lesbaren Namen für alle Schlüsselteile.
- Am Ende des Aufbaus `renderAll()`.

**Design:**
- Corporate-Design-Baustein als Erstes im `<style>`. Ein eigener `@import` für Schriften fällt weg.
- Alle Farben, Schriften, Schriftgrössen und Schriftstärken auf die passendste `var(--cd-…)` abbilden. SVG-Farben über `style="fill:…"` / `style="stroke:…"`.
- Passt eine Originalfarbe zu keiner CD-Farbe, die nächstliegende wählen und im Bericht melden.
- Layout-Masse (Abstände, Breiten) bleiben, eigene Variablen sind erlaubt.

**Lektoratsmodus:**
- CSS mit `body.lektorat …` ergänzen, damit im Lektoratsmodus alle Texte sichtbar sind: Akkordeons offen, Rückseiten sichtbar, Tabs untereinander, Rückmeldungen eingeblendet.

## 5. Speichern

- Datei: `rise-codes/codes/<CODE_ID>.html`
- Existiert dort schon ein Code mit diesem Namen, nicht überschreiben, sondern beim Benutzer nachfragen.

## 6. Prüfen

```bash
node rise-codes/pruefen.js rise-codes/codes/<CODE_ID>.html
```

- Alle Fehler (✖) beheben und erneut prüfen, bis keine mehr übrig sind.
- Hinweise (⚠) beurteilen: beheben, was ein echtes Problem ist. Den Rest im Bericht begründen (z. B. «Text erscheint erst nach Klick: korrekt»).
- Zusätzlich Original und umgebauten Code im Browser vergleichen (Playwright, Screenshot je auf Deutsch). Das Aussehen muss gleich bleiben, abgesehen von bewussten CD-Anpassungen. Den Lektoratsmodus einmal einschalten und anschauen.

## 7. Bericht an den Benutzer

Kurz und auf Deutsch:
- welche Codes umgebaut wurden (Datei, `CODE_ID`, Anzahl Texte)
- Prüfergebnis
- Abweichungen: Farben ohne passende CD-Farbe, geänderte Darstellung
- Fachbegriffe, die nicht im Glossar stehen, mit den gewählten Übersetzungen als Tabelle. Ins Glossar erst nach Bestätigung aufnehmen.
- Auffälligkeiten im deutschen Original (Tippfehler usw.), unverändert gelassen
- Hinweis: Code in die Ablage übernehmen und in alle vier Sprachkurse einfügen (Zeile `SPRACHE` anpassen)

Danach auf dem Arbeits-Branch committen und pushen.

## Bausteine oder Corporate Design aktualisieren

Wenn der Benutzer Farben, Schrift oder Textgrössen geändert hat oder die Bausteine in allen Codes aktualisieren möchte:

```bash
node rise-codes/pruefen.js --aktualisieren
```

Das ersetzt die Bausteine in allen Codes in `rise-codes/codes/` und setzt einen neuen Stand. Danach melden, welche Codes geändert wurden. Diese müssen in die Ablage und in alle Sprachkurse übernommen werden.

Neue `--cd-…`-Variablen nur auf ausdrücklichen Wunsch einführen und dann in VORGABEN Abschnitt 1 dokumentieren.
