# Supabase einrichten – Schritt für Schritt

Für den 7’rizons-Spielkonfigurator auf https://lmbreuer.github.io/7rizons-spielkonfigurator/.

Stand: 18. November 2026. Das Frontend und der Backendcode sind vorbereitet. Hier ist kein Supabase-Connector und keine angemeldete Supabase-CLI verfügbar; ein Projekt wurde deshalb noch nicht angelegt. Die folgenden Schritte führst du mit deinem Supabase-Konto aus. Die bestehende Loomspun-Datenbank bleibt unberührt.

## 1. Ein eigenes Projekt anlegen

1. Öffne [Supabase Dashboard](https://supabase.com/dashboard) und melde dich an.
2. Wähle **New project**, deine Organisation und beispielsweise den Namen `7rizons-spielkonfigurator`.
3. Lege ein starkes Datenbankpasswort fest und speichere es im Passwortmanager. Für den Workshop eine passende europäische Region wählen. Prüfe den ausgewählten Tarif, bevor du das Projekt anlegst.
4. Warte, bis das Projekt bereit ist. Die **Project Reference** findest du in den Projekteinstellungen und in der Dashboard-URL: `https://supabase.com/dashboard/project/PROJECT_REF`.

## 2. Terminal anmelden und Datenbank einspielen

Öffne Terminal. Jeder Codeblock ist ein eigener Schritt. Platzhalter `DEINE_PROJECT_REF` durch die gerade gefundene Project Reference ersetzen.

```sh
cd '/Users/lmb-privat/Documents/ChatGPT/7rizons Spielkonfigurator'
```

```sh
npx supabase login
```

Folge der Browseranmeldung. Zugangstokens nicht in diesen Chat kopieren.

```sh
npx supabase link --project-ref DEINE_PROJECT_REF
```

Falls nach dem Datenbankpasswort gefragt wird, das Passwort aus Schritt 1 verwenden.

```sh
npx supabase db push --dry-run
```

Es müssen die Projektmigrationen in Reihenfolge erscheinen, darunter `202611170001_workshop.sql` und `202611180001_worksheet_collection.sql`. Die erste richtet Tabellen und Rechte ein; die zweite ermöglicht mehrere private Arbeitsblätter und teilt bei Abgabe nur das ausgewählte Ergebnis.

```sh
npx supabase db push
```

Die Datenbank ist anschließend eingerichtet. Dieselben SQL-Dateien nicht zusätzlich von Hand ausführen. Spätere Aktualisierungen verwenden wieder `db push`; bereits angewendete Migrationen werden übersprungen. Details: [Supabase Deployment](https://supabase.com/docs/guides/deployment/database-migrations).

## 3. Anmeldung und Rücksprungadresse konfigurieren

Im Dashboard unter **Authentication**:

1. Unter **Sign In / Providers** den E-Mail-Provider aktivieren und neue Registrierungen erlauben, wenn Teilnehmende sich selbst anmelden sollen.
2. Unter **URL Configuration** als **Site URL** eintragen:

```text
https://lmbreuer.github.io/7rizons-spielkonfigurator/
```

3. Dieselbe vollständige Adresse unter **Redirect URLs** hinzufügen. Für lokale Tests zusätzlich `http://127.0.0.1:5173/` erlauben. Auf das abschließende `/` achten.
4. Unter **Email / SMTP Settings** eigenen Mailversand konfigurieren: Host, Port, Benutzername, Passwort und verifizierte Absenderadresse von deinem Mailanbieter. Dessen Einrichtung/Domainverifikation abschließen.
5. Zustelllimits auf die erwartete Workshopgröße abstimmen und einen Magic Link an eine externe Testadresse schicken.

Der eingebaute Supabase-Mailversand ist für Workshopteilnehmende nicht ausreichend: Ohne eigenes SMTP ist der Empfängerkreis beschränkt. Die Einstellungen sind in der [SMTP-Anleitung](https://supabase.com/docs/guides/auth/auth-smtp) beschrieben. Die [Magic-Link-Dokumentation](https://supabase.com/docs/guides/auth/auth-email-passwordless) und [Redirect-Dokumentation](https://supabase.com/docs/guides/auth/redirect-urls) erklären die erlaubten Rücksprungadressen.

## 4. Zwei Admins einrichten

1. Unter **Authentication → Users** die beiden Adminpersonen anlegen/einladen. Jede Person verwendet ein eigenes Konto. Nach der Rollenzuweisung meldet sie sich mit einem Magic Link an und setzt optional unter **Konto → Passwort für den Adminzugang setzen oder ändern** ihr Passwort selbst.
2. Die jeweilige User-ID (UUID) kopieren.
3. Im **SQL Editor** folgende Anweisung mit den beiden tatsächlichen IDs ausführen:

```sql
insert into public.admins (user_id)
values ('ERSTE-AUTH-USER-UUID'), ('ZWEITE-AUTH-USER-UUID')
on conflict do nothing;
```

Nur diese Benutzer haben Adminrechte. E-Mail/Passwort allein verleiht keine Adminrolle. Normale Teilnehmende verwenden Magic Links.

## 5. Edge-Function-Secrets hinterlegen

Im Dashboard **Edge Functions → Secrets** öffnen und diese Werte setzen:

| Name                        | Wert                                                |
| --------------------------- | --------------------------------------------------- |
| `ALLOWED_ORIGINS`           | `https://lmbreuer.github.io,http://127.0.0.1:5173`  |
| `CREDENTIAL_ENCRYPTION_KEY` | Ein eigener, zufälliger 32-Byte-Schlüssel in Base64 |

Origins haben keine Unterpfade und keinen abschließenden Schrägstrich. Keine Wildcards hinzufügen.

Auf deinem Mac erzeugt folgender Befehl den Verschlüsselungsschlüssel direkt in der Zwischenablage, ohne ihn im Terminal auszugeben:

```sh
openssl rand -base64 32 | pbcopy
```

Den Wert in einem geschützten Passwortmanager sichern und in `CREDENTIAL_ENCRYPTION_KEY` einfügen. Er ist für die Wiederherstellung zentraler Providerzugänge nötig. Nicht ins Repository, Notion oder in den Chat kopieren. Danach die Zwischenablage überschreiben.

Supabase stellt die eigenen Backendvariablen automatisch bereit. Einen `service_role`-Schlüssel niemals in GitHub-Frontendvariablen eintragen. Die Anbieter-API-Keys werden später ausschließlich in der App-Administration oder für den einzelnen Aufruf durch Teilnehmende eingegeben. [Supabase Secrets](https://supabase.com/docs/guides/functions/secrets).

## 6. Funktionen veröffentlichen

Im Projektordner im Terminal:

```sh
npx supabase functions deploy generate
```

```sh
npx supabase functions deploy credentials
```

Die lokale `supabase/config.toml` setzt für beide Funktionen `verify_jwt = false`. Das ist beabsichtigt: Die Funktionen prüfen die Benutzersitzung selbst mit `auth.getUser`; die Schlüsselverwaltung prüft zusätzlich die Adminrolle. Keine Auth-Prüfung im Handler entfernen. [Supabase Functions Deployment](https://supabase.com/docs/guides/functions/deploy).

## 7. GitHub Pages mit dem Backend verbinden

1. Im Supabase-Projekt unter **Connect / API Keys** die **Project URL** und den öffentlichen **Publishable Key** bzw. Legacy-**anon key** kopieren. Keinen Secret Key verwenden.
2. Öffne [Repository-Secrets](https://github.com/LMBreuer/7rizons-spielkonfigurator/settings/secrets/actions).
3. Mit **New repository secret** genau zwei Secrets anlegen:

| Name                     | Wert                                                    |
| ------------------------ | ------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Die Project URL `https://DEINE_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Der öffentliche Publishable-/anon-Key                   |

4. Unter [Actions](https://github.com/LMBreuer/7rizons-spielkonfigurator/actions) den Workflow **Test and deploy GitHub Pages** wählen, **Run workflow**, Branch `main`.
5. Warten, bis Build und Deployment grün sind. Dann die Website neu laden.

Die zwei Werte sind im Browser öffentlich sichtbar. Datenschutz und Zugriffsschutz beruhen auf den eingerichteten Datenbankrechten, nicht auf der Geheimhaltung dieses öffentlichen Schlüssels.

## 8. Modelle konfigurieren und Funktionen prüfen

1. Auf der Website **Anmelden → Administrationszugang** und mit einem Admin anmelden.
2. In der Administration für jeden gewünschten Anbieter eine Modell-ID eintragen, für die die Teilnehmenden API-Zugriff besitzen. Leere Modell-IDs deaktivieren den Anbieter. Aktuelle verfügbare Modelle beim jeweiligen Anbieter prüfen.
3. Mit zwei normalen Testkonten Magic Link, privaten Entwurf speichern, neu laden und löschen testen. Konto B darf Entwürfe von Konto A nicht sehen, auch ein Admin sieht keine privaten Entwürfe.
4. Mit einem eigenen Test-API-Key je freigegebenem Anbieter einen kleinen Aufruf durchführen. Die Anbieter rechnen API-Nutzung separat von Chat-Abos ab.
5. Mehrere Arbeitsblätter ohne KI und mit KI erstellen, zwischen ihnen wechseln und eines löschen. Ein fehlerhafter KI-Aufruf muss die bisherigen Ergebnisse erhalten.
6. Workshop in der Administration anlegen, Code an das Testkonto geben und eine ausdrückliche Abgabe testen. Nur das ausgewählte aktuelle Arbeitsblatt darf bei der Moderation erscheinen. Danach Zurückziehen testen.
7. Workshop-KI bleibt in der öffentlichen Auswahl vorerst ausgeblendet. Für eigene API-Zugänge ist kein zentraler Anbieter-Key nötig. Eine spätere zentrale Freigabe erfordert zusätzlich Kostenlimits beim Anbieter und die bewusste Aktivierung in der App.

Vor dem echten Workshop: Zustellung mit realer Teilnehmerzahl prüfen, konkrete Betriebs-/Aufbewahrungsangaben im Datenschutzhinweis ergänzen und gedrucktes Arbeitsblatt prüfen. Die genaue technische Betriebsbeschreibung steht in [DEPLOYMENT.md](DEPLOYMENT.md).

## Wenn etwas nicht funktioniert

- **Keine Mail:** SMTP-Verifikation, Spam, Supabase Auth Logs und Versandlimits prüfen.
- **Rücksprung zu localhost:** Site URL und Redirect URLs aus Schritt 3 korrigieren.
- **Login weiterhin deaktiviert:** Beide GitHub-Secrets und einen neuen erfolgreichen Pages-Build prüfen.
- **Function-Aufruf scheitert:** Deployment beider Funktionen, `ALLOWED_ORIGINS`, gültige Sitzung und Modellfreigabe prüfen. Keine API-Keys, Auth-Header oder Requestbodies in Logs ausgeben.
- **Speichern/Abgabe scheitert:** Beide Migrationen angewendet? Tabellen/RPCs nicht manuell durch unsichere Freigaben ersetzen.
