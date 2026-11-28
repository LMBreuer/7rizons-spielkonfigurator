import React, { useId, useState } from "react";
import { t } from "./i18n.js";

function VersionSummary({ label, version, modifiedAt, language, name }) {
  const { draft, worksheets } = version;
  const sheets = worksheets ?? (version.result ? [{ result: version.result }] : []);
  return (
    <div className="sync-version">
      <h3>{label}</h3>
      {modifiedAt && Number.isFinite(Date.parse(modifiedAt)) && (
        <time dateTime={modifiedAt}>
          {new Date(modifiedAt).toLocaleString(
            language === "en" ? "en-GB" : "de-AT",
            { dateStyle: "short", timeStyle: "short" },
          )}
        </time>
      )}
      <strong>{name || version.projectName || draft.context.thema || draft.context.name || t("Unbenanntes Projekt")}</strong>
      {sheets.length ? (
        <details className="sync-version-sheets" open={sheets.length <= 4}>
          <summary>
            {sheets.length === 1 ? t("1 Arbeitsblatt") : t("{0} Arbeitsblätter", { 0: sheets.length })}
          </summary>
          <ul>
            {sheets.map((sheet, index) => (
              <li key={sheet.id || index}>{sheet.result.title}</li>
            ))}
          </ul>
        </details>
      ) : (
        <span className="sync-version-sheets">{t("0 Arbeitsblätter")}</span>
      )}
    </div>
  );
}

export default function VersionComparison({ local, remote, worksheetOnly, language, busy, onChoose }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="sync-offer no-print" aria-labelledby={id}>
      <div className="sync-offer-heading">
        <h2 id={id} aria-live="polite">
          {t(remote.revision > local.cloudRevision
            ? "Neuere Online-Version verfügbar"
            : "Ein anderer Online-Stand ist verfügbar")}
        </h2>
        <button
          type="button"
          className="text-button"
          aria-expanded={open}
          aria-controls={id + "-versions"}
          onClick={() => setOpen(!open)}
        >
          {t(open ? "Vergleich schließen" : "Versionen vergleichen")}
        </button>
      </div>
      <div id={id + "-versions"} className="sync-compare" hidden={!open}>
        <div className="sync-versions">
          <VersionSummary label={t("Auf diesem Gerät")} version={local} modifiedAt={local.modifiedAt} language={language} />
          <VersionSummary label={t("Online-Version {0}", { 0: remote.revision })} version={remote.payload} modifiedAt={remote.updated_at} language={language} name={remote.title} />
        </div>
        <div className="sync-choices">
          {[
            ["keep-both", t("Beide behalten"), worksheetOnly
              ? t("Arbeitsblätter zusammenführen und im selben Projekt speichern.")
              : t("Die lokale Fassung als eigenes Online-Projekt speichern.")],
            ["discard-local", t("Lokale Änderungen verwerfen"), t("Die Online-Version auf diesem Gerät öffnen.")],
            ["keep-local", t("Lokalen Stand behalten"), t("Die Online-Version durch den lokalen Stand ersetzen.")],
          ].map(([choice, label, detail]) => (
            <div className="sync-choice" key={choice}>
              <button
                type="button"
                className={choice === "keep-both" ? "button" : "button secondary"}
                aria-describedby={id + "-" + choice}
                disabled={busy}
                onClick={() => onChoose(choice, setError)}
              >
                {label}
              </button>
              <p id={id + "-" + choice}>{detail}</p>
            </div>
          ))}
        </div>
        {error && <p className="sync-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
