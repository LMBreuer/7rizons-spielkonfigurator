# Abgleich mit dem Original

Referenzen: bereitgestelltes `seminar-hack-tool.tsx`, Screenshot von Schritt 4 und `BEISPIELMDAUSORIGINAL7rizons-hack-Test-Linguistik.md`. Die Originaldateien bleiben unverändert. Der öffentliche Claude-Link war über den Webzugriff nicht erreichbar; ein interaktiver Browservergleich konnte wegen ausgefallener Browseranbindung nicht stattfinden.

## Fragebogen und Übersicht

- Alle neun Lernerlebnisse, alle 24 Mechaniken, ihre Beschreibungen, Kurztexte, Gruppen, Kern-/Basis-/Pflichtmarkierungen, Gewichtungen und Konfliktregeln sind aus dem Original übernommen. Ein lokaler Test vergleicht die vollständigen Katalogobjekte mit dem Artifact; CI schützt den abgeglichenen Katalog zusätzlich über seinen Hash.
- Schritt 1 und 2 behalten deutsche Originalfragen und Ansprache. Datum und Semester ergänzen die ausdrücklich gewünschten Eingabehilfen; Auswahlgrenzen bleiben administrierbar.
- Schritt 3 zeigt passende Mechaniken zuerst, weitere nach Lernerlebnissen gruppiert. Kategorien sind aufklappbar, Auswahlstände und Relevanzmarkierungen bleiben sichtbar.
- Schritt 4 enthält wieder beide Originalbereiche: „Im Basisspiel vorhanden“ und „Hauptanpassungen ↕ sortierbar“. Der Safety-Rahmen ist immer enthalten. Basiselemente werden durch Aktivieren zu Hauptanpassungen. Abgewählte Hauptanpassungen bleiben wieder anwählbar; abgewählte Basiselemente kehren in den oberen Bereich zurück.
- Hauptanpassungen werden wie im Original einem Lernerlebnis zugeordnet: gewählte primäre Zuordnung, dann gewählte unterstützende, dann primäre Katalogzuordnung. Lernerlebnisgruppen und Mechaniken innerhalb einer Gruppe sind sortierbar. Tastatur/Pfeile ergänzen Drag-and-drop. Priorität, Kandidaten und endgültige Auswahl werden getrennt gespeichert und im KI-Auftrag berücksichtigt.

## Arbeitsblatt

Das Original liefert frei formuliertes Markdown. Die Webapp verwendet validiertes JSON für Inhalte und ein festes Layout. Der Prompt ist daher angepasst und nicht wortgleich mit dem ursprünglichen Claude-Prompt. Er übernimmt dessen Arbeitsauftrag: vollständige Seminaranleitung, Einleitung, Mechanikerklärung und konkrete Anpassung, Kartenbeispiele, Beitrag zu Lerntätigkeiten, Basiselemente, Safety und nächste Schritte. Die Sprache folgt der ausgewählten Ausgabeversion. Der Original-Abschlusstext bleibt enthalten.

Die Abschnitte „Neue Mechaniken“, „Basisspiel-Elemente gezielt nutzen“, „Safety-Rahmen“ und „Nächste Schritte“ erscheinen auch in Webansicht/Markdown. Aktivierte Basiselemente werden wie im Original unter den Hauptanpassungen behandelt. Schreibfelder ersetzen die ursprünglichen `{{KARTEN:N}}`-Marker. Anders als beim Original wird ihre Zahl durch die Einstellung bestimmt statt von der KI frei gesetzt. Jede KI-Ausgabe bleibt fachlich zu prüfen; das bereitgestellte Beispiel ist ein Vergleich, kein garantierter identischer Modelloutput.

Die Webapp sendet wie in der bestehenden Datenschutzbeschreibung Thema, Fach und Spielkonfiguration an die KI. Andere organisatorische Kontextangaben stehen im Arbeitsblatt, aber nicht im KI-Auftrag. Persönliche API-Keys gelangen weder in Sicherungen noch Arbeitsblätter.

Mehrere Arbeitsblätter pro Konfiguration sind eine gewünschte Erweiterung. Jede Version bewahrt ihre eigene Konfiguration, Sprache, Herkunft und Kartenzahl. Frühere Versionen bleiben exportierbar. Neue Erstellungen überschreiben sie nicht.
