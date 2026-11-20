# Rise HTML-Finder (Chrome-Erweiterung)

Findet manuell eingebaute HTML-, Code- und Embed-Blöcke sowie Storyline- und
Szenario-Blöcke in einem Articulate-Rise-Kurs,
zeigt deren Standort (Kapitel → Lektion → Block) an, springt per Klick dorthin und
erstellt ein Protokoll (HTML oder CSV).

## Installation

1. Diesen Ordner `rise-html-finder` lokal speichern.
2. In Chrome `chrome://extensions` öffnen.
3. Oben rechts den **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** klicken und den Ordner `rise-html-finder` wählen.
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
| Code-/HTML-Block | Rise-Blöcke vom Typ Code bzw. eigener HTML-Code |
| HTML im Inhalt | andere Blöcke, deren Inhalt `<iframe>`, `<script>`, `<style>`, `<embed>`, `<object>`, `<form>` oder `<canvas>` enthält |
| Storyline (SL) | Storyline-Blöcke bzw. Blöcke, die auf `story.html` verweisen |
| Szenario | Rise-Szenario-Blöcke |

Die Erweiterung liest zuerst die Kursdaten der Seite (mit Kapiteln). Klappt das nicht,
kann sie sich über **Lektionen durchsuchen** durch alle Lektionen klicken und die
Seite selbst untersuchen (ohne Kapitelangabe).

## Wenn nichts gefunden wird

Unten im Popup auf **Diagnose** klicken und den Text kopieren. Er enthält nur die
technische Struktur der Seite (Adressen gekürzt, keine Kursinhalte) und hilft,
die Erkennung anzupassen.
