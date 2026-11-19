import React from "react";
import { t } from "./i18n.js";

export const INFO_PAGES = {
  legal: "Impressum",
  privacy: "Datenschutz",
  help: "Hilfe & Nutzung",
};

function ContactDetails() {
  return (
    <address className="info-address">
      Dr. Ludwig M. Breuer
      <br />
      Bgm.-Rohmüller-Str. 7 · 86554 Pöttmes
      <br />
      <a href="mailto:info@lmbreuer.de">info@lmbreuer.de</a>
    </address>
  );
}

function PrivacyInfo({ online }) {
  return (
    <>
      <p>{t("Verantwortlich für den Spielkonfigurator")}</p>
      <ContactDetails />
      <h2>{t("Was wird wo gespeichert?")}</h2>
      <ul>
        <li>
          <strong>{t("Im Browser.")}</strong>{" "}
          {t(
            "Deine eingegebenen Seminardaten, Spielauswahl, Arbeitsblätter und Kartentexte werden automatisch in diesem Browser gespeichert. Dazu kommen die Darstellungs- und Spracheinstellungen, bei Anmeldung die Sitzung und bei einer offenen Workshop-Einladung der Code. Browserdaten kannst du in den Einstellungen des Browsers löschen. Eine heruntergeladene JSON-Datei bleibt bei dir.",
          )}
        </li>
        <li>
          <strong>{t("Beim Besuch der Website.")}</strong>{" "}
          {t(
            "GitHub Pages liefert die Website aus und protokolliert IP-Adressen zur Absicherung des Dienstes. Der Konfigurator bindet keine Analysedienste ein.",
          )}
          {online &&
            " " +
              t(
                "Die Website lädt außerdem öffentliche Konfigurator-Einstellungen von Supabase. Dabei fallen technische Zugriffsdaten an.",
              )}{" "}
          <a href="https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection">
            {t("Datenerfassung bei GitHub Pages")}
          </a>
        </li>
        {online && (
          <>
            <li>
              <strong>{t("Bei der Anmeldung.")}</strong>{" "}
              {t(
                "Supabase verarbeitet deine E-Mail-Adresse, eine Konto-ID und technische Anmeldedaten, damit du dich anmelden und auf deine Online-Projekte zugreifen kannst. Der Mailversanddienst erhält die Adresse für den Versand des Magic Links. Die Hauptdatenbank des Projekts liegt in Irland.",
              )}
            </li>
            <li>
              <strong>{t("Beim Online-Speichern.")}</strong>{" "}
              {t(
                "Der gespeicherte Stand umfasst deine Eingaben, Auswahl, Arbeitsblätter und Kartentexte, gegebenenfalls einen vorbereiteten KI-Auftrag sowie Projekt-ID, Version und Änderungszeitpunkt. Der Stand ist deinem Konto zugeordnet. Die Superadministration sieht Projekttitel und Änderungsdatum. Für eine Freigabeanfrage kann sie einen Mailentwurf an deine Konto-Adresse öffnen. Eine Kopie der Inhalte erhält sie nach bestätigter Freigabe.",
              )}
            </li>
          </>
        )}
      </ul>
      {!online && (
        <p>
          {t(
            "In dieser Vorschau sind Anmeldung, Online-Speichern, Workshop-Freigaben und direkte KI-Aufrufe deaktiviert.",
          )}
        </p>
      )}
      {online && (
        <>
          <h2>{t("Wer sieht einen freigegebenen Stand?")}</h2>
          <ul>
            <li>
              {t(
                "Wenn du ein Projekt einem Workshop zuordnest, sieht dessen Moderation den Titel und das Änderungsdatum. Bei einer Abgabe erhält sie zusätzlich eine Kopie des ausgewählten Arbeitsblatts samt Kontextangaben.",
              )}
            </li>
            <li>
              {t(
                "Wer einen von dir erstellten Freigabelink hat, kann den freigegebenen Projektstand samt Arbeitsblättern ohne Anmeldung ansehen, herunterladen oder als eigenes Projekt übernehmen.",
              )}
            </li>
          </ul>
          <p>
            {t(
              "Du kannst Freigaben widerrufen und Abgaben zurückziehen. Bereits heruntergeladene oder übernommene Kopien bleiben bei den Empfänger:innen.",
            )}
          </p>
        </>
      )}
      <h2>{t("Was wird an KI-Anbieter übermittelt?")}</h2>
      <p>
        {t(
          "Bei einem direkten KI-Aufruf bekommt der ausgewählte Anbieter OpenAI, Anthropic (Claude) oder Google (Gemini) den Auftrag mit Thema, Fach, Lerntätigkeiten und gewählten Spielmechaniken. Die Felder für Name der Lehrveranstaltung, Dozent:in, Semester und Datum sowie deine vorhandenen Kartentexte gehen nicht in den Auftrag ein. Verwende auch in Thema und Fach keine vertraulichen oder personenbezogenen Angaben, die der Anbieter nicht erhalten soll.",
        )}
      </p>
      <p>
        {t(
          "Deinen für eine Sitzung eingegebenen API-Key verwendet das Backend für den Aufruf. In der Administration hinterlegte Keys werden verschlüsselt gespeichert. Zur Durchsetzung der Kontingente erfasst der Konfigurator Zeitpunkt, Konto-ID und gegebenenfalls die Workshop-ID eines Generierungsversuchs. Welche Daten der Anbieter weiterverarbeitet und wie lange er sie aufbewahrt, hängt vom Anbieter und den Kontoeinstellungen ab.",
        )}
      </p>
      <p>
        {t(
          "Bei „Mit deiner KI-App“ kopierst oder lädst du den Auftrag selbst herunter und entscheidest, wem du ihn sendest. „Ohne KI“ erstellt das Arbeitsblatt aus Vorlagen, ohne einen KI-Anbieter aufzurufen.",
        )}
      </p>
      {online && (
        <>
          <h2>{t("Löschung und deine Rechte")}</h2>
          <p>
            {t(
              "Online-Projekte bleiben bis zur Löschung unter „Mein Zugang → Meine Entwürfe“ gespeichert. Workshop-Abgaben bleiben bis zum Zurückziehen oder zur administrativen Bereinigung gespeichert. Das Konto und die Generierungszähler bleiben bis zur Kontolöschung oder administrativen Bereinigung bestehen. Für die Löschung deines Kontos wende dich an die oben genannte Adresse.",
            )}
          </p>
        </>
      )}
      <p>
        {t(
          "Du kannst dich für Auskunft, Berichtigung und Löschung an die oben genannte Adresse wenden. Je nach Voraussetzungen kannst du die Verarbeitung einschränken lassen, ihr widersprechen oder deine Daten übertragen lassen. Du kannst dich bei einer Datenschutzaufsichtsbehörde beschweren.",
        )}{" "}
        <a href="https://www.lda.bayern.de/de/beschwerde.html">
          {t("Datenschutzbeschwerde (BayLDA)")}
        </a>
      </p>
    </>
  );
}

function HelpInfo() {
  return (
    <>
      <h2>{t("Vom Seminarthema zum Arbeitsblatt")}</h2>
      <ol>
        <li>
          {t(
            "Gib den Seminarkontext ein, wähle Lerntätigkeiten und Mechaniken und lege ihre Reihenfolge in der Übersicht fest.",
          )}
        </li>
        <li>
          {t(
            "Erstelle in Schritt 5 ein Arbeitsblatt. Mit „Ohne KI“ kannst du direkt starten. Über „Kopie ausfüllen“ schreibst du deine Kartenideen in eine Arbeitskopie.",
          )}
        </li>
        <li>
          {t(
            "Über „Projektverwaltung“ kannst du dein ganzes Projekt als JSON-Datei herunterladen und später wieder importieren. Am Arbeitsblatt öffnet „Drucken“ die A4-Druckvorschau des Browsers. Dort kannst du das Blatt auch als PDF speichern. Im Drei-Punkte-Menü findest du den Markdown-Export.",
          )}
        </li>
      </ol>
      <h2>{t("Online speichern, am Workshop teilnehmen und teilen")}</h2>
      <p>
        {t(
          "Melde dich über „Anmelden“ per E-Mail an, wenn du auf einem anderen Gerät weiterarbeiten möchtest. Speichere über „Online speichern“ und öffne den Stand dort unter „Mein Zugang → Meine Entwürfe“.",
        )}
      </p>
      <p>
        {t(
          "Öffne deinen Einladungslink oder scanne den QR-Code und bestätige den Workshopbeitritt. Einen Zugangscode kannst du unter „Mein Zugang“ eingeben. Danach kannst du in der Projektverwaltung ein Projekt zuordnen oder in Schritt 5 ein Arbeitsblatt ausdrücklich abgeben. Wenn Workshop-KI freigeschaltet ist, kannst du nach dem Beitritt diesen Zugang nutzen.",
        )}
      </p>
      <p>
        {t(
          "Für die Weitergabe außerhalb eines Workshops öffne „Projektverwaltung → Projekt per Link teilen“. Der Link verweist auf den Stand beim Erstellen des Links. Du kannst ihn dort kopieren, durch einen neuen ersetzen oder widerrufen.",
        )}
      </p>
      <h2 id="urheberrecht">{t("Urheberrecht und Nutzungsrechte")}</h2>
      <p>
        {t(
          "Durch Speichern oder Teilen im Konfigurator überträgst du keine Urheberrechte an deinen eigenen Beiträgen. Prüfe bei fremden Texten, Bildern oder Vorlagen, ob eine Lizenz, eine Erlaubnis oder eine gesetzliche Ausnahme die beabsichtigte Nutzung abdeckt. Beachte dabei auch Vorgaben zur Namensnennung und Quellenangabe.",
        )}
      </p>
      <p>
        {t(
          "Ein Freigabelink ermöglicht den technischen Zugriff auf einen Stand. Ob du Inhalte daraus weiterveröffentlichen, bearbeiten oder weitergeben darfst, richtet sich nach den Rechten und Lizenzen an diesen Inhalten. Prüfe vor der Weitergabe auch KI-Vorschläge auf mögliche Rechte Dritter.",
        )}
      </p>
      <h2 id="ki">{t("KI-Hinweis")}</h2>
      <p>
        {t(
          "Für die Entwicklung des ursprünglichen Spielkonfigurators und seine Umsetzung als Webapp wurde generative KI eingesetzt. Konzeption, Verantwortung und Entscheidungen blieben dabei bei Menschen. Der Einsatz von KI berührt gesellschaftliche, kulturelle und politische Fragen und bedarf weiterhin offener, kritischer Diskussionen. ",
        )}
      </p>
      <p>
        {t(
          "„Ohne KI“ verwendet feste Vorlagen und erzeugt keine neuen KI-Texte. Beim externen Weg übermittelst du den Auftrag selbst an deine KI. Direkte KI-Ausgaben und importierte Antworten sind Vorschläge: Prüfe fachliche Richtigkeit und Eignung für deine Lehrveranstaltung. ",
        )}
      </p>
      <p>
        {t(
          "Die Herkunft des konkreten Arbeitsblatts wird am Dokument ausgewiesen. ",
        )}
      </p>
    </>
  );
}

export default function InfoPage({ page, online }) {
  return (
    <article className="panel info-page">
      <h1>{t(INFO_PAGES[page])}</h1>
      {page === "legal" && (
        <>
          <p>{t("Verantwortlich für den Spielkonfigurator")}</p>
          <ContactDetails />
          <p>
            {t("Spielkonfigurator by Harald Eckmüller. ")}
            <br />
            {t("Webapp-Umsetzung unterstützt durch LMB. ")}
          </p>
        </>
      )}
      {page === "privacy" && <PrivacyInfo online={online} />}
      {page === "help" && <HelpInfo />}
    </article>
  );
}
