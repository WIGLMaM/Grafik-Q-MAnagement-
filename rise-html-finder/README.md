# Rise HTML-Finder (Chrome-Erweiterung)

Findet manuell eingebaute HTML-, Code- und Embed-Blöcke in einem Articulate-Rise-Kurs,
zeigt deren Standort (Kapitel → Lektion → Block) an, springt per Klick dorthin und
erstellt ein Protokoll (HTML oder CSV).

## Installation

1. Diesen Ordner `rise-html-finder` lokal speichern.
2. In Chrome `chrome://extensions` öffnen.
3. Oben rechts den **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** klicken und den Ordner `rise-html-finder` wählen.
5. Optional: Über das Puzzle-Symbol die Erweiterung an die Toolbar anheften.

## Bedienung

1. Den Rise-Kurs-Link öffnen (Freigabe-Link, Review-Link oder veröffentlichter Kurs).
2. Auf das Erweiterungssymbol klicken und dann auf **Kurs scannen**.
3. Die Fundstellen erscheinen nach Kapitel und Lektion gruppiert.
   Ein Klick öffnet die Lektion, scrollt zum Block und markiert ihn orange.
4. **Protokoll (HTML)** oder **Protokoll (CSV)** lädt die Liste herunter
   (Kapitel, Lektion, Block-Nr., Typ, Name, Quell-URLs, Direktlink, Code-Vorschau).

## Was erkannt wird

- Rise-Blöcke vom Typ Embed, Code oder HTML
- Blöcke, deren Inhalt `<iframe>`, `<script>`, `<style>`, `<embed>`, `<object>`, `<form>` oder `<canvas>` enthält
- Storyline-Blöcke werden bewusst ignoriert.

Die Erweiterung liest zuerst die Kursdaten der Seite (mit Kapiteln). Klappt das nicht,
kann sie sich über **Lektionen durchsuchen** durch alle Lektionen klicken und die
Seite selbst untersuchen (ohne Kapitelangabe).
