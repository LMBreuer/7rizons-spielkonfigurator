import React, { useState } from "react";
import { translate } from "../supabase/functions/_shared/translations.js";

import {
  catalogFor,
  blockDefaults,
  learningFields,
  mechanicFields,
  validateContent,
} from "../supabase/functions/_shared/content.js";
import { t } from "./i18n.js";

const labels = {
  label: "Bezeichnung",
  desc: "Beschreibung",
  bloom: "Bloom-Taxonomie",
  fuer: "Anwendungsbereiche",
  hinweis: "Hinweis",
  kurz: "Kurzbeschreibung",
  kat: "Kategorie",
  questions: "Leitfragen",
  frame: "Schreibhilfe",
  example: "Aufklappbares Beispiel",
  introduction: "Einleitung",
  safety: "Safety-Rahmen",
  playtest: "Probelauf",
  revision: "Auswertung",
  closing: "Abschluss",
};

export default function ContentEditor({ published, onPublish, busy, act }) {
  const [edition, setEdition] = useState(published.content);
  const [section, setSection] = useState("learning");
  const [selected, setSelected] = useState("");
  const [lang, setLang] = useState("de");
  // Empty form fields are allowed while editing; validate the complete edition on publication.
  const catalog = catalogFor({ edition: published.content });
  const items = section === "mechanics" ? catalog.MK : catalog.LE;
  const patches = edition[section] || {};
  const ids = [
    ...new Set([...items.map((x) => x.id), ...Object.keys(patches)]),
  ];
  const id = ids.includes(selected) ? selected : ids[0];
  const original =
    section === "blocks"
      ? blockDefaults
      : (section === "mechanics" ? catalogFor().MK : catalogFor().LE).find(
          (x) => x.id === id,
        ) || {};
  const guide = section === "mechanics" ? catalogFor().guides[id] || {} : {};
  const patch = section === "blocks" ? patches : patches[id] || {};
  const value = { ...original, ...guide, ...patch };
  const fields =
    section === "blocks"
      ? Object.keys(blockDefaults)
      : section === "mechanics"
        ? mechanicFields
        : learningFields;
  function replace(next) {
    setEdition({
      ...edition,
      [section]: section === "blocks" ? next : { ...patches, [id]: next },
    });
  }
  function textChange(key, text) {
    replace(
      lang === "de"
        ? { ...patch, [key]: text }
        : { ...patch, en: { ...patch.en, [key]: text } },
    );
  }
  function add() {
    const key = (section === "learning" ? "l-" : "m-") + crypto.randomUUID();
    setEdition({
      ...edition,
      [section]: {
        ...patches,
        [key]:
          section === "learning"
            ? { label: t("Neues Lernerlebnis"), group: "inhalt" }
            : { label: t("Neue Mechanik"), w: {} },
      },
    });
    setLang("de");
    setSelected(key);
  }
  const goals = [
    ...new Set([
      ...catalog.LE.map((l) => l.id),
      ...Object.keys(edition.learning || {}),
    ]),
  ];
  return (
    <section className="panel">
      <h2>{t("Inhalte")}</h2>
      <p>
        {t(
          "Veröffentlichte Änderungen gelten für neue Projekte. Bestehende Projekte und Arbeitsblätter behalten ihre Inhaltsfassung.",
        )}
      </p>
      <div className="field-grid">
        <label>
          {t("Bereich")}
          <select
            value={section}
            onChange={(e) => {
              setSection(e.target.value);
              setSelected("");
            }}
          >
            <option value="learning">{t("Lernerlebnisse")}</option>
            <option value="mechanics">{t("Mechaniken")}</option>
            <option value="blocks">{t("Arbeitsblatttexte")}</option>
          </select>
        </label>
        <label>
          {t("Textsprache")}
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      {section !== "blocks" && (
        <>
          <label>
            {t("Eintrag")}
            <select value={id} onChange={(e) => setSelected(e.target.value)}>
              {ids.map((key) => (
                <option key={key} value={key}>
                  {patches[key]?.label ??
                    items.find((x) => x.id === key)?.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="button secondary" onClick={add}>
            {t(
              section === "learning"
                ? "Lernerlebnis hinzufügen"
                : "Mechanik hinzufügen",
            )}
          </button>
        </>
      )}
      <div className="field-grid">
        {fields.map((key) => (
          <label key={key}>
            {t(labels[key])}
            <textarea
              rows={["label", "kat", "kurz", "bloom"].includes(key) ? 1 : 3}
              maxLength={4000}
              value={
                lang === "de"
                  ? value[key] || ""
                  : (patch.en?.[key] ?? translate(value[key] || "", "en"))
              }
              onChange={(e) => textChange(key, e.target.value)}
            />
          </label>
        ))}
      </div>
      {section === "learning" && (
        <label>
          {t("Gruppe")}
          <select
            value={value.group || "inhalt"}
            onChange={(e) => replace({ ...patch, group: e.target.value })}
          >
            <option value="inhalt">{t("Inhaltlich")}</option>
            <option value="wiss">{t("Wissenschaftlich")}</option>
          </select>
        </label>
      )}
      {section === "mechanics" && (
        <>
          <label>
            <input
              type="checkbox"
              disabled={original.kern}
              checked={!!value.basis}
              onChange={(e) => replace({ ...patch, basis: e.target.checked })}
            />{" "}
            {t("Im Basisspiel vorhanden")}
          </label>
          <fieldset>
            <legend>{t("Zuordnung zu Lernerlebnissen")}</legend>
            <div className="field-grid">
              {goals.map((goal) => (
                <label key={goal}>
                  {edition.learning?.[goal]?.label ??
                    catalog.LE.find((l) => l.id === goal)?.label}
                  <select
                    value={value.w?.[goal] || ""}
                    onChange={(e) => {
                      const w = { ...value.w };
                      if (e.target.value) w[goal] = e.target.value;
                      else delete w[goal];
                      replace({ ...patch, w });
                    }}
                  >
                    <option value="">{t("Keine Zuordnung")}</option>
                    <option value="P">{t("Primär")}</option>
                    <option value="S">{t("Unterstützend")}</option>
                    {value.w?.[goal] === "~" && (
                      <option value="~">{t("Reibung")}</option>
                    )}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {section !== "blocks" && !original.kern && (
        <label>
          <input
            type="checkbox"
            checked={!!patch.archived}
            onChange={(e) => replace({ ...patch, archived: e.target.checked })}
          />{" "}
          {t("In neuen Projekten ausblenden")}
        </label>
      )}
      <button
        type="button"
        className="button"
        disabled={busy || edition === published.content}
        onClick={() => act(() => onPublish(validateContent(edition)))}
      >
        {t("Inhalte veröffentlichen")}
      </button>
    </section>
  );
}
