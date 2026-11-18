# Sprachen und Übersetzungen

Die Oberfläche ist über **DE / EN** umschaltbar. Die Wahl wird im Browser gespeichert. Beim Umschalten wird auch die Sprache für neu erstellte Arbeitsblätter gesetzt. Bereits gespeicherte Arbeitsblätter behalten ihre Sprache und Inhalte. Freie Eingaben und KI-Ergebnisse werden nicht automatisch übersetzt.

## Englische Texte anpassen

Die zentrale Datei ist `supabase/functions/_shared/locales/en.json`. Links steht der unveränderte deutsche Quelltext, rechts die englische Übersetzung. Nur die rechte Seite ändern, wenn lediglich die englische Fassung angepasst werden soll. JSON-Syntax beachten; nach Änderungen `npm test` und `npm run build` ausführen und die Website neu veröffentlichen.

Die Datei umfasst Oberfläche, Beschriftungen für Screenreader, Katalogbeschreibungen, Formularhinweise, Vorlagen und Fehlermeldungen. Platzhalter wie `{0}` müssen in der Übersetzung erhalten bleiben; ihre Reihenfolge darf angepasst werden. Technische Kennungen und gespeicherte Auswahlwerte werden nicht übersetzt. Fehlende Einträge fallen auf den deutschen Quelltext zurück.

`translate(text, language, values)` in `translations.js` ist für gemeinsam verwendete Logik vorgesehen; `t(text, values)` in `src/i18n.js` verwendet die gewählte Oberflächensprache. Neue Oberflächentexte mit `t(...)` umschließen und einen englischen Eintrag ergänzen. Fachliche Originaltexte im Fragebogen weiterhin gemäß `AGENTS.md` abstimmen.

## KI und Arbeitsblätter

Der Entwurf speichert `language` (`de` oder `en`); der KI-Auftrag übernimmt diese Sprache. Das Layout übersetzt feste Beschriftungen und Katalogtexte anhand der Sprache des Arbeitsblatts. KI-Antworten und frei eingegebene Themen bleiben unverändert. Ein anderssprachiges Arbeitsblatt wird durch eine neue Erstellung hinzugefügt.
