import React, { useEffect, useState } from "react";
import { cloud, unwrap } from "./cloud.js";
import { t } from "./i18n.js";
import ContentEditor from "./ContentEditor.jsx";

export default function ContentLibrary({ act, busy, message, dirtyRef }) {
  const [rows, setRows] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [defaultId, setDefaultId] = useState("");
  const [current, setCurrent] = useState(null);
  const [copy, setCopy] = useState(null);
  const [ready, setReady] = useState(false);
  async function refresh() {
    const [editions, settings, uses] = await Promise.all([
      cloud
        .from("content_editions")
        .select("id,title,revision,is_public")
        .order("title"),
      cloud.from("app_settings").select("default_edition_id").single(),
      cloud.from("workshops").select("id,title,edition_id").order("title"),
    ]);
    const next = [unwrap(editions), unwrap(settings), unwrap(uses)];
    setRows(next[0]);
    setDefaultId(next[1].default_edition_id);
    setWorkshops(next[2]);
    setReady(true);
  }
  useEffect(() => {
    act(refresh);
  }, []);
  async function edit(id) {
    setCurrent(
      unwrap(
        await cloud
          .from("content_editions")
          .select("id,title,revision,content")
          .eq("id", id)
          .single(),
      ),
    );
    setCopy(null);
  }
  if (current)
    return (
      <ContentEditor
        key={current.id}
        dirtyRef={dirtyRef}
        published={current}
        busy={busy}
        act={act}
        onBack={() => {
          setCurrent(null);
          act(refresh);
        }}
        onPublish={async (content, title) => {
          const revision = unwrap(
            await cloud.rpc("publish_content_edition", {
              p_id: current.id,
              p_revision: current.revision,
              p_title: title,
              p_content: content,
            }),
          );
          setCurrent({ ...current, revision, content, title });
          message(t("Änderungen gespeichert."));
        }}
      />
    );
  return (
    <section className="edition-library">
      <div className="editor-heading">
        <div>
          <h1>{t("Inhalte")}</h1>
          <p className="muted">
            {t(
              "Eine Inhaltsfassung bündelt Lernerlebnisse, Mechaniken und Arbeitsblatttexte für neue Projekte.",
            )}
          </p>
        </div>
        {ready && (
          <button
            className="button"
            disabled={busy || !!copy}
            onClick={() => setCopy({ source: defaultId, title: "" })}
          >
            {t("Neue Fassung")}
          </button>
        )}
      </div>
      {copy && (
        <form
          className="editor-create panel"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const id = unwrap(
                await cloud.rpc("copy_content_edition", {
                  p_source: copy.source,
                  p_revision: rows.find((r) => r.id === copy.source).revision,
                  p_title: copy.title.trim(),
                }),
              );
              setCopy(null);
              await edit(id);
            });
          }}
        >
          <h2>{t("Neue Fassung")}</h2>
          <div className="field-grid">
            <label>
              {t("Name der Fassung")}
              <input
                required
                autoFocus
                maxLength={100}
                value={copy.title}
                onChange={(e) => setCopy({ ...copy, title: e.target.value })}
              />
            </label>
            <label>
              {t("Kopieren von")}
              <select
                value={copy.source}
                onChange={(e) => setCopy({ ...copy, source: e.target.value })}
              >
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="actions">
            <button className="button" disabled={busy || !copy.title.trim()}>
              {t("Fassung anlegen")}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => setCopy(null)}
            >
              {t("Abbrechen")}
            </button>
          </div>
        </form>
      )}
      <section className="panel edition-list">
        <h2>{t("Inhaltsfassungen")}</h2>
        <p className="muted">
          {t(
            "Öffentliche Fassungen stehen bei Organisatorisches zur Auswahl. Neue Projekte starten mit der Standardfassung. Workshops können eine eigene Fassung verwenden.",
          )}
        </p>
        {!ready && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => act(refresh)}
          >
            {t("Fassungen laden")}
          </button>
        )}
        {rows.map((row) => {
          const isDefault = row.id === defaultId;
          const uses = workshops.filter(
            (w) => (w.edition_id || defaultId) === row.id,
          );
          return (
            <div className="edition-row" key={row.id}>
              <div>
                <h3>
                  {row.title}{" "}
                  {isDefault && (
                    <span className="edition-default">{t("Standard")}</span>
                  )}
                </h3>
                <small className="muted">
                  {uses.length
                    ? uses.map((w) => w.title).join(" · ")
                    : t("Keinem Workshop zugewiesen")}
                </small>
              </div>
              <div className="actions">
                <label className="checkbox edition-visibility">
                  <input
                    type="checkbox"
                    checked={row.is_public}
                    disabled={busy || isDefault}
                    aria-label={t("„{0}“ öffentlich auswählbar", { 0: row.title })}
                    onChange={(event) => {
                      const isPublic = event.target.checked;
                      act(async () => {
                        unwrap(
                          await cloud.rpc("set_edition_visibility", {
                            p_id: row.id,
                            p_public: isPublic,
                          }),
                        );
                        await refresh();
                      });
                    }}
                  />
                  {t("Öffentlich auswählbar")}
                </label>
                {!isDefault && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        if (
                          !window.confirm(
                            t(
                              "„{0}“ öffentlich verfügbar machen und als Standard für neue Projekte und Workshops ohne eigene Fassung setzen?",
                              { 0: row.title },
                            ),
                          )
                        )
                          return;
                        unwrap(
                          await cloud.rpc("choose_default_edition", {
                            p_id: row.id,
                          }),
                        );
                        await refresh();
                      })
                    }
                  >
                    {t("Als Standard setzen")}
                  </button>
                )}
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => act(() => edit(row.id))}
                >
                  {t("Bearbeiten")}
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </section>
  );
}
