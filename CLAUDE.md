# Projekt

Dieses Repository enthält zwei Teile:

- `trapfinder/`: Chrome-Erweiterung «TrapFinder»
- `rise-codes/`: mehrsprachige HTML-Codes (Grafiken, Interaktionen) für Articulate Rise, mit Lektoratsmodus und Lektorats-Werkzeug

Kommunikation auf Deutsch (Schweiz, «ss» statt «ß»).

## Rise-Codes

- Alle Regeln: `rise-codes/vorgaben/VORGABEN.md`
- Umbau neuer Codes: Skill `rise-code-umbau` (`.claude/skills/rise-code-umbau/SKILL.md`)
- Corporate Design (Farben, Schrift, Textgrössen): nur in `rise-codes/vorgaben/bausteine/corporate-design.css`
- Fertige Codes: `rise-codes/codes/`, Originale: `rise-codes/eingang/`
- Prüfen: `node rise-codes/pruefen.js`, Bausteine in allen Codes erneuern: `node rise-codes/pruefen.js --aktualisieren`
- Bausteine im Code nie von Hand ändern. Jeder Code muss das Prüfscript ohne Fehler bestehen.
