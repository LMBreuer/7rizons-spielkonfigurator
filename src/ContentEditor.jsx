import React, { useEffect, useState } from "react";
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

export default function ContentEditor({
  published,
  onPublish,
  onBack,
  busy,
  act,
  dirtyRef,
}) {
  const [edition, setEdition] = useState(published.content);
  const [section, setSection] = useState("learning");
  const [selected, setSelected] = useState("");
  const [lang, setLang] = useState("de");
  const [title, setTitle] = useState(published.title);
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState(false);
  const dirty =
    edition !== published.content || title.trim() !== published.title;
  useEffect(() => {
    dirtyRef.current = dirty;
    if (!dirty) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      dirtyRef.current = false;
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);
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
  const sections = {
    learning: "Lernerlebnisse",
    mechanics: "Mechaniken",
    blocks: "Arbeitsblatttexte",
  };
  const nameOf = (key) =>
    (lang === "en" ? patches[key]?.en?.label : undefined) ??
    translate(
      patches[key]?.label ?? items.find((x) => x.id === key)?.label ?? key,
      lang,
    );
  const matches = ids.filter((key) =>
    nameOf(key).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const blockKey = Object.hasOwn(blockDefaults, selected)
    ? selected
    : "introduction";
  function textField(key) {
    const props = {
      maxLength: 4000,
      value:
        lang === "de"
          ? value[key] || ""
          : (patch.en?.[key] ?? translate(value[key] || "", "en")),
      onChange: (e) => textChange(key, e.target.value),
    };
    return (
      <label key={key}>
        {t(labels[key])}
        {["label", "kat", "bloom"].includes(key) &&
        !props.value.includes("\n") ? (
          <input {...props} />
        ) : (
          <textarea {...props} rows={section === "blocks" ? 5 : 3} />
        )}
      </label>
    );
  }
  return (
    <section className="edition-editor">
      <button
        type="button"
        className="text-button"
        onClick={() => {
          if (
            !dirty ||
            window.confirm(t("Unveröffentlichte Änderungen verwerfen?"))
          )
            onBack();
        }}
      >
        ← {t("Inhaltsfassungen")}
      </button>
      <div className="editor-heading">
        <div className="editor-title">
          <h1>{published.title}</h1>
          <button
            type="button"
            className="text-button"
            aria-expanded={renaming}
            onClick={() => setRenaming(!renaming)}
          >
            {t("Umbenennen")}
          </button>
          {renaming && (
            <label>
              {t("Name der Fassung")}
              <input
                autoFocus
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
          )}
        </div>
        <button
          type="button"
          className="button"
          disabled={busy || !dirty || !title.trim()}
          onClick={() =>
            act(() => onPublish(validateContent(edition), title.trim()))
          }
        >
          {t("Inhalte veröffentlichen")}
        </button>
      </div>
      <nav className="admin-tabs" aria-label={t("Inhaltsbereiche")}>
        {Object.entries(sections).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-current={section === key ? "page" : undefined}
            onClick={() => {
              setSection(key);
              setSelected("");
              setQuery("");
            }}
          >
            {t(label)}
          </button>
        ))}
      </nav>
      <div className="editor-workspace">
        <aside className="editor-index">
          {section !== "blocks" && (
            <label>
              {t("Einträge suchen")}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          )}
          <div className="editor-items" role="group" aria-label={t("Eintrag")}>
            {(section === "blocks" ? Object.keys(blockDefaults) : matches).map(
              (key) => (
                <button
                  type="button"
                  key={key}
                  aria-current={
                    key === (section === "blocks" ? blockKey : id)
                      ? "true"
                      : undefined
                  }
                  onClick={() => setSelected(key)}
                >
                  {section === "blocks" ? t(labels[key]) : nameOf(key)}
                  {patches[key]?.archived && " · " + t("Ausgeblendet")}
                </button>
              ),
            )}
            {section !== "blocks" && !matches.length && (
              <p>{t("Keine passenden Einträge.")}</p>
            )}
          </div>
          {section !== "blocks" && (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setQuery("");
                add();
              }}
            >
              +{" "}
              {t(
                section === "learning"
                  ? "Lernerlebnis hinzufügen"
                  : "Mechanik hinzufügen",
              )}
            </button>
          )}
        </aside>
        <section className="panel editor-detail">
          <div className="editor-heading">
            <h2>{section === "blocks" ? t(labels[blockKey]) : nameOf(id)}</h2>
            <label>
              {t("Textsprache")}
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <div className="editor-fields">
            {(section === "blocks"
              ? [blockKey]
              : fields.filter(
                  (key) => !["frame", "example", "questions"].includes(key),
                )
            ).map(textField)}
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
                  onChange={(e) =>
                    replace({ ...patch, basis: e.target.checked })
                  }
                />{" "}
                {t("Im Basisspiel vorhanden")}
              </label>
              <details className="edition-options">
                <summary>{t("Arbeitsaufträge und Beispiele")}</summary>
                <div className="editor-fields">
                  {["questions", "frame", "example"].map(textField)}
                </div>
              </details>
              <details className="edition-options">
                <summary>{t("Zuordnung zu Lernerlebnissen")}</summary>
                <fieldset>
                  <legend className="sr-only">
                    {t("Zuordnung zu Lernerlebnissen")}
                  </legend>
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
              </details>
            </>
          )}
          {section !== "blocks" && !original.kern && (
            <label>
              <input
                type="checkbox"
                checked={!!patch.archived}
                onChange={(e) =>
                  replace({ ...patch, archived: e.target.checked })
                }
              />{" "}
              {t("In neuen Projekten ausblenden")}
            </label>
          )}
        </section>
      </div>
    </section>
  );
}
