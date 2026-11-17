# Bereitstellung

## 1. Supabase-Projekt

Ein eigenes Projekt für den Konfigurator verwenden. Keine Migration in das bestehende Loomspun-Projekt einspielen.

1. `supabase/migrations/202611170001_workshop.sql` auf dem neuen Projekt ausführen, vorzugsweise mit Supabase CLI/Migrationsworkflow.
2. E-Mail-Anmeldung aktivieren und produktiven SMTP-Versand einrichten. Die für den Workshop benötigte Zustellmenge und Limits testen.
3. Als Site URL und erlaubte Redirect URL die tatsächliche Pages-Adresse hinterlegen, geplant: `https://lmbreuer.github.io/7rizons-spielkonfigurator/`. Für lokale Abnahme zusätzlich `http://127.0.0.1:5173/` erlauben.
4. Die beiden Adminkonten über die Supabase-Administration erstellen. Passwortvergabe und Rücksetzung durch die jeweiligen Personen durchführen lassen, nicht im Repository oder Chat ablegen.
5. Adminrollen anhand der konkreten Auth-User-IDs zuweisen. E-Mail-Adressen sind keine Rollen:

```sql
insert into public.admins(user_id) values ('AUTH-USER-UUID');
```

Normale Nutzer können diese Tabelle nicht verändern. Magic-Link- und Passwortlogin verwenden denselben Supabase-Identitätsdienst.

## 2. Edge Functions

Die Funktionen `generate` und `credentials` deployen. `supabase/config.toml` deaktiviert nur die Gateway-Prüfung; beide Handler prüfen die Sitzung selbst mit `auth.getUser`, die Schlüsselverwaltung zusätzlich die Adminrolle.

Deployment-Secrets:

- `ALLOWED_ORIGINS`: Kommagetrennte erlaubte Origins, z. B. `https://lmbreuer.github.io,http://127.0.0.1:5173`. Keine Pfade oder Wildcards.
- `CREDENTIAL_ENCRYPTION_KEY`: 32 kryptografisch zufällige Bytes, Base64-kodiert. Über die geschützte Secretverwaltung setzen. Nicht committen, ausgeben oder als Frontendvariable hinterlegen.
- Die von Supabase bereitgestellten Projekt-/Servicevariablen werden nur im Backend verwendet. Der `service_role`-Key gehört niemals in die Website.

Die Verschlüsselungsvariable dauerhaft sicher verwahren. Bei Verlust sind gespeicherte zentrale API-Keys nicht wiederherstellbar. Vor Rotation müssen zentrale Keys neu verschlüsselt bzw. neu eingegeben werden; nicht einfach nur den Deployment-Key wechseln.

Zentrale Anbieter-API-Keys werden anschließend in der Konfigurator-Administration eingegeben. Das Backend speichert nur Chiffretext mit zufälliger IV. Die Administration kann den Einrichtungsstatus sehen, aber keine Schlüssel zurücklesen. Request-/Body-Logging und externe Telemetrie für beide Funktionen deaktiviert lassen. Auch beim Debuggen keine Requestbodies, Zugangsdaten oder Header ausgeben.

## 3. Frontendkonfiguration

Für lokale Tests `.env.example` nach `.env` kopieren und ausschließlich die öffentliche Supabase-URL und den öffentlichen Publishable-/Anon-Key eintragen.

Für GitHub Actions zwei Repository-Secrets bzw. Variablen mit diesen Namen hinterlegen:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Beide Werte sind im ausgelieferten Frontend öffentlich sichtbar; Datenrechte werden durch RLS geschützt. Keine Provider- oder Service-Keys hier verwenden. Ohne beide Variablen wird bewusst nur die lokale Vorschau gebaut.

Unter Settings → Pages als Source **GitHub Actions** wählen. Der Workflow führt Tests und Build aus und veröffentlicht ausschließlich `dist/`. Die Migration und Funktionen werden separat nach Supabase deployt, nicht durch den Pages-Workflow.

## 4. Modelle und Workshops

1. Als Admin anmelden und für die gewünschten Anbieter gültige Modell-IDs eintragen. Leere IDs deaktivieren den Anbieter. Verfügbarkeit, API-Berechtigungen und Ausgabeformat je Modell prüfen.
2. Für zentrale Nutzung einen Provider-Key hinterlegen, beim Anbieter ein Kostenlimit setzen und einen Workshop anlegen.
3. Workshop-KI bewusst einschalten; standardmäßig ist sie aus.
4. Workshopcode an die vorgesehenen Teilnehmenden weitergeben. Der Code ermöglicht angemeldeten Personen den Workshopbeitritt; er ist kein API-Key. Codes vertraulich behandeln und Workshops nach Ende schließen.
5. Aufruflimit insgesamt und Stundenlimit je Person setzen. Fehlversuche zählen mit. Bereits abgeschickte Provideraufrufe können auch bei Timeout Kosten verursachen.

## 5. Abnahme vor dem Workshop

- Zwei echte Teilnehmerkonten sowie ein Admin: fremde Entwürfe unsichtbar, Abgaben nur für eigene Person und Moderation sichtbar.
- Magic Link auf zweitem Gerät und erlaubte Rücksprungadresse testen.
- Privaten Entwurf speichern, neu laden, auf anderem Gerät fortsetzen; parallele Änderung muss einen Versionskonflikt melden.
- Alle vier Arbeitsblatt-Wege mit realistischem Seminarthema durchlaufen. Eigene Keys dürfen in keiner Sicherungsdatei erscheinen.
- Je aktiviertem Anbieter einen echten Aufruf testen; Loginfehler, abgelehntes Modell, Kontingentlimit und Timeout prüfen.
- Workshopcode, zentrale Freigabe, Limits, ausdrückliche Abgabe und Zurückziehen testen.
- Light-/Darkmode, Mobilansicht, Tastatur, Markdown und A4-Druck visuell prüfen.
- Datenschutzangaben mit dem tatsächlich gewählten Backend/Anbietern abgleichen. Das Impressum verwendet auf Wunsch dieselben Betreiberangaben wie Loomspun.

## Aufbewahrung und Betrieb

Entwürfe bleiben bis zur Löschung durch ihre Eigentümer gespeichert. Abgaben bleiben bis zum Zurückziehen oder einer vereinbarten administrativen Bereinigung gespeichert; noch keine automatische Löschfrist implementiert. `generation_attempts` enthalten nur Nutzer-/Workshopkennungen und Zeitpunkte, keine Prompts oder Schlüssel. Für längerfristigen Betrieb eine passende serverseitige Bereinigung dieser Zähler und alter Workshopdaten einrichten; laufende Gesamtlimits dürfen dabei nicht versehentlich zurückgesetzt werden.

Regelmäßige Datenbanksicherung und Wiederherstellbarkeit des Verschlüsselungskeys gehören zum Betrieb. Der technische Prototyp ist kein Nachweis einer durchgeführten Datenschutz- oder Produktionsabnahme.
