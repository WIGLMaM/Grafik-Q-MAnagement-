# TrapFinder (Chrome-Erweiterung)

Findet HTML-, Code-, Embed- und Custom-Blöcke, Storyline- und Szenario-Blöcke
sowie PDF-/Word-Dateien in einem Articulate-Rise-Kurs,
zeigt deren Standort (Kapitel → Lektion → Block) an, springt per Klick dorthin und
erstellt ein Protokoll (HTML oder CSV).

## Installation

1. Diesen Ordner `trapfinder` lokal speichern.
2. In Chrome `chrome://extensions` öffnen.
3. Oben rechts den **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** klicken und den Ordner `trapfinder` wählen.
5. Optional: Über das Puzzle-Symbol die Erweiterung an die Toolbar anheften.

## Bedienung

1. Den Rise-Kurs öffnen: im Editor (`rise.articulate.com/authoring/…`), in der Preview,
   über den Freigabe-/Review-Link oder als veröffentlichten Kurs.
   Im Editor nach dem Installieren oder Aktualisieren der Erweiterung die Seite einmal neu laden (F5).
2. Auf das Erweiterungssymbol klicken, unter **Suchen nach** die gewünschten
   Kategorien anhaken und auf **Kurs scannen** klicken. Die Auswahl bleibt gespeichert
   und lässt sich auch nach dem Scan ändern. Die Zahl in Klammern zeigt die Treffer je Kategorie.
3. Die Fundstellen erscheinen nach Kapitel und Lektion gruppiert.
   Ein Klick öffnet die Lektion, scrollt zum Block und markiert ihn orange.
4. **Protokoll (HTML)** oder **Protokoll (CSV)** lädt die Liste herunter
   (Kapitel, Lektion, Block-Nr., Typ, Name, Quell-URLs, Direktlink, Code-Vorschau).
   Das Protokoll enthält nur die ausgewählten Kategorien.

## Kategorien (einzeln auswählbar)

| Kategorie | Erkennung |
|---|---|
| Embed (iFrame) | Rise-Blöcke vom Typ Embed |
| HTML (Code-Block) | HTML, das über einen Code-Block selbst eingefügt wurde |
| Custom Block | von Rise vordefinierte Custom Blocks |
| Storyline (SL) | Storyline-Blöcke bzw. Blöcke, die auf `story.html` verweisen |
| Szenario | Rise-Szenario-Blöcke |
| PDF/Word-Dateien | Anhänge sowie Links auf `.pdf`, `.doc`, `.docx`, `.dotx`, `.rtf`, `.odt` (auch in Text und Buttons) |

Bei Storyline-Blöcken wird der Name der Storyline angezeigt. Fehlt er in den Kursdaten,
liest die Erweiterung den Titel aus der veröffentlichten `story.html`.

Die Erweiterung liest zuerst die Kursdaten der Seite (mit Kapiteln). Klappt das nicht,
kann sie sich über **Lektionen durchsuchen** durch alle Lektionen klicken und die
Seite selbst untersuchen (ohne Kapitelangabe).

## Wenn nichts gefunden wird

Unten im Popup auf **Diagnose** klicken und den Text kopieren. Er enthält nur die
technische Struktur der Seite (Adressen gekürzt, keine Kursinhalte) und hilft,
die Erkennung anzupassen.
