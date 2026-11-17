# 7’rizons · Spielkonfigurator

Ein Workshopwerkzeug für Hochschullehrende: Seminarkontext festlegen, Lerntätigkeiten und Spielmechaniken wählen, priorisieren und ein druckbares Arbeitsblatt erstellen.

Created by Harald Eckmüller · Mit technischem Rückenwind von LMB.

## Vier Wege zum Arbeitsblatt

1. **Ohne KI:** feste Anleitungen, ausgewählte Mechaniken, Schreibfelder und Safety-Rahmen.
2. **Externe KI-App:** vollständigen Arbeitsauftrag kopieren/herunterladen und die JSON-Antwort nach Prüfung importieren.
3. **Eigener API-Zugang:** OpenAI, Claude oder Gemini auswählen; persönlichen API-Key ausschließlich für die Sitzung verwenden.
4. **Workshop-KI:** mit einem Workshop-Code beitreten und einen von der Administration freigeschalteten zentralen API-Zugang verwenden.

Die direkten Wege benötigen ein eingerichtetes Supabase-Backend. Eine funktionierende API-Integration bedeutet keinen allgemeinen Login über ein ChatGPT-/Claude-Chatabo. Die Anbietermodelle werden von Admins eingerichtet; die nutzende Person benötigt Zugriff auf das eingestellte Modell.

## Entwicklung

```sh
npm ci
npm run dev
npm test
npm run build
```

Die Website ist eine statische React-/Vite-Anwendung mit relativen Assetpfaden. `dist/` kann unter einem GitHub-Pages-Projektpfad bereitgestellt werden. Es werden keine externen Schriften oder Trackingdienste geladen.

Ohne `.env` läuft der lokale Modus mit Browser-Sicherung, Vorlagen, KI-Auftrag, JSON-Import, Markdown und Druckansicht. Die Oberfläche weist auf das fehlende Backend hin.

## Backend und Veröffentlichung

Siehe [DEPLOYMENT.md](DEPLOYMENT.md). Die Datenbankmigration enthält Eigentümerrechte, getrennte Adminrollen, private Entwürfe, optimistische Versionsprüfung, Workshopbeitritt, ausdrückliche Abgaben und serverseitige Generierungslimits. Schlüsselverwaltung und KI-Aufrufe laufen über Supabase Edge Functions.

Magic Link ist der normale Login. Admins können E-Mail/Passwort verwenden; die Adminrolle wird ausschließlich im Backend zugewiesen. Ein Passwortlogin allein verleiht keine zusätzlichen Rechte.

## Architektur

- `src/`: Oberfläche, Light-/Darkmode, Cloudanbindung, sichere textbasierte Arbeitsblattdarstellung.
- `supabase/functions/_shared/catalog.js`: aus dem übergebenen Claude-Artifact übernommener Katalog.
- `supabase/functions/_shared/domain.js`: versionierte Konfigurationen, Regeln, Prompt, Importvalidierung und Markdownexport; von Frontend und Backend gemeinsam verwendet.
- `supabase/functions/generate/`: direkte Anbieteraufrufe mit eigenem oder zentralem Zugang. Keine frei vorgebbaren Endpoints.
- `supabase/functions/credentials/`: nur für Admins, verschlüsselte zentrale Zugangsdaten.
- `supabase/migrations/`: Datenmodell und Zugriffsregeln.
- `tests/`: Regeln, Imports, Providerantworten, Verschlüsselung und Datenbankrechte in eingebettetem PostgreSQL.

Die KI liefert ausschließlich Inhalte, keine ausführbaren Layouts. Ausgabe und Drucklayout bestimmt die Anwendung. Persönliche API-Keys werden weder in Browser-Storage noch in Datenbank, Exporten oder Logs gespeichert. Sie werden für den konkreten Aufruf über HTTPS an die Backendfunktion und den gewählten Anbieter übertragen. Zentrale Schlüssel werden mit AES-256-GCM verschlüsselt gespeichert; der Verschlüsselungsschlüssel bleibt ein Deployment-Secret.

Private Speicherung und Workshop-Abgabe sind getrennt. Eine Abgabe erzeugt eine Kopie des ausdrücklich freigegebenen Stands. Spätere Entwurfsänderungen verändern diese Kopie nicht. Die Moderation sieht keine privaten Entwürfe. Teilnehmende können Abgaben zurückziehen; bereits exportierte Kopien werden dadurch nicht zurückgerufen.

## Darstellung und Zugänglichkeit

Hell ist die Standardeinstellung. Über „Darstellung“ sind Dunkel und Hoher Kontrast wählbar; eine bewusste Auswahl wird im Browser gespeichert. Hochkontrast verwendet größere Grundschrift, stärkere Konturen und zusätzliche sichtbare Auswahlmarkierungen. Die Original-Logodatei bleibt unverändert: Ein SVG-Ausschnitt entfernt leeren Rand, passt die Wortmarke für Dunkel an und verwendet das Symbol allein als transparentes Favicon. `node scripts/prepare-brand.mjs` erzeugt das Favicon aus der Originaldatei.

Ein Sprunglink, beschriftete Formulare, erkennbare Auswahlzustände, Fokusführung zwischen Schritten/Seiten und Statusansagen unterstützen Tastatur und Screenreader. Mechaniken lassen sich am Griff mit Hoch/Runter oder über beschriftete Buttons sortieren; nach Entfernen bleibt der Fokus in der Liste. Reduzierte Bewegung und Windows-Systemkontraste werden berücksichtigt.

Automatisierte Prüfungen decken die zentralen Schritte, Arbeitsblatt, Anmeldung und About mit axe-core und simulierten Tastaturaktionen ab. Kontrastwerte der vorgesehenen Text-/Hintergrundpaare werden separat berechnet (mindestens 4,5:1, im Hochkontrastmodus mindestens 7:1). Diese Prüfungen ersetzen keine visuelle Abnahme und keinen Test mit VoiceOver oder NVDA; eine vollständige WCAG-Konformität wird damit nicht behauptet.

## Weitere Grenzen

Die erste Version verwendet einen festen, versionierten Mechanikkatalog. Auswahlgrenzen, Kartenzahl, Anbieter-/Modellfreigaben und Workshoplimits sind administrierbar. Ein Katalogeditor und gemeinsame Livebearbeitung sind nicht enthalten.

Neue KI-Aufträge berücksichtigen aktuelle Einstellungen; bereits erstellte Arbeitsblätter behalten ihre Kartenzahl. KI-Ausgaben müssen fachlich geprüft werden. Eine abgeschnittene oder nicht zum Auftrag passende Antwort wird nicht als fertiges Arbeitsblatt übernommen. Keine automatische kostenpflichtige Wiederholung; fehlgeschlagene Versuche verbrauchen vorsorglich ebenfalls ein Aufrufkontingent. Aufruf-/Tokenlimits sind keine exakte Euro-Budgetgrenze – zusätzlich Budgetlimits beim API-Anbieter setzen.

Die erste Backendbereitstellung, Mailzustellung und reale Anbieteraufrufe benötigen eine gesonderte Abnahme mit dem gewählten Projekt und Testzugängen. Die bereitgestellten Unit-/Datenbanktests ersetzen diese Abnahme nicht.
