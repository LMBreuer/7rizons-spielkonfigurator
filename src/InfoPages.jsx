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
            "Ihre eingegebenen Seminardaten, Spielauswahl, Arbeitsblätter und Kartentexte werden automatisch in diesem Browser gespeichert. Dazu kommen die Darstellungs- und Spracheinstellungen, bei Anmeldung die Sitzung und bei einer offenen Workshop-Einladung der Code. Browserdaten können Sie in den Einstellungen des Browsers löschen. Eine heruntergeladene JSON-Datei bleibt bei Ihnen.",
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
                "Supabase verarbeitet Ihre E-Mail-Adresse, eine Konto-ID und technische Anmeldedaten, damit Sie sich anmelden und auf Ihre Online-Projekte zugreifen können. Der Mailversanddienst erhält die Adresse für den Versand des Magic Links. Die Hauptdatenbank des Projekts liegt in Irland.",
              )}
            </li>
            <li>
              {t(
                "Die Superadministration sieht die E-Mail-Adressen bestätigter Konten und verwaltet Administrationsrechte. Die Administration und die jeweilige Workshopmoderation sehen E-Mail-Adresse und Rolle der Mitglieder des Workshops.",
              )}
            </li>
            <li>
              <strong>{t("Beim Online-Speichern.")}</strong>{" "}
              {t(
                "Der gespeicherte Stand umfasst Ihre Eingaben, Auswahl, Arbeitsblätter und Kartentexte, gegebenenfalls einen vorbereiteten KI-Auftrag sowie Projekt-ID, Version und Änderungszeitpunkt. Der Stand ist Ihrem Konto zugeordnet. Die Superadministration sieht Projekttitel und Änderungsdatum. Für eine Freigabeanfrage kann sie einen Mailentwurf an Ihre Konto-Adresse öffnen. Eine Kopie der Inhalte erhält sie nach bestätigter Freigabe.",
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
                "Wenn Sie ein Projekt einem Workshop zuordnen, sieht dessen Moderation den Titel und das Änderungsdatum. Bei einer Abgabe erhält sie zusätzlich eine Kopie des ausgewählten Arbeitsblatts samt Kontextangaben.",
              )}
            </li>
            <li>
              {t(
                "Wer einen von Ihnen erstellten Freigabelink hat, kann den freigegebenen Projektstand samt Arbeitsblättern ohne Anmeldung ansehen, herunterladen oder als eigenes Projekt übernehmen.",
              )}
            </li>
          </ul>
          <p>
            {t(
              "Sie können Freigaben widerrufen und Abgaben zurückziehen. Bereits heruntergeladene oder übernommene Kopien bleiben bei den Empfänger:innen.",
            )}
          </p>
        </>
      )}
      <h2>{t("Was wird an KI-Anbieter übermittelt?")}</h2>
      <p>
        {t(
          "Bei einem direkten KI-Aufruf bekommt der ausgewählte Anbieter OpenAI, Anthropic (Claude) oder Google (Gemini) den Auftrag mit Thema, Fach, Lerntätigkeiten und gewählten Spielmechaniken. Die Felder für Name der Lehrveranstaltung, Dozent:in, Semester und Datum sowie Ihre vorhandenen Kartentexte gehen nicht in den Auftrag ein. Verwenden Sie auch in Thema und Fach keine vertraulichen oder personenbezogenen Angaben, die der Anbieter nicht erhalten soll.",
        )}
      </p>
      <p>
        {t(
          "Ihren für eine Sitzung eingegebenen API-Key verwendet das Backend für den Aufruf. In der Administration hinterlegte Keys werden verschlüsselt gespeichert. Zur Durchsetzung der Kontingente erfasst der Konfigurator Zeitpunkt, Konto-ID und gegebenenfalls die Workshop-ID eines Generierungsversuchs. Welche Daten der Anbieter weiterverarbeitet und wie lange er sie aufbewahrt, hängt vom Anbieter und den Kontoeinstellungen ab.",
        )}
      </p>
      <p>
        {t(
          "Bei „Mit Ihrer KI-App“ kopieren Sie den Auftrag oder laden ihn herunter und entscheiden selbst, wem Sie ihn senden. „Ohne KI“ erstellt das Arbeitsblatt aus Vorlagen, ohne einen KI-Anbieter aufzurufen.",
        )}
      </p>
      {online && (
        <>
          <h2>{t("Löschung und Ihre Rechte")}</h2>
          <p>
            {t(
              "Online-Projekte bleiben bis zur Löschung unter „Konto → Meine Entwürfe“ gespeichert. Workshop-Abgaben bleiben bis zum Zurückziehen oder zur administrativen Bereinigung gespeichert. Das Konto und die Generierungszähler bleiben bis zur Kontolöschung oder administrativen Bereinigung bestehen. Für die Löschung Ihres Kontos wenden Sie sich an die oben genannte Adresse.",
            )}
          </p>
        </>
      )}
      <p>
        {t(
          "Sie können sich für Auskunft, Berichtigung und Löschung an die oben genannte Adresse wenden. Je nach Voraussetzungen können Sie die Verarbeitung einschränken lassen, ihr widersprechen oder Ihre Daten übertragen lassen. Sie können sich bei einer Datenschutzaufsichtsbehörde beschweren.",
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
            "Geben Sie den Seminarkontext ein, wählen Sie Lerntätigkeiten und Mechaniken und legen Sie ihre Reihenfolge in der Übersicht fest.",
          )}
        </li>
        <li>
          {t(
            "Schritt 5 öffnet das Arbeitsblatt zu Ihrer Auswahl. Fügen Sie Spielkarten mit Titel, Kartentext, Randfarbe und Notizen hinzu. Am Ende des Blatts ist Platz für Notizen zum Probelauf.",
          )}
        </li>
        <li>
          {t(
            "Unter „Projekte“ können Sie Ihr ganzes Projekt als JSON-Datei herunterladen und später wieder importieren. Am Arbeitsblatt öffnet „Drucken“ die A4-Druckvorschau des Browsers. Dort können Sie das Blatt auch als PDF speichern. „Karten drucken“ öffnet einen separaten Bogen zum Ausschneiden. Die Notizen stehen im Arbeitsblatt. Im Drei-Punkte-Menü finden Sie den Markdown-Export.",
          )}
        </li>
      </ol>
      <h2>{t("Online speichern, am Workshop teilnehmen und teilen")}</h2>
      <p>
        {t(
          "Melden Sie sich über „Anmelden“ per E-Mail an, wenn Sie auf einem anderen Gerät weiterarbeiten möchten. Speichern Sie über „Online speichern“ und öffnen Sie den Stand dort unter „Konto → Meine Entwürfe“.",
        )}
      </p>
      <p>
        {t(
          "Öffnen Sie Ihren Einladungslink oder scannen Sie den QR-Code und bestätigen Sie den Workshopbeitritt. Einen Zugangscode können Sie unter „Konto“ eingeben. Danach können Sie unter „Projekte“ ein Projekt zuordnen oder in Schritt 5 ein Arbeitsblatt ausdrücklich abgeben. Wenn Workshop-KI freigeschaltet ist, können Sie nach dem Beitritt diesen Zugang nutzen.",
        )}
      </p>
      <p>
        {t(
          "Öffnen Sie das gewünschte Projekt und wählen Sie „Teilen“. Mit „Freigabelink erstellen“ geben Sie diesen Stand samt Arbeitsblättern frei. Spätere Änderungen bleiben privat, bis Sie den Link ersetzen.",
        )}
      </p>
      <h2 id="urheberrecht">{t("Eigene Karten und fremde Materialien")}</h2>
      <p>
        {t(
          "Die Rechte an Ihren eigenen Kartentexten bleiben bei Ihnen. Wer Ihren Projektlink erhält, kann eine Kopie für das eigene Seminar anlegen. Wenn Sie Ihre Karten darüber hinaus zur Veröffentlichung freigeben möchten, können Sie das direkt auf dem Arbeitsblatt vermerken.",
        )}
      </p>
      <p>
        {t(
          "Übernehmen Sie Texte, Bilder oder Spielmaterial von anderen, gelten deren Nutzungsbedingungen auch im geteilten Arbeitsblatt. Geben Sie Quelle und Lizenz so an, wie es das Material verlangt.",
        )}
      </p>
      <p>
        <a href="?modus=selbststudium">
          {t("Separate Variante mit KI-Optionen öffnen")}
        </a>
      </p>
      <h2 id="ki">{t("KI-Hinweis")}</h2>
      <p>
        {t(
          "Für die Entwicklung des ursprünglichen Spielkonfigurators und seine Umsetzung als Webapp wurde generative KI eingesetzt. Konzeption, Verantwortung und Entscheidungen blieben dabei bei Menschen. Der Einsatz von KI berührt gesellschaftliche, kulturelle und politische Fragen und bedarf weiterhin offener, kritischer Diskussionen. ",
        )}
      </p>
      <p>
        {t(
          "„Ohne KI“ verwendet feste Vorlagen und erzeugt keine neuen KI-Texte. Beim externen Weg übermitteln Sie den Auftrag selbst an Ihre KI. Direkte KI-Ausgaben und importierte Antworten sind Vorschläge: Prüfen Sie fachliche Richtigkeit und Eignung für Ihre Lehrveranstaltung. ",
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
